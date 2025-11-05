import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
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
import { TimelineSvgComponent } from './components/timeline-svg/timeline-svg.component';
import { CurrentTaskInfoComponent } from './components/current-task-info/current-task-info.component';
import { TaskModalComponent } from './components/task-modal/task-modal.component';
import { RemindersModalComponent } from './components/reminders-modal/reminders-modal.component';
import { TaskTrackerHeaderComponent } from './components/amain_components/task-tracker-header';
import { EnvironmentModalComponent } from './components/environment-modal/environment-modal.component';
import { BoardViewComponent } from './components/amain_components/board-view';
import { ChangeStatusModalComponent } from './components/change-status-modal/change-status-modal';
import { DateRangeModalComponent } from './components/date-range-modal/date-range-modal.component';

@Component({
  selector: 'app-task-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ManagementModalComponent, TimelineSvgComponent, CurrentTaskInfoComponent, TaskModalComponent, RemindersModalComponent, TaskTrackerHeaderComponent, EnvironmentModalComponent, BoardViewComponent, ChangeStatusModalComponent, DateRangeModalComponent],
  templateUrl: './task-tracker.component.html',
  styleUrls: ['./task-tracker.component.css']
})
export class TaskTrackerComponent implements OnInit {
  currentView: 'board' | 'timeline' = 'board';
  showNewTaskModal = false;
  searchQuery = '';
  userName = '';
  userPhotoUrl = '';
  tasks: Task[] = [];
  projects: Project[] = [];
  environments: Environment[] = [];
  filteredTasks: Task[] = [];
  showNewEnvironmentModal = false;
  showNewProjectModal = false;
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
    color: '#3B82F6'
  };
  
  newProject: Partial<Project> = {
    name: '',
    description: '',
    environment: ''
  };
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
    private elementRef: ElementRef
  ) {}

  async ngOnInit() {
    await this.loadInitialData();
    this.initializeNewTask();
    // Cargar el estado del filtro desde localStorage
    this.loadShowHiddenState();
    // Cargar modos de vista por environment desde localStorage
    this.loadEnvironmentViewModes();
    // Cargar órdenes de clasificación por environment desde localStorage
    this.loadEnvironmentSortOrders();
  }

  async loadInitialData(): Promise<void> {
    try {
      await this.loadUserData();
      await Promise.all([
        this.loadEnvironments(),
        this.loadProjects()
      ]);
      await this.loadTasks();
    } catch (error) {
      console.error("Error loading initial data for TaskTrackerComponent:", error);
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
  }

  switchView(view: 'board' | 'timeline') {
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

  closeNewTaskModal() {
    this.showNewTaskModal = false;
  }

  filterTasks() {
    let tasksToFilter = this.tasks.filter(task => task.environment && task.environment !== '');
    
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
    
    this.showNewProjectModal = true;
  }

  closeNewProjectModal() {
    this.showNewProjectModal = false;
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

  async onSaveNewEnvironment(env: { name: string; color: string }) {
    try {
      this.newEnvironment.name = env.name;
      this.newEnvironment.color = env.color;
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
      } else if (this.showEditTaskModal && this.selectedTask) {
        // También asegurarnos de que el ambiente esté seleccionado
        if (this.newProject.environment) {
          this.selectedTask.environment = this.newProject.environment;
          this.onEditTaskEnvironmentChange(); // Cargar proyectos disponibles
        }
        this.selectedTask.project = createdProjectId;
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
      color: '#3B82F6'
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
    
    return this.filteredTasks
      .filter(task => {
        // Filtrar por environment
        if (task.environment !== environmentId) return false;
        
        // Aplicar filtro por fecha si está activo
        if (visibility === 'date-range' && dateRange) {
          const taskStartDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
          taskStartDate.setHours(0, 0, 0, 0);
          
          if (dateRange.mode === 'day' && dateRange.singleDate) {
            // Filtrar por día único
            const filterDate = new Date(dateRange.singleDate);
            filterDate.setHours(0, 0, 0, 0);
            const taskDateOnly = new Date(taskStartDate);
            taskDateOnly.setHours(0, 0, 0, 0);
            
            if (taskDateOnly.getTime() !== filterDate.getTime()) {
              return false;
            }
          } else if (dateRange.mode === 'range' && dateRange.startDate && dateRange.endDate) {
            // Filtrar por rango de fechas
            const startDate = new Date(dateRange.startDate);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(dateRange.endDate);
            endDate.setHours(23, 59, 59, 999);
            
            if (taskStartDate < startDate || taskStartDate > endDate) {
              return false;
            }
          } else {
            // Si no hay fecha seleccionada, no mostrar nada
            return false;
          }
        }
        
        // Aplicar filtro de visibilidad según la configuración del environment
        if (task.hidden) {
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
              return true;
            default:
              return false;
          }
        }
        
        return true; // Mostrar tareas no ocultas
      })
      .sort((a, b) => {
        const dateA = new Date(a.start + (a.start.includes('Z') ? '' : 'Z')).getTime();
        const dateB = new Date(b.start + (b.start.includes('Z') ? '' : 'Z')).getTime();
        const sortOrder = this.getEnvironmentSortOrder(environmentId);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }


  getTasksByProject(projectId: string): Task[] {
    // Obtener el environment del proyecto para aplicar su configuración de visibilidad
    const project = this.projects.find(p => p.id === projectId);
    const environmentId = project?.environment || '';
    const visibility = this.getEnvironmentHiddenVisibility(environmentId);
    const dateRange = this.environmentDateRanges[environmentId];
    
    return this.filteredTasks
      .filter(task => {
        // Filtrar por proyecto
        if (task.project !== projectId) return false;
        
        // Aplicar filtro por fecha si está activo
        if (visibility === 'date-range' && dateRange) {
          const taskStartDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
          taskStartDate.setHours(0, 0, 0, 0);
          
          if (dateRange.mode === 'day' && dateRange.singleDate) {
            // Filtrar por día único
            const filterDate = new Date(dateRange.singleDate);
            filterDate.setHours(0, 0, 0, 0);
            const taskDateOnly = new Date(taskStartDate);
            taskDateOnly.setHours(0, 0, 0, 0);
            
            if (taskDateOnly.getTime() !== filterDate.getTime()) {
              return false;
            }
          } else if (dateRange.mode === 'range' && dateRange.startDate && dateRange.endDate) {
            // Filtrar por rango de fechas
            const startDate = new Date(dateRange.startDate);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(dateRange.endDate);
            endDate.setHours(23, 59, 59, 999);
            
            if (taskStartDate < startDate || taskStartDate > endDate) {
              return false;
            }
          } else {
            // Si no hay fecha seleccionada, no mostrar nada
            return false;
          }
        }
        
        // Aplicar filtro de visibilidad según la configuración del environment padre
        if (task.hidden) {
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
              return true;
            default:
              return false;
          }
        }
        
        return true; // Mostrar tareas no ocultas
      })
      .sort((a, b) => {
        const dateA = new Date(a.start + (a.start.includes('Z') ? '' : 'Z')).getTime();
        const dateB = new Date(b.start + (b.start.includes('Z') ? '' : 'Z')).getTime();
        const sortOrder = this.getEnvironmentSortOrder(environmentId);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
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
    
    // Calcular la altura del menú de proyecto (1 elemento: Eliminar Proyecto)
    const menuHeight = 1 * 40 + 16; // 1 item * 40px + padding
    
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
    console.log('showAssignOrphanedTasksModal set to true');
  }

  closeAssignOrphanedTasksModal(): void {
    this.showAssignOrphanedTasksModal = false;
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

  getEnvironmentName(envId: string): string | undefined {
    const env = this.environments.find(e => e.id === envId);
    return env?.name;
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
    if (this.calculatorType === 'start') {
      // Calcular hora de inicio restando minutos de la hora de fin
      if (this.newTaskEndDate && this.newTaskEndTime) {
        const endDateTime = new Date(`${this.newTaskEndDate}T${this.newTaskEndTime}`);
        const startDateTime = new Date(endDateTime.getTime() - (minutes * 60 * 1000));
        
        this.newTaskStartDate = startDateTime.toISOString().split('T')[0];
        this.newTaskStartTime = startDateTime.toTimeString().slice(0, 5);
        
        this.onNewTaskDateChange('start', this.newTaskStartDate);
        this.onNewTaskStartTimeChange(this.newTaskStartTime);
      }
    } else {
      // Calcular hora de fin sumando minutos a la hora de inicio
      if (this.newTaskStartDate && this.newTaskStartTime) {
        const startDateTime = new Date(`${this.newTaskStartDate}T${this.newTaskStartTime}`);
        const endDateTime = new Date(startDateTime.getTime() + (minutes * 60 * 1000));
        
        this.newTaskEndDate = endDateTime.toISOString().split('T')[0];
        this.newTaskEndTime = endDateTime.toTimeString().slice(0, 5);
        
        this.onNewTaskDateChange('end', this.newTaskEndDate);
        this.onNewTaskEndTimeChange(this.newTaskEndTime);
      }
    }
  }

  applyEditTaskTimeCalculation(minutes: number) {
    if (this.calculatorType === 'start') {
      // Calcular hora de inicio restando minutos de la hora de fin
      if (this.editTaskEndDate && this.editTaskEndTime) {
        const endDateTime = new Date(`${this.editTaskEndDate}T${this.editTaskEndTime}`);
        const startDateTime = new Date(endDateTime.getTime() - (minutes * 60 * 1000));
        
        this.editTaskStartDate = startDateTime.toISOString().split('T')[0];
        this.editTaskStartTime = startDateTime.toTimeString().slice(0, 5);
        
        this.onEditTaskDateChange('start', this.editTaskStartDate);
        this.onEditTaskStartTimeChange(this.editTaskStartTime);
      }
    } else {
      // Calcular hora de fin sumando minutos a la hora de inicio
      if (this.editTaskStartDate && this.editTaskStartTime) {
        const startDateTime = new Date(`${this.editTaskStartDate}T${this.editTaskStartTime}`);
        const endDateTime = new Date(startDateTime.getTime() + (minutes * 60 * 1000));
        
        this.editTaskEndDate = endDateTime.toISOString().split('T')[0];
        this.editTaskEndTime = endDateTime.toTimeString().slice(0, 5);
        
        this.onEditTaskDateChange('end', this.editTaskEndDate);
        this.onEditTaskEndTimeChange(this.editTaskEndTime);
      }
    }
  }


  // Nuevo: Métodos para manejar environments
  get orderedEnvironments(): Environment[] {
    return [...this.environments].sort((a, b) => {
      const aHasTasks = this.environmentHasTasks(a.id);
      const bHasTasks = this.environmentHasTasks(b.id);
      
      // Environments con tareas van primero
      if (aHasTasks && !bHasTasks) return -1;
      if (!aHasTasks && bHasTasks) return 1;
      
      // Dentro del mismo grupo, ordenar alfabéticamente
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

} 
