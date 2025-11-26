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

// Interfaz para representar un día de la semana
interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthDay: number;
}

@Component({
  selector: 'app-week-timeline-svg',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    AndroidDatePickerComponent,
    TimeShiftModalComponent,
    DurationEditModalComponent
  ],
  templateUrl: './week-timeline-svg.component.html',
  styleUrls: ['./week-timeline-svg.component.css']
})
export class WeekTimelineSvgComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() tasks: Task[] = [];
  @Input() environments: Environment[] = [];
  @Input() taskTypes: TaskType[] = [];
  @Input() projects: Project[] = [];
  
  private loadedProjects: Project[] = [];
  
  focusedEnvironmentId: string | null = null;
  private focusSubscription?: Subscription;
  private gestureSubscription?: Subscription;
  private gestureCleanups: (() => void)[] = [];
  
  // Modo de coloreado
  colorMode: 'environment' | 'taskType' = 'environment';

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

  // 📅 NAVEGACIÓN DE SEMANA
  currentWeekStart: Date = this.getWeekStart(new Date());
  
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

  // Propiedades de dimensiones
  svgWidth = 1400;
  minSvgWidth = 800;
  hoursAreaHeight = 900; // 24 horas * 37.5px
  svgHeight = 60 + this.hoursAreaHeight;
  
  dayColumnWidth = 180;
  dayColumnPadding = 4;
  columnGap = 2;
  
  // Fuentes
  dayNameFontSize = 14;
  dayNumberFontSize = 12;
  hourFontSize = 10;
  taskFontSize = 11;
  
  hours: number[] = Array.from({length: 48}, (_, i) => i);
  weekDays: WeekDay[] = [];
  
  private resizeObserver?: ResizeObserver;
  private containerPadding = 16;

  // Configuración de gestos para este timeline (VERTICAL)
  private gestureConfig: Partial<GestureConfig> = {
    direction: 'vertical',  // Dirección vertical para week-timeline
    enableResize: true,
    dragThreshold: 15,
    resizeZoneWidth: 12
  };

  // Píxeles por hora (vertical)
  get pixelsPerHour(): number {
    return 37.5; // 900px / 24 horas
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const sunday = new Date(d.setDate(diff));
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  }

  private updateWeekDays(): void {
    this.weekDays = [];
    const weekStart = new Date(this.currentWeekStart);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      
      this.weekDays.push({
        date: new Date(day),
        dayName: dayNames[i],
        dayNumber: day.getDate(),
        monthDay: day.getDate()
      });
    }
  }

  getDayColumnX(dayIndex: number): number {
    return dayIndex * (this.dayColumnWidth + this.columnGap);
  }

  getHourY(hourIndex: number): number {
    return hourIndex * 18.75;
  }

  isTodayColumn(dayIndex: number): boolean {
    const today = new Date();
    const day = this.weekDays[dayIndex];
    if (!day) return false;
    return day.date.toDateString() === today.toDateString();
  }

  isCurrentHour(): boolean {
    const today = new Date();
    const currentWeekStart = this.getWeekStart(today);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 7);
    return today >= currentWeekStart && today < currentWeekEnd;
  }

  getCurrentHourY(): number {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    return (hour * 37.5) + (minutes * 0.625);
  }

  formatHour(hourIndex: number): string {
    const hour12 = hourIndex;
    let displayHour = hour12;
    let period = 'AM';
    
    if (hour12 === 0) {
      displayHour = 12;
    } else if (hour12 === 12) {
      displayHour = 12;
      period = 'PM';
    } else if (hour12 > 12) {
      displayHour = hour12 - 12;
      period = 'PM';
    }
    
    return `${displayHour}:00 ${period}`;
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
    
    this.updateWeekDays();
    this.updateSvgDimensions();
  }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['projects'] && this.projects.length > 0) {
      this.loadedProjects = this.projects;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      this.updateSvgDimensions();
    }
    
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

    this.taskRects.changes.subscribe(() => {
      this.registerTaskGestures();
    });
  }

  /**
   * Registrar gestos en todos los rectángulos de tareas
   */
  private registerTaskGestures(): void {
    this.gestureCleanups.forEach(cleanup => cleanup());
    this.gestureCleanups = [];

    const handlesStart = this.resizeHandlesStart ? this.resizeHandlesStart.toArray() : [];
    const handlesEnd = this.resizeHandlesEnd ? this.resizeHandlesEnd.toArray() : [];

    this.taskRects.forEach((rectRef, index) => {
      const rect = rectRef.nativeElement;
      const taskId = rect.getAttribute('data-task-id');
      const fragmentIndexStr = rect.getAttribute('data-fragment-index');
      const fragmentIndex = fragmentIndexStr ? parseInt(fragmentIndexStr, 10) : undefined;

      if (taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
          const data = { task, fragmentIndex };

          // 1. Registrar tarea PRINCIPAL solo para DRAG (disable resize)
          const cleanupTask = this.gestureService.registerElement(rect, data, {
            ...this.gestureConfig,
            enableResize: false // Disable automatic resize detection on edges
          });
          this.gestureCleanups.push(cleanupTask);

          // 2. Registrar Handle Inicio (Resize Start) - Top for vertical
          const handleStart = handlesStart[index]?.nativeElement;
          if (handleStart) {
            const cleanupStart = this.gestureService.registerElement(handleStart, data, {
              ...this.gestureConfig,
              enableResize: true,
              fixedResizeEdge: 'start'
            });
            this.gestureCleanups.push(cleanupStart);
          }

          // 3. Registrar Handle Fin (Resize End) - Bottom for vertical
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
   * Manejar eventos de gestos (VERTICAL para week-timeline)
   */
  private handleGestureEvent(event: GestureEvent): void {
    if (!event.data?.task) return;

    const task: Task = event.data.task;
    const fragmentIndex: number | undefined = event.data.fragmentIndex;

    switch (event.type) {
      case 'drag-up':
      case 'drag-down':
        this.openTimeShiftModal(task, fragmentIndex, event);
        break;

      case 'resize-start':
      case 'resize-end':
        this.openDurationModal(task, fragmentIndex, event);
        break;

      case 'tap':
        this.showTaskTooltip(task);
        break;

      case 'long-press':
        this.showTaskContextMenu(task, event.endX, event.endY);
        break;
    }
  }

  /**
   * Abrir modal de desplazamiento de tiempo
   */
  private openTimeShiftModal(task: Task, fragmentIndex: number | undefined, event: GestureEvent): void {
    this.hideTooltip();
    this.closeContextMenu();

    // Para vertical: drag-up = más temprano (backward), drag-down = más tarde (forward)
    const direction = event.type === 'drag-down' ? 'forward' : 'backward';
    const suggestedMinutes = this.gestureService.calculateTimeShift(
      Math.abs(event.deltaY),
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
      this.svgWidth = Math.floor(1400);
      return;
    }

    const screenWidth = window.innerWidth;
    let containerWidth = screenWidth;

    if (this.containerRef?.nativeElement) {
      const rect = this.containerRef.nativeElement.getBoundingClientRect();
      containerWidth = rect.width;
    }

    const availableWidth = Math.max(containerWidth - this.containerPadding, this.minSvgWidth);
    const minRequiredWidth = 7 * (this.dayColumnWidth + this.columnGap) - this.columnGap;
    
    if (screenWidth <= 640) {
      this.dayColumnWidth = Math.max(120, (availableWidth - 6 * this.columnGap) / 7);
      this.dayNameFontSize = 11;
      this.dayNumberFontSize = 10;
      this.hourFontSize = 8;
      this.taskFontSize = 9;
    } else if (screenWidth <= 1024) {
      this.dayColumnWidth = Math.max(140, (availableWidth - 6 * this.columnGap) / 7);
      this.dayNameFontSize = 12;
      this.dayNumberFontSize = 11;
      this.hourFontSize = 9;
      this.taskFontSize = 10;
    } else {
      this.dayColumnWidth = Math.max(180, Math.min(200, (availableWidth - 6 * this.columnGap) / 7));
      this.dayNameFontSize = 14;
      this.dayNumberFontSize = 12;
      this.hourFontSize = 10;
      this.taskFontSize = 11;
    }

    this.svgWidth = Math.max(minRequiredWidth, 7 * (this.dayColumnWidth + this.columnGap) - this.columnGap);
  }

  getRenderableItemsForDay(dayIndex: number): RenderableItem[] {
    const day = this.weekDays[dayIndex];
    if (!day) return [];

    const dayStart = new Date(day.date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(day.date);
    dayEnd.setHours(23, 59, 59, 999);

    let filteredTasks = this.tasks;
    if (this.focusedEnvironmentId) {
      filteredTasks = this.tasks.filter(task => task.environment === this.focusedEnvironmentId);
    }

    const items: RenderableItem[] = [];

    for (const task of filteredTasks) {
      if (task.fragments && task.fragments.length > 0) {
        for (let i = 0; i < task.fragments.length; i++) {
          const fragment = task.fragments[i];
          if (fragment.start && fragment.end) {
            const fragmentStart = this.parseUTCToLocal(fragment.start);
            const fragmentEnd = this.parseUTCToLocal(fragment.end);
            
            if (fragmentStart <= dayEnd && fragmentEnd >= dayStart) {
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
        
        if (taskStart <= dayEnd && taskEnd >= dayStart) {
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

  getTaskX(item: RenderableItem, dayIndex: number): number {
    return this.dayColumnPadding;
  }

  getTaskY(item: RenderableItem, dayIndex: number): number {
    const itemStart = this.parseUTCToLocal(item.start);
    const day = this.weekDays[dayIndex];
    if (!day) return 0;

    const dayStart = new Date(day.date);
    dayStart.setHours(0, 0, 0, 0);

    let effectiveStart: Date;
    if (itemStart < dayStart) {
      effectiveStart = new Date(dayStart);
    } else {
      effectiveStart = new Date(itemStart);
    }

    const minutesFromDayStart = (effectiveStart.getHours() * 60) + effectiveStart.getMinutes();
    return minutesFromDayStart * 0.625;
  }

  getTaskWidth(item: RenderableItem, dayIndex: number): number {
    return this.dayColumnWidth - (this.dayColumnPadding * 2);
  }

  getTaskHeight(item: RenderableItem, dayIndex: number): number {
    const itemStart = this.parseUTCToLocal(item.start);
    const itemEnd = this.parseUTCToLocal(item.end);
    const day = this.weekDays[dayIndex];
    if (!day) return 0;

    const dayStart = new Date(day.date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(day.date);
    dayEnd.setHours(23, 59, 59, 999);

    let effectiveStart: Date;
    let effectiveEnd: Date;

    if (itemStart < dayStart) {
      effectiveStart = new Date(dayStart);
    } else {
      effectiveStart = new Date(itemStart);
    }

    if (itemEnd > dayEnd) {
      effectiveEnd = new Date(dayEnd);
    } else {
      effectiveEnd = new Date(itemEnd);
    }

    const startMinutes = (effectiveStart.getHours() * 60) + effectiveStart.getMinutes();
    const endMinutes = (effectiveEnd.getHours() * 60) + effectiveEnd.getMinutes();
    
    const durationMinutes = Math.max(endMinutes - startMinutes, 15);
    return durationMinutes * 0.625;
  }

  getItemText(item: RenderableItem, dayIndex: number): string {
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
    
    const taskWidth = this.getTaskWidth(item, dayIndex);
    const availableChars = Math.floor(taskWidth / (this.taskFontSize * 0.5));
    
    if (availableChars >= name.length) {
      return `${emoji} ${name}`;
    } else if (availableChars >= 3) {
      return `${emoji} ${name.substring(0, availableChars - 3)}...`;
    } else {
      return emoji;
    }
  }

  getTaskColor(task: Task): string {
    if (!this.focusedEnvironmentId) {
      if (task.environment && this.environments.length > 0) {
        const environment = this.environments.find(env => env.id === task.environment);
        if (environment && environment.color) {
          return environment.color;
        }
      }
    } else {
      if (this.colorMode === 'taskType') {
        const typeColor = this.getTaskTypeColor(task);
        if (typeColor) {
          return typeColor;
        }
      } else {
        if (task.environment && this.environments.length > 0) {
          const environment = this.environments.find(env => env.id === task.environment);
          if (environment && environment.color) {
            return environment.color;
          }
        }
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

  isFutureItem(item: RenderableItem): boolean {
    const startDate = this.parseUTCToLocal(item.start);
    const now = new Date();
    return startDate > now;
  }

  shouldShowAsHidden(item: RenderableItem): boolean {
    return item.task.hidden === true && this.isFutureItem(item);
  }
  
  toggleColorMode(): void {
    this.colorMode = this.colorMode === 'environment' ? 'taskType' : 'environment';
    this.cdr.detectChanges();
  }

  getTaskTypeColor(task: Task): string | null {
    if (!task.type || !this.taskTypes.length) return null;
    const taskType = this.taskTypes.find(t => t.id === task.type);
    return taskType?.color || null;
  }

  getProjectInitials(projectName: string): string {
    if (!projectName) return '';
    const withoutSpaces = projectName.replace(/\s+/g, '');
    return withoutSpaces.substring(0, 3).toUpperCase();
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

  formatTaskTime(dateTimeString: string): string {
    if (!dateTimeString) return '';
    const date = this.parseUTCToLocal(dateTimeString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  // Navegación de semana
  goToPreviousWeek() {
    const newDate = new Date(this.currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    this.currentWeekStart = new Date(newDate);
    this.updateWeekDays();
    this.updateSvgDimensions();
  }

  goToNextWeek() {
    const newDate = new Date(this.currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    this.currentWeekStart = new Date(newDate);
    this.updateWeekDays();
    this.updateSvgDimensions();
  }

  goToCurrentWeek() {
    this.currentWeekStart = this.getWeekStart(new Date());
    this.updateWeekDays();
    this.updateSvgDimensions();
  }

  formatWeekRange(): string {
    const weekStart = new Date(this.currentWeekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const startStr = weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    const endStr = weekEnd.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    
    return `${startStr} - ${endStr}`;
  }

  getWeekInputValue(): string {
    const year = this.currentWeekStart.getFullYear();
    const month = String(this.currentWeekStart.getMonth() + 1).padStart(2, '0');
    const day = String(this.currentWeekStart.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onWeekDateChange(dateString: string) {
    if (dateString) {
      const [year, month, day] = dateString.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);
      this.currentWeekStart = this.getWeekStart(selectedDate);
      this.updateWeekDays();
      this.updateSvgDimensions();
    }
  }

  isCurrentWeek(): boolean {
    const today = new Date();
    const currentWeekStart = this.getWeekStart(today);
    return this.currentWeekStart.toDateString() === currentWeekStart.toDateString();
  }

  // Sistema de tooltip
  showTaskTooltip(task: Task): void {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }

    this.tooltipTask = task;
    this.showTooltip = true;

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
  }

  // Menú contextual
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
    this.gestureCleanups.forEach(cleanup => cleanup());
    this.gestureCleanups = [];
  }
}
