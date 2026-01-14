import { Component, OnInit, OnDestroy, HostListener, ElementRef, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from '@angular/fire/firestore';
import { TaskService } from './services/task.service';
import { ProjectService } from './services/project.service';
import { EnvironmentService } from './services/environment.service';
import { Task } from './models/task.model';
import { Project } from './models/project.model';
import { Environment } from './models/environment.model';
import { ManagementModalComponent } from './components/management-modal/management-modal.component';
import { CurrentTaskInfoComponent } from './components/current-task-info/current-task-info.component';
import { PendingTasksBubbleComponent } from './components/pending-tasks-bubble/pending-tasks-bubble.component';
import { TaskModalComponent } from './components/task-modal/task-modal.component';
import { RemindersModalComponent } from './components/reminders-modal/reminders-modal.component';
import { TaskTrackerHeaderComponent } from './components/amain_components/task-tracker-header';
import { EnvironmentModalComponent } from './components/environment-modal/environment-modal.component';
import { BoardViewComponent } from './components/amain_components/board-view';
import { WeekViewComponent } from './components/amain_components/week-view';
import { ChangeStatusModalComponent } from './components/change-status-modal/change-status-modal';
import { DateRangeModalComponent } from './components/date-range-modal/date-range-modal.component';
import { TaskTypeModalComponent } from './components/task-type-modal/task-type-modal.component';
import { TaskTypeService } from './services/task-type.service';
import { TaskType } from './models/task-type.model';
import { TimelineFocusService } from './services/timeline-focus.service';
import { TaskTimeService } from './services/task-time.service';
import { CustomSelectComponent, SelectOption } from './components/custom-select/custom-select.component';
import { WeekTimelineSvgComponent } from './components/week-timeline-svg/week-timeline-svg.component';
import { TaskSumTemplateService } from './services/task-sum-template.service';
import { TaskSumTemplate } from './models/task-sum-template.model';
import { SumsBubbleComponent } from './components/sums-bubble/sums-bubble.component';

@Component({
  selector: 'app-task-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ManagementModalComponent, CurrentTaskInfoComponent, PendingTasksBubbleComponent, TaskModalComponent, RemindersModalComponent, TaskTrackerHeaderComponent, EnvironmentModalComponent, BoardViewComponent, WeekViewComponent, ChangeStatusModalComponent, DateRangeModalComponent, TaskTypeModalComponent, CustomSelectComponent, WeekTimelineSvgComponent, SumsBubbleComponent],
  templateUrl: './task-tracker.component.html',
  styleUrls: ['./task-tracker.component.css']
})
export class TaskTrackerComponent implements OnInit, OnDestroy {
  @ViewChild('newTaskModal') newTaskModal?: TaskModalComponent;
  @ViewChild('editTaskModal') editTaskModal?: TaskModalComponent;
  
  currentView: 'board' | 'week' = 'board';
  showNewTaskModal = false;
  searchQuery = '';
  userName = '';
  userPhotoUrl = '';
  tasks: Task[] = [];
  projects: Project[] = [];
  environments: Environment[] = [];
  private _orderedEnvironmentsCache: Environment[] = [];
  taskTypes: TaskType[] = [];
  filteredTasks: Task[] = [];
  showNewEnvironmentModal = false;
  showNewProjectModal = false;
  showNewTaskTypeModal = false;
  showManagementModal = false;

  // Nuevo: Estado para contraer environments vacíos
  collapsedEmptyEnvironments = true; // Por defecto contraídos
  collapsedEnvironments: { [envId: string]: boolean } = {}; // Control individual
  // Nuevo: Estado para contraer proyectos (por defecto expandidos)
  collapsedProjects: { [projectId: string]: boolean } = {};

  // Control de visibilidad de tareas ocultas por environment
  environmentHiddenVisibility: { [envId: string]: 'hidden' | 'show-all' | 'show-24h' | 'date-range' } = {}; // Control de visibilidad individual por environment
  // Rangos de fechas por environment para el filtro de fecha
  environmentDateRanges: { [envId: string]: { mode: 'day' | 'range', startDate?: string, endDate?: string, singleDate?: string } } = {};
  // Modo de vista por environment: 'cards' o 'list'
  environmentViewMode: { [envId: string]: 'cards' | 'list' } = {};
  // Orden de tareas por environment: 'asc' (más antigua primero) o 'desc' (más reciente primero)
  environmentSortOrder: { [envId: string]: 'asc' | 'desc' } = {};
  // Orden personalizado de environments: { [envId: string]: number }
  environmentCustomOrder: { [envId: string]: number } = {};
  // Estado de carga del orden personalizado
  isLoadingEnvironmentOrder: boolean = true;
  // Estados para sincronización del orden con base de datos
  isSavingOrderToDatabase: boolean = false;
  isLoadingOrderFromDatabase: boolean = false;
  orderSyncMessage: string = '';
  orderSyncMessageType: 'success' | 'error' | 'info' = 'info';
  private orderSyncMessageTimeout: any = null;
  // Throttle para guardar la posición del scroll
  private scrollSaveTimeout: any = null;
  // Listener de scroll para limpiar al destruir
  private scrollHandler: (() => void) | null = null;
  private beforeUnloadHandler: (() => void) | null = null;
  // Ambiente enfocado en la línea de tiempo (null = sin enfoque)
  // Usamos un objeto wrapper para que Angular detecte cambios por referencia
  focusedEnvironment: { id: string | null } = { id: null };
  
  // Getter para compatibilidad con código existente
  get focusedEnvironmentId(): string | null {
    return this.focusedEnvironment.id;
  }

  newTask: Partial<Task> = {
    name: '',
    emoji: '',
    description: '',
    start: '',
    end: '',
    environment: '',
    project: '',
    priority: 'medium',
    duration: 0,
    deadline: null,
    reminders: [],
    fragments: []
  };
  showEmojiPicker = false;
  emojis = ['😀', '😊', '😎', '🤩', '😍', '🤔', '😴', '🥳', '😇', '🤯', 
            '📝', '📅', '📌', '✅', '🔑', '⏰', '📚', '💻', '📱', '🔋',
            '🏋️', '🚴', '🚗', '🍎', '🍕', '🍔', '🛒', '☕', '🍷', '🎵', '🎮', '🎨', '🛏️', '✈️'];
  filteredProjects: Project[] = [];
  newEnvironment: Partial<Environment> = {
    name: '',
    color: '#3B82F6',
    emoji: ''
  };
  
  newProject: Partial<Project> = {
    name: '',
    description: '',
    environment: ''
  };
  
  // Opciones para selectores personalizados
  environmentOptionsForNewProject: SelectOption[] = [];
  showContextMenu = false;
  contextMenuPosition = { x: 0, y: 0 };
  selectedTask: Task | null = null;
  // Menú contextual rápido para "Completar y Ocultar"
  showQuickContextMenu = false;
  quickContextMenuPosition = { x: 0, y: 0 };
  showEditTaskModal = false;
  showHidden = false;
  selectableProjectsForNewTask: Project[] = [];

  // Variables para menú contextual de ambientes
  showEnvironmentContextMenu = false;
  environmentContextMenuPosition = { x: 0, y: 0 };
  selectedEnvironment: Environment | null = null;
  
  // Modal de rango de fechas
  showDateRangeModal = false;
  dateRangeModalEnvironmentId: string = '';

  // Variables para menú contextual de proyectos
  showProjectContextMenu = false;
  projectContextMenuPosition = { x: 0, y: 0 };
  selectedProject: Project | null = null;
  
  // Variables para modal de tareas del proyecto
  showProjectTasksModal = false;
  selectedProjectForTasksModal: Project | null = null;
  projectTasksForModal: Task[] = [];
  projectTaskIncluded: { [taskId: string]: boolean } = {};
  lastSelectedTaskIndex: number | null = null;
  isCalendarExpanded: boolean = true; // Por defecto expandido
  
  // Variables para plantillas de suma
  taskSumTemplates: TaskSumTemplate[] = [];
  showSaveSumTemplateModal = false;
  newSumTemplateName = '';
  editingTemplateId: string | null = null;
  startDateFilter: string = '';
  endDateFilter: string = '';

  // Propiedades para tareas huérfanas
  orphanedTasks: Task[] = [];
  selectedOrphanedTasks: { [taskId: string]: boolean } = {};
  showAssignOrphanedTasksModal: boolean = false;
  projectForAssigningOrphans: string = '';
  isAssigningOrphanedTasks: boolean = false;
  selectableProjectsForEditTask: Project[] = [];

  // Colores sugeridos para entornos
  suggestedColors: string[] = [
    '#3B82F6', // Azul
    '#10B981', // Verde
    '#F59E0B', // Amarillo
    '#EF4444', // Rojo
    '#8B5CF6', // Púrpura
    '#F97316', // Naranja
    '#06B6D4', // Cyan
    '#84CC16', // Lima
    '#EC4899', // Rosa
    '#6B7280'  // Gris
  ];

  // Propiedades para el color picker personalizado
  colorPickerHue: number = 220; // Hue para el azul por defecto
  colorPickerSaturation: number = 76; // Saturación por defecto
  colorPickerLightness: number = 60; // Luminosidad por defecto

  // Propiedades para manejar fechas y horas por separado
  newTaskStartDate: string = '';
  newTaskStartTime: string = '';
  newTaskEndDate: string = '';
  newTaskEndTime: string = '';
  newTaskDeadlineDate: string = '';
  newTaskDeadlineTime: string = '';
  
  editTaskStartDate: string = '';
  editTaskStartTime: string = '';
  editTaskEndDate: string = '';
  editTaskEndTime: string = '';
  editTaskDeadlineDate: string = '';
  editTaskDeadlineTime: string = '';

  // Propiedades para validación de fechas
  newTaskDateError: string = '';
  editTaskDateError: string = '';

  // Variables para el modal de cálculo de tiempo
  showTimeCalculatorModal = false;
  calculatorInput = '';
  calculatorType: 'start' | 'end' = 'start'; // determina si calcula hora de inicio o fin
  calculatorContext: 'new' | 'edit' = 'new'; // determina si está en modal de nueva tarea o edición
  calculatorError = '';
  calculatorIsValid = false;

  // Variables para el modal de confirmación de cambio de estado
  showStatusChangeModal = false;
  pendingStatusChange: { task: Task; status: 'pending' | 'in-progress' | 'completed' } | null = null;
  statusChangeWillHide = false; // Para mostrar diferente mensaje según si va a ocultar o mostrar

  // Propiedades para recordatorios con fecha/hora separadas
  newTaskReminderDates: string[] = [];
  newTaskReminderTimes: string[] = [];
  editTaskReminderDates: string[] = [];
  editTaskReminderTimes: string[] = [];
  newTaskReminderErrors: string[] = [];
  editTaskReminderErrors: string[] = [];

  // Modal de gestión de recordatorios
  showRemindersModal = false;
  remindersModalContext: 'new' | 'edit' = 'new';
  remindersActiveTab: 'relative' | 'now' | 'ai' | 'manual' = 'relative';
  
  // Campos para agregar recordatorios
  reminderRelativeReference: 'start' | 'end' | 'deadline' = 'start';
  reminderRelativeDirection: 'before' | 'after' = 'before';
  reminderRelativeTime = '';
  reminderFromNowDirection: 'in' | 'before' | 'after' = 'in';
  reminderFromNowTime = '';
  reminderAiInput = '';
  reminderManualDate = '';
  reminderManualTime = '';
  
  // Errores y estados
  reminderRelativeError = '';
  reminderFromNowError = '';
  reminderAiError = '';
  reminderManualError = '';

  // Propiedades para manejo de modales inteligentes
  private calculatorBackdropMouseDownPos: { x: number, y: number } | null = null;

  constructor(
    private authService: AuthService,
    private firestore: Firestore,
    private taskService: TaskService,
    private projectService: ProjectService,
    private environmentService: EnvironmentService,
    private taskTypeService: TaskTypeService,
    private taskSumTemplateService: TaskSumTemplateService,
    private timelineFocusService: TimelineFocusService,
    private taskTimeService: TaskTimeService,
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    // Iniciar carga del orden
    this.isLoadingEnvironmentOrder = true;
    
    // Exponer el componente en window para depuración
    (window as any).taskTrackerComponent = this;
    console.log('🔧 Componente expuesto en window.taskTrackerComponent para depuración');
    
    await this.loadInitialData();
    this.initializeNewTask();
    // Cargar el estado del filtro desde localStorage
    this.loadShowHiddenState();
    // Cargar modos de vista por environment desde localStorage
    this.loadEnvironmentViewModes();
    // Cargar órdenes de clasificación por environment desde localStorage
    this.loadEnvironmentSortOrders();
    // Cargar orden personalizado de environments desde localStorage (después de cargar environments)
    this.loadEnvironmentCustomOrder();
    // Inicializar orden solo para environments nuevos (después de cargar el orden guardado)
    this.initializeEnvironmentOrder();
    
    // Finalizar carga del orden - usar requestAnimationFrame para asegurar que el DOM esté listo
    requestAnimationFrame(() => {
      this.isLoadingEnvironmentOrder = false;
      this.cdr.detectChanges();
      // Restaurar posición del scroll después de que el contenido esté completamente renderizado
      // Esperar un poco más para asegurar que el DOM esté estable
      setTimeout(() => {
        this.restoreScrollPosition();
      }, 150);
    });

    // Configurar listener para guardar posición del scroll antes de recargar
    this.setupScrollSave();
  }

  ngOnDestroy(): void {
    // Guardar posición del scroll antes de destruir el componente
    this.saveScrollPosition();
    
    // Limpiar listeners
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
    if (this.scrollSaveTimeout) {
      clearTimeout(this.scrollSaveTimeout);
    }
    if (this.orderSyncMessageTimeout) {
      clearTimeout(this.orderSyncMessageTimeout);
    }
    
    // Limpiar referencia en window
    if ((window as any).taskTrackerComponent === this) {
      delete (window as any).taskTrackerComponent;
    }
  }

  private setupScrollSave(): void {
    console.log('🎬 CONFIGURANDO listener de scroll...');
    // Guardar posición del scroll cuando el usuario hace scroll (con throttling)
    this.scrollHandler = () => {
      if (this.scrollSaveTimeout) {
        clearTimeout(this.scrollSaveTimeout);
      }
      this.scrollSaveTimeout = setTimeout(() => {
        this.saveScrollPosition();
      }, 250); // Guardar después de 250ms sin scroll
    };
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    console.log('✅ Listener de scroll agregado');

    // Guardar posición del scroll antes de que la página se recargue
    this.beforeUnloadHandler = () => {
      console.log('🔄 beforeunload detectado, guardando scroll...');
      this.saveScrollPosition();
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    console.log('✅ Listener de beforeunload agregado');
  }

  private saveScrollPosition(): void {
    try {
      const scrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      localStorage.setItem('taskTracker_scrollPosition', JSON.stringify(scrollPosition));
    } catch (error) {
      console.error('Error al guardar la posición del scroll:', error);
    }
  }

  private restoreScrollPosition(): void {
    try {
      console.log('🔍 INTENTANDO restaurar posición de scroll...');
      const savedPosition = localStorage.getItem('taskTracker_scrollPosition');
      console.log('📦 Valor guardado en localStorage:', savedPosition);
      
      if (savedPosition) {
        const scrollPosition = JSON.parse(savedPosition);
        console.log('📊 Posición parseada:', scrollPosition, 'Tipo:', typeof scrollPosition);
        
        if (typeof scrollPosition === 'number' && scrollPosition > 0) {
          console.log('✅ Posición válida, aplicando scroll a:', scrollPosition);
          // Usar setTimeout para asegurar que el DOM esté completamente renderizado
          setTimeout(() => {
            console.log('⏱️ Ejecutando scrollTo después del timeout...');
            window.scrollTo({
              top: scrollPosition,
              behavior: 'auto' // Sin animación para que sea instantáneo
            });
            console.log('✅ Scroll aplicado, posición actual:', window.pageYOffset);
            // Limpiar la posición guardada después de restaurarla
            localStorage.removeItem('taskTracker_scrollPosition');
            console.log('🗑️ Posición limpiada de localStorage');
          }, 100);
        } else {
          console.log('⚠️ Posición inválida o cero');
        }
      } else {
        console.log('ℹ️ No hay posición guardada en localStorage');
      }
    } catch (error) {
      console.error('❌ Error al restaurar la posición del scroll:', error);
    }
  }

  async loadInitialData(): Promise<void> {
    try {
      await this.loadUserData();
      await Promise.all([
        this.loadEnvironments(),
        this.loadProjects(),
        this.loadTaskTypes(),
        this.loadTaskSumTemplates()
      ]);
      await this.loadTasks();
      // Nota: initializeEnvironmentOrder se llama en ngOnInit después de cargar el orden desde localStorage
    } catch (error) {
      console.error("Error loading initial data for TaskTrackerComponent:", error);
    }
  }

  private async loadTaskSumTemplates() {
    try {
      this.taskSumTemplates = await this.taskSumTemplateService.getTemplates();
    } catch (error) {
      console.error('Error al cargar plantillas de suma:', error);
      this.taskSumTemplates = [];
    }
  }

  private async loadUserData() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = user.displayName || 'Usuario';
      this.userPhotoUrl = user.photoURL || 'https://randomuser.me/api/portraits/women/44.jpg';
    }
  }

  private async loadTasks() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      this.tasks = await this.taskService.getTasks();
      this.processTasks();
      console.log('Tareas cargadas:', this.tasks);
    } catch (error) {
      console.error('Error al cargar tareas:', error);
    }
  }

  private processTasks(): void {
    this.filterTasks();
    this.loadOrphanedTasks();
  }

  private loadOrphanedTasks(): void {
    this.orphanedTasks = this.tasks.filter(task => !task.environment || task.environment === '');
    const newSelection: { [taskId: string]: boolean } = {};
    this.orphanedTasks.forEach(task => {
      if (this.selectedOrphanedTasks[task.id]) {
        newSelection[task.id] = true;
      }
    });
    this.selectedOrphanedTasks = newSelection;
  }

  private async loadProjects() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const projectsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}projects`);
    const q = query(projectsRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    this.projects = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Project));
    this.filteredProjects = [...this.projects];
  }

  private async loadEnvironments() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const environmentsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}environments`);
    const q = query(environmentsRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    this.environments = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Environment));
    this.updateOrderedEnvironmentsCache();
  }

  private async loadTaskTypes() {
    try {
      this.taskTypes = await this.taskTypeService.getTaskTypes();
    } catch (error) {
      console.error('Error al cargar tipos de tarea:', error);
      this.taskTypes = [];
    }
  }

  switchView(view: 'board' | 'week') {
    this.currentView = view;
  }

  openNewTaskModal() {
    this.resetNewTask();
    this.showNewTaskModal = true;
  }

  openNewTaskModalForProject(environmentId: string, projectId: string) {
    this.resetNewTask();
    // Preseleccionar ambiente primero
    this.newTask.environment = environmentId;
    // Cargar proyectos disponibles para el ambiente
    this.onNewTaskEnvironmentChange();
    // Ahora preseleccionar el proyecto (después de que se carguen los proyectos disponibles)
    this.newTask.project = projectId;
    this.showNewTaskModal = true;
  }

  /**
   * Abre el modal de nueva tarea desde la burbuja flotante roja (sin tarea actual)
   * - Hora de inicio: fin de la última tarea antes de ahora
   * - Hora de fin: próximo múltiplo de 30 minutos después de ahora
   */
  openNewTaskModalFromBubble() {
    this.resetNewTask();
    
    // Obtener la última tarea antes de la hora actual (usando las tareas ya cargadas)
    const lastTask = this.taskTimeService.getLastTaskBeforeNow(this.tasks);
    
    // Calcular las horas propuestas
    const { startDateTime, endDateTime } = this.taskTimeService.calculateBubbleTaskTimes(lastTask);
    
    console.log('📅 openNewTaskModalFromBubble: Hora inicio calculada:', startDateTime.toISOString());
    console.log('📅 openNewTaskModalFromBubble: Hora fin calculada:', endDateTime.toISOString());
    
    // Formatear y establecer los valores
    this.newTask.start = this.formatDateTimeLocalForDefaults(startDateTime);
    this.newTask.end = this.formatDateTimeLocalForDefaults(endDateTime);
    
    // Actualizar las fechas y horas separadas usando HORA LOCAL
    this.newTaskStartDate = `${startDateTime.getFullYear()}-${String(startDateTime.getMonth() + 1).padStart(2, '0')}-${String(startDateTime.getDate()).padStart(2, '0')}`;
    this.newTaskStartTime = `${startDateTime.getHours().toString().padStart(2, '0')}:${startDateTime.getMinutes().toString().padStart(2, '0')}`;
    this.newTaskEndDate = `${endDateTime.getFullYear()}-${String(endDateTime.getMonth() + 1).padStart(2, '0')}-${String(endDateTime.getDate()).padStart(2, '0')}`;
    this.newTaskEndTime = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Recalcular la duración
    this.updateNewTaskDuration();
    
    this.showNewTaskModal = true;
  }

  closeNewTaskModal() {
    this.showNewTaskModal = false;
  }

  filterTasks() {
    let tasksToFilter = this.tasks.filter(task => task.environment && task.environment !== '');
    
    // Aplicar filtros por fecha por environment
    tasksToFilter = tasksToFilter.filter(task => {
      if (!task.environment) return true;
      
      const visibility = this.getEnvironmentHiddenVisibility(task.environment);
      const dateRange = this.environmentDateRanges[task.environment];
      const hasDateRangeFilter = dateRange && (dateRange.mode === 'day' && dateRange.singleDate || dateRange.mode === 'range' && dateRange.startDate && dateRange.endDate);
      
      // Si hay filtro por fecha activo, aplicarlo
      if (hasDateRangeFilter) {
        // Extraer solo la fecha (sin hora) de la tarea
        const taskStartDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
        const taskYear = taskStartDate.getUTCFullYear();
        const taskMonth = taskStartDate.getUTCMonth();
        const taskDay = taskStartDate.getUTCDate();
        
        if (dateRange.mode === 'day' && dateRange.singleDate) {
          // Filtrar por día único
          const filterParts = dateRange.singleDate.split('-');
          if (filterParts.length === 3) {
            const filterYear = parseInt(filterParts[0], 10);
            const filterMonth = parseInt(filterParts[1], 10) - 1;
            const filterDay = parseInt(filterParts[2], 10);
            
            if (taskYear !== filterYear || taskMonth !== filterMonth || taskDay !== filterDay) {
              return false;
            }
          } else {
            return false;
          }
        } else if (dateRange.mode === 'range' && dateRange.startDate && dateRange.endDate) {
          // Filtrar por rango de fechas
          const startParts = dateRange.startDate.split('-');
          const endParts = dateRange.endDate.split('-');
          
          if (startParts.length === 3 && endParts.length === 3) {
            const startYear = parseInt(startParts[0], 10);
            const startMonth = parseInt(startParts[1], 10) - 1;
            const startDay = parseInt(startParts[2], 10);
            
            const endYear = parseInt(endParts[0], 10);
            const endMonth = parseInt(endParts[1], 10) - 1;
            const endDay = parseInt(endParts[2], 10);
            
            // Crear fechas para comparación (solo fecha, sin hora)
            const taskDate = new Date(Date.UTC(taskYear, taskMonth, taskDay));
            const startDate = new Date(Date.UTC(startYear, startMonth, startDay));
            const endDate = new Date(Date.UTC(endYear, endMonth, endDay));
            
            if (taskDate < startDate || taskDate > endDate) {
              return false;
            }
          } else {
            return false;
          }
        }
      }
      
      return true;
    });
    
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      tasksToFilter = tasksToFilter.filter(task =>
        task.name.toLowerCase().includes(q) ||
        (task.description && task.description.toLowerCase().includes(q)) ||
        (task.project && this.projects.find(p=>p.id === task.project)?.name.toLowerCase().includes(q))
      );
    }
    this.filteredTasks = tasksToFilter;
  }

  toggleShowHidden() {
    this.showHidden = !this.showHidden;
    this.saveShowHiddenState(); // Guardar el nuevo estado
    this.filterTasks();
    // Actualizar la vista con los nuevos filtros aplicados
    this.processTasks();
  }

  async saveTask() {
    // Validar fechas antes de guardar
    if (!this.validateNewTaskDates()) {
      return; // No guardar si hay errores de validación
    }

    try {
      await this.taskService.createTask(this.newTask as Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt'>);
      await this.loadTasks();
      this.closeNewTaskModal();
      this.resetNewTask();
    } catch (error) {
      console.error('Error al guardar la tarea:', error);
    }
  }

  private resetNewTask() {
    this.newTask = {
      name: '',
      emoji: '',
      description: '',
      start: '',
      end: '',
      environment: '',
      project: '',
      priority: 'medium',
      duration: 0,
      deadline: null,
      reminders: [],
      fragments: []
    };
    
    // Limpiar errores de validación
    this.newTaskDateError = '';
    
    // Establecer tiempos por defecto directamente
    const now = new Date();
    const msHalfHour = 30 * 60 * 1000; // 30 minutos en milisegundos
    
    // Hora de inicio: el próximo múltiplo de 30 minutos después de la hora actual
    const startTime = new Date(Math.ceil(now.getTime() / msHalfHour) * msHalfHour);
    
    // Hora de fin: 30 minutos después de la hora de inicio
    const endTime = new Date(startTime.getTime() + msHalfHour);
    
    // Formatear y establecer los valores
    this.newTask.start = this.formatDateTimeLocalForDefaults(startTime);
    this.newTask.end = this.formatDateTimeLocalForDefaults(endTime);
    
    // Inicializar fechas y horas separadas usando HORA LOCAL (corregido)
    this.newTaskStartDate = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}`;
    this.newTaskStartTime = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
    this.newTaskEndDate = `${endTime.getFullYear()}-${String(endTime.getMonth() + 1).padStart(2, '0')}-${String(endTime.getDate()).padStart(2, '0')}`;
    this.newTaskEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Deadline por defecto vacío
    this.newTaskDeadlineDate = '';
    this.newTaskDeadlineTime = '';
    
    // Limpiar arrays de recordatorios
    this.newTaskReminderDates = [];
    this.newTaskReminderTimes = [];
    this.newTaskReminderErrors = [];
    
    this.onNewTaskEnvironmentChange();
    
    // Calcular duración inicial automáticamente
    this.updateNewTaskDuration();
  }

  private formatDateTimeLocalForDefaults(date: Date): string {
    // Convertir a UTC para guardar en la base de datos (igual que combineDateTime)
    return date.toISOString().slice(0, 16);
  }


  openNewEnvironmentModal() {
    this.showNewEnvironmentModal = true;
    this.initializeColorPicker();
  }

  closeNewEnvironmentModal() {
    this.showNewEnvironmentModal = false;
  }

  openNewProjectModal() {
    // Preseleccionar el ambiente si ya hay uno seleccionado en la tarea
    if (this.showNewTaskModal && this.newTask && this.newTask.environment) {
      this.newProject.environment = this.newTask.environment;
    } else if (this.showEditTaskModal && this.selectedTask && this.selectedTask.environment) {
      this.newProject.environment = this.selectedTask.environment;
    }
    
    this.buildEnvironmentOptionsForNewProject();
    this.showNewProjectModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeNewProjectModal() {
    this.showNewProjectModal = false;
    document.body.style.overflow = '';
  }
  
  // Métodos para selector personalizado de nuevo proyecto
  buildEnvironmentOptionsForNewProject(): void {
    this.environmentOptionsForNewProject = this.orderedEnvironments.map(env => ({
      value: env.id || '',
      label: env.emoji ? `${env.emoji} ${env.name}` : env.name
    }));
  }
  
  onEnvironmentSelectCustomForNewProject(option: SelectOption): void {
    this.newProject.environment = String(option.value);
  }

  openNewTaskTypeModal() {
    // Verificar que haya un proyecto seleccionado en la tarea actual
    const currentProjectId = this.showNewTaskModal && this.newTask?.project 
      ? this.newTask.project 
      : this.showEditTaskModal && this.selectedTask?.project 
        ? this.selectedTask.project 
        : '';
    
    if (!currentProjectId) {
      alert('Por favor, selecciona un proyecto primero');
      return;
    }
    
    // El projectId se pasa al modal a través del binding en el HTML
    this.showNewTaskTypeModal = true;
  }

  getCurrentProjectIdForTaskTypeModal(): string {
    return this.showNewTaskModal && this.newTask?.project 
      ? this.newTask.project 
      : this.showEditTaskModal && this.selectedTask?.project 
        ? this.selectedTask.project 
        : '';
  }

  closeNewTaskTypeModal() {
    this.showNewTaskTypeModal = false;
  }

  async onTaskTypeCreated() {
    // Recargar los tipos de tarea después de crear uno nuevo
    await this.loadTaskTypes();
    
    // Recargar los tipos en el modal de tarea si está abierto
    if (this.showNewTaskModal && this.newTaskModal) {
      await this.newTaskModal.refreshTaskTypes();
    }
    if (this.showEditTaskModal && this.editTaskModal) {
      await this.editTaskModal.refreshTaskTypes();
    }
    
    // Cerrar el modal de tipos después de crear un tipo
    this.closeNewTaskTypeModal();
  }

  openManagementModal() {
    this.showManagementModal = true;
  }

  closeManagementModal() {
    this.showManagementModal = false;
    this.loadInitialData();
  }

  private initializeNewTask() {
    this.newTask = {
      name: '',
      emoji: '',
      description: '',
      start: '',
      end: '',
      environment: '',
      project: '',
      priority: 'medium',
      duration: 0,
      deadline: null,
      reminders: [],
      fragments: []
    };
    
    // Establecer tiempos por defecto directamente
    const now = new Date();
    const msHalfHour = 30 * 60 * 1000; // 30 minutos en milisegundos
    
    // Hora de inicio: el próximo múltiplo de 30 minutos después de la hora actual
    const startTime = new Date(Math.ceil(now.getTime() / msHalfHour) * msHalfHour);
    
    // Hora de fin: 30 minutos después de la hora de inicio
    const endTime = new Date(startTime.getTime() + msHalfHour);
    
    // Formatear y establecer los valores
    this.newTask.start = this.formatDateTimeLocalForDefaults(startTime);
    this.newTask.end = this.formatDateTimeLocalForDefaults(endTime);
    
    // Inicializar fechas y horas separadas usando HORA LOCAL (corregido)
    this.newTaskStartDate = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}`;
    this.newTaskStartTime = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
    this.newTaskEndDate = `${endTime.getFullYear()}-${String(endTime.getMonth() + 1).padStart(2, '0')}-${String(endTime.getDate()).padStart(2, '0')}`;
    this.newTaskEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Deadline por defecto vacío
    this.newTaskDeadlineDate = '';
    this.newTaskDeadlineTime = '';
    
    // Limpiar arrays de recordatorios
    this.newTaskReminderDates = [];
    this.newTaskReminderTimes = [];
    this.newTaskReminderErrors = [];
    
    this.onNewTaskEnvironmentChange();
    
    // Calcular duración inicial automáticamente
    this.updateNewTaskDuration();
  }

  async saveNewEnvironment() {
    try {
      const createdEnvironmentId = await this.environmentService.createEnvironment(this.newEnvironment as Omit<Environment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>);
      await this.loadEnvironments();
      
      // Inicializar el orden del nuevo environment
      this.initializeEnvironmentOrder();
      
      // Auto-seleccionar el nuevo ambiente en la tarea
      if (this.showNewTaskModal && this.newTask) {
        this.newTask.environment = createdEnvironmentId;
        this.onNewTaskEnvironmentChange(); // Cargar proyectos disponibles para el nuevo ambiente
      } else if (this.showEditTaskModal && this.selectedTask) {
        this.selectedTask.environment = createdEnvironmentId;
        this.onEditTaskEnvironmentChange(); // Cargar proyectos disponibles para el nuevo ambiente
      }
      
      this.closeNewEnvironmentModal();
      this.resetNewEnvironment();
    } catch (error) {
      console.error('Error al guardar el ambiente:', error);
    }
  }

  async onSaveNewEnvironment(env: { name: string; color: string; emoji?: string }) {
    try {
      this.newEnvironment.name = env.name;
      this.newEnvironment.color = env.color;
      this.newEnvironment.emoji = env.emoji || '';
      await this.saveNewEnvironment();
    } catch (error) {
      console.error('Error en onSaveNewEnvironment:', error);
    }
  }

  async saveNewProject() {
    try {
      const createdProjectId = await this.projectService.createProject(this.newProject as Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>);
      await this.loadProjects();
      
      // Auto-seleccionar el nuevo proyecto en la tarea
      if (this.showNewTaskModal && this.newTask) {
        // También asegurarnos de que el ambiente esté seleccionado
        if (this.newProject.environment) {
          this.newTask.environment = this.newProject.environment;
          this.onNewTaskEnvironmentChange(); // Cargar proyectos disponibles
        }
        this.newTask.project = createdProjectId;
        // Recargar la lista de proyectos en el modal de tarea
        if (this.newTaskModal) {
          this.newTaskModal.refreshProjects();
        }
      } else if (this.showEditTaskModal && this.selectedTask) {
        // También asegurarnos de que el ambiente esté seleccionado
        if (this.newProject.environment) {
          this.selectedTask.environment = this.newProject.environment;
          this.onEditTaskEnvironmentChange(); // Cargar proyectos disponibles
        }
        this.selectedTask.project = createdProjectId;
        // Recargar la lista de proyectos en el modal de tarea
        if (this.editTaskModal) {
          this.editTaskModal.refreshProjects();
        }
      }
      
      this.closeNewProjectModal();
      this.resetNewProject();
    } catch (error) {
      console.error('Error al guardar el proyecto:', error);
    }
  }

  private resetNewEnvironment() {
    this.newEnvironment = {
      name: '',
      color: '#3B82F6',
      emoji: ''
    };
  }

  private resetNewProject() {
    this.newProject = {
      name: '',
      description: '',
      environment: ''
    };
  }


  getTasksByEnvironment(environmentId: string): Task[] {
    const visibility = this.getEnvironmentHiddenVisibility(environmentId);
    const dateRange = this.environmentDateRanges[environmentId];
    const hasDateRangeFilter = dateRange && (dateRange.mode === 'day' && dateRange.singleDate || dateRange.mode === 'range' && dateRange.startDate && dateRange.endDate);
    
    const filtered = this.filteredTasks
      .filter(task => {
        // Filtrar por environment
        if (task.environment !== environmentId) return false;
        
        // Aplicar filtro de visibilidad según la configuración del environment
        // Si hay filtro por fecha activo, las tareas ya fueron filtradas por fecha en filterTasks()
        // y las tareas ocultas que pasaron el filtro se muestran
        if (task.hidden) {
          // Si hay filtro por fecha activo, las tareas ocultas que pasaron el filtro se muestran
          if (hasDateRangeFilter) {
            return true; // Ya pasó el filtro por fecha en filterTasks()
          }
          
          switch (visibility) {
            case 'hidden':
              return false; // No mostrar tareas ocultas
            case 'show-all':
              return true; // Mostrar todas las tareas ocultas
            case 'show-24h':
              // Mostrar solo las tareas ocultas de las últimas 24 horas
              const taskDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
              const now = new Date();
              const hoursDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60);
              return hoursDiff <= 24;
            case 'date-range':
              // En modo date-range, las tareas ocultas también se muestran si están en el rango
              // (el filtro por fecha ya se aplicó arriba, así que si llegamos aquí, la tarea está en el rango)
              return true;
            default:
              return false;
          }
        }
        
        return true; // Mostrar tareas no ocultas
      });
    
    const sortOrder = this.getEnvironmentSortOrder(environmentId);
    
    // Ordenar primero por día (sin hora) según el ordenamiento, luego por hora dentro del día
    return filtered.sort((a, b) => {
      const dateA = new Date(a.start + (a.start.includes('Z') ? '' : 'Z'));
      const dateB = new Date(b.start + (b.start.includes('Z') ? '' : 'Z'));
      
      // Obtener solo la fecha (sin hora) para comparar días
      const dayA = new Date(dateA.getUTCFullYear(), dateA.getUTCMonth(), dateA.getUTCDate()).getTime();
      const dayB = new Date(dateB.getUTCFullYear(), dateB.getUTCMonth(), dateB.getUTCDate()).getTime();
      
      // Comparar días primero
      if (dayA !== dayB) {
        return sortOrder === 'desc' ? dayB - dayA : dayA - dayB;
      }
      
      // Si están en el mismo día, ordenar por hora según el ordenamiento
      const timeA = dateA.getTime();
      const timeB = dateB.getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }


  getTasksByProject(projectId: string): Task[] {
    // Obtener el environment del proyecto para aplicar su configuración de visibilidad
    const project = this.projects.find(p => p.id === projectId);
    const environmentId = project?.environment || '';
    const visibility = this.getEnvironmentHiddenVisibility(environmentId);
    const dateRange = this.environmentDateRanges[environmentId];
    const hasDateRangeFilter = dateRange && (dateRange.mode === 'day' && dateRange.singleDate || dateRange.mode === 'range' && dateRange.startDate && dateRange.endDate);
    
    const filtered = this.filteredTasks
      .filter(task => {
        // Filtrar por proyecto
        if (task.project !== projectId) return false;
        
        // Aplicar filtro de visibilidad según la configuración del environment padre
        // Si hay filtro por fecha activo, las tareas ya fueron filtradas por fecha en filterTasks()
        // y las tareas ocultas que pasaron el filtro se muestran
        if (task.hidden) {
          // Si hay filtro por fecha activo, las tareas ocultas que pasaron el filtro se muestran
          if (hasDateRangeFilter) {
            return true; // Ya pasó el filtro por fecha en filterTasks()
          }
          
          switch (visibility) {
            case 'hidden':
              return false; // No mostrar tareas ocultas
            case 'show-all':
              return true; // Mostrar todas las tareas ocultas
            case 'show-24h':
              // Mostrar solo las tareas ocultas de las últimas 24 horas
              const taskDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
              const now = new Date();
              const hoursDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60);
              return hoursDiff <= 24;
            case 'date-range':
              // En modo date-range, las tareas ocultas también se muestran si están en el rango
              // (el filtro por fecha ya se aplicó arriba, así que si llegamos aquí, la tarea está en el rango)
              return true;
            default:
              return false;
          }
        }
        
        return true; // Mostrar tareas no ocultas
      });
    
    const sortOrder = this.getEnvironmentSortOrder(environmentId);
    
    // Ordenar primero por día (sin hora) según el ordenamiento, luego por hora dentro del día
    return filtered.sort((a, b) => {
      const dateA = new Date(a.start + (a.start.includes('Z') ? '' : 'Z'));
      const dateB = new Date(b.start + (b.start.includes('Z') ? '' : 'Z'));
      
      // Obtener solo la fecha (sin hora) para comparar días
      const dayA = new Date(dateA.getUTCFullYear(), dateA.getUTCMonth(), dateA.getUTCDate()).getTime();
      const dayB = new Date(dateB.getUTCFullYear(), dateB.getUTCMonth(), dateB.getUTCDate()).getTime();
      
      // Comparar días primero
      if (dayA !== dayB) {
        return sortOrder === 'desc' ? dayB - dayA : dayA - dayB;
      }
      
      // Si están en el mismo día, ordenar por hora según el ordenamiento
      const timeA = dateA.getTime();
      const timeB = dateB.getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }


  onTaskContextMenu(event: MouseEvent, task: Task) {
    event.preventDefault();
    event.stopPropagation();
    // Cerrar menú rápido si estuviera abierto
    this.closeQuickContextMenu();
    this.selectedTask = task;
    
    // Calcular la altura aproximada del menú contextual
    // Contamos los elementos que aparecerán en el menú
    let menuItemsCount = 3; // Editar, Eliminar, Mostrar/Ocultar (siempre presentes)
    
    // Contar elementos de estado que aparecerán
    if (task.status !== 'completed') menuItemsCount++; // Marcar completada
    if (task.status !== 'in-progress') menuItemsCount++; // Marcar en progreso  
    if (task.status !== 'pending') menuItemsCount++; // Marcar pendiente
    
    // Altura aproximada: 40px por item + padding
    const menuHeight = menuItemsCount * 40 + 16; // 16px de padding total
    
    // Obtener dimensiones del viewport
    const viewportHeight = window.innerHeight;
    
    // Coordenadas del click
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    // Verificar si el menú cabe hacia abajo desde la posición del click
    const spaceBelow = viewportHeight - clickY;
    const spaceAbove = clickY;
    
    let finalY = clickY;
    
    // Si no cabe hacia abajo pero sí hacia arriba, posicionarlo hacia arriba
    if (spaceBelow < menuHeight && spaceAbove >= menuHeight) {
      finalY = clickY - menuHeight;
    }
    // Si no cabe hacia abajo pero el espacio arriba es mayor, usarlo
    else if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      finalY = clickY - menuHeight;
    }
    // Si no cabe en ningún lado, ajustar para que esté visible
    else if (spaceBelow < menuHeight && spaceAbove < menuHeight) {
      if (spaceAbove > spaceBelow) {
        finalY = 10; // Pegarlo arriba con margen
      } else {
        finalY = viewportHeight - menuHeight - 10; // Pegarlo abajo con margen
      }
    }
    
    // Asegurar que no se salga por los lados
    let finalX = clickX;
    const menuWidth = 200; // Ancho aproximado del menú
    const spaceRight = window.innerWidth - clickX;
    
    if (spaceRight < menuWidth) {
      finalX = clickX - menuWidth;
    }
    
    // Asegurar que no se salga por la izquierda
    if (finalX < 0) {
      finalX = 10;
    }
    
    this.contextMenuPosition = { x: finalX, y: finalY };
    this.showContextMenu = true;
  }

  onTaskQuickContextMenu(event: MouseEvent, task: Task) {
    // Click derecho sobre los tres puntos: abrir menú rápido con una sola acción
    event.preventDefault();
    event.stopPropagation();
    this.selectedTask = task;

    // Dimensiones aproximadas del menú rápido (1 item)
    const menuHeight = 40 + 16; // 1 item * 40px + padding
    const menuWidth = 200;

    const viewportHeight = window.innerHeight;
    const clickX = event.clientX;
    const clickY = event.clientY;

    const spaceBelow = viewportHeight - clickY;
    const spaceAbove = clickY;

    let finalY = clickY;
    if (spaceBelow < menuHeight && spaceAbove >= menuHeight) {
      finalY = clickY - menuHeight;
    } else if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      finalY = clickY - menuHeight;
    } else if (spaceBelow < menuHeight && spaceAbove < menuHeight) {
      if (spaceAbove > spaceBelow) {
        finalY = 10;
      } else {
        finalY = viewportHeight - menuHeight - 10;
      }
    }

    let finalX = clickX;
    const spaceRight = window.innerWidth - clickX;
    if (spaceRight < menuWidth) {
      finalX = clickX - menuWidth;
    }
    if (finalX < 0) finalX = 10;

    this.quickContextMenuPosition = { x: finalX, y: finalY };
    this.showQuickContextMenu = true;

    // Asegurar cierre de otros menús
    this.showContextMenu = false;
    this.showEnvironmentContextMenu = false;
    this.showProjectContextMenu = false;
  }

  async completeAndHide(task: Task) {
    try {
      // Aplicar directamente: marcar completada y ocultar
      await this.applyStatusChange(task, 'completed', true);
      this.closeQuickContextMenu();
    } catch (error) {
      console.error('Error al completar y ocultar:', error);
      this.closeQuickContextMenu();
    }
  }

  onEnvironmentContextMenu(event: MouseEvent, environment: Environment) {
    event.preventDefault();
    event.stopPropagation();
    this.selectedEnvironment = environment;
    
    // Calcular la altura del menú de ambiente (2 elementos: Crear Proyecto, Eliminar Ambiente)
    const menuHeight = 2 * 40 + 16; // 2 items * 40px + padding
    
    // Obtener dimensiones del viewport
    const viewportHeight = window.innerHeight;
    
    // Coordenadas del click
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    // Verificar espacio disponible
    const spaceBelow = viewportHeight - clickY;
    const spaceAbove = clickY;
    
    let finalY = clickY;
    
    // Lógica de posicionamiento inteligente
    if (spaceBelow < menuHeight && spaceAbove >= menuHeight) {
      finalY = clickY - menuHeight;
    } else if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      finalY = clickY - menuHeight;
    } else if (spaceBelow < menuHeight && spaceAbove < menuHeight) {
      if (spaceAbove > spaceBelow) {
        finalY = 10;
      } else {
        finalY = viewportHeight - menuHeight - 10;
      }
    }
    
    // Verificar posición horizontal
    let finalX = clickX;
    const menuWidth = 200;
    const spaceRight = window.innerWidth - clickX;
    
    if (spaceRight < menuWidth) {
      finalX = clickX - menuWidth;
    }
    if (finalX < 0) {
      finalX = 10;
    }
    
    this.environmentContextMenuPosition = { x: finalX, y: finalY };
    this.showEnvironmentContextMenu = true;
  }

  onProjectContextMenu(event: MouseEvent, project: Project) {
    event.preventDefault();
    event.stopPropagation();
    this.selectedProject = project;
    
    // Calcular la altura del menú de proyecto (2 elementos: Ver Tareas del Proyecto, Eliminar Proyecto + separador)
    const menuHeight = 2 * 40 + 16 + 8; // 2 items * 40px + padding + separador
    
    // Obtener dimensiones del viewport
    const viewportHeight = window.innerHeight;
    
    // Coordenadas del click
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    // Verificar espacio disponible
    const spaceBelow = viewportHeight - clickY;
    const spaceAbove = clickY;
    
    let finalY = clickY;
    
    // Lógica de posicionamiento inteligente
    if (spaceBelow < menuHeight && spaceAbove >= menuHeight) {
      finalY = clickY - menuHeight;
    } else if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      finalY = clickY - menuHeight;
    } else if (spaceBelow < menuHeight && spaceAbove < menuHeight) {
      if (spaceAbove > spaceBelow) {
        finalY = 10;
      } else {
        finalY = viewportHeight - menuHeight - 10;
      }
    }
    
    // Verificar posición horizontal
    let finalX = clickX;
    const menuWidth = 200;
    const spaceRight = window.innerWidth - clickX;
    
    if (spaceRight < menuWidth) {
      finalX = clickX - menuWidth;
    }
    if (finalX < 0) {
      finalX = 10;
    }
    
    this.projectContextMenuPosition = { x: finalX, y: finalY };
    this.showProjectContextMenu = true;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Si el time calculator está abierto y el click está fuera del componente
    if (this.showTimeCalculatorModal && event.target && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeTimeCalculator();
    }
    
    // Funcionalidad existente para otros context menus
    if (this.showContextMenu && event.target && !(event.target as Element).closest('.context-menu')) {
      this.closeContextMenu();
    }
    if (this.showEnvironmentContextMenu && event.target && !(event.target as Element).closest('.environment-context-menu')) {
      this.closeEnvironmentContextMenu();
    }
    if (this.showProjectContextMenu && event.target && !(event.target as Element).closest('.project-context-menu')) {
      this.closeProjectContextMenu();
    }
    if (this.showQuickContextMenu && event.target && !(event.target as Element).closest('.context-menu')) {
      this.closeQuickContextMenu();
    }
  }

  closeContextMenu() {
    this.showContextMenu = false;
  }

  closeEnvironmentContextMenu() {
    this.showEnvironmentContextMenu = false;
  }

  closeProjectContextMenu() {
    this.showProjectContextMenu = false;
  }

  openProjectTasksModal(project: Project) {
    this.selectedProjectForTasksModal = project;
    // Obtener todas las tareas del proyecto
    let projectTasks = this.tasks.filter(t => t.project === project.id);
    
    // Aplicar filtro de fechas si existe
    if (this.startDateFilter || this.endDateFilter) {
      projectTasks = projectTasks.filter(task => {
        if (!task.start) return false;
        
        const taskStartDate = new Date(task.start.includes('Z') ? task.start : task.start + 'Z');
        const taskDateOnly = new Date(taskStartDate.getFullYear(), taskStartDate.getMonth(), taskStartDate.getDate());
        
        if (this.startDateFilter) {
          const startFilterDate = new Date(this.startDateFilter + 'T00:00:00');
          if (taskDateOnly < startFilterDate) return false;
        }
        
        if (this.endDateFilter) {
          const endFilterDate = new Date(this.endDateFilter + 'T23:59:59');
          if (taskDateOnly > endFilterDate) return false;
        }
        
        return true;
      });
    }
    
    // Ordenar por fecha de inicio descendente (más reciente primero)
    projectTasks = projectTasks.sort((a, b) => {
      const dateA = a.start ? new Date(a.start.includes('Z') ? a.start : a.start + 'Z').getTime() : 0;
      const dateB = b.start ? new Date(b.start.includes('Z') ? b.start : b.start + 'Z').getTime() : 0;
      return dateB - dateA; // Descendente
    });
    
    this.projectTasksForModal = projectTasks;
    
    // Inicializar todos los checkboxes como true (incluidos por defecto)
    this.projectTaskIncluded = {};
    this.projectTasksForModal.forEach(task => {
      this.projectTaskIncluded[task.id] = true;
    });
    
    // Inicializar índice de última selección
    this.lastSelectedTaskIndex = null;
    
    // Resetear estado del calendario a expandido por defecto
    this.isCalendarExpanded = true;
    
    this.showProjectTasksModal = true;
    document.body.style.overflow = 'hidden';
    this.closeProjectContextMenu();
  }

  closeProjectTasksModal() {
    this.showProjectTasksModal = false;
    document.body.style.overflow = '';
    this.selectedProjectForTasksModal = null;
    this.projectTasksForModal = [];
    this.projectTaskIncluded = {};
    this.lastSelectedTaskIndex = null;
    this.isCalendarExpanded = true;
    // Limpiar filtros y estado de edición solo si no estamos guardando
    if (!this.showSaveSumTemplateModal) {
      this.editingTemplateId = null;
      this.startDateFilter = '';
      this.endDateFilter = '';
    }
  }

  toggleCalendarExpanded() {
    this.isCalendarExpanded = !this.isCalendarExpanded;
  }

  openSaveSumTemplateModal() {
    // Si estamos editando, cargar el nombre de la plantilla
    if (this.editingTemplateId) {
      const template = this.taskSumTemplates.find(t => t.id === this.editingTemplateId);
      this.newSumTemplateName = template?.name || '';
    } else {
      this.newSumTemplateName = '';
    }
    this.showSaveSumTemplateModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeSaveSumTemplateModal() {
    this.showSaveSumTemplateModal = false;
    this.newSumTemplateName = '';
    document.body.style.overflow = '';
    // No limpiar editingTemplateId aquí, se limpia después de guardar exitosamente
  }

  onDateFilterChange() {
    // Re-aplicar filtros cuando cambian las fechas
    if (this.selectedProjectForTasksModal) {
      // Guardar el estado actual de los checkboxes
      const currentIncluded = { ...this.projectTaskIncluded };
      
      // Reabrir el modal con los nuevos filtros
      this.openProjectTasksModal(this.selectedProjectForTasksModal);
      
      // Restaurar los checkboxes que estaban seleccionados y siguen visibles
      Object.keys(currentIncluded).forEach(taskId => {
        if (this.projectTasksForModal.find(t => t.id === taskId)) {
          this.projectTaskIncluded[taskId] = currentIncluded[taskId];
        }
      });
    }
  }

  clearDateFilters() {
    this.startDateFilter = '';
    this.endDateFilter = '';
    this.onDateFilterChange();
  }

  async saveTaskSumTemplate() {
    if (!this.newSumTemplateName.trim() || !this.selectedProjectForTasksModal) {
      alert('Por favor ingresa un nombre para la suma');
      return;
    }

    try {
      // Obtener IDs de tareas seleccionadas
      const selectedTaskIds = this.projectTasksForModal
        .filter(task => this.projectTaskIncluded[task.id] !== false)
        .map(task => task.id);

      // Calcular suma total
      let totalHours = 0;
      selectedTaskIds.forEach(taskId => {
        const task = this.projectTasksForModal.find(t => t.id === taskId);
        if (task) {
          const duration = this.getTaskDuration(task);
          if (duration !== null) {
            totalHours += duration;
          }
        }
      });

      // Obtener environmentId del proyecto
      const project = this.projects.find(p => p.id === this.selectedProjectForTasksModal!.id);
      if (!project) {
        alert('Error: No se pudo encontrar el proyecto');
        return;
      }

      const templateData: any = {
        name: this.newSumTemplateName.trim(),
        projectId: this.selectedProjectForTasksModal.id,
        environmentId: project.environment,
        selectedTaskIds: selectedTaskIds,
        totalDuration: totalHours
      };

      // Agregar filtros de fecha si existen
      if (this.startDateFilter) {
        templateData.startDateFilter = this.startDateFilter;
      }
      if (this.endDateFilter) {
        templateData.endDateFilter = this.endDateFilter;
      }

      // Guardar si estamos editando o creando
      const isEditing = !!this.editingTemplateId;
      
      // Guardar o actualizar plantilla
      if (isEditing) {
        await this.taskSumTemplateService.updateTemplate(this.editingTemplateId!, templateData);
      } else {
        await this.taskSumTemplateService.createTemplate(templateData);
      }

      // Guardar el nombre antes de cerrar el modal (que limpia la variable)
      const savedName = this.newSumTemplateName.trim();

      // Recargar plantillas
      await this.loadTaskSumTemplates();

      // Limpiar estado de edición
      this.editingTemplateId = null;

      // Cerrar modal
      this.closeSaveSumTemplateModal();

      alert(`Suma "${savedName}" ${isEditing ? 'actualizada' : 'guardada'} exitosamente`);
    } catch (error) {
      console.error('Error al guardar plantilla de suma:', error);
      alert('Error al guardar la suma. Por favor intenta nuevamente.');
    }
  }

  async openSavedTemplate(template: TaskSumTemplate) {
    // Buscar el proyecto
    const project = this.projects.find(p => p.id === template.projectId);
    if (!project) {
      alert('Error: No se pudo encontrar el proyecto de esta suma');
      return;
    }

    // Establecer estado de edición
    this.editingTemplateId = template.id;
    
    // Cargar filtros de fecha si existen (robusto para plantillas antiguas)
    this.startDateFilter = template.startDateFilter || '';
    this.endDateFilter = template.endDateFilter || '';

    // Abrir el modal del proyecto (aplicará los filtros automáticamente)
    await this.openProjectTasksModal(project);

    // Restaurar la selección de checkboxes
    this.projectTaskIncluded = {};
    this.projectTasksForModal.forEach(task => {
      this.projectTaskIncluded[task.id] = template.selectedTaskIds.includes(task.id);
    });
  }

  async deleteTaskSumTemplate(id: string) {
    try {
      await this.taskSumTemplateService.deleteTemplate(id);
      await this.loadTaskSumTemplates();
    } catch (error) {
      console.error('Error al eliminar plantilla de suma:', error);
      alert('Error al eliminar la suma. Por favor intenta nuevamente.');
    }
  }

  getTaskDuration(task: Task): number | null {
    // Si hay fragmentos, sumar la duración de todos
    if (task.fragments && task.fragments.length > 0) {
      let totalDuration = 0;
      for (const fragment of task.fragments) {
        if (fragment.start && fragment.end) {
          const startStr = fragment.start.includes('Z') ? fragment.start : fragment.start + 'Z';
          const endStr = fragment.end.includes('Z') ? fragment.end : fragment.end + 'Z';
          const start = new Date(startStr).getTime();
          const end = new Date(endStr).getTime();
          const diffMs = end - start;
          const diffHours = diffMs / (1000 * 60 * 60);
          totalDuration += Math.max(0, diffHours);
        }
      }
      return totalDuration > 0 ? totalDuration : null;
    }
    
    // Si no hay fragmentos pero hay duration definida, usarla
    if (task.duration && task.duration > 0) {
      return task.duration;
    }
    
    // Si no hay fragmentos ni duration, calcular desde start y end
    if (task.start && task.end) {
      const startStr = task.start.includes('Z') ? task.start : task.start + 'Z';
      const endStr = task.end.includes('Z') ? task.end : task.end + 'Z';
      const start = new Date(startStr).getTime();
      const end = new Date(endStr).getTime();
      const diffMs = end - start;
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

  getTotalProjectDuration(): string {
    let totalHours = 0;
    
    this.projectTasksForModal.forEach(task => {
      // Solo incluir si el checkbox está marcado (true por defecto)
      if (this.projectTaskIncluded[task.id] !== false) {
        const duration = this.getTaskDuration(task);
        if (duration !== null) {
          totalHours += duration;
        }
      }
    });
    
    return this.formatTaskDuration(totalHours);
  }

  getSelectedProjectTasks(): Task[] {
    return this.projectTasksForModal.filter(task => 
      this.projectTaskIncluded[task.id] !== false
    );
  }

  getDayTotalDuration(dateKey: string): string {
    const grouped = this.getGroupedProjectTasks();
    const dayTasks = grouped[dateKey] || [];
    
    let totalHours = 0;
    
    dayTasks.forEach(task => {
      // Solo incluir si el checkbox está marcado (true por defecto)
      if (this.projectTaskIncluded[task.id] !== false) {
        const duration = this.getTaskDuration(task);
        if (duration !== null) {
          totalHours += duration;
        }
      }
    });
    
    return this.formatTaskDuration(totalHours);
  }

  updateTotalDuration() {
    // Este método se llama cuando cambia un checkbox
    // La suma se recalcula automáticamente mediante getTotalProjectDuration()
    // No necesitamos hacer nada aquí, Angular se encarga de la actualización
  }

  getGroupedProjectTasks(): { [dateKey: string]: Task[] } {
    const grouped: { [dateKey: string]: Task[] } = {};
    
    this.projectTasksForModal.forEach(task => {
      if (task.start) {
        const dateStr = task.start.includes('Z') ? task.start : task.start + 'Z';
        const date = new Date(dateStr);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(task);
      } else {
        // Tareas sin fecha van a un grupo especial
        const noDateKey = 'sin-fecha';
        if (!grouped[noDateKey]) {
          grouped[noDateKey] = [];
        }
        grouped[noDateKey].push(task);
      }
    });
    
    return grouped;
  }

  formatTaskDate(dateString: string | null | undefined): string {
    if (!dateString) return 'Sin fecha';
    
    try {
      const dateStr = dateString.includes('Z') ? dateString : dateString + 'Z';
      const taskDate = new Date(dateStr);
      
      // Validar que la fecha sea válida
      if (isNaN(taskDate.getTime())) {
        return 'Sin fecha';
      }
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Resetear horas para comparar solo fechas
      const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      
      if (taskDateOnly.getTime() === todayOnly.getTime()) {
        return 'Hoy';
      } else if (taskDateOnly.getTime() === yesterdayOnly.getTime()) {
        return 'Ayer';
      } else {
        // Formato DD/MM/YYYY
        const day = taskDate.getDate().toString().padStart(2, '0');
        const month = (taskDate.getMonth() + 1).toString().padStart(2, '0');
        const year = taskDate.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (error) {
      return 'Sin fecha';
    }
  }

  formatTaskTime(dateString: string | null | undefined): string {
    if (!dateString) return '';
    
    try {
      const dateStr = dateString.includes('Z') ? dateString : dateString + 'Z';
      const date = new Date(dateStr);
      
      // Validar que la fecha sea válida
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${hours}:${minutes}`;
    } catch (error) {
      return '';
    }
  }

  getGroupedProjectTasksKeys(): string[] {
    const grouped = this.getGroupedProjectTasks();
    // Ordenar las claves de fecha descendente (más reciente primero)
    // Las tareas sin fecha van al final
    return Object.keys(grouped).sort((a, b) => {
      if (a === 'sin-fecha') return 1;
      if (b === 'sin-fecha') return -1;
      return b.localeCompare(a); // Descendente
    });
  }

  getTaskGlobalIndex(task: Task): number {
    return this.projectTasksForModal.findIndex(t => t.id === task.id);
  }

  handleCheckboxChange(task: Task, index: number, event: MouseEvent) {
    event.preventDefault(); // Prevenir el cambio automático del checkbox
    
    const isShiftPressed = event.shiftKey;
    const currentState = this.projectTaskIncluded[task.id];
    const newState = !currentState;
    
    if (isShiftPressed && this.lastSelectedTaskIndex !== null) {
      // Selección por rango
      const startIndex = Math.min(this.lastSelectedTaskIndex, index);
      const endIndex = Math.max(this.lastSelectedTaskIndex, index);
      
      // Aplicar el nuevo estado (el que tendrá el checkbox actual) a todo el rango
      for (let i = startIndex; i <= endIndex; i++) {
        const rangeTask = this.projectTasksForModal[i];
        if (rangeTask) {
          this.projectTaskIncluded[rangeTask.id] = newState;
        }
      }
    } else {
      // Selección individual normal
      this.projectTaskIncluded[task.id] = newState;
    }
    
    // Actualizar el último índice seleccionado
    this.lastSelectedTaskIndex = index;
  }

  closeQuickContextMenu() {
    this.showQuickContextMenu = false;
  }

  async editTask(task: Task) {
    this.selectedTask = JSON.parse(JSON.stringify(task));
    
    // Limpiar errores de validación
    this.editTaskDateError = '';
    
    // Guardar el proyecto original antes de cargar proyectos disponibles
    const originalProject = this.selectedTask?.project;
    
    // Inicializar fechas y horas separadas para edición ANTES de cargar proyectos
    if (this.selectedTask && this.selectedTask.start) {
      const startDateTime = this.splitDateTime(this.selectedTask.start);
      this.editTaskStartDate = startDateTime.date;
      this.editTaskStartTime = startDateTime.time;
    } else {
      // Proporcionar valores por defecto válidos
      const now = new Date();
      this.editTaskStartDate = now.toISOString().split('T')[0];
      this.editTaskStartTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
    
    if (this.selectedTask && this.selectedTask.end) {
      const endDateTime = this.splitDateTime(this.selectedTask.end);
      this.editTaskEndDate = endDateTime.date;
      this.editTaskEndTime = endDateTime.time;
    } else {
      // Proporcionar valores por defecto válidos (1 hora después del inicio)
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000); // +1 hora
      this.editTaskEndDate = endTime.toISOString().split('T')[0];
      this.editTaskEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    }
    
    if (this.selectedTask && this.selectedTask.deadline) {
      const deadlineDateTime = this.splitDateTime(this.selectedTask.deadline);
      this.editTaskDeadlineDate = deadlineDateTime.date;
      this.editTaskDeadlineTime = deadlineDateTime.time;
    } else {
      // Para deadline, mantener valores vacíos cuando no hay deadline
      this.editTaskDeadlineDate = '';
      this.editTaskDeadlineTime = '';
    }
    
    // Inicializar recordatorios para edición
    this.editTaskReminderDates = [];
    this.editTaskReminderTimes = [];
    this.editTaskReminderErrors = [];
    
    if (this.selectedTask?.reminders) {
      this.selectedTask.reminders.forEach((reminder, index) => {
        const reminderDateTime = this.splitDateTime(reminder);
        this.editTaskReminderDates[index] = reminderDateTime.date;
        this.editTaskReminderTimes[index] = reminderDateTime.time;
        this.editTaskReminderErrors[index] = '';
      });
    }
    
    // Cargar proyectos disponibles para el ambiente seleccionado
    this.onEditTaskEnvironmentChange();
    
    // Restaurar el proyecto original después de cargar los proyectos disponibles
    if (this.selectedTask && originalProject) {
      this.selectedTask.project = originalProject;
    }
    
    // Calcular duración inicial automáticamente basada en las fechas/horas de la tarea
    this.updateEditTaskDuration();
    
    // Abrir el modal después de inicializar todo
    this.showEditTaskModal = true;
    this.closeContextMenu();
  }


  async deleteTask(task: Task) {
    if (confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      try {
        await this.taskService.deleteTask(task.id);
        await this.loadTasks();
      } catch (error) {
        console.error('Error al eliminar la tarea:', error);
      }
    }
    this.closeContextMenu();
  }

  // Método para eliminar tarea desde el timeline
  async deleteTaskFromTimeline(task: Task) {
    console.log('🗑️ Eliminar tarea desde timeline:', task.name);
    if (confirm(`¿Estás seguro de que quieres eliminar la tarea "${task.name}"?`)) {
      try {
        await this.taskService.deleteTask(task.id);
        await this.loadTasks();
        console.log('✅ Tarea eliminada correctamente');
      } catch (error) {
        console.error('❌ Error al eliminar la tarea:', error);
        alert('Error al eliminar la tarea. Por favor, intenta de nuevo.');
      }
    }
  }

  // Método para refrescar cuando se actualiza tiempo/duración desde el timeline
  async onTaskTimeUpdated(task: Task) {
    console.log('🔄 Tarea actualizada desde timeline:', task.name);
    await this.loadTasks();
  }

  async toggleHidden(task: Task) {
    try {
      await this.taskService.updateTask(task.id, { hidden: !task.hidden });
      await this.loadTasks();
    } catch (error) {
      console.error('Error al cambiar visibilidad:', error);
    }
    this.closeContextMenu();
  }

  async changeStatus(task: Task, status: 'pending' | 'in-progress' | 'completed') {
    // Determinar si se debe preguntar sobre ocultar/mostrar
    const currentStatus = task.status;
    
    // Configurar el cambio pendiente
    this.pendingStatusChange = { task, status };
    
    // Determinar el mensaje según el cambio de estado
    if (status === 'completed') {
      // Al completar una tarea, preguntar si quiere ocultarla
      this.statusChangeWillHide = true;
    } else if (currentStatus === 'completed' && (status === 'pending' || status === 'in-progress')) {
      // Al sacar de completada, preguntar si quiere mostrarla (en caso de que esté oculta)
      this.statusChangeWillHide = false;
    } else {
      // Para otros cambios, aplicar directamente sin modal
      await this.applyStatusChange(task, status, false);
      return;
    }
    
    // Mostrar el modal de confirmación
    this.showStatusChangeModal = true;
    this.closeContextMenu();
  }

  async applyStatusChange(task: Task, status: 'pending' | 'in-progress' | 'completed', changeVisibility: boolean = false) {
    try {
      const updates: Partial<Task> = { status };
      
      // Actualizar campos de completado
      if (status === 'completed') {
        updates.completed = true;
        updates.completedAt = new Date().toISOString();
        // Si se eligió ocultar, agregarlo a las actualizaciones
        if (changeVisibility) {
          updates.hidden = true;
        }
      } else {
        updates.completed = false;
        updates.completedAt = null;
        // Si se eligió mostrar, agregarlo a las actualizaciones
        if (changeVisibility) {
          updates.hidden = false;
        }
      }
      
      await this.taskService.updateTask(task.id, updates);
      await this.loadTasks();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
    }
  }

  async saveEditedTask() {
    if (!this.selectedTask) return;
    
    // Validar fechas antes de guardar
    if (!this.validateEditTaskDates()) {
      return; // No guardar si hay errores de validación
    }
    
    try {
      // Excluir campos del sistema que no deben actualizarse
      const { id, userId, createdAt, ...updates } = this.selectedTask;
      await this.taskService.updateTask(this.selectedTask.id, updates);
      await this.loadTasks();
      this.showEditTaskModal = false;
      this.selectedTask = null;
    } catch (error) {
      console.error('Error al actualizar la tarea:', error);
    }
  }

  async onUpdateTaskProject(event: { taskId: string, projectId: string }) {
    try {
      const task = this.tasks.find(t => t.id === event.taskId);
      if (!task) {
        console.error('Tarea no encontrada:', event.taskId);
        return;
      }

      const project = this.projects.find(p => p.id === event.projectId);
      if (!project) {
        console.error('Proyecto no encontrado:', event.projectId);
        return;
      }

      // Actualizar el proyecto y asegurar que el ambiente coincida
      await this.taskService.updateTask(event.taskId, {
        project: event.projectId,
        environment: project.environment
      });
      
      await this.loadTasks();
    } catch (error) {
      console.error('Error al actualizar el proyecto de la tarea:', error);
      alert('Error al actualizar el proyecto. Por favor, intenta de nuevo.');
    }
  }

  onNewTaskEnvironmentChange(): void {
    if (this.newTask.environment) {
      this.selectableProjectsForNewTask = this.projects.filter(
        p => p.environment === this.newTask.environment
      );
    } else {
      this.selectableProjectsForNewTask = []; 
    }
    this.newTask.project = '';
  }

  onEditTaskEnvironmentChange(): void {
    if (this.selectedTask && this.selectedTask.environment) {
      this.selectableProjectsForEditTask = this.projects.filter(
        p => p.environment === this.selectedTask!.environment
      );
    } else {
      this.selectableProjectsForEditTask = [];
    }
    if (this.selectedTask) {
      this.selectedTask.project = '';
    }
  }

  openAssignOrphanedTasksModal(): void {
    console.log('openAssignOrphanedTasksModal called');
    console.log('Selected orphaned tasks IDs:', this.getSelectedOrphanedTasksIds());
    console.log('selectedOrphanedTasks object:', this.selectedOrphanedTasks);
    console.log('noOrphanedSelected:', this.noOrphanedSelected);
    console.log('isAssigningOrphanedTasks:', this.isAssigningOrphanedTasks);

    if (this.getSelectedOrphanedTasksIds().length === 0) {
      alert("Por favor, selecciona al menos una tarea huérfana para asignar.");
      return;
    }
    this.projectForAssigningOrphans = '';
    this.showAssignOrphanedTasksModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeAssignOrphanedTasksModal(): void {
    this.showAssignOrphanedTasksModal = false;
    document.body.style.overflow = '';
  }

  getSelectedOrphanedTasksIds(): string[] {
    return Object.keys(this.selectedOrphanedTasks).filter(taskId => this.selectedOrphanedTasks[taskId]);
  }

  async assignSelectedOrphanedTasks(): Promise<void> {
    const selectedIds = this.getSelectedOrphanedTasksIds();
    if (selectedIds.length === 0) {
      alert("No hay tareas seleccionadas.");
      return;
    }
    if (!this.projectForAssigningOrphans) {
      alert("Por favor, selecciona un proyecto destino.");
      return;
    }

    const targetProject = this.projects.find(p => p.id === this.projectForAssigningOrphans);
    if (!targetProject) {
      alert("Proyecto destino no encontrado. Por favor, recarga.");
      return;
    }

    this.isAssigningOrphanedTasks = true;
    try {
      const updatePromises = selectedIds.map(taskId => {
        return this.taskService.updateTask(taskId, { 
          project: targetProject.id, 
          environment: targetProject.environment 
        });
      });
      await Promise.all(updatePromises);
      alert(`${selectedIds.length} tarea(s) asignada(s) exitosamente al proyecto "${targetProject.name}".`);
      
      await this.loadTasks();
      this.selectedOrphanedTasks = {};
      this.closeAssignOrphanedTasksModal();

    } catch (error) {
      console.error("Error asignando tareas huérfanas:", error);
      alert(`Error al asignar tareas: ${error}`);
    } finally {
      this.isAssigningOrphanedTasks = false;
    }
  }

  toggleSelectAllOrphaned(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const checked = inputElement.checked;
    const newSelection: { [taskId: string]: boolean } = {};
    this.orphanedTasks.forEach(task => newSelection[task.id] = checked);
    this.selectedOrphanedTasks = newSelection;
  }

  get allOrphanedSelected(): boolean {
    return this.orphanedTasks.length > 0 && this.orphanedTasks.every(task => this.selectedOrphanedTasks[task.id]);
  }

  get noOrphanedSelected(): boolean {
    return this.getSelectedOrphanedTasksIds().length === 0;
  }

  createProjectForEnvironment(environmentId: string) {
    // Preseleccionar el ambiente en el nuevo proyecto
    this.newProject.environment = environmentId;
    this.openNewProjectModal();
    this.closeEnvironmentContextMenu();
  }

  async deleteEnvironment(environment: Environment) {
    const hasProjects = this.projects.some(p => p.environment === environment.id);
    const hasTasks = this.tasks.some(t => t.environment === environment.id);
    
    let confirmMessage = `¿Estás seguro de que quieres eliminar el ambiente "${environment.name}"?`;
    
    if (hasProjects || hasTasks) {
      confirmMessage += '\n\nEste ambiente contiene:';
      if (hasProjects) {
        const projectCount = this.projects.filter(p => p.environment === environment.id).length;
        confirmMessage += `\n- ${projectCount} proyecto(s)`;
      }
      if (hasTasks) {
        const taskCount = this.tasks.filter(t => t.environment === environment.id).length;
        confirmMessage += `\n- ${taskCount} tarea(s)`;
      }
      confirmMessage += '\n\nTodos los proyectos y tareas de este ambiente también serán eliminados.';
    }
    
    if (confirm(confirmMessage)) {
      try {
        // Eliminar todas las tareas del ambiente
        const tasksToDelete = this.tasks.filter(t => t.environment === environment.id);
        for (const task of tasksToDelete) {
          await this.taskService.deleteTask(task.id);
        }
        
        // Eliminar todos los proyectos del ambiente
        const projectsToDelete = this.projects.filter(p => p.environment === environment.id);
        for (const project of projectsToDelete) {
          await this.projectService.deleteProject(project.id);
        }
        
        // Eliminar el ambiente
        await this.environmentService.deleteEnvironment(environment.id);
        
        // Limpiar el orden personalizado del environment eliminado
        if (this.environmentCustomOrder[environment.id]) {
          delete this.environmentCustomOrder[environment.id];
          this.saveEnvironmentCustomOrder();
        }
        
        // Recargar datos
        await this.loadInitialData();
        
        alert(`Ambiente "${environment.name}" eliminado exitosamente.`);
      } catch (error) {
        console.error('Error al eliminar el ambiente:', error);
        alert(`Error al eliminar el ambiente: ${error}`);
      }
    }
    this.closeEnvironmentContextMenu();
  }

  async deleteProject(project: Project) {
    const projectTasks = this.tasks.filter(t => t.project === project.id);
    
    let confirmMessage = `¿Estás seguro de que quieres eliminar el proyecto "${project.name}"?`;
    
    if (projectTasks.length > 0) {
      confirmMessage += `\n\nEste proyecto contiene ${projectTasks.length} tarea(s) que serán desvinculadas del proyecto y se convertirán en tareas sin proyecto asignado.`;
    }
    
    if (confirm(confirmMessage)) {
      try {
        // Desvincular tareas del proyecto (no eliminarlas, solo quitar la referencia)
        for (const task of projectTasks) {
          await this.taskService.updateTask(task.id, { 
            project: '',
            // Mantener el ambiente para que no se conviertan en huérfanas
          });
        }
        
        // Eliminar el proyecto
        await this.projectService.deleteProject(project.id);
        
        // Recargar datos
        await this.loadInitialData();
        
        if (projectTasks.length > 0) {
          alert(`Proyecto "${project.name}" eliminado exitosamente. ${projectTasks.length} tarea(s) fueron desvinculadas del proyecto.`);
        } else {
          alert(`Proyecto "${project.name}" eliminado exitosamente.`);
        }
      } catch (error) {
        console.error('Error al eliminar el proyecto:', error);
        alert(`Error al eliminar el proyecto: ${error}`);
      }
    }
    this.closeProjectContextMenu();
  }

  private loadShowHiddenState(): void {
    const savedState = localStorage.getItem('taskTracker_showHidden');
    if (savedState !== null) {
      this.showHidden = JSON.parse(savedState);
      // Aplicar el filtro con el estado recuperado
      this.filterTasks();
    }
  }

  private saveShowHiddenState(): void {
    localStorage.setItem('taskTracker_showHidden', JSON.stringify(this.showHidden));
  }


  calculateDuration(startDate: string, startTime: string, endDate: string, endTime: string): number {
    if (!startDate || !startTime || !endDate || !endTime) {
      return 0;
    }

    try {
      // Crear objetos Date para inicio y fin
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      const startDateTime = new Date(startDate);
      startDateTime.setHours(startHours, startMinutes, 0, 0);
      
      const endDateTime = new Date(endDate);
      endDateTime.setHours(endHours, endMinutes, 0, 0);
      
      // Calcular diferencia en milisegundos
      const diffMs = endDateTime.getTime() - startDateTime.getTime();
      
      // Convertir a horas
      const diffHours = diffMs / (1000 * 60 * 60);
      
      // Redondear a 2 decimales y asegurar que no sea negativo
      return Math.max(0, Math.round(diffHours * 100) / 100);
    } catch (error) {
      console.error('Error calculating duration:', error);
      return 0;
    }
  }

  updateNewTaskDuration(): void {
    const duration = this.calculateDuration(
      this.newTaskStartDate,
      this.newTaskStartTime,
      this.newTaskEndDate,
      this.newTaskEndTime
    );
    this.newTask.duration = duration;
    
    // Validar fechas automáticamente
    this.validateNewTaskDates();
  }

  updateEditTaskDuration(): void {
    if (!this.selectedTask) return;
    
    const duration = this.calculateDuration(
      this.editTaskStartDate,
      this.editTaskStartTime,
      this.editTaskEndDate,
      this.editTaskEndTime
    );
    this.selectedTask.duration = duration;
    
    // Validar fechas automáticamente
    this.validateEditTaskDates();
  }


  // Convertir HEX a HSL
  hexToHsl(hex: string): {h: number, s: number, l: number} {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }


  // Inicializar color picker al abrir modal
  initializeColorPicker(): void {
    const currentColor = this.newEnvironment.color || '#3B82F6';
    const hsl = this.hexToHsl(currentColor);
    this.colorPickerHue = hsl.h;
    this.colorPickerSaturation = hsl.s;
    this.colorPickerLightness = hsl.l;
  }

  // Métodos para manejar fecha y hora por separado
  combineDateTime(date: string, time: string): string {
    if (!date || !time) return '';
    const [hours, minutes] = time.split(':');
    
    // Crear fecha en zona horaria local
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(5, 7)) - 1; // Los meses en JS son 0-11
    const day = parseInt(date.substring(8, 10));
    
    const dateTime = new Date(year, month, day, parseInt(hours), parseInt(minutes), 0, 0);
    
    // Convertir a UTC para guardar en la base de datos (esto es lo correcto)
    return dateTime.toISOString().slice(0, 16);
  }

  splitDateTime(dateTimeString: string): { date: string, time: string } {
    if (!dateTimeString) return { date: '', time: '' };
    
    // El string viene de la base de datos en UTC, necesitamos convertir a hora local
    const dateTime = new Date(dateTimeString + (dateTimeString.includes('Z') ? '' : 'Z')); // Asegurar que se interprete como UTC
    
    // Convertir a hora local del usuario
    const year = dateTime.getFullYear();
    const month = String(dateTime.getMonth() + 1).padStart(2, '0');
    const day = String(dateTime.getDate()).padStart(2, '0');
    const hours = String(dateTime.getHours()).padStart(2, '0');
    const minutes = String(dateTime.getMinutes()).padStart(2, '0');
    
    const date = `${year}-${month}-${day}`;
    const time = `${hours}:${minutes}`;
    
    return { date, time };
  }

  onNewTaskStartTimeChange(time: string) {
    this.newTaskStartTime = time;
    this.updateNewTaskDateTime('start');
    this.updateNewTaskDuration();
  }

  onNewTaskEndTimeChange(time: string) {
    this.newTaskEndTime = time;
    this.updateNewTaskDateTime('end');
    this.updateNewTaskDuration();
  }


  onEditTaskStartTimeChange(time: string) {
    this.editTaskStartTime = time;
    this.updateEditTaskDateTime('start');
    this.updateEditTaskDuration();
  }

  onEditTaskEndTimeChange(time: string) {
    this.editTaskEndTime = time;
    this.updateEditTaskDateTime('end');
    this.updateEditTaskDuration();
  }


  private updateNewTaskDateTime(field: 'start' | 'end' | 'deadline') {
    let dateValue = '';
    let timeValue = '';
    
    switch (field) {
      case 'start':
        dateValue = this.newTaskStartDate;
        timeValue = this.newTaskStartTime;
        break;
      case 'end':
        dateValue = this.newTaskEndDate;
        timeValue = this.newTaskEndTime;
        break;
      case 'deadline':
        dateValue = this.newTaskDeadlineDate;
        timeValue = this.newTaskDeadlineTime;
        break;
    }

    const combinedDateTime = this.combineDateTime(dateValue, timeValue);
    
    if (field === 'deadline') {
      this.newTask.deadline = combinedDateTime || null;
    } else {
      (this.newTask as any)[field] = combinedDateTime;
    }
  }

  private updateEditTaskDateTime(field: 'start' | 'end' | 'deadline') {
    if (!this.selectedTask) return;
    
    let dateValue = '';
    let timeValue = '';
    
    switch (field) {
      case 'start':
        dateValue = this.editTaskStartDate;
        timeValue = this.editTaskStartTime;
        break;
      case 'end':
        dateValue = this.editTaskEndDate;
        timeValue = this.editTaskEndTime;
        break;
      case 'deadline':
        dateValue = this.editTaskDeadlineDate;
        timeValue = this.editTaskDeadlineTime;
        break;
    }

    const combinedDateTime = this.combineDateTime(dateValue, timeValue);
    
    if (field === 'deadline') {
      this.selectedTask.deadline = combinedDateTime || null;
    } else {
      (this.selectedTask as any)[field] = combinedDateTime;
    }
  }

  onNewTaskDateChange(field: 'start' | 'end' | 'deadline', date: string) {
    switch (field) {
      case 'start':
        this.newTaskStartDate = date;
        break;
      case 'end':
        this.newTaskEndDate = date;
        break;
      case 'deadline':
        this.newTaskDeadlineDate = date;
        break;
    }
    this.updateNewTaskDateTime(field);
    // Actualizar duración solo si cambió fecha de inicio o fin
    if (field === 'start' || field === 'end') {
      this.updateNewTaskDuration();
    }
  }

  onEditTaskDateChange(field: 'start' | 'end' | 'deadline', date: string) {
    switch (field) {
      case 'start':
        this.editTaskStartDate = date;
        break;
      case 'end':
        this.editTaskEndDate = date;
        break;
      case 'deadline':
        this.editTaskDeadlineDate = date;
        break;
    }
    this.updateEditTaskDateTime(field);
    // Actualizar duración solo si cambió fecha de inicio o fin
    if (field === 'start' || field === 'end') {
      this.updateEditTaskDuration();
    }
  }

  // Métodos para validación de fechas
  validateNewTaskDates(): boolean {
    this.newTaskDateError = '';
    
    if (!this.newTaskStartDate || !this.newTaskStartTime || !this.newTaskEndDate || !this.newTaskEndTime) {
      return true; // No validar si no están completas las fechas
    }

    const startDateTime = new Date(`${this.newTaskStartDate}T${this.newTaskStartTime}`);
    const endDateTime = new Date(`${this.newTaskEndDate}T${this.newTaskEndTime}`);

    if (endDateTime <= startDateTime) {
      this.newTaskDateError = 'La fecha de fin debe ser posterior a la fecha de inicio';
      return false;
    }

    return true;
  }

  validateEditTaskDates(): boolean {
    this.editTaskDateError = '';
    
    if (!this.editTaskStartDate || !this.editTaskStartTime || !this.editTaskEndDate || !this.editTaskEndTime) {
      return true; // No validar si no están completas las fechas
    }

    const startDateTime = new Date(`${this.editTaskStartDate}T${this.editTaskStartTime}`);
    const endDateTime = new Date(`${this.editTaskEndDate}T${this.editTaskEndTime}`);

    if (endDateTime <= startDateTime) {
      this.editTaskDateError = 'La fecha de fin debe ser posterior a la fecha de inicio';
      return false;
    }

    return true;
  }

  // Métodos para el cálculo de tiempo
  openTimeCalculator(type: 'start' | 'end', context: 'new' | 'edit') {
    this.calculatorType = type;
    this.calculatorContext = context;
    this.calculatorInput = '';
    this.calculatorError = '';
    this.calculatorIsValid = false;
    this.showTimeCalculatorModal = true;
    
    // Bloquear scroll del body
    document.body.style.overflow = 'hidden';
  }

  closeTimeCalculator() {
    this.showTimeCalculatorModal = false;
    this.calculatorInput = '';
    this.calculatorError = '';
    this.calculatorIsValid = false;
    this.calculatorBackdropMouseDownPos = null;
    
    // Restaurar scroll del body
    document.body.style.overflow = '';
  }

  // Detectar Escape key para cerrar modales
  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.showTimeCalculatorModal) {
      this.closeTimeCalculator();
    }
  }

  onCalculatorBackdropMouseDown(event: MouseEvent) {
    // Guardar la posición del mousedown para comparar con mouseup
    this.calculatorBackdropMouseDownPos = { x: event.clientX, y: event.clientY };
  }

  onCalculatorBackdropMouseUp(event: MouseEvent) {
    // Solo cerrar si el mouseup está cerca del mousedown (es un click, no un drag)
    if (this.calculatorBackdropMouseDownPos) {
      const deltaX = Math.abs(event.clientX - this.calculatorBackdropMouseDownPos.x);
      const deltaY = Math.abs(event.clientY - this.calculatorBackdropMouseDownPos.y);
      const threshold = 5; // Píxeles de tolerancia para considerar que es un click
      
      if (deltaX <= threshold && deltaY <= threshold) {
        this.closeTimeCalculator();
      }
    }
    
    this.calculatorBackdropMouseDownPos = null;
  }

  validateCalculatorInput() {
    if (!this.calculatorInput.trim()) {
      this.calculatorError = '';
      this.calculatorIsValid = false;
      return;
    }

    try {
      const result = this.parseCalculatorInput(this.calculatorInput);
      if (result > 0) {
        this.calculatorError = '';
        this.calculatorIsValid = true;
      } else {
        this.calculatorError = 'El resultado debe ser mayor que 0';
        this.calculatorIsValid = false;
      }
    } catch (error: any) {
      this.calculatorError = error.message || 'Formato inválido';
      this.calculatorIsValid = false;
    }
  }

  parseCalculatorInput(input: string): number {
    // Limpiar espacios y normalizar
    let cleanInput = input.trim().toLowerCase();
    
    // Verificar si termina en 'h' (horas) - puede tener espacios antes
    const isHours = /\s*h\s*$/.test(cleanInput);
    let expression = isHours ? cleanInput.replace(/\s*h\s*$/, '').trim() : cleanInput;
    
    // Validar caracteres permitidos (números, operadores, puntos decimales, espacios, paréntesis)
    if (!/^[\d+\-*\/\.\s\(\)]+$/.test(expression)) {
      throw new Error('Solo se permiten números y operadores matemáticos (+, -, *, /, paréntesis)');
    }
    
    // Evaluar la expresión matemática de forma segura
    let result: number;
    try {
      // Reemplazar espacios múltiples y normalizar espacios alrededor de operadores
      expression = expression.replace(/\s+/g, '');
      
      // Validar que no hay operadores consecutivos o mal formados
      if (/[\+\-\*\/]{2,}/.test(expression) || /^[\+\*\/]/.test(expression) || /[\+\-\*\/]$/.test(expression)) {
        throw new Error('Operadores mal formados');
      }
      
      // Usar Function constructor para evaluar de forma más segura que eval()
      result = new Function('return ' + expression)();
      
      if (isNaN(result) || !isFinite(result)) {
        throw new Error('Resultado inválido');
      }
    } catch (error) {
      throw new Error('Expresión matemática inválida');
    }
    
    // Redondear a 2 decimales
    result = Math.round(result * 100) / 100;
    
    // Si es en horas, convertir a minutos
    if (isHours) {
      result = result * 60; // Convertir horas a minutos
    }
    
    return result;
  }

  getCalculatorPreview(): string {
    if (!this.calculatorIsValid || !this.calculatorInput) return '';
    
    try {
      const minutes = this.parseCalculatorInput(this.calculatorInput);
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      
      let timeStr = '';
      if (hours > 0) {
        timeStr = `${hours}h ${mins}m`;
      } else {
        timeStr = `${mins}m`;
      }
      
      const action = this.calculatorType === 'start' ? 'Restar' : 'Sumar';
      return `${action} ${timeStr} (${minutes} minutos)`;
    } catch (error) {
      return '';
    }
  }

  applyTimeCalculation() {
    if (!this.calculatorIsValid || !this.calculatorInput) return;
    
    try {
      const minutes = this.parseCalculatorInput(this.calculatorInput);
      
      if (this.calculatorContext === 'new') {
        this.applyNewTaskTimeCalculation(minutes);
      } else {
        this.applyEditTaskTimeCalculation(minutes);
      }
      
      this.closeTimeCalculator();
    } catch (error) {
      console.error('Error aplicando cálculo:', error);
    }
  }

  applyNewTaskTimeCalculation(minutes: number) {
    // Usar el método público del modal para aplicar el cálculo
    if (this.newTaskModal) {
      this.newTaskModal.applyTimeCalculation(this.calculatorType, minutes);
    }
  }

  applyEditTaskTimeCalculation(minutes: number) {
    // Usar el método público del modal para aplicar el cálculo
    if (this.editTaskModal) {
      this.editTaskModal.applyTimeCalculation(this.calculatorType, minutes);
    }
  }


  // Nuevo: Métodos para manejar environments
  get orderedEnvironments(): Environment[] {
    return this._orderedEnvironmentsCache;
  }

  updateOrderedEnvironmentsCache(): void {
    const isMobile = window.innerWidth < 768;
    
    this._orderedEnvironmentsCache = [...this.environments].sort((a, b) => {
      if (isMobile) {
        const aOrder = this.environmentCustomOrder[a.id] ?? Infinity;
        const bOrder = this.environmentCustomOrder[b.id] ?? Infinity;
        
        if (aOrder !== Infinity || bOrder !== Infinity) {
          if (aOrder !== bOrder) {
            return aOrder - bOrder;
          }
        }
        return a.name.localeCompare(b.name);
      }
      
      const aHasTasks = this.environmentHasTasks(a.id);
      const bHasTasks = this.environmentHasTasks(b.id);
      
      if (aHasTasks && !bHasTasks) return -1;
      if (!aHasTasks && bHasTasks) return 1;
      
      const aOrder = this.environmentCustomOrder[a.id] ?? Infinity;
      const bOrder = this.environmentCustomOrder[b.id] ?? Infinity;
      
      if (aOrder !== Infinity || bOrder !== Infinity) {
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
      }
      
      return a.name.localeCompare(b.name);
    });
  }

  environmentHasTasks(environmentId: string): boolean {
    return this.getTasksByEnvironment(environmentId).length > 0 ||
           this.getProjectsWithTasksInEnvironment(environmentId).length > 0;
  }

  getProjectsWithTasksInEnvironment(environmentId: string): Project[] {
    return this.projects.filter(project =>
      project.environment === environmentId &&
      this.getTasksByProject(project.id).length > 0
    );
  }


  getEnvironmentHiddenVisibility(envId: string): 'show-all' | 'show-24h' | 'hidden' | 'date-range' {
    // Si el filtro global está activado, siempre mostrar todas las tareas ocultas
    if (this.showHidden) {
      return 'show-all';
    }
    
    // Si hay una configuración específica para este environment, usarla
    if (this.environmentHiddenVisibility[envId]) {
      return this.environmentHiddenVisibility[envId];
    }
    // Por defecto, ocultar las tareas ocultas (no mostrarlas)
    return 'hidden';
  }

  setEnvironmentHiddenVisibility(envId: string, visibility: 'show-all' | 'show-24h' | 'hidden' | 'date-range'): void {
    this.environmentHiddenVisibility[envId] = visibility;
    this.closeEnvironmentContextMenu();
    // Refrescar la vista aplicando los filtros
    this.processTasks();
  }
  
  openDateRangeModal(environmentId: string): void {
    this.dateRangeModalEnvironmentId = environmentId;
    this.showDateRangeModal = true;
    this.closeEnvironmentContextMenu();
  }
  
  closeDateRangeModal(): void {
    this.showDateRangeModal = false;
    this.dateRangeModalEnvironmentId = '';
  }
  
  onDateRangeSelected(range: { mode: 'day' | 'range', startDate?: string, endDate?: string, singleDate?: string }): void {
    if (!this.dateRangeModalEnvironmentId) {
      this.closeDateRangeModal();
      return;
    }
    
    // Si se limpia el filtro (singleDate vacío en modo day)
    if (range.mode === 'day' && !range.singleDate) {
      // Cambiar visibilidad a 'hidden' y eliminar el rango
      this.environmentHiddenVisibility[this.dateRangeModalEnvironmentId] = 'hidden';
      delete this.environmentDateRanges[this.dateRangeModalEnvironmentId];
    } else {
      // Establecer el modo de visibilidad a 'date-range' y guardar el rango
      this.environmentHiddenVisibility[this.dateRangeModalEnvironmentId] = 'date-range';
      this.environmentDateRanges[this.dateRangeModalEnvironmentId] = range;
    }
    this.processTasks();
    this.closeDateRangeModal();
  }
  
  getDateRangeForModal(): { mode: 'day' | 'range', startDate?: string, endDate?: string, singleDate?: string } | null {
    if (!this.dateRangeModalEnvironmentId) {
      return null;
    }
    return this.environmentDateRanges[this.dateRangeModalEnvironmentId] || null;
  }

  // Vista por environment: cards/list
  getEnvironmentViewMode(envId: string): 'cards' | 'list' {
    return this.environmentViewMode[envId] || 'cards';
  }

  toggleEnvironmentViewMode(envId: string): void {
    const current = this.getEnvironmentViewMode(envId);
    this.environmentViewMode[envId] = current === 'cards' ? 'list' : 'cards';
    this.closeEnvironmentContextMenu();
    this.saveEnvironmentViewModes();
  }
  
  // Orden de tareas por environment
  getEnvironmentSortOrder(envId: string): 'asc' | 'desc' {
    return this.environmentSortOrder[envId] || 'asc';
  }
  
  toggleEnvironmentSortOrder(envId: string): void {
    const current = this.getEnvironmentSortOrder(envId);
    this.environmentSortOrder[envId] = current === 'asc' ? 'desc' : 'asc';
    this.saveEnvironmentSortOrders();
    this.closeEnvironmentContextMenu();
    // Refrescar la vista aplicando el nuevo orden
    this.processTasks();
  }
  
  getEnvironmentSortOrderLabel(envId: string): string {
    const order = this.getEnvironmentSortOrder(envId);
    return order === 'asc' ? 'Más reciente' : 'Más antigua';
  }

  toggleFocusEnvironment(envId: string): void {
    let newFocusedId: string | null;
    if (this.focusedEnvironment.id === envId) {
      // Desenfocar si ya está enfocado
      newFocusedId = null;
      this.focusedEnvironment = { id: null };
    } else {
      // Enfocar el ambiente seleccionado
      newFocusedId = envId;
      this.focusedEnvironment = { id: envId };
    }
    
    // Notificar al servicio para que el componente timeline lo reciba
    this.timelineFocusService.setFocusedEnvironmentId(newFocusedId);
    
    this.cdr.detectChanges();
    this.closeEnvironmentContextMenu();
  }

  getEnvironmentName(envId: string): string {
    const env = this.environments.find(e => e.id === envId);
    return env ? (env.emoji ? `${env.emoji} ${env.name}` : env.name) : 'Desconocido';
  }

  private loadEnvironmentViewModes(): void {
    try {
      const raw = localStorage.getItem('taskTracker_envViewModes');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.environmentViewMode = parsed;
        }
      }
    } catch {}
  }

  private saveEnvironmentViewModes(): void {
    try {
      localStorage.setItem('taskTracker_envViewModes', JSON.stringify(this.environmentViewMode));
    } catch {}
  }

  private loadEnvironmentSortOrders(): void {
    try {
      const raw = localStorage.getItem('taskTracker_envSortOrders');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.environmentSortOrder = parsed;
        }
      }
    } catch {}
  }

  private saveEnvironmentSortOrders(): void {
    try {
      localStorage.setItem('taskTracker_envSortOrders', JSON.stringify(this.environmentSortOrder));
    } catch {}
  }

  private loadEnvironmentCustomOrder(): void {
    try {
      const raw = localStorage.getItem('taskTracker_envCustomOrder');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.environmentCustomOrder = parsed;
          this.updateOrderedEnvironmentsCache();
        }
      }
    } catch (error) {
      console.error('Error al cargar el orden personalizado:', error);
    }
  }
  
  // Función de utilidad para reorganizar alfabéticamente (solo móviles)
  // Ejecutar desde consola: (window as any).taskTrackerComponent.reorganizeEnvironmentsAlphabetically()
  reorganizeEnvironmentsAlphabetically(): void {
    const isMobile = window.innerWidth < 768;
    
    if (!isMobile) {
      console.log('⚠️ Esta función solo funciona en dispositivos móviles');
      return;
    }
    
    console.log('🔄 Reorganizando environments alfabéticamente...');
    
    // Ordenar environments alfabéticamente
    const sortedEnvs = [...this.environments].sort((a, b) => a.name.localeCompare(b.name));
    
    // Asignar nuevo orden
    sortedEnvs.forEach((env, index) => {
      this.environmentCustomOrder[env.id] = index;
    });
    
    console.log('✅ Nuevo orden:', this.environmentCustomOrder);
    
    // Guardar
    this.saveEnvironmentCustomOrder();
    
    // Forzar actualización
    this.cdr.detectChanges();
    
    alert('Orden reorganizado alfabéticamente');
  }

  private saveEnvironmentCustomOrder(): void {
    try {
      localStorage.setItem('taskTracker_envCustomOrder', JSON.stringify(this.environmentCustomOrder));
      this.updateOrderedEnvironmentsCache();
    } catch (error) {
      console.error('Error al guardar el orden personalizado:', error);
    }
  }

  private initializeEnvironmentOrder(): void {
    // Solo asignar orden a environments que NO tienen orden personalizado guardado
    const environmentsWithoutOrder = this.environments.filter(env => 
      !(env.id in this.environmentCustomOrder) || this.environmentCustomOrder[env.id] === undefined
    );

    if (environmentsWithoutOrder.length === 0) {
      // Todos los environments ya tienen orden, no hacer nada
      return;
    }

    // Detectar si estamos en dispositivo móvil
    const isMobile = window.innerWidth < 768;

    // Ordenar los environments sin orden
    const sortedByName = [...environmentsWithoutOrder].sort((a, b) => {
      // En móviles, solo ordenar alfabéticamente sin priorizar por tareas
      if (isMobile) {
        return a.name.localeCompare(b.name);
      }
      
      // En desktop, respetar grupos con/sin tareas
      const aHasTasks = this.environmentHasTasks(a.id);
      const bHasTasks = this.environmentHasTasks(b.id);
      if (aHasTasks && !bHasTasks) return -1;
      if (!aHasTasks && bHasTasks) return 1;
      return a.name.localeCompare(b.name);
    });

    // Encontrar el máximo orden existente para asignar índices continuos
    let maxOrder = -1;
    Object.values(this.environmentCustomOrder).forEach(order => {
      if (typeof order === 'number' && order > maxOrder) {
        maxOrder = order;
      }
    });

    // Asignar orden solo a los environments que no lo tienen
    sortedByName.forEach((env, index) => {
      if (!(env.id in this.environmentCustomOrder) || this.environmentCustomOrder[env.id] === undefined) {
        this.environmentCustomOrder[env.id] = maxOrder + index + 1;
      }
    });

    // Guardar siempre para asegurar que los nuevos órdenes se persistan
    this.saveEnvironmentCustomOrder();
  }

  moveEnvironmentUp(envId: string): void {
    const currentOrder = this.environmentCustomOrder[envId];
    if (currentOrder === undefined) {
      console.warn(`Environment ${envId} no tiene orden asignado`);
      return;
    }

    // Detectar si estamos en dispositivo móvil
    const isMobile = window.innerWidth < 768;

    let environmentsToConsider;
    
    if (isMobile) {
      // En móviles, considerar TODOS los environments sin importar si tienen tareas
      environmentsToConsider = this.environments
        .map(env => ({
          env,
          order: this.environmentCustomOrder[env.id] ?? Infinity
        }))
        .sort((a, b) => a.order - b.order);
    } else {
      // En desktop, mantener la lógica original de grupos
      const envHasTasks = this.environmentHasTasks(envId);
      environmentsToConsider = this.environments
        .filter(env => this.environmentHasTasks(env.id) === envHasTasks)
        .map(env => ({
          env,
          order: this.environmentCustomOrder[env.id] ?? Infinity
        }))
        .sort((a, b) => a.order - b.order);
    }

    const currentIndex = environmentsToConsider.findIndex(item => item.env.id === envId);
    if (currentIndex > 0) {
      const previousEnv = environmentsToConsider[currentIndex - 1];
      const previousOrder = previousEnv.order;
      
      console.log(`Moviendo ${envId} arriba: orden ${currentOrder} -> ${previousOrder}`);
      
      // Intercambiar órdenes
      this.environmentCustomOrder[envId] = previousOrder;
      this.environmentCustomOrder[previousEnv.env.id] = currentOrder;
      
      this.saveEnvironmentCustomOrder();
      // Forzar detección de cambios
      this.cdr.detectChanges();
    } else {
      console.log(`No se puede mover ${envId} arriba: ya está en la primera posición`);
    }
  }

  moveEnvironmentDown(envId: string): void {
    const currentOrder = this.environmentCustomOrder[envId];
    if (currentOrder === undefined) {
      console.warn(`Environment ${envId} no tiene orden asignado`);
      return;
    }

    // Detectar si estamos en dispositivo móvil
    const isMobile = window.innerWidth < 768;

    let environmentsToConsider;
    
    if (isMobile) {
      // En móviles, considerar TODOS los environments sin importar si tienen tareas
      environmentsToConsider = this.environments
        .map(env => ({
          env,
          order: this.environmentCustomOrder[env.id] ?? Infinity
        }))
        .sort((a, b) => a.order - b.order);
    } else {
      // En desktop, mantener la lógica original de grupos
      const envHasTasks = this.environmentHasTasks(envId);
      environmentsToConsider = this.environments
        .filter(env => this.environmentHasTasks(env.id) === envHasTasks)
        .map(env => ({
          env,
          order: this.environmentCustomOrder[env.id] ?? Infinity
        }))
        .sort((a, b) => a.order - b.order);
    }

    const currentIndex = environmentsToConsider.findIndex(item => item.env.id === envId);
    if (currentIndex < environmentsToConsider.length - 1) {
      const nextEnv = environmentsToConsider[currentIndex + 1];
      const nextOrder = nextEnv.order;
      
      console.log(`Moviendo ${envId} abajo: orden ${currentOrder} -> ${nextOrder}`);
      
      // Intercambiar órdenes
      this.environmentCustomOrder[envId] = nextOrder;
      this.environmentCustomOrder[nextEnv.env.id] = currentOrder;
      
      this.saveEnvironmentCustomOrder();
      // Forzar detección de cambios
      this.cdr.detectChanges();
    } else {
      console.log(`No se puede mover ${envId} abajo: ya está en la última posición`);
    }
  }

  // Métodos para el modal de confirmación de cambio de estado
  closeStatusChangeModal() {
    this.showStatusChangeModal = false;
    this.pendingStatusChange = null;
  }

  async confirmStatusChangeWithVisibility(changeVisibility: boolean) {
    if (this.pendingStatusChange) {
      await this.applyStatusChange(
        this.pendingStatusChange.task, 
        this.pendingStatusChange.status, 
        changeVisibility
      );
      this.closeStatusChangeModal();
    }
  }

  // Métodos para modal de recordatorios
  openRemindersModal(context: 'new' | 'edit') {
    this.remindersModalContext = context;
    this.showRemindersModal = true;
    this.resetReminderInputs();
  }

  closeRemindersModal() {
    this.showRemindersModal = false;
    this.resetReminderInputs();
  }

  private resetReminderInputs() {
    this.reminderRelativeTime = '';
    this.reminderFromNowTime = '';
    this.reminderAiInput = '';
    this.reminderManualDate = '';
    this.reminderManualTime = '';
    this.reminderRelativeError = '';
    this.reminderFromNowError = '';
    this.reminderAiError = '';
    this.reminderManualError = '';
  }

  // Métodos para sincronización del orden con base de datos
  async saveOrderToDatabase(): Promise<void> {
    if (this.isSavingOrderToDatabase) return;
    
    this.isSavingOrderToDatabase = true;
    this.showOrderSyncMessage('Guardando orden en base de datos...', 'info');
    
    try {
      const updatePromises = this.environments.map(env => {
        const order = this.environmentCustomOrder[env.id];
        if (order !== undefined) {
          return this.environmentService.updateEnvironment(env.id, { customOrder: order });
        }
        return Promise.resolve();
      });
      
      await Promise.all(updatePromises);
      
      // Recargar environments para actualizar el campo customOrder
      await this.loadEnvironments();
      
      this.showOrderSyncMessage('✓ Orden guardado exitosamente en base de datos', 'success');
      console.log('Orden guardado en base de datos:', this.environmentCustomOrder);
    } catch (error) {
      console.error('Error al guardar orden en base de datos:', error);
      this.showOrderSyncMessage('✗ Error al guardar orden en base de datos', 'error');
    } finally {
      this.isSavingOrderToDatabase = false;
    }
  }

  async loadOrderFromDatabase(): Promise<void> {
    if (this.isLoadingOrderFromDatabase) return;
    
    const confirmLoad = confirm(
      '¿Deseas cargar el orden desde la base de datos?\n\n' +
      'Esto sobrescribirá el orden local actual con el orden guardado en la base de datos.'
    );
    
    if (!confirmLoad) return;
    
    this.isLoadingOrderFromDatabase = true;
    this.showOrderSyncMessage('Cargando orden desde base de datos...', 'info');
    
    try {
      // Recargar environments desde la base de datos
      await this.loadEnvironments();
      
      // Extraer el orden de los environments cargados
      const newOrder: { [envId: string]: number } = {};
      let hasAnyOrder = false;
      
      this.environments.forEach(env => {
        if (env.customOrder !== undefined && env.customOrder !== null) {
          newOrder[env.id] = env.customOrder;
          hasAnyOrder = true;
        }
      });
      
      if (!hasAnyOrder) {
        this.showOrderSyncMessage('⚠ No se encontró orden guardado en la base de datos', 'info');
        return;
      }
      
      // Aplicar el nuevo orden
      this.environmentCustomOrder = newOrder;
      
      // Inicializar orden para environments que no tengan orden guardado
      this.initializeEnvironmentOrder();
      
      // Guardar en localStorage
      this.saveEnvironmentCustomOrder();
      
      // Forzar actualización de vista
      this.cdr.detectChanges();
      
      this.showOrderSyncMessage('✓ Orden cargado exitosamente desde base de datos', 'success');
      console.log('Orden cargado desde base de datos:', this.environmentCustomOrder);
    } catch (error) {
      console.error('Error al cargar orden desde base de datos:', error);
      this.showOrderSyncMessage('✗ Error al cargar orden desde base de datos', 'error');
    } finally {
      this.isLoadingOrderFromDatabase = false;
    }
  }

  private showOrderSyncMessage(message: string, type: 'success' | 'error' | 'info'): void {
    this.orderSyncMessage = message;
    this.orderSyncMessageType = type;
    
    // Limpiar timeout anterior si existe
    if (this.orderSyncMessageTimeout) {
      clearTimeout(this.orderSyncMessageTimeout);
    }
    
    // Auto-ocultar mensaje después de 4 segundos (excepto para loading)
    if (!message.includes('...')) {
      this.orderSyncMessageTimeout = setTimeout(() => {
        this.orderSyncMessage = '';
        this.cdr.detectChanges();
      }, 4000);
    }
    
    this.cdr.detectChanges();
  }

} 
