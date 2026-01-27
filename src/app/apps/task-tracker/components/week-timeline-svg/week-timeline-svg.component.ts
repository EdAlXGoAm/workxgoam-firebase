import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, HostListener, ViewChild, ElementRef, AfterViewInit, OnDestroy, ChangeDetectorRef, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { Environment } from '../../models/environment.model';
import { TaskType } from '../../models/task-type.model';
import { Project } from '../../models/project.model';
import { TaskGroup } from '../../models/task-group.model';
import { TimelineFocusService } from '../../services/timeline-focus.service';
import { ProjectService } from '../../services/project.service';
import { GestureService, GestureEvent, GestureConfig } from '../../services/gesture.service';
import { TaskTimeService } from '../../services/task-time.service';
import { AndroidDatePickerComponent } from '../android-date-picker/android-date-picker.component';
import { TimeShiftModalComponent, TimeShiftResult } from '../../modals/time-shift-modal/time-shift-modal.component';
import { DurationEditModalComponent, DurationEditResult } from '../../modals/duration-edit-modal/duration-edit-modal.component';
import { Subscription } from 'rxjs';
import { Overlay, OverlayRef, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { TaskContextMenuComponent, TaskContextMenuEvent } from '../task-context-menu/task-context-menu.component';

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
  @Input() taskGroups: TaskGroup[] = [];
  
  private loadedProjects: Project[] = [];
  
  focusedEnvironmentId: string | null = null;
  private focusSubscription?: Subscription;
  private gestureSubscription?: Subscription;
  private gestureCleanups: (() => void)[] = [];
  
  // Modo de coloreado
  colorMode: 'environment' | 'taskType' = 'environment';

  // Estado de previsualización (sombra)
  previewState = {
    visible: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    dayIndex: 0
  };

  // Preview secundaria para cuando el drag se extiende a otro día
  previewStateSecondary = {
    visible: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    dayIndex: 0
  };

  // Estado de selección de rango para crear nuevas tareas
  rangeSelectionState = {
    isSelecting: false,
    startY: 0,
    currentY: 0,
    dayIndex: 0,
    dayStartDate: new Date()
  };

  // Rectángulo visual de selección de rango
  rangeSelectionRect = {
    visible: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    dayIndex: 0
  };

  constructor(
    private cdr: ChangeDetectorRef,
    private timelineFocusService: TimelineFocusService,
    private projectService: ProjectService,
    private gestureService: GestureService,
    private taskTimeService: TaskTimeService,
    private overlay: Overlay
  ) {}

  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<Task>();
  @Output() toggleHidden = new EventEmitter<Task>();
  @Output() changeStatus = new EventEmitter<{ task: Task; status: 'pending' | 'in-progress' | 'completed' }>();
  @Output() taskUpdated = new EventEmitter<Task>();
  @Output() createTaskWithRange = new EventEmitter<{ startTime: Date; endTime: Date }>();

  @ViewChild('containerRef') containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('svgScrollContainer') svgScrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('hoursIndicator') hoursIndicator!: ElementRef<HTMLDivElement>;
  @ViewChild('daysIndicator') daysIndicator!: ElementRef<HTMLDivElement>;
  @ViewChildren('taskRect') taskRects!: QueryList<ElementRef<SVGRectElement>>;
  @ViewChildren('resizeHandleStart') resizeHandlesStart!: QueryList<ElementRef<SVGRectElement>>;
  @ViewChildren('resizeHandleEnd') resizeHandlesEnd!: QueryList<ElementRef<SVGRectElement>>;

  // 📅 NAVEGACIÓN DE SEMANA
  currentWeekStart: Date = this.getWeekStart(new Date());
  
  // 🔄 FILTRO DE FINES DE SEMANA
  showWeekends: boolean = true;
  
  // 💡 SISTEMA DE TOOLTIP
  showTooltip: boolean = false;
  tooltipTask: Task | null = null;
  tooltipTimeout: any = null;
  // Variables para detectar selección de texto en tooltip
  private tooltipMouseDownPos: { x: number; y: number } | null = null;
  private isTooltipTextSelection: boolean = false;

  // 📱 SISTEMA DE MENÚ CONTEXTUAL
  showContextMenu: boolean = false;
  contextMenuTask: Task | null = null;
  contextMenuX: number = 0;
  contextMenuY: number = 0;
  private overlayRef: OverlayRef | null = null;

  // 🎯 SISTEMA DE SELECCIÓN DE TAREAS SUPERPUESTAS
  showTaskSelector: boolean = false;
  taskSelectorItems: RenderableItem[] = [];
  taskSelectorX: number = 0;
  taskSelectorY: number = 0;
  taskSelectorDayIndex: number = 0;
  
  // Mapa para mantener el orden de las tareas "traídas al frente" (clave: task.id, valor: timestamp)
  private taskZOrderMap: Map<string, number> = new Map();

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

  // Propiedades de dimensiones
  svgWidth = 1400;
  minSvgWidth = 800;
  hoursAreaHeight = 900; // 24 horas * 37.5px
  svgHeight = 60 + this.hoursAreaHeight;
  
  dayColumnWidth = 180;
  dayColumnPadding = 4;
  columnGap = 2;
  
  // ==========================================
  // 🎯 VARIABLES DE CALIBRACIÓN DEL HEADER DE DÍAS
  // Estas variables escalan proporcionalmente con el zoom
  // ==========================================
  
  // Offset izquierdo del header de días (como padding inicial)
  // Valor base que se multiplicará por zoomScale
  headerDayLeftOffset = 60; // Ajusta este valor para mover el header hacia la derecha
  
  // Ancho de cada día en el header
  // Valor base que se multiplicará por zoomScale
  headerDayWidth = 200; // Ajusta este valor para cambiar el ancho de cada día en el header
  
  // Propiedades para pan libre (horizontal y vertical) con Ctrl+drag
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartScrollLeft = 0;
  private panStartScrollTop = 0;
  
  // Fuentes
  dayNameFontSize = 14;
  dayNumberFontSize = 12;
  hourFontSize = 10;
  taskFontSize = 11;
  
  hours: number[] = Array.from({length: 48}, (_, i) => i);
  
  // Array de horas completas para el indicador lateral (0-23)
  get fullHours(): number[] {
    return Array.from({length: 24}, (_, i) => i);
  }
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

  // ==========================================
  // 🎯 GETTERS ESCALADOS PARA EL HEADER DE DÍAS
  // ==========================================
  
  /**
   * Offset izquierdo del header escalado con el zoom
   * Úsalo para ajustar el padding/margen izquierdo del header
   */
  get scaledHeaderDayLeftOffset(): number {
    return this.headerDayLeftOffset * this.zoomScale;
  }
  
  /**
   * Ancho de cada día en el header escalado con el zoom
   * Úsalo para ajustar el ancho de cada columna de día en el header
   */
  get scaledHeaderDayWidth(): number {
    return this.dayColumnWidth * this.zoomScale;
  }
  
  /**
   * Calcula la posición X de cada día en el header del indicador fijo
   * Usa el ancho de columna calculado para que sea responsivo
   * @param dayIndex Índice visual del día (0-4 o 0-6)
   */
  getHeaderDayX(dayIndex: number): number {
    return this.headerDayLeftOffset + (dayIndex * (this.dayColumnWidth + this.columnGap));
  }
  
  /**
   * Calcula el ancho total del SVG del header de días
   * Basado en las dimensiones calculadas y el número de días visibles
   */
  get headerSvgWidth(): number {
    const daysCount = this.visibleDaysCount;
    // Usar dayColumnWidth en lugar de headerDayWidth para que sea responsivo
    return this.headerDayLeftOffset + (daysCount * this.dayColumnWidth) + ((daysCount - 1) * this.columnGap);
  }
  
  /**
   * Ratio entre el ancho del header y el ancho del SVG principal
   * Se usa para sincronizar el scroll horizontal correctamente
   */
  get headerToSvgWidthRatio(): number {
    if (this.svgWidth === 0) return 1;
    return this.headerSvgWidth / this.svgWidth;
  }

  // Sistema de zoom (incrementos de 5%)
  zoomScale: number = 1.0;
  readonly zoomStep = 0.05; // 5%
  readonly minZoom = 0.5; // 50%
  readonly maxZoom = 2.0; // 200%

  zoomOut(): void {
    const newScale = this.zoomScale - this.zoomStep;
    if (newScale >= this.minZoom) {
      this.zoomScale = Math.round(newScale * 100) / 100; // Redondear a 2 decimales
      this.applyZoom();
    }
  }

  zoomIn(): void {
    const newScale = this.zoomScale + this.zoomStep;
    if (newScale <= this.maxZoom) {
      this.zoomScale = Math.round(newScale * 100) / 100; // Redondear a 2 decimales
      this.applyZoom();
    }
  }

  resetZoom(): void {
    this.zoomScale = 1.0;
    this.applyZoom();
  }

  private applyZoom(): void {
    // El zoom se aplica mediante CSS transform en el template
    // Actualizar sincronización del indicador de horas y días
    setTimeout(() => {
      if (this.hoursIndicator?.nativeElement && this.svgScrollContainer?.nativeElement) {
        const hoursIndicator = this.hoursIndicator.nativeElement;
        const scrollContainer = this.svgScrollContainer.nativeElement;
        // Ajustar altura del indicador para que coincida con el contenedor escalado
        hoursIndicator.style.height = scrollContainer.offsetHeight + 'px';
        hoursIndicator.style.width = (60 * this.zoomScale) + 'px';
      }
      if (this.daysIndicator?.nativeElement && this.svgScrollContainer?.nativeElement) {
        const daysIndicator = this.daysIndicator.nativeElement;
        // El ancho debe ser el SVG SIN escalar, ya que CSS transform se encarga del zoom visual
        daysIndicator.style.width = this.headerSvgWidth + 'px';
      }
    }, 0);
    this.cdr.detectChanges();
  }

  canZoomOut(): boolean {
    return this.zoomScale > this.minZoom;
  }

  canZoomIn(): boolean {
    return this.zoomScale < this.maxZoom;
  }

  isZoomReset(): boolean {
    return Math.abs(this.zoomScale - 1.0) < 0.01; // Permitir pequeña diferencia por redondeo
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

  /**
   * Obtener los días visibles según el filtro de fines de semana
   */
  get visibleWeekDays(): WeekDay[] {
    if (this.showWeekends) {
      return this.weekDays;
    }
    // Filtrar sábado (índice 6) y domingo (índice 0)
    return this.weekDays.filter((day, index) => index !== 0 && index !== 6);
  }

  /**
   * Convertir índice visual (0-4 cuando no hay fines de semana) a índice real del día (0-6)
   */
  getRealDayIndex(visualIndex: number): number {
    if (this.showWeekends) {
      return visualIndex;
    }
    // Mapear: 0->1(Lun), 1->2(Mar), 2->3(Mié), 3->4(Jue), 4->5(Vie)
    return visualIndex + 1;
  }

  /**
   * Convertir índice real del día (0-6) a índice visual (0-4 cuando no hay fines de semana)
   */
  getVisualDayIndex(realIndex: number): number {
    if (this.showWeekends) {
      return realIndex;
    }
    // Mapear: 1(Lun)->0, 2(Mar)->1, 3(Mié)->2, 4(Jue)->3, 5(Vie)->4
    // Si es domingo (0) o sábado (6), retornar -1 (no visible)
    if (realIndex === 0 || realIndex === 6) {
      return -1;
    }
    return realIndex - 1;
  }

  /**
   * Obtener el número de días visibles
   */
  get visibleDaysCount(): number {
    return this.showWeekends ? 7 : 5;
  }

  toggleWeekends(): void {
    this.showWeekends = !this.showWeekends;
    // updateSvgDimensions ya se encarga de actualizar el ancho del indicador de días
    this.updateSvgDimensions();
    this.cdr.detectChanges();
  }

  getDayColumnX(dayIndex: number): number {
    // dayIndex aquí es el índice visual (0-4 o 0-6)
    return dayIndex * (this.dayColumnWidth + this.columnGap);
  }

  getHourY(hourIndex: number): number {
    return hourIndex * 18.75;
  }

  isTodayColumn(dayIndex: number): boolean {
    // dayIndex es el índice visual, convertir a índice real
    const realIndex = this.getRealDayIndex(dayIndex);
    const today = new Date();
    const day = this.weekDays[realIndex];
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
    this.initializePanHandlers();
    this.initializeRangeSelectionHandlers();
    this.initializeHoursIndicatorSync();
    this.initializeDaysIndicatorSync();
    setTimeout(() => {
      this.updateSvgDimensions();
      this.registerTaskGestures();
      this.scrollToInitialPosition();
    }, 100);

    this.taskRects.changes.subscribe(() => {
      this.registerTaskGestures();
    });
  }
  
  /**
   * Hacer scroll a una posición inicial útil (8:00 AM por defecto)
   * para mostrar las horas más relevantes del día laboral
   */
  private scrollToInitialPosition(): void {
    if (!this.svgScrollContainer?.nativeElement) return;
    
    const scrollContainer = this.svgScrollContainer.nativeElement;
    
    // Hora inicial para el scroll (8:00 AM = hora 8)
    const initialHour = 8;
    const scrollTop = initialHour * this.pixelsPerHour;
    
    // Aplicar scroll suave
    scrollContainer.scrollTo({
      top: scrollTop,
      behavior: 'auto' // 'auto' para scroll instantáneo, 'smooth' para animado
    });
  }
  
  /**
   * Inicializar handlers para pan horizontal y vertical con Ctrl+drag
   */
  private initializePanHandlers(): void {
    if (!this.svgScrollContainer?.nativeElement) return;
    
    const scrollContainer = this.svgScrollContainer.nativeElement;
    const svgElement = scrollContainer.querySelector('.week-timeline-svg') as SVGElement;
    
    // Función para verificar si el click es sobre una tarea
    const isClickOnTask = (e: MouseEvent): boolean => {
      const target = e.target as HTMLElement;
      return target?.closest('.task-rect, .task-inner, .resize-handle') !== null;
    };
    
    // Mousedown: iniciar pan si Ctrl está presionado y no es sobre una tarea
    const handleMouseDown = (e: MouseEvent) => {
      if ((e.ctrlKey || e.metaKey) && !isClickOnTask(e)) {
        // Prevenir el comportamiento por defecto y los gestos de tareas
        e.preventDefault();
        e.stopPropagation();
        
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.panStartScrollLeft = scrollContainer.scrollLeft;
        this.panStartScrollTop = scrollContainer.scrollTop;
        
        // Cambiar cursor a "grabbing"
        scrollContainer.style.cursor = 'grabbing';
        scrollContainer.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        
        // También aplicar al SVG si existe
        if (svgElement) {
          svgElement.style.cursor = 'grabbing';
        }
        
        // Agregar listener global para capturar movimientos rápidos
        document.addEventListener('mousemove', handleDocumentMouseMove, { passive: false });
        document.addEventListener('mouseup', handleDocumentMouseUp, { passive: false });
      }
    };
    
    // Mousemove local: solo para cambiar cursor cuando Ctrl está presionado
    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isPanning && (e.ctrlKey || e.metaKey) && !isClickOnTask(e)) {
        // Cambiar cursor a "grab" cuando Ctrl está presionado y no está sobre una tarea
        scrollContainer.style.cursor = 'grab';
        if (svgElement) {
          svgElement.style.cursor = 'grab';
        }
      }
    };
    
    // Mousemove global: actualizar scroll durante el pan (captura movimientos rápidos)
    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (this.isPanning) {
        e.preventDefault();
        e.stopPropagation();
        
        const deltaX = e.clientX - this.panStartX;
        const deltaY = e.clientY - this.panStartY;
        
        // Desplazamiento horizontal y vertical
        scrollContainer.scrollLeft = this.panStartScrollLeft - deltaX;
        scrollContainer.scrollTop = this.panStartScrollTop - deltaY;
      }
    };
    
    // Mouseup local: solo para casos normales
    const handleMouseUp = (e: MouseEvent) => {
      if (this.isPanning) {
        e.preventDefault();
        e.stopPropagation();
        finishPanning();
      }
    };
    
    // Mouseup global: finalizar pan (captura cuando se suelta fuera del contenedor)
    const handleDocumentMouseUp = (e: MouseEvent) => {
      if (this.isPanning) {
        e.preventDefault();
        e.stopPropagation();
        finishPanning();
      }
    };
    
    // Función para finalizar el pan y limpiar
    const finishPanning = () => {
      this.isPanning = false;
      scrollContainer.style.cursor = '';
      scrollContainer.style.userSelect = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (svgElement) {
        svgElement.style.cursor = '';
      }
      
      // Remover listeners globales
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
    
    // Mouseleave: finalizar pan si el mouse sale del contenedor
    const handleMouseLeave = (e: MouseEvent) => {
      // No finalizar aquí, dejar que handleDocumentMouseUp lo maneje
      // Esto permite continuar el pan incluso si el mouse sale del contenedor
    };
    
    // Agregar listeners locales al contenedor de scroll
    scrollContainer.addEventListener('mousedown', handleMouseDown, true);
    scrollContainer.addEventListener('mousemove', handleMouseMove, true);
    scrollContainer.addEventListener('mouseup', handleMouseUp, true);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave, true);
    
    // Detectar cuando se presiona/suelta Ctrl para cambiar el cursor
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !this.isPanning && scrollContainer) {
        scrollContainer.style.cursor = 'grab';
        if (svgElement) {
          svgElement.style.cursor = 'grab';
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey && !this.isPanning && scrollContainer) {
        scrollContainer.style.cursor = '';
        if (svgElement) {
          svgElement.style.cursor = '';
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Limpiar listeners en ngOnDestroy
    this.panCleanup = () => {
      scrollContainer.removeEventListener('mousedown', handleMouseDown, true);
      scrollContainer.removeEventListener('mousemove', handleMouseMove, true);
      scrollContainer.removeEventListener('mouseup', handleMouseUp, true);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave, true);
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }
  
  private panCleanup?: () => void;
  private rangeSelectionCleanup?: () => void;
  private hoursIndicatorSyncCleanup?: () => void;
  private daysIndicatorSyncCleanup?: () => void;

  /**
   * Sincronizar el scroll horizontal del indicador de días con el contenedor SVG
   */
  private initializeDaysIndicatorSync(): void {
    if (!this.svgScrollContainer?.nativeElement || !this.daysIndicator?.nativeElement) return;
    
    const scrollContainer = this.svgScrollContainer.nativeElement;
    const daysIndicator = this.daysIndicator.nativeElement;
    
    // Sincronizar ancho del indicador con el contenedor
    // El ancho debe ser el SVG SIN escalar, ya que CSS transform se encarga del zoom visual
    const updateWidth = () => {
      daysIndicator.style.width = this.headerSvgWidth + 'px';
    };
    updateWidth();
    
    // Sincronizar scroll del contenedor al indicador
    // Ajusta por el ratio de anchos entre header y SVG principal
    let isScrollingContainer = false;
    const handleContainerScroll = () => {
      if (!isScrollingContainer) {
        isScrollingContainer = true;
        // Calcular el scroll proporcional basado en el ratio de anchos
        const ratio = this.headerToSvgWidthRatio;
        daysIndicator.scrollLeft = (scrollContainer.scrollLeft / this.zoomScale) * ratio;
        requestAnimationFrame(() => {
          isScrollingContainer = false;
        });
      }
    };
    
    // Sincronizar scroll del indicador al contenedor
    let isScrollingIndicator = false;
    const handleIndicatorScroll = () => {
      if (!isScrollingIndicator) {
        isScrollingIndicator = true;
        // Calcular el scroll proporcional inverso
        const ratio = this.headerToSvgWidthRatio;
        scrollContainer.scrollLeft = (daysIndicator.scrollLeft * this.zoomScale) / ratio;
        requestAnimationFrame(() => {
          isScrollingIndicator = false;
        });
      }
    };
    
    scrollContainer.addEventListener('scroll', handleContainerScroll, { passive: true });
    daysIndicator.addEventListener('scroll', handleIndicatorScroll, { passive: true });
    
    // Observar cambios de tamaño
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    resizeObserver.observe(scrollContainer);
    
    this.daysIndicatorSyncCleanup = () => {
      scrollContainer.removeEventListener('scroll', handleContainerScroll);
      daysIndicator.removeEventListener('scroll', handleIndicatorScroll);
      resizeObserver.disconnect();
    };
  }

  /**
   * Sincronizar el scroll vertical del indicador de horas con el contenedor SVG
   * Usa CSS transform en lugar de scrollTop para mejor rendimiento (evita reflows)
   */
  private initializeHoursIndicatorSync(): void {
    if (!this.svgScrollContainer?.nativeElement || !this.hoursIndicator?.nativeElement) return;
    
    const scrollContainer = this.svgScrollContainer.nativeElement;
    const hoursIndicator = this.hoursIndicator.nativeElement;
    const hoursSvg = hoursIndicator.querySelector('.hours-indicator-svg') as SVGElement;
    
    if (!hoursSvg) return;
    
    // Sincronizar altura del indicador con el contenedor
    const updateHeight = () => {
      hoursIndicator.style.height = scrollContainer.offsetHeight + 'px';
      hoursIndicator.style.width = (60 * this.zoomScale) + 'px';
    };
    updateHeight();
    
    // Sincronizar scroll del contenedor al indicador usando transform (más eficiente)
    const handleContainerScroll = () => {
      // Usar transform en lugar de scrollTop para evitar reflows
      const scrollTop = scrollContainer.scrollTop;
      hoursSvg.style.transform = `translateY(-${scrollTop}px)`;
    };
    
    // Usar passive: true para mejor rendimiento del scroll
    scrollContainer.addEventListener('scroll', handleContainerScroll, { passive: true });
    
    // Observar cambios de tamaño
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });
    resizeObserver.observe(scrollContainer);
    
    this.hoursIndicatorSyncCleanup = () => {
      scrollContainer.removeEventListener('scroll', handleContainerScroll);
      resizeObserver.disconnect();
    };
  }

  /**
   * Inicializar handlers para selección de rango (crear tarea)
   */
  private initializeRangeSelectionHandlers(): void {
    if (!this.svgScrollContainer?.nativeElement) return;
    
    const scrollContainer = this.svgScrollContainer.nativeElement;
    const svgElement = scrollContainer.querySelector('.week-timeline-svg') as SVGElement;
    if (!svgElement) return;
    
    // Handler de mousedown para iniciar selección de rango
    const handleRangeMouseDown = (e: MouseEvent) => {
      // Solo procesar click izquierdo
      if (e.button !== 0) return;
      
      // No iniciar si Ctrl está presionado (para pan)
      if (e.ctrlKey || e.metaKey) return;
      
      // Verificar que sea un área vacía
      if (!this.isClickOnEmptyArea(e.target)) return;
      
      const svgRect = svgElement.getBoundingClientRect();
      // Ajustar por zoom para convertir a espacio SVG sin escalar
      const localX = (e.clientX - svgRect.left) / this.zoomScale;
      const localY = (e.clientY - svgRect.top) / this.zoomScale;
      
      // Determinar el día
      const { dayIndex, dayDate } = this.getDayFromX(localX);
      
      // Solo permitir selección en el área de horas (después del header de 60px)
      if (localY < 60) return;
      
      // Iniciar estado de selección
      this.rangeSelectionState = {
        isSelecting: true,
        startY: localY - 60, // Relativo al inicio del área de horas
        currentY: localY - 60,
        dayIndex: dayIndex,
        dayStartDate: dayDate
      };
      
      // Inicializar rectángulo visual
      this.updateRangeSelectionRect(localY - 60, localY - 60, dayIndex);
      
      // Forzar detección de cambios para mostrar el rectángulo
      this.cdr.detectChanges();
      
      // Prevenir comportamiento por defecto solo si no es pan
      e.preventDefault();
      e.stopPropagation();
    };
    
    // Agregar listener al SVG con captura para que se ejecute antes del pan handler
    svgElement.addEventListener('mousedown', handleRangeMouseDown, true);
    
    // Limpiar en ngOnDestroy
    this.rangeSelectionCleanup = () => {
      svgElement.removeEventListener('mousedown', handleRangeMouseDown, true);
    };
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
      const dayIndexStr = rect.getAttribute('data-day-index');
      const fragmentIndex = fragmentIndexStr ? parseInt(fragmentIndexStr, 10) : undefined;
      const dayIndex = dayIndexStr ? parseInt(dayIndexStr, 10) : 0;

      if (taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
          const data = { task, fragmentIndex, dayIndex };

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
    const dayIndex: number = event.data.dayIndex || 0;

    // Fase MOVE: Actualizar previsualización (sombra)
    if (event.phase === 'move') {
      this.updatePreview(task, fragmentIndex, dayIndex, event);
      return;
    }

    // Fase END: Ejecutar acción y limpiar
    if (event.phase === 'end') {
      this.previewState.visible = false;
      this.previewStateSecondary.visible = false;
      this.cdr.detectChanges();

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
          // Siempre traer la tarea clickeada al frente
          const clickedItem: RenderableItem = fragmentIndex !== undefined && task.fragments && task.fragments[fragmentIndex]
            ? { type: 'fragment', task, fragmentIndex, start: task.fragments[fragmentIndex].start, end: task.fragments[fragmentIndex].end }
            : { type: 'task', task, start: task.start, end: task.end };
          this.bringItemToFront(clickedItem);
          
          // Verificar si hay múltiples tareas superpuestas en el punto del clic
          const overlappingItems = this.getOverlappingItemsAtPoint(event.endX, event.endY, dayIndex);
          if (overlappingItems.length > 1) {
            // Mostrar menú de selección si hay múltiples tareas superpuestas
            this.showTaskSelectorMenu(overlappingItems, event.endX, event.endY, dayIndex);
          } else {
            // Mostrar tooltip si solo hay una tarea
          this.showTaskTooltip(task);
          }
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
  private updatePreview(task: Task, fragmentIndex: number | undefined, dayIndex: number, event: GestureEvent): void {
    let item: RenderableItem;
    if (fragmentIndex !== undefined && task.fragments && task.fragments[fragmentIndex]) {
        const f = task.fragments[fragmentIndex];
        item = { type: 'fragment', task, fragmentIndex, start: f.start, end: f.end };
    } else {
        item = { type: 'task', task, start: task.start, end: task.end };
    }

    const originalY = this.getTaskY(item, dayIndex);
    const originalHeight = this.getTaskHeight(item, dayIndex);
    const width = this.getTaskWidth(item, dayIndex);
    const x = this.getTaskX(item, dayIndex);
    
    let newY = originalY;
    let newHeight = originalHeight;
    let newDayIndex = dayIndex;

    // Resetear preview secundaria
    this.previewStateSecondary.visible = false;

    if (event.type === 'drag-up' || event.type === 'drag-down') {
        // Movimiento vertical con posible componente horizontal
        // Ajustar deltaY por zoom para convertir a espacio SVG sin escalar
        newY += event.deltaY / this.zoomScale;
        
        // Detectar movimiento horizontal significativo (más de 30px)
        // Ajustar deltaX por zoom para convertir a espacio SVG sin escalar
        if (Math.abs(event.deltaX / this.zoomScale) > 30) {
          // Calcular nuevo día basándose en deltaX (ya ajustado por zoom)
          const dayColumnWidth = this.dayColumnWidth + this.columnGap;
          const dayOffset = Math.round((event.deltaX / this.zoomScale) / dayColumnWidth);
          const maxVisualIndex = this.visibleDaysCount - 1;
          newDayIndex = Math.max(0, Math.min(maxVisualIndex, dayIndex + dayOffset));
          
          // Si cambió de día, mostrar previsualización secundaria
          if (newDayIndex !== dayIndex) {
            const targetDayX = this.getDayColumnX(newDayIndex) + this.dayColumnPadding;
            this.previewStateSecondary = {
              visible: true,
              x: targetDayX,
              y: newY,
              width: width,
              height: originalHeight,
              dayIndex: newDayIndex
            };
            
            // Mantener la previsualización principal en el día original pero ajustada
            // Limitar Y dentro de los límites del día original
            newY = Math.max(0, Math.min(this.hoursAreaHeight - originalHeight, newY));
          }
        } else {
          // Solo movimiento vertical, limitar dentro del día
          newY = Math.max(0, Math.min(this.hoursAreaHeight - originalHeight, newY));
        }
    } else if (event.type === 'resize-start') {
        // Resize desde el borde superior
        // deltaY > 0 = arrastrar hacia abajo = REDUCIR tarea
        // deltaY < 0 = arrastrar hacia arriba = EXTENDER tarea
        // Ajustar deltaY por zoom para convertir a espacio SVG sin escalar
        const originalEndY = originalY + originalHeight;
        const adjustedDeltaY = event.deltaY / this.zoomScale;
        newY += adjustedDeltaY;
        newHeight -= adjustedDeltaY;
        
        // REDUCCIÓN: Limitar para que el inicio no pase del final menos altura mínima
        if (adjustedDeltaY > 0) {
          const minHeight = 5;
          const maxNewY = originalEndY - minHeight;
          if (newY > maxNewY) {
            newY = maxNewY;
            newHeight = minHeight;
          }
        }
        
        // EXTENSIÓN: Detectar si se extiende antes de las 00:00
        if (newY < 0) {
          // Mostrar previsualización secundaria en el día anterior
          if (dayIndex > 0) {
            const overflow = -newY;
            const prevDayIndex = dayIndex - 1;
            const prevDayX = this.getDayColumnX(prevDayIndex) + this.dayColumnPadding;
            
            // Calcular altura en el día anterior
            const prevDayHeight = Math.min(overflow, this.hoursAreaHeight);
            const prevDayY = this.hoursAreaHeight - prevDayHeight;
            
            this.previewStateSecondary = {
              visible: true,
              x: prevDayX,
              y: prevDayY,
              width: width,
              height: prevDayHeight,
              dayIndex: prevDayIndex
            };
            
            // Ajustar preview principal: desde Y=0 hasta el final original de la tarea
            newY = 0;
            newHeight = originalEndY; // Mantener el final donde estaba
          } else {
            // No hay día anterior, limitar en 00:00
            newY = 0;
            newHeight = originalEndY; // La tarea va desde 00:00 hasta su final original
          }
        }
        
        // Limitar altura mínima
        newHeight = Math.max(5, newHeight);
    } else if (event.type === 'resize-end') {
        // Resize desde el borde inferior
        // deltaY > 0 = arrastrar hacia abajo = EXTENDER tarea
        // deltaY < 0 = arrastrar hacia arriba = REDUCIR tarea
        // Ajustar deltaY por zoom para convertir a espacio SVG sin escalar
        const adjustedDeltaY = event.deltaY / this.zoomScale;
        newHeight += adjustedDeltaY;
        
        // REDUCCIÓN: Limitar altura mínima
        if (adjustedDeltaY < 0) {
          const minHeight = 5;
          newHeight = Math.max(minHeight, newHeight);
        }
        
        // EXTENSIÓN: Detectar si se extiende después de las 23:59
        const bottomY = newY + newHeight;
        if (bottomY > this.hoursAreaHeight) {
          // Mostrar previsualización secundaria en el día siguiente
          const maxVisualIndex = this.visibleDaysCount - 1;
          if (dayIndex < maxVisualIndex) {
            const overflow = bottomY - this.hoursAreaHeight;
            const nextDayIndex = dayIndex + 1;
            const nextDayX = this.getDayColumnX(nextDayIndex) + this.dayColumnPadding;
            
            // Calcular altura en el día siguiente
            const nextDayHeight = Math.min(overflow, this.hoursAreaHeight);
            
            this.previewStateSecondary = {
              visible: true,
              x: nextDayX,
              y: 0,
              width: width,
              height: nextDayHeight,
              dayIndex: nextDayIndex
            };
            
            // Ajustar preview principal para que termine en 23:59 del día actual
            newHeight = this.hoursAreaHeight - newY;
          } else {
            // No hay día siguiente, limitar en 23:59
            newHeight = this.hoursAreaHeight - newY;
          }
        }
        
        // Limitar altura mínima (por si acaso)
        newHeight = Math.max(5, newHeight);
    }

    this.previewState = {
        visible: true,
        x: x,
        y: Math.max(0, Math.min(this.hoursAreaHeight - 5, newY)),
        width: width,
        height: Math.max(5, Math.min(this.hoursAreaHeight, newHeight)),
        dayIndex: newDayIndex
    };
    
    this.cdr.detectChanges();
  }

  /**
   * Abrir modal de desplazamiento de tiempo
   */
  private openTimeShiftModal(task: Task, fragmentIndex: number | undefined, event: GestureEvent): void {
    this.hideTooltip();
    this.closeContextMenu();

    // Para vertical: drag-up = más temprano (backward), drag-down = más tarde (forward)
    const direction = event.type === 'drag-down' ? 'forward' : 'backward';
    
    // Calcular minutos de desplazamiento vertical
    // Ajustar deltaY por zoom para convertir a espacio SVG sin escalar
    let suggestedMinutes = this.gestureService.calculateTimeShift(
      Math.abs(event.deltaY) / this.zoomScale,
      this.pixelsPerHour,
      15
    );
    
    // Detectar movimiento horizontal significativo (más de 30px)
    // y agregar minutos equivalentes al cambio de día
    // Ajustar deltaX por zoom para convertir a espacio SVG sin escalar
    if (Math.abs(event.deltaX / this.zoomScale) > 30) {
      const dayColumnWidth = this.dayColumnWidth + this.columnGap;
      const dayOffset = Math.round((event.deltaX / this.zoomScale) / dayColumnWidth);
      
      // Agregar minutos equivalentes a los días de desplazamiento
      // Cada día = 24 horas = 1440 minutos
      const dayMinutes = Math.abs(dayOffset) * 1440;
      
      // Si hay movimiento horizontal, agregar los minutos de los días
      // El movimiento vertical ya está calculado arriba
      suggestedMinutes += dayMinutes;
    }

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
    
    let currentDuration = 0;
    if (fragmentIndex !== undefined && task.fragments && task.fragments[fragmentIndex]) {
        currentDuration = this.taskTimeService.getFragmentDurationMinutes(task, fragmentIndex);
    } else {
        currentDuration = this.taskTimeService.getTaskDurationMinutes(task);
    }

    // Ajustar deltaY por zoom para convertir a espacio SVG sin escalar
    let pixels = event.deltaY / this.zoomScale;
    if (event.type === 'resize-start') {
        pixels = -pixels;
    }

    const pixelsPerHour = this.hoursAreaHeight / 24;

    this.suggestedDurationMinutes = this.gestureService.calculateDurationChange(
        currentDuration,
        pixels,
        pixelsPerHour,
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
    // Ya no necesitamos reposicionar manualmente, CDK Overlay lo maneja automáticamente
  }

  private initializeResizeObserver() {
    if (typeof ResizeObserver !== 'undefined' && this.svgScrollContainer?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateSvgDimensions();
      });
      this.resizeObserver.observe(this.svgScrollContainer.nativeElement);
    } else if (typeof ResizeObserver !== 'undefined' && this.containerRef?.nativeElement) {
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
    
    // Usar el ancho de la ventana como base para evitar el crecimiento infinito
    // del contenedor cuando tiene min-width: fit-content
    let containerWidth = screenWidth;

    if (this.containerRef?.nativeElement) {
      // Intentar obtener el ancho del padre que debería ser el que limita el espacio
      const parent = this.containerRef.nativeElement.parentElement;
      if (parent) {
        containerWidth = parent.clientWidth || screenWidth;
      } else {
        containerWidth = this.containerRef.nativeElement.clientWidth || screenWidth;
      }
    }

    // Asegurar que el ancho de columna del cuerpo coincida con el del header (calibración)
    this.dayColumnWidth = this.headerDayWidth;

    const availableWidth = Math.max(containerWidth - this.containerPadding, this.minSvgWidth);
    const daysCount = this.visibleDaysCount;
    const gapsCount = daysCount - 1;
    
    if (screenWidth <= 640) {
      // En móvil, si el ancho calibrado es muy grande, lo ajustamos para que quepan los días
      // pero mantenemos un mínimo de 120px para legibilidad
      const fitWidth = (availableWidth - gapsCount * this.columnGap) / daysCount;
      this.dayColumnWidth = Math.max(120, Math.min(this.headerDayWidth, fitWidth));
      
      this.dayNameFontSize = 11;
      this.dayNumberFontSize = 10;
      this.hourFontSize = 8;
      this.taskFontSize = 9;
    } else if (screenWidth <= 1024) {
      // En tablets, ajuste similar
      const fitWidth = (availableWidth - gapsCount * this.columnGap) / daysCount;
      this.dayColumnWidth = Math.max(140, Math.min(this.headerDayWidth, fitWidth));
      
      this.dayNameFontSize = 12;
      this.dayNumberFontSize = 11;
      this.hourFontSize = 9;
      this.taskFontSize = 10;
    } else {
      // En escritorio, usamos el valor calibrado si es posible, o lo ajustamos al espacio disponible
      // si el espacio es muy grande, pero siempre respetando la intención del usuario
      this.dayNameFontSize = 14;
      this.dayNumberFontSize = 12;
      this.hourFontSize = 10;
      this.taskFontSize = 11;
    }

    // El ancho de columna ya está calculado en this.dayColumnWidth
    // No sobreescribimos this.headerDayWidth para preservar la calibración original del usuario

    const minRequiredWidth = daysCount * (this.dayColumnWidth + this.columnGap) - this.columnGap;
    this.svgWidth = Math.max(minRequiredWidth, daysCount * (this.dayColumnWidth + this.columnGap) - this.columnGap);
    
    // Actualizar ancho del indicador de días después de calcular las dimensiones
    setTimeout(() => {
      if (this.daysIndicator?.nativeElement && this.svgScrollContainer?.nativeElement) {
        const daysIndicator = this.daysIndicator.nativeElement;
        // El ancho del indicador de días debe ser el ancho total calculado del header
        daysIndicator.style.width = this.headerSvgWidth + 'px';
      }
    }, 0);
  }

  getRenderableItemsForDay(dayIndex: number): RenderableItem[] {
    // dayIndex es el índice visual, convertir a índice real
    const realIndex = this.getRealDayIndex(dayIndex);
    const day = this.weekDays[realIndex];
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

    // Ordenar items por z-order: los que tienen mayor valor se renderizan al final (arriba)
    items.sort((a, b) => this.getItemZOrder(a) - this.getItemZOrder(b));

    return items;
  }

  getTaskX(item: RenderableItem, dayIndex: number): number {
    return this.dayColumnPadding;
  }

  getTaskY(item: RenderableItem, dayIndex: number): number {
    // dayIndex es el índice visual, convertir a índice real
    const realIndex = this.getRealDayIndex(dayIndex);
    const itemStart = this.parseUTCToLocal(item.start);
    const day = this.weekDays[realIndex];
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
    // dayIndex es el índice visual, convertir a índice real
    const realIndex = this.getRealDayIndex(dayIndex);
    const itemStart = this.parseUTCToLocal(item.start);
    const itemEnd = this.parseUTCToLocal(item.end);
    const day = this.weekDays[realIndex];
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
    // Si no se muestran fines de semana, el último día visible es viernes (día 5)
    const lastDayOffset = this.showWeekends ? 6 : 4;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + lastDayOffset);
    
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

  // Menú contextual
  showTaskContextMenu(task: Task, x: number, y: number): void {
    this.hideTooltip();
    this.closeTaskSelector();
    this.closeContextMenu(); // Cerrar menú anterior si existe
    
    this.contextMenuTask = task;
    
    // Configuración del overlay
    const config = new OverlayConfig({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      positionStrategy: this.overlay.position()
        .flexibleConnectedTo({ x, y })
        .withPositions([
          {
            originX: 'start',
            originY: 'bottom',
            overlayX: 'start',
            overlayY: 'top'
          },
          {
            originX: 'start',
            originY: 'top',
            overlayX: 'start',
            overlayY: 'bottom'
          },
          {
            originX: 'end',
            originY: 'bottom',
            overlayX: 'end',
            overlayY: 'top'
          },
          {
            originX: 'end',
            originY: 'top',
            overlayX: 'end',
            overlayY: 'bottom'
          }
        ]),
      scrollStrategy: this.overlay.scrollStrategies.reposition()
    });
    
    this.overlayRef = this.overlay.create(config);
    
    // Crear portal y adjuntar
    const portal = new ComponentPortal(TaskContextMenuComponent);
    const componentRef = this.overlayRef.attach(portal);
    
    // Pasar datos al componente
    componentRef.instance.task = task;
    componentRef.instance.taskGroups = this.taskGroups;
    componentRef.instance.isOverdue = this.isTaskOverdue(task);
    componentRef.instance.isRunning = this.isTaskRunning(task);
    
    // Escuchar eventos
    componentRef.instance.menuAction.subscribe((event: TaskContextMenuEvent) => {
      this.handleContextMenuAction(event);
    });
    
    componentRef.instance.close.subscribe(() => {
      this.closeContextMenu();
    });
    
    // Cerrar al hacer clic en el backdrop
    this.overlayRef.backdropClick().subscribe(() => {
      this.closeContextMenu();
    });
    
    this.showContextMenu = true;
  }

  /**
   * Manejar acciones del menú contextual
   */
  private handleContextMenuAction(event: TaskContextMenuEvent): void {
    switch (event.action) {
      case 'edit':
        this.editTask.emit(event.task);
        break;
      case 'delete':
        this.deleteTask.emit(event.task);
        break;
      case 'toggleHidden':
        this.toggleHidden.emit(event.task);
        break;
      case 'changeStatus':
        if (event.status) {
          this.changeStatus.emit({ task: event.task, status: event.status });
        }
        break;
    }
  }

  /**
   * Obtener todas las tareas/fragmentos que están en un punto específico
   * Las coordenadas clientX, clientY vienen del evento del gesto (coordenadas de pantalla)
   */
  private getOverlappingItemsAtPoint(clientX: number, clientY: number, dayIndex: number): RenderableItem[] {
    const overlapping: RenderableItem[] = [];
    
    // Obtener el rect del SVG para convertir coordenadas
    const svgElement = this.svgScrollContainer?.nativeElement?.querySelector('.week-timeline-svg') || 
                       this.containerRef?.nativeElement?.querySelector('.week-timeline-svg');
    if (!svgElement) return [];
    
    const svgRect = svgElement.getBoundingClientRect();
    
    // Convertir coordenadas de pantalla a coordenadas del SVG
    // Ajustar por zoom para convertir a espacio SVG sin escalar
    const localX = (clientX - svgRect.left) / this.zoomScale;
    const localY = (clientY - svgRect.top) / this.zoomScale;
    
    // Revisar todos los días visibles para encontrar tareas superpuestas
    for (let di = 0; di < this.visibleDaysCount; di++) {
      const dayColumnX = this.getDayColumnX(di);
      const items = this.getRenderableItemsForDay(di);
      
      for (const item of items) {
        const itemX = dayColumnX + this.getTaskX(item, di);
        const itemY = 60 + this.getTaskY(item, di); // 60px de header
        const itemWidth = this.getTaskWidth(item, di);
        const itemHeight = this.getTaskHeight(item, di);
        
        // Verificar si el punto está dentro del rectángulo de la tarea
        if (localX >= itemX && localX <= itemX + itemWidth &&
            localY >= itemY && localY <= itemY + itemHeight) {
          overlapping.push(item);
        }
      }
    }
    
    return overlapping;
  }

  /**
   * Mostrar el menú de selección de tareas superpuestas
   */
  showTaskSelectorMenu(items: RenderableItem[], x: number, y: number, dayIndex: number): void {
    this.hideTooltip();
    this.closeContextMenu();
    
    this.taskSelectorItems = items;
    this.taskSelectorX = x;
    this.taskSelectorY = y;
    this.taskSelectorDayIndex = dayIndex;
    this.showTaskSelector = true;
    this.cdr.detectChanges();
  }

  /**
   * Cerrar el menú de selección de tareas
   */
  closeTaskSelector(): void {
    this.showTaskSelector = false;
    this.taskSelectorItems = [];
  }

  /**
   * Seleccionar una tarea del menú de selección para traerla al frente
   */
  selectTaskFromSelector(item: RenderableItem): void {
    this.bringItemToFront(item);
    this.closeTaskSelector();
  }

  /**
   * Traer un item (tarea o fragmento) al frente
   */
  private bringItemToFront(item: RenderableItem): void {
    const key = this.getItemKey(item);
    this.taskZOrderMap.set(key, Date.now());
    
    // Forzar actualización del renderizado
    this.cdr.detectChanges();
    
    // Re-registrar gestos después del reordenamiento
    setTimeout(() => this.registerTaskGestures(), 50);
  }

  /**
   * Obtener una clave única para un item (tarea o fragmento)
   */
  private getItemKey(item: RenderableItem): string {
    if (item.type === 'fragment' && item.fragmentIndex !== undefined) {
      return `${item.task.id}-fragment-${item.fragmentIndex}`;
    }
    return item.task.id;
  }

  /**
   * Obtener el z-order de un item (para ordenamiento)
   */
  private getItemZOrder(item: RenderableItem): number {
    const key = this.getItemKey(item);
    return this.taskZOrderMap.get(key) || 0;
  }

  /**
   * Obtener el texto corto para mostrar en el selector
   */
  getItemShortText(item: RenderableItem): string {
    const emoji = item.task.emoji || '📋';
    let name = item.task.name || 'Sin título';
    
    if (item.type === 'fragment' && item.fragmentIndex !== undefined) {
      name = `${name} [F${item.fragmentIndex + 1}]`;
    }
    
    // Limitar a 25 caracteres
    if (name.length > 25) {
      name = name.substring(0, 22) + '...';
    }
    
    return `${emoji} ${name}`;
  }

  /**
   * Obtener el rango de tiempo de un item
   */
  getItemTimeRange(item: RenderableItem): string {
    return `${this.formatTaskTime(item.start)} - ${this.formatTaskTime(item.end)}`;
  }

  /**
   * Verificar si un item tiene intersección con otros items en el mismo día
   */
  hasIntersection(item: RenderableItem, dayIndex: number): boolean {
    const items = this.getRenderableItemsForDay(dayIndex);
    if (items.length <= 1) return false;
    
    const itemStart = this.parseUTCToLocal(item.start).getTime();
    const itemEnd = this.parseUTCToLocal(item.end).getTime();
    
    for (const other of items) {
      // Saltar si es el mismo item
      if (this.getItemKey(item) === this.getItemKey(other)) continue;
      
      const otherStart = this.parseUTCToLocal(other.start).getTime();
      const otherEnd = this.parseUTCToLocal(other.end).getTime();
      
      // Verificar intersección temporal
      if (itemStart < otherEnd && itemEnd > otherStart) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Obtener la opacidad de un item (80% si tiene intersección, normal si no)
   */
  getItemOpacity(item: RenderableItem, dayIndex: number): string {
    if (this.shouldShowAsHidden(item)) {
      return '0.4';
    }
    return this.hasIntersection(item, dayIndex) ? '0.6' : '1';
  }

  closeContextMenu(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
    this.showContextMenu = false;
    this.contextMenuTask = null;
  }

  editTaskFromContextMenu(): void {
    if (this.contextMenuTask) {
      this.hideTooltip();
      this.editTask.emit(this.contextMenuTask);
      this.closeContextMenu();
    }
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

  /**
   * Obtiene el nombre del grupo de tarea compleja dado su ID
   */
  getTaskGroupName(groupId: string | undefined): string | null {
    if (!groupId) return null;
    const group = this.taskGroups.find(g => g.id === groupId);
    return group ? group.name : null;
  }

  /**
   * Copia el título de la tarea al portapapeles
   */
  async copyTitle(): Promise<void> {
    if (this.contextMenuTask) {
      try {
        await navigator.clipboard.writeText(this.contextMenuTask.name);
      } catch (err) {
        console.error('Error al copiar:', err);
      }
      this.closeContextMenu();
    }
  }

  /**
   * Copia solo el título del grupo complejo al portapapeles
   */
  async copyComplexTitle(): Promise<void> {
    if (this.contextMenuTask) {
      const groupName = this.getTaskGroupName(this.contextMenuTask.taskGroupId);
      if (groupName) {
        try {
          await navigator.clipboard.writeText(groupName);
        } catch (err) {
          console.error('Error al copiar:', err);
        }
      }
      this.closeContextMenu();
    }
  }

  /**
   * Copia el título complejo + título de la tarea al portapapeles
   * Formato: "(ComplexTitle) Title"
   */
  async copyComplexTitleWithTitle(): Promise<void> {
    if (this.contextMenuTask) {
      const groupName = this.getTaskGroupName(this.contextMenuTask.taskGroupId);
      if (groupName) {
        const text = `(${groupName}) ${this.contextMenuTask.name}`;
        try {
          await navigator.clipboard.writeText(text);
        } catch (err) {
          console.error('Error al copiar:', err);
        }
      }
      this.closeContextMenu();
    }
  }

  /**
   * Verifica si la tarea tiene un grupo complejo asignado
   */
  hasComplexGroup(): boolean {
    return !!(this.contextMenuTask?.taskGroupId && this.getTaskGroupName(this.contextMenuTask.taskGroupId));
  }

  /**
   * Verifica si una tarea específica tiene un grupo complejo asignado
   */
  taskHasComplexGroup(task: Task): boolean {
    return !!(task.taskGroupId && this.getTaskGroupName(task.taskGroupId));
  }

  /**
   * Obtiene todas las tareas que pertenecen al mismo grupo complejo
   */
  getTasksInSameGroup(task: Task): Task[] {
    if (!task.taskGroupId) return [];
    return this.tasks.filter(t => t.taskGroupId === task.taskGroupId);
  }

  /**
   * Calcula la duración total de todas las tareas de un grupo complejo (en horas)
   */
  getComplexGroupTotalDuration(task: Task): number | null {
    if (!task.taskGroupId) return null;
    
    const groupTasks = this.getTasksInSameGroup(task);
    if (groupTasks.length <= 1) return null; // No mostrar si solo hay una tarea
    
    let totalHours = 0;
    for (const t of groupTasks) {
      const duration = this.getTaskDuration(t);
      if (duration) {
        totalHours += duration;
      }
    }
    
    return totalHours > 0 ? totalHours : null;
  }

  /**
   * Obtiene el número de tareas en el grupo complejo
   */
  getComplexGroupTaskCount(task: Task): number {
    if (!task.taskGroupId) return 0;
    return this.getTasksInSameGroup(task).length;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showContextMenu) {
      this.closeContextMenu();
    }
    if (this.showTooltip) {
      // No cerrar el tooltip si hubo selección de texto
      if (this.isTooltipTextSelection) {
        this.isTooltipTextSelection = false;
        return;
      }
      // Verificar si el click fue dentro del tooltip
      const tooltipElement = (event.target as HTMLElement).closest('.tooltip-container');
      if (!tooltipElement) {
        this.hideTooltip();
      }
    }
    if (this.showTaskSelector) {
      this.closeTaskSelector();
    }
  }

  // Métodos para manejar selección de texto en tooltip
  onTooltipMouseDown(event: MouseEvent): void {
    this.tooltipMouseDownPos = { x: event.clientX, y: event.clientY };
    this.isTooltipTextSelection = false;
    // Reiniciar el timeout del tooltip mientras se interactúa
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
  }

  onTooltipMouseUp(event: MouseEvent): void {
    if (this.tooltipMouseDownPos) {
      const dx = Math.abs(event.clientX - this.tooltipMouseDownPos.x);
      const dy = Math.abs(event.clientY - this.tooltipMouseDownPos.y);
      // Si el mouse se movió más de 5px, considerar como selección de texto
      if (dx > 5 || dy > 5) {
        this.isTooltipTextSelection = true;
      }
    }
    this.tooltipMouseDownPos = null;
    // Reiniciar el timeout del tooltip
    this.tooltipTimeout = setTimeout(() => {
      this.hideTooltip();
    }, 4000);
  }

  /**
   * Convertir coordenada Y a hora decimal del día
   */
  yToHour(y: number, dayIndex: number): number {
    // Y ya está relativo al inicio del área de horas (después del header de 60px)
    const hour = (y / this.pixelsPerHour);
    return Math.max(0, Math.min(24, hour));
  }

  /**
   * Redondear hora a múltiplos de 15 minutos
   */
  snapToQuarterHour(hour: number): number {
    const totalMinutes = hour * 60;
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    return snappedMinutes / 60;
  }

  /**
   * Determinar el día de la semana basándose en la coordenada X
   * Retorna el índice visual (0-4 o 0-6)
   */
  getDayFromX(localX: number): { dayIndex: number; dayDate: Date } {
    let dayIndex = 0;
    for (let i = 0; i < this.visibleDaysCount; i++) {
      const dayColumnX = this.getDayColumnX(i);
      if (localX >= dayColumnX && localX < dayColumnX + this.dayColumnWidth) {
        dayIndex = i;
        break;
      }
    }
    const clampedIndex = Math.max(0, Math.min(this.visibleDaysCount - 1, dayIndex));
    // Convertir índice visual a índice real para obtener la fecha
    const realIndex = this.getRealDayIndex(clampedIndex);
    const day = this.weekDays[realIndex];
    return {
      dayIndex: clampedIndex, // Retornar índice visual
      dayDate: day ? new Date(day.date) : new Date(this.currentWeekStart)
    };
  }

  /**
   * Verificar si el click está en un área vacía (sin tareas)
   */
  isClickOnEmptyArea(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element)) return true;
    
    const element = target as Element;
    
    // Verificar si el target es un elemento de tarea o sus componentes
    const isTaskElement = element.closest('.task-rect') !== null ||
                          element.closest('.task-group') !== null ||
                          element.closest('.task-inner') !== null ||
                          element.closest('.task-text') !== null ||
                          element.closest('.task-type-indicator') !== null ||
                          element.closest('.resize-handle') !== null ||
                          element.closest('.resize-handle-line') !== null ||
                          element.closest('.context-menu') !== null ||
                          element.closest('.task-selector-menu') !== null ||
                          element.closest('.tooltip-container') !== null ||
                          element.closest('.week-navigation') !== null ||
                          element.closest('.color-mode-toggle') !== null ||
                          element.closest('button') !== null ||
                          element.closest('input') !== null ||
                          element.closest('select') !== null ||
                          element.closest('.preview-shadow') !== null ||
                          element.closest('.preview-shadow-secondary') !== null ||
                          element.closest('.range-selection-rect') !== null;
    
    // Permitir selección en el fondo de la columna, líneas de horas, y áreas vacías
    const isBackgroundElement = element.tagName === 'rect' && 
                                 (element.classList.contains('inactive-hours-shade') || 
                                  !element.closest('.task-group'));
    
    return !isTaskElement || isBackgroundElement;
  }

  /**
   * Handler para mousedown en el SVG - iniciar selección de rango
   */
  onSvgMouseDown(event: MouseEvent): void {
    // Solo procesar click izquierdo
    if (event.button !== 0) return;
    
    // No iniciar si Ctrl está presionado (para pan)
    if (event.ctrlKey || event.metaKey) return;
    
    // Verificar que sea un área vacía
    if (!this.isClickOnEmptyArea(event.target)) return;
    
    // Obtener coordenadas relativas al SVG
    const svgElement = this.svgScrollContainer?.nativeElement?.querySelector('.week-timeline-svg') || 
                       this.containerRef?.nativeElement?.querySelector('.week-timeline-svg');
    if (!svgElement) return;
    
    const svgRect = svgElement.getBoundingClientRect();
    // Ajustar por zoom para convertir a espacio SVG sin escalar
    const localX = (event.clientX - svgRect.left) / this.zoomScale;
    const localY = (event.clientY - svgRect.top) / this.zoomScale;
    
    // Determinar el día
    const { dayIndex, dayDate } = this.getDayFromX(localX);
    
    // Solo permitir selección en el área de horas (después del header de 60px)
    if (localY < 60) return;
    
    // Iniciar estado de selección
    this.rangeSelectionState = {
      isSelecting: true,
      startY: localY - 60, // Relativo al inicio del área de horas
      currentY: localY - 60,
      dayIndex: dayIndex,
      dayStartDate: dayDate
    };
    
    // Inicializar rectángulo visual
    this.updateRangeSelectionRect(localY - 60, localY - 60, dayIndex);
    
    // Forzar detección de cambios para mostrar el rectángulo
    this.cdr.detectChanges();
    
    // Prevenir comportamiento por defecto
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Handler para mousemove global durante selección
   */
  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.rangeSelectionState.isSelecting) return;
    
    const svgElement = this.svgScrollContainer?.nativeElement?.querySelector('.week-timeline-svg') || 
                       this.containerRef?.nativeElement?.querySelector('.week-timeline-svg');
    if (!svgElement) {
      // Si no hay SVG, cancelar selección
      this.resetRangeSelection();
      return;
    }
    
    const svgRect = svgElement.getBoundingClientRect();
    // Ajustar por zoom para convertir a espacio SVG sin escalar
    const localY = (event.clientY - svgRect.top) / this.zoomScale;
    const localX = (event.clientX - svgRect.left) / this.zoomScale;
    
    // Verificar que el mouse esté dentro del SVG (ambos en espacio SVG sin escalar)
    if (localX < 0 || localX > this.svgWidth || localY < 0 || localY > this.svgHeight) {
      // Mouse fuera del SVG, cancelar selección
      this.resetRangeSelection();
      return;
    }
    
    // Verificar que sigamos en el mismo día
    const { dayIndex } = this.getDayFromX(localX);
    if (dayIndex !== this.rangeSelectionState.dayIndex) {
      // Si cambiamos de día, cancelar la selección
      this.resetRangeSelection();
      return;
    }
    
    // Limitar Y al área de horas (después del header de 60px)
    const yRelative = Math.max(0, Math.min(this.hoursAreaHeight, localY - 60));
    
    this.rangeSelectionState.currentY = yRelative;
    this.updateRangeSelectionRect(
      this.rangeSelectionState.startY, 
      yRelative, 
      this.rangeSelectionState.dayIndex
    );
    
    this.cdr.detectChanges();
  }

  /**
   * Handler para mouseup global - finalizar selección
   */
  @HostListener('document:mouseup', ['$event'])
  onDocumentMouseUp(event: MouseEvent): void {
    if (!this.rangeSelectionState.isSelecting) return;
    
    const startY = this.rangeSelectionState.startY;
    const endY = this.rangeSelectionState.currentY;
    const dayIndex = this.rangeSelectionState.dayIndex;
    const dayDate = this.rangeSelectionState.dayStartDate;
    
    // Calcular horas (startY y endY ya están relativos al área de horas)
    let startHour = this.yToHour(startY, dayIndex);
    let endHour = this.yToHour(endY, dayIndex);
    
    // Asegurar que startHour < endHour
    if (startHour > endHour) {
      [startHour, endHour] = [endHour, startHour];
    }
    
    // Redondear a 15 minutos
    startHour = this.snapToQuarterHour(startHour);
    endHour = this.snapToQuarterHour(endHour);
    
    // Asegurar duración mínima de 15 minutos (0.25 horas)
    if (endHour - startHour < 0.25) {
      endHour = startHour + 0.25;
    }
    
    // Limitar a 24 horas
    endHour = Math.min(24, endHour);
    
    // Crear objetos Date con las horas calculadas
    const startTime = new Date(dayDate);
    startTime.setHours(Math.floor(startHour), Math.round((startHour % 1) * 60), 0, 0);
    
    const endTime = new Date(dayDate);
    endTime.setHours(Math.floor(endHour), Math.round((endHour % 1) * 60), 0, 0);
    
    // Emitir evento solo si hubo una selección significativa (más de un umbral mínimo)
    const deltaY = Math.abs(endY - startY);
    if (deltaY > 10) {
      this.createTaskWithRange.emit({ startTime, endTime });
    }
    
    // Limpiar estado
    this.resetRangeSelection();
  }

  /**
   * Actualizar el rectángulo visual de selección
   */
  private updateRangeSelectionRect(startY: number, endY: number, dayIndex: number): void {
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.hoursAreaHeight, Math.max(startY, endY));
    const height = maxY - minY;
    
    this.rangeSelectionRect = {
      visible: true,
      x: this.dayColumnPadding,
      y: minY,
      width: this.dayColumnWidth - (this.dayColumnPadding * 2),
      height: Math.max(5, height),
      dayIndex: dayIndex
    };
  }

  /**
   * Limpiar estado de selección de rango
   */
  private resetRangeSelection(): void {
    this.rangeSelectionState = {
      isSelecting: false,
      startY: 0,
      currentY: 0,
      dayIndex: 0,
      dayStartDate: new Date()
    };
    this.rangeSelectionRect = {
      visible: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      dayIndex: 0
    };
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
    if (this.panCleanup) {
      this.panCleanup();
    }
    if (this.rangeSelectionCleanup) {
      this.rangeSelectionCleanup();
    }
    if (this.hoursIndicatorSyncCleanup) {
      this.hoursIndicatorSyncCleanup();
    }
    if (this.daysIndicatorSyncCleanup) {
      this.daysIndicatorSyncCleanup();
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
    if (this.panCleanup) {
      this.panCleanup();
    }
    this.gestureCleanups.forEach(cleanup => cleanup());
    this.gestureCleanups = [];
  }
}
