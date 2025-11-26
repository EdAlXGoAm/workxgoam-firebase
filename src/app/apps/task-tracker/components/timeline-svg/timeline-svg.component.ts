import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, HostListener, ViewChild, ElementRef, AfterViewInit, OnDestroy, ChangeDetectorRef, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { Environment } from '../../models/environment.model';
import { TaskType } from '../../models/task-type.model';
import { Project } from '../../models/project.model';
import { TimelineFocusService } from '../../services/timeline-focus.service';
import { ProjectService } from '../../services/project.service';
import { GestureService, GestureEvent, GestureConfig } from '../../services/gesture.service';
import { TaskTimeService } from '../../services/task-time.service';
import { AndroidDatePickerComponent } from '../android-date-picker/android-date-picker.component';
import { TimeShiftModalComponent, TimeShiftResult } from '../../modals/time-shift-modal/time-shift-modal.component';
import { DurationEditModalComponent, DurationEditResult } from '../../modals/duration-edit-modal/duration-edit-modal.component';
import { Subscription } from 'rxjs';

// Interfaz para elementos renderizables (tareas o fragmentos)
interface RenderableItem {
  type: 'task' | 'fragment';
  task: Task;
  fragmentIndex?: number;
  start: string;
  end: string;
}

@Component({
  selector: 'app-timeline-svg',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    AndroidDatePickerComponent,
    TimeShiftModalComponent,
    DurationEditModalComponent
  ],
  templateUrl: './timeline-svg.component.html',
  styleUrls: ['./timeline-svg.component.css']
})
export class TimelineSvgComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() tasks: Task[] = [];
  @Input() environments: Environment[] = [];
  @Input() taskTypes: TaskType[] = [];
  @Input() projects: Project[] = [];
  
  private loadedProjects: Project[] = [];
  
  focusedEnvironmentId: string | null = null;
  private focusSubscription?: Subscription;
  private gestureSubscription?: Subscription;
  private gestureCleanups: (() => void)[] = [];

  // Estado de previsualización (sombra ghost)
  previewState = {
    visible: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    section: 0
  };

  constructor(
    private cdr: ChangeDetectorRef,
    private timelineFocusService: TimelineFocusService,
    private projectService: ProjectService,
    private gestureService: GestureService,
    private taskTimeService: TaskTimeService
  ) {}

  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<Task>();
  @Output() toggleHidden = new EventEmitter<Task>();
  @Output() changeStatus = new EventEmitter<{ task: Task; status: 'pending' | 'in-progress' | 'completed' }>();
  @Output() taskUpdated = new EventEmitter<Task>();

  @ViewChild('containerRef') containerRef!: ElementRef<HTMLDivElement>;
  @ViewChildren('taskRect') taskRects!: QueryList<ElementRef<SVGRectElement>>;
  @ViewChildren('resizeHandleStart') resizeHandlesStart!: QueryList<ElementRef<SVGRectElement>>;
  @ViewChildren('resizeHandleEnd') resizeHandlesEnd!: QueryList<ElementRef<SVGRectElement>>;

  // 📅 NAVEGACIÓN DE FECHAS
  selectedDate: Date = new Date();
  
  // 💡 SISTEMA DE TOOLTIP
  showTooltip: boolean = false;
  tooltipTask: Task | null = null;
  tooltipTimeout: any = null;

  // 📱 SISTEMA DE MENÚ CONTEXTUAL
  showContextMenu: boolean = false;
  contextMenuTask: Task | null = null;
  contextMenuX: number = 0;
  contextMenuY: number = 0;

  // 🔄 MODALES DE GESTOS
  showTimeShiftModal: boolean = false;
  timeShiftTask: Task | null = null;
  timeShiftFragmentIndex: number | null = null;
  suggestedShiftDirection: 'forward' | 'backward' = 'forward';
  suggestedShiftMinutes: number = 0;

  showDurationModal: boolean = false;
  durationTask: Task | null = null;
  durationFragmentIndex: number | null = null;
  suggestedAdjustStart: boolean = false;
  suggestedDurationMinutes: number = 0;

  // Propiedades de dimensiones responsive
  svgWidth = 600;
  minSvgWidth = 320;
  sectionHeight = 100;
  svgHeight = this.sectionHeight * 3;

  private widthScale: number = 0.7;

  // Tamaños de fuente responsivos
  titleFontSize = 12;
  hourFontSize = 10;
  taskFontSize = 12;

  private resizeObserver?: ResizeObserver;
  private containerPadding = 16;

  private hourOffsetStart = 25;
  private hourOffsetEnd = 25;

  hoursPerSection: number[][] = [
    Array.from({length: 9}, (_, i) => i),
    Array.from({length: 9}, (_, i) => i + 8),
    Array.from({length: 9}, (_, i) => i + 16)
  ];

  // Configuración de gestos para este timeline (horizontal)
  private gestureConfig: Partial<GestureConfig> = {
    direction: 'horizontal',
    enableResize: true,
    dragThreshold: 15,
    resizeZoneWidth: 12
  };

  // Píxeles por hora (calculado dinámicamente)
  get pixelsPerHour(): number {
    const effectiveWidth = this.svgWidth - this.hourOffsetStart - this.hourOffsetEnd;
    return effectiveWidth / 8; // 8 horas por sección
  }
  
  private parseUTCToLocal(dateTimeString: string): Date {
    const utcString = dateTimeString + (dateTimeString.includes('Z') ? '' : 'Z');
    return new Date(utcString);
  }

  trackByRenderableItem(index: number, item: RenderableItem): string {
    return item.task.id + '-' + (item.fragmentIndex ?? 'main') + '-' + item.start;
  }

  async ngOnInit() {
    try {
      this.loadedProjects = await this.projectService.getProjects();
    } catch (error) {
      console.error('Error al cargar proyectos:', error);
      this.loadedProjects = [];
    }
    
    if (this.projects.length > 0) {
      this.loadedProjects = this.projects;
    }
    
    this.focusedEnvironmentId = this.timelineFocusService.getCurrentFocusedEnvironmentId();
    this.focusSubscription = this.timelineFocusService.getFocusedEnvironmentId().subscribe(envId => {
      const changed = this.focusedEnvironmentId !== envId;
      this.focusedEnvironmentId = envId;
      if (changed) {
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        this.updateSvgDimensions();
      }
    });

    // Suscribirse a eventos de gestos
    this.gestureSubscription = this.gestureService.gestures$.subscribe(event => {
      this.handleGestureEvent(event);
    });
    
    this.updateSvgDimensions();
  }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['projects'] && this.projects.length > 0) {
      this.loadedProjects = this.projects;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      this.updateSvgDimensions();
    }
    
    // Re-registrar gestos cuando cambian las tareas
    if (changes['tasks']) {
      setTimeout(() => this.registerTaskGestures(), 100);
    }
  }

  ngAfterViewInit() {
    this.initializeResizeObserver();
    setTimeout(() => {
      this.updateSvgDimensions();
      this.registerTaskGestures();
    }, 100);

    // Observar cambios en los rectángulos de tareas
    this.taskRects.changes.subscribe(() => {
      this.registerTaskGestures();
    });
  }

  /**
   * Registrar gestos en todos los rectángulos de tareas
   */
  private registerTaskGestures(): void {
    // Limpiar registros anteriores
    this.gestureCleanups.forEach(cleanup => cleanup());
    this.gestureCleanups = [];

    const handlesStart = this.resizeHandlesStart ? this.resizeHandlesStart.toArray() : [];
    const handlesEnd = this.resizeHandlesEnd ? this.resizeHandlesEnd.toArray() : [];

    // Registrar gestos en cada rectángulo de tarea
    this.taskRects.forEach((rectRef, index) => {
      const rect = rectRef.nativeElement;
      const taskId = rect.getAttribute('data-task-id');
      const fragmentIndexStr = rect.getAttribute('data-fragment-index');
      const sectionStr = rect.getAttribute('data-section');
      const fragmentIndex = fragmentIndexStr ? parseInt(fragmentIndexStr, 10) : undefined;
      const section = sectionStr ? parseInt(sectionStr, 10) : 0;

      if (taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
          const data = { task, fragmentIndex, section };
          
          // 1. Registrar tarea PRINCIPAL solo para DRAG (disable resize detection on edges)
          const cleanupTask = this.gestureService.registerElement(rect, data, {
            ...this.gestureConfig,
            enableResize: false // Deshabilitar detección automática de resize en la tarea
          });
          this.gestureCleanups.push(cleanupTask);

          // 2. Registrar Handle Inicio (Resize Start)
          const handleStart = handlesStart[index]?.nativeElement;
          if (handleStart) {
            const cleanupStart = this.gestureService.registerElement(handleStart, data, {
              ...this.gestureConfig,
              enableResize: true,
              fixedResizeEdge: 'start'
            });
            this.gestureCleanups.push(cleanupStart);
          }

          // 3. Registrar Handle Fin (Resize End)
          const handleEnd = handlesEnd[index]?.nativeElement;
          if (handleEnd) {
            const cleanupEnd = this.gestureService.registerElement(handleEnd, data, {
              ...this.gestureConfig,
              enableResize: true,
              fixedResizeEdge: 'end'
            });
            this.gestureCleanups.push(cleanupEnd);
          }
        }
      }
    });
  }

  /**
   * Manejar eventos de gestos
   */
  private handleGestureEvent(event: GestureEvent): void {
    if (!event.data?.task) return;

    const task: Task = event.data.task;
    const fragmentIndex: number | undefined = event.data.fragmentIndex;
    const section: number = event.data.section || 0;

    // Fase MOVE: Actualizar previsualización (sombra)
    if (event.phase === 'move') {
      this.updatePreview(task, fragmentIndex, section, event);
      return;
    }

    // Fase END: Ejecutar acción y limpiar
    if (event.phase === 'end') {
      this.previewState.visible = false;
      this.cdr.detectChanges();

      switch (event.type) {
        case 'drag-left':
        case 'drag-right':
          this.openTimeShiftModal(task, fragmentIndex, event);
          break;

        case 'resize-start':
        case 'resize-end':
          this.openDurationModal(task, fragmentIndex, event);
          break;

        case 'tap':
          this.showTaskTooltip(task);
          break;

        case 'double-tap':
          this.editTask.emit(task);
          break;

        case 'long-press':
        case 'contextmenu':
          this.showTaskContextMenu(task, event.endX, event.endY);
          break;
      }
    }
  }

  /**
   * Actualizar la sombra de previsualización durante el gesto
   */
  private updatePreview(task: Task, fragmentIndex: number | undefined, section: number, event: GestureEvent): void {
    let item: RenderableItem;
    
    if (fragmentIndex !== undefined && task.fragments && task.fragments[fragmentIndex]) {
        const f = task.fragments[fragmentIndex];
        item = { type: 'fragment', task, fragmentIndex, start: f.start, end: f.end };
    } else {
        item = { type: 'task', task, start: task.start, end: task.end };
    }

    const originalX = this.getItemX(item, section);
    const originalWidth = this.getItemWidth(item, section);
    
    let newX = originalX;
    let newWidth = originalWidth;

    if (event.type === 'drag-left' || event.type === 'drag-right') {
        newX += event.deltaX;
    } else if (event.type === 'resize-start') {
        newX += event.deltaX;
        newWidth -= event.deltaX;
    } else if (event.type === 'resize-end') {
        newWidth += event.deltaX;
    }

    this.previewState = {
        visible: true,
        x: newX,
        y: 20,
        width: Math.max(5, newWidth),
        height: 40,
        section: section
    };
    
    this.cdr.detectChanges();
  }

  /**
   * Abrir modal de desplazamiento de tiempo
   */
  private openTimeShiftModal(task: Task, fragmentIndex: number | undefined, event: GestureEvent): void {
    this.hideTooltip();
    this.closeContextMenu();

    const direction = event.type === 'drag-right' ? 'forward' : 'backward';
    const suggestedMinutes = this.gestureService.calculateTimeShift(
      Math.abs(event.deltaX),
      this.pixelsPerHour,
      15
    );

    this.timeShiftTask = task;
    this.timeShiftFragmentIndex = fragmentIndex ?? null;
    this.suggestedShiftDirection = direction;
    this.suggestedShiftMinutes = Math.max(15, suggestedMinutes);
    this.showTimeShiftModal = true;
    this.cdr.detectChanges();
  }

  /**
   * Abrir modal de edición de duración
   */
  private openDurationModal(task: Task, fragmentIndex: number | undefined, event: GestureEvent): void {
    this.hideTooltip();
    this.closeContextMenu();

    this.durationTask = task;
    this.durationFragmentIndex = fragmentIndex ?? null;
    this.suggestedAdjustStart = event.type === 'resize-start';
    
    // Calcular duración sugerida
    let currentDuration = 0;
    if (fragmentIndex !== undefined && task.fragments && task.fragments[fragmentIndex]) {
        currentDuration = this.taskTimeService.getFragmentDurationMinutes(task, fragmentIndex);
    } else {
        currentDuration = this.taskTimeService.getTaskDurationMinutes(task);
    }

    // Ajustar pixels según dirección de resize
    let pixels = event.deltaX;
    if (event.type === 'resize-start') {
        pixels = -event.deltaX;
    }

    this.suggestedDurationMinutes = this.gestureService.calculateDurationChange(
        currentDuration,
        pixels,
        this.pixelsPerHour,
        15
    );

    this.showDurationModal = true;
    this.cdr.detectChanges();
  }

  /**
   * Confirmar desplazamiento de tiempo
   */
  async onTimeShiftConfirm(result: TimeShiftResult): Promise<void> {
    if (!result.confirmed || !this.timeShiftTask || !result.minutes) {
      this.onTimeShiftCancel();
      return;
    }

    const minutes = result.direction === 'backward' ? -result.minutes : result.minutes;
    
    const updateResult = await this.taskTimeService.shiftTask(this.timeShiftTask, {
      minutes,
      fragmentOnly: result.fragmentIndex !== undefined,
      fragmentIndex: result.fragmentIndex
    });

    if (updateResult.success) {
      console.log('✅ Tarea desplazada:', updateResult.message);
      this.taskUpdated.emit(this.timeShiftTask);
    } else {
      console.error('❌ Error al desplazar:', updateResult.message);
    }

    this.onTimeShiftCancel();
  }

  /**
   * Cancelar desplazamiento de tiempo
   */
  onTimeShiftCancel(): void {
    this.showTimeShiftModal = false;
    this.timeShiftTask = null;
    this.timeShiftFragmentIndex = null;
    this.cdr.detectChanges();
  }

  /**
   * Confirmar cambio de duración
   */
  async onDurationConfirm(result: DurationEditResult): Promise<void> {
    if (!result.confirmed || !this.durationTask || !result.newDurationMinutes) {
      this.onDurationCancel();
      return;
    }

    const updateResult = await this.taskTimeService.changeDuration(this.durationTask, {
      newDurationMinutes: result.newDurationMinutes,
      adjustStart: result.adjustStart ?? false,
      fragmentOnly: result.fragmentIndex !== undefined,
      fragmentIndex: result.fragmentIndex
    });

    if (updateResult.success) {
      console.log('✅ Duración cambiada:', updateResult.message);
      this.taskUpdated.emit(this.durationTask);
    } else {
      console.error('❌ Error al cambiar duración:', updateResult.message);
    }

    this.onDurationCancel();
  }

  /**
   * Cancelar cambio de duración
   */
  onDurationCancel(): void {
    this.showDurationModal = false;
    this.durationTask = null;
    this.durationFragmentIndex = null;
    this.cdr.detectChanges();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.updateSvgDimensions();
  }

  private initializeResizeObserver() {
    if (typeof ResizeObserver !== 'undefined' && this.containerRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateSvgDimensions();
      });
      this.resizeObserver.observe(this.containerRef.nativeElement);
    }
  }

  private updateSvgDimensions() {
    if (typeof window === 'undefined') {
      this.svgWidth = Math.floor(600 * this.widthScale);
      return;
    }

    const screenWidth = window.innerWidth;
    let containerWidth = screenWidth;

    if (this.containerRef?.nativeElement) {
      const rect = this.containerRef.nativeElement.getBoundingClientRect();
      containerWidth = rect.width;
    }

    const availableWidth = Math.max(containerWidth - this.containerPadding, this.minSvgWidth);

    if (screenWidth <= 375) {
      this.svgWidth = Math.floor(Math.max(availableWidth, this.minSvgWidth) * this.widthScale);
      this.titleFontSize = 10;
      this.hourFontSize = 8;
      this.taskFontSize = 10;
    } else if (screenWidth <= 480) {
      this.svgWidth = Math.floor(Math.max(availableWidth * 1.2, 400) * this.widthScale);
      this.titleFontSize = 11;
      this.hourFontSize = 9;
      this.taskFontSize = 11;
    } else if (screenWidth <= 640) {
      this.svgWidth = Math.floor(Math.max(availableWidth * 1.4, 500) * this.widthScale);
      this.titleFontSize = 12;
      this.hourFontSize = 10;
      this.taskFontSize = 12;
    } else if (screenWidth <= 768) {
      this.svgWidth = Math.floor(Math.max(availableWidth * 0.9, 600) * this.widthScale);
      this.titleFontSize = 12;
      this.hourFontSize = 10;
      this.taskFontSize = 12;
    } else if (screenWidth <= 1024) {
      this.svgWidth = Math.floor(Math.max(availableWidth * 0.95, 800) * this.widthScale);
      this.titleFontSize = 13;
      this.hourFontSize = 11;
      this.taskFontSize = 13;
    } else if (screenWidth <= 1280) {
      this.svgWidth = Math.floor(Math.max(availableWidth * 0.98, 1000) * this.widthScale);
      this.titleFontSize = 14;
      this.hourFontSize = 12;
      this.taskFontSize = 14;
    } else {
      this.svgWidth = Math.floor(Math.min(availableWidth * 0.98, 1400) * this.widthScale);
      this.titleFontSize = 14;
      this.hourFontSize = 12;
      this.taskFontSize = 14;
    }

    const scaledMinWidth = Math.floor(this.minSvgWidth * this.widthScale);
    this.svgWidth = Math.max(this.svgWidth, scaledMinWidth);
  }

  getTaskText(task: Task, sectionStartHour: number): string {
    const taskWidth = this.getTaskWidth(task, sectionStartHour);
    const emoji = task.emoji || '📋';
    let name = task.name || 'Sin título';
    
    if (this.focusedEnvironmentId && task.project) {
      const projectsToUse = this.loadedProjects.length > 0 ? this.loadedProjects : this.projects;
      const project = projectsToUse.find(p => p.id === task.project);
      
      if (project) {
        const projectInitials = this.getProjectInitials(project.name);
        name = `${projectInitials}: ${name}`;
      }
    }
    
    const availableChars = Math.floor(taskWidth / (this.taskFontSize * 0.35));
    
    if (taskWidth < 20) {
      return emoji;
    }
    
    const emojiSpace = 2;
    const ellipsisSpace = 3;
    const availableForName = Math.max(availableChars - emojiSpace, 1);
    
    if (availableForName >= name.length) {
      return `${emoji} ${name}`;
    } else if (availableForName >= 3) {
      const truncatedLength = Math.max(availableForName - ellipsisSpace, 1);
      return `${emoji} ${name.substring(0, truncatedLength)}...`;
    } else if (availableForName >= 1) {
      return `${emoji} ${name.charAt(0)}`;
    } else {
      return emoji;
    }
  }

  getProjectInitials(projectName: string): string {
    if (!projectName) return '';
    const withoutSpaces = projectName.replace(/\s+/g, '');
    return withoutSpaces.substring(0, 3).toUpperCase();
  }

  getX(hourInDay: number, sectionStartHour: number): number {
    const hourInSection = hourInDay - sectionStartHour;
    const effectiveWidth = this.svgWidth - this.hourOffsetStart - this.hourOffsetEnd;
    return this.hourOffsetStart + (hourInSection / 8) * effectiveWidth;
  }

  getTaskX(task: Task, sectionStartHour: number): number {
    const taskActualStart = this.parseUTCToLocal(task.start);
    
    const selectedDayStart = new Date(this.selectedDate);
    selectedDayStart.setHours(0, 0, 0, 0);
    
    let effectiveStartHour;
    
    if (taskActualStart < selectedDayStart) {
      effectiveStartHour = 0;
    } else {
      effectiveStartHour = taskActualStart.getHours() + taskActualStart.getMinutes() / 60;
    }

    const visiblePortionStartHourInDay = Math.max(effectiveStartHour, sectionStartHour);
    const offsetFromSectionStart = visiblePortionStartHourInDay - sectionStartHour;
    const effectiveWidth = this.svgWidth - this.hourOffsetStart - this.hourOffsetEnd;
    
    return this.hourOffsetStart + (offsetFromSectionStart / 8) * effectiveWidth;
  }

  getTaskWidth(task: Task, sectionStartHour: number): number {
    const start = this.parseUTCToLocal(task.start);
    const end = this.parseUTCToLocal(task.end);
    
    const selectedDayStart = new Date(this.selectedDate);
    selectedDayStart.setHours(0, 0, 0, 0);
    
    const selectedDayEnd = new Date(this.selectedDate);
    selectedDayEnd.setHours(23, 59, 59, 999);
    
    let taskStartHour, taskEndHour;
    
    if (start < selectedDayStart) {
      taskStartHour = 0;
    } else {
      taskStartHour = start.getHours() + start.getMinutes() / 60;
    }
    
    if (end > selectedDayEnd) {
      taskEndHour = 24;
    } else {
      taskEndHour = end.getHours() + end.getMinutes() / 60;
    }

    taskStartHour = Math.max(taskStartHour, sectionStartHour);
    taskEndHour = Math.min(taskEndHour, sectionStartHour + 8);
    
    const durationInSection = taskEndHour - taskStartHour;
    
    if (durationInSection <= 0) return 0;

    const effectiveWidth = this.svgWidth - this.hourOffsetStart - this.hourOffsetEnd;
    
    return Math.max(8, (durationInSection / 8) * effectiveWidth);
  }

  getTasksForSection(sectionIndex: 0 | 1 | 2): Task[] {
    const sectionStartHour = sectionIndex * 8;
    const sectionEndHour = sectionStartHour + 8;

    let filteredTasks = this.tasks;
    if (this.focusedEnvironmentId) {
      filteredTasks = this.tasks.filter(task => task.environment === this.focusedEnvironmentId);
    }

    return filteredTasks.filter(task => {
      const taskStart = this.parseUTCToLocal(task.start);
      const taskEnd = this.parseUTCToLocal(task.end);
      
      const selectedDayStart = new Date(this.selectedDate);
      selectedDayStart.setHours(0, 0, 0, 0);
      
      const selectedDayEnd = new Date(this.selectedDate);
      selectedDayEnd.setHours(23, 59, 59, 999);
      
      const taskOverlapsSelectedDay = taskStart <= selectedDayEnd && taskEnd >= selectedDayStart;
      
      if (!taskOverlapsSelectedDay) {
        return false;
      }
      
      let taskStartHour, taskEndHour;
      
      if (taskStart < selectedDayStart) {
        taskStartHour = 0;
      } else {
        taskStartHour = taskStart.getHours() + taskStart.getMinutes() / 60;
      }
      
      if (taskEnd > selectedDayEnd) {
        taskEndHour = 24;
      } else {
        taskEndHour = taskEnd.getHours() + taskEnd.getMinutes() / 60;
      }

      return taskStartHour < sectionEndHour && taskEndHour > sectionStartHour;
    });
  }
  
  getRenderableItemsForSection(sectionIndex: 0 | 1 | 2): RenderableItem[] {
    const sectionStartHour = sectionIndex * 8;
    const sectionEndHour = sectionStartHour + 8;
    const items: RenderableItem[] = [];

    let filteredTasks = this.tasks;
    if (this.focusedEnvironmentId) {
      filteredTasks = this.tasks.filter(task => task.environment === this.focusedEnvironmentId);
    }

    const selectedDayStart = new Date(this.selectedDate);
    selectedDayStart.setHours(0, 0, 0, 0);
    
    const selectedDayEnd = new Date(this.selectedDate);
    selectedDayEnd.setHours(23, 59, 59, 999);

    for (const task of filteredTasks) {
      if (task.fragments && task.fragments.length > 0) {
        for (let i = 0; i < task.fragments.length; i++) {
          const fragment = task.fragments[i];
          if (fragment.start && fragment.end) {
            const fragmentStart = this.parseUTCToLocal(fragment.start);
            const fragmentEnd = this.parseUTCToLocal(fragment.end);
            
            const fragmentOverlapsSelectedDay = fragmentStart <= selectedDayEnd && fragmentEnd >= selectedDayStart;
            
            if (!fragmentOverlapsSelectedDay) {
              continue;
            }
            
            let fragmentStartHour, fragmentEndHour;
            
            if (fragmentStart < selectedDayStart) {
              fragmentStartHour = 0;
            } else {
              fragmentStartHour = fragmentStart.getHours() + fragmentStart.getMinutes() / 60;
            }
            
            if (fragmentEnd > selectedDayEnd) {
              fragmentEndHour = 24;
            } else {
              fragmentEndHour = fragmentEnd.getHours() + fragmentEnd.getMinutes() / 60;
            }
            
            if (fragmentStartHour < sectionEndHour && fragmentEndHour > sectionStartHour) {
              items.push({
                type: 'fragment',
                task: task,
                fragmentIndex: i,
                start: fragment.start,
                end: fragment.end
              });
            }
          }
        }
      } else {
        const taskStart = this.parseUTCToLocal(task.start);
        const taskEnd = this.parseUTCToLocal(task.end);
        
        const taskOverlapsSelectedDay = taskStart <= selectedDayEnd && taskEnd >= selectedDayStart;
        
        if (!taskOverlapsSelectedDay) {
          continue;
        }
        
        let taskStartHour, taskEndHour;
        
        if (taskStart < selectedDayStart) {
          taskStartHour = 0;
        } else {
          taskStartHour = taskStart.getHours() + taskStart.getMinutes() / 60;
        }
        
        if (taskEnd > selectedDayEnd) {
          taskEndHour = 24;
        } else {
          taskEndHour = taskEnd.getHours() + taskEnd.getMinutes() / 60;
        }
        
        if (taskStartHour < sectionEndHour && taskEndHour > sectionStartHour) {
          items.push({
            type: 'task',
            task: task,
            start: task.start,
            end: task.end
          });
        }
      }
    }

    return items;
  }
  
  getItemX(item: RenderableItem, sectionStartHour: number): number {
    const itemStart = this.parseUTCToLocal(item.start);
    
    const selectedDayStart = new Date(this.selectedDate);
    selectedDayStart.setHours(0, 0, 0, 0);
    
    let effectiveStartHour;
    
    if (itemStart < selectedDayStart) {
      effectiveStartHour = 0;
    } else {
      effectiveStartHour = itemStart.getHours() + itemStart.getMinutes() / 60;
    }
    
    const visiblePortionStartHourInDay = Math.max(effectiveStartHour, sectionStartHour);
    const offsetFromSectionStart = visiblePortionStartHourInDay - sectionStartHour;
    const effectiveWidth = this.svgWidth - this.hourOffsetStart - this.hourOffsetEnd;
    
    return this.hourOffsetStart + (offsetFromSectionStart / 8) * effectiveWidth;
  }
  
  getItemWidth(item: RenderableItem, sectionStartHour: number): number {
    const start = this.parseUTCToLocal(item.start);
    const end = this.parseUTCToLocal(item.end);
    
    const selectedDayStart = new Date(this.selectedDate);
    selectedDayStart.setHours(0, 0, 0, 0);
    
    const selectedDayEnd = new Date(this.selectedDate);
    selectedDayEnd.setHours(23, 59, 59, 999);
    
    let itemStartHour, itemEndHour;
    
    if (start < selectedDayStart) {
      itemStartHour = 0;
    } else {
      itemStartHour = start.getHours() + start.getMinutes() / 60;
    }
    
    if (end > selectedDayEnd) {
      itemEndHour = 24;
    } else {
      itemEndHour = end.getHours() + end.getMinutes() / 60;
    }
    
    itemStartHour = Math.max(itemStartHour, sectionStartHour);
    itemEndHour = Math.min(itemEndHour, sectionStartHour + 8);
    
    const durationInSection = itemEndHour - itemStartHour;
    
    if (durationInSection <= 0) return 0;
    
    const effectiveWidth = this.svgWidth - this.hourOffsetStart - this.hourOffsetEnd;
    
    return Math.max(8, (durationInSection / 8) * effectiveWidth);
  }
  
  getItemText(item: RenderableItem, sectionStartHour: number): string {
    const itemWidth = this.getItemWidth(item, sectionStartHour);
    const emoji = item.task.emoji || '📋';
    let name = item.task.name || 'Sin título';
    
    if (this.focusedEnvironmentId && item.task.project) {
      const projectsToUse = this.loadedProjects.length > 0 ? this.loadedProjects : this.projects;
      const project = projectsToUse.find(p => p.id === item.task.project);
      
      if (project) {
        const projectInitials = this.getProjectInitials(project.name);
        name = `${projectInitials}: ${name}`;
      }
    }
    
    if (item.type === 'fragment' && item.fragmentIndex !== undefined) {
      name = `${name} [F${item.fragmentIndex + 1}]`;
    }
    
    const availableChars = Math.floor(itemWidth / (this.taskFontSize * 0.35));
    
    if (itemWidth < 20) {
      return emoji;
    }
    
    const emojiSpace = 2;
    const ellipsisSpace = 3;
    const availableForName = Math.max(availableChars - emojiSpace, 1);
    
    if (availableForName >= name.length) {
      return `${emoji} ${name}`;
    } else if (availableForName >= 3) {
      const truncatedLength = Math.max(availableForName - ellipsisSpace, 1);
      return `${emoji} ${name.substring(0, truncatedLength)}...`;
    } else if (availableForName >= 1) {
      return `${emoji} ${name.charAt(0)}`;
    } else {
      return emoji;
    }
  }
  
  getTaskColor(task: Task): string {
    if (this.focusedEnvironmentId) {
      const typeColor = this.getTaskTypeColor(task);
      if (typeColor) {
        return typeColor;
      }
    }
    
    if (task.environment && this.environments.length > 0) {
      const environment = this.environments.find(env => env.id === task.environment);
      if (environment && environment.color) {
        return environment.color;
      }
    }
    
    switch (task.priority) {
      case 'low': return '#4ade80';
      case 'medium': return '#60a5fa';
      case 'high': return '#f87171';
      case 'critical': return '#f472b6';
      default: return '#a3a3a3';
    }
  }

  isTaskOverdue(task: Task): boolean {
    if (task.status === 'completed' || task.completed) return false;
    const endDate = this.parseUTCToLocal(task.end);
    const now = new Date();
    return endDate < now;
  }

  isTaskRunning(task: Task): boolean {
    if (task.status === 'completed' || task.completed) return false;
    const startDate = this.parseUTCToLocal(task.start);
    const endDate = this.parseUTCToLocal(task.end);
    const now = new Date();
    return startDate <= now && now <= endDate;
  }

  isFutureTask(task: Task): boolean {
    const startDate = this.parseUTCToLocal(task.start);
    const now = new Date();
    return startDate > now;
  }

  isFutureItem(item: RenderableItem): boolean {
    const startDate = this.parseUTCToLocal(item.start);
    const now = new Date();
    return startDate > now;
  }

  shouldShowAsHidden(item: RenderableItem): boolean {
    return item.task.hidden === true && this.isFutureItem(item);
  }

  getNowX(sectionStartHour: number): number {
    const now = new Date();
    const currentHourInDay = now.getHours() + now.getMinutes() / 60;
    const hourInSection = currentHourInDay - sectionStartHour;
    
    const effectiveWidth = this.svgWidth - this.hourOffsetStart - this.hourOffsetEnd;
    
    return this.hourOffsetStart + (hourInSection / 8) * effectiveWidth;
  }

  isNowInSection(sectionIndex: 0 | 1 | 2): boolean {
    if (!this.isToday()) {
      return false;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const sectionStartHour = sectionIndex * 8;
    const sectionEndHour = sectionStartHour + 8;
    return currentHour >= sectionStartHour && currentHour < sectionEndHour;
  }

  public setWidthScale(scale: number): void {
    if (scale > 0 && scale <= 3) {
      this.widthScale = scale;
      this.updateSvgDimensions();
    }
  }

  public getWidthScale(): number {
    return this.widthScale;
  }

  public setHourOffsets(startOffset: number, endOffset: number): void {
    if (startOffset >= 0 && endOffset >= 0) {
      this.hourOffsetStart = startOffset;
      this.hourOffsetEnd = endOffset;
    }
  }

  public getHourOffsets(): { start: number, end: number } {
    return {
      start: this.hourOffsetStart,
      end: this.hourOffsetEnd
    };
  }

  goToPreviousDay() {
    this.selectedDate.setDate(this.selectedDate.getDate() - 1);
    this.updateSvgDimensions();
  }

  goToToday() {
    this.selectedDate = new Date();
    this.updateSvgDimensions();
  }

  goToNextDay() {
    this.selectedDate.setDate(this.selectedDate.getDate() + 1);
    this.updateSvgDimensions();
  }

  formatSelectedDate() {
    return this.selectedDate.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric'
    });
  }

  getDateInputValue() {
    const year = this.selectedDate.getFullYear();
    const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onDateChange(dateString: string) {
    if (dateString) {
      const [year, month, day] = dateString.split('-').map(Number);
      this.selectedDate = new Date(year, month - 1, day);
      this.updateSvgDimensions();
    }
  }

  isToday(): boolean {
    const today = new Date();
    return this.selectedDate.toDateString() === today.toDateString();
  }

  formatTaskTime(dateTimeString: string): string {
    if (!dateTimeString) return '';
    const date = this.parseUTCToLocal(dateTimeString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  public goToDate(date: Date): void {
    this.selectedDate = new Date(date);
    this.updateSvgDimensions();
  }

  public getSelectedDate(): Date {
    return new Date(this.selectedDate);
  }

  public navigateByWeek(direction: 1 | -1): void {
    this.selectedDate.setDate(this.selectedDate.getDate() + (7 * direction));
    this.updateSvgDimensions();
  }

  public navigateByMonth(direction: 1 | -1): void {
    this.selectedDate.setMonth(this.selectedDate.getMonth() + direction);
    this.updateSvgDimensions();
  }

  showTaskTooltip(task: Task): void {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }

    this.tooltipTask = task;
    this.showTooltip = true;
    this.cdr.detectChanges();

    this.tooltipTimeout = setTimeout(() => {
      this.hideTooltip();
    }, 4000);
  }

  hideTooltip(): void {
    this.showTooltip = false;
    this.tooltipTask = null;
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
    this.cdr.detectChanges();
  }

  getNextTask(currentTask: Task): Task | null {
    const currentEnd = this.parseUTCToLocal(currentTask.end);
    const currentDate = currentEnd.toDateString();
    
    let tasksToSearch = this.tasks;
    if (this.focusedEnvironmentId) {
      tasksToSearch = this.tasks.filter(task => task.environment === this.focusedEnvironmentId);
    }
    
    const tasksOnSameDay = tasksToSearch.filter(task => {
      const taskStart = this.parseUTCToLocal(task.start);
      const taskDate = taskStart.toDateString();
      return taskDate === currentDate && task.id !== currentTask.id;
    });

    let nextTask: Task | null = null;
    let earliestStart: Date | null = null;

    for (const task of tasksOnSameDay) {
      const taskStart = this.parseUTCToLocal(task.start);
      
      if (taskStart >= currentEnd) {
        if (!earliestStart || taskStart < earliestStart) {
          earliestStart = taskStart;
          nextTask = task;
        }
      }
    }

    return nextTask;
  }

  getTimeUntilNextTask(currentTask: Task): string {
    const nextTask = this.getNextTask(currentTask);
    
    if (!nextTask) {
      return 'No hay más tareas programadas hoy';
    }

    const currentEnd = this.parseUTCToLocal(currentTask.end);
    const nextStart = this.parseUTCToLocal(nextTask.start);
    
    const timeDifferenceMs = nextStart.getTime() - currentEnd.getTime();
    
    if (timeDifferenceMs <= 0) {
      return 'La siguiente tarea se superpone';
    }

    return this.formatTimeBreak(timeDifferenceMs);
  }

  private formatTimeBreak(milliseconds: number): string {
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    
    if (totalMinutes < 1) {
      return 'Menos de 1 minuto de descanso';
    }
    
    if (totalMinutes < 60) {
      return `${totalMinutes} min de descanso`;
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours === 1 && minutes === 0) {
      return '1 hora de descanso';
    }
    
    if (minutes === 0) {
      return `${hours} horas de descanso`;
    }
    
    if (hours === 1) {
      return `1 hora y ${minutes} min de descanso`;
    }
    
    return `${hours} horas y ${minutes} min de descanso`;
  }

  getTaskTypeColor(task: Task): string | null {
    if (!task.type || !this.taskTypes.length) return null;
    const taskType = this.taskTypes.find(t => t.id === task.type);
    return taskType?.color || null;
  }

  getTaskDisplayName(task: Task): string {
    let name = task.name || 'Sin título';
    
    if (this.focusedEnvironmentId && task.project) {
      const projectsToUse = this.loadedProjects.length > 0 ? this.loadedProjects : this.projects;
      const project = projectsToUse.find(p => p.id === task.project);
      if (project) {
        const projectInitials = this.getProjectInitials(project.name);
        name = `${projectInitials}: ${name}`;
      }
    }
    
    return name;
  }
  
  getTaskDuration(task: Task): number | null {
    if (task.fragments && task.fragments.length > 0) {
      let totalDuration = 0;
      for (const fragment of task.fragments) {
        if (fragment.start && fragment.end) {
          const start = this.parseUTCToLocal(fragment.start);
          const end = this.parseUTCToLocal(fragment.end);
          const diffMs = end.getTime() - start.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          totalDuration += Math.max(0, diffHours);
        }
      }
      return totalDuration > 0 ? totalDuration : null;
    }
    
    if (task.duration && task.duration > 0) {
      return task.duration;
    }
    
    if (task.start && task.end) {
      const start = this.parseUTCToLocal(task.start);
      const end = this.parseUTCToLocal(task.end);
      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return Math.max(0, diffHours);
    }
    
    return null;
  }
  
  formatTaskDuration(hours: number | null): string {
    if (!hours || hours === 0) return '0 horas';
    
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (minutes === 0) {
      return `${wholeHours} hora${wholeHours !== 1 ? 's' : ''}`;
    } else if (wholeHours === 0) {
      return `${minutes} minutos`;
    } else {
      return `${wholeHours} hora${wholeHours !== 1 ? 's' : ''} y ${minutes} minutos`;
    }
  }
  
  showTaskContextMenu(task: Task, x: number, y: number): void {
    this.hideTooltip();
    
    this.contextMenuTask = task;
    this.contextMenuX = x;
    this.contextMenuY = y;
    this.showContextMenu = true;
  }

  closeContextMenu(): void {
    this.showContextMenu = false;
    this.contextMenuTask = null;
  }

  deleteTaskFromContextMenu(): void {
    if (this.contextMenuTask) {
      this.deleteTask.emit(this.contextMenuTask);
      this.closeContextMenu();
    }
  }

  toggleHiddenFromContextMenu(): void {
    if (this.contextMenuTask) {
      this.toggleHidden.emit(this.contextMenuTask);
      this.closeContextMenu();
    }
  }

  changeStatusFromContextMenu(status: 'pending' | 'in-progress' | 'completed'): void {
    if (this.contextMenuTask) {
      this.changeStatus.emit({ task: this.contextMenuTask, status });
      this.closeContextMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showContextMenu) {
      this.closeContextMenu();
    }
    if (this.showTooltip) {
      this.hideTooltip();
    }
  }

  ngOnDestroy(): void {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
    if (this.focusSubscription) {
      this.focusSubscription.unsubscribe();
    }
    if (this.gestureSubscription) {
      this.gestureSubscription.unsubscribe();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    // Limpiar registros de gestos
    this.gestureCleanups.forEach(cleanup => cleanup());
    this.gestureCleanups = [];
  }
}
