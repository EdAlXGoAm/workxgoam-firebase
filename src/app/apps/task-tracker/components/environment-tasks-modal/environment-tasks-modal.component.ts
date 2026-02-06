import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { TaskService } from '../../services/task.service';
import { EmojiPickerComponent } from '../../shared/emoji-picker/emoji-picker.component';

@Component({
  selector: 'app-environment-tasks-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, EmojiPickerComponent],
  templateUrl: './environment-tasks-modal.component.html',
  styleUrls: ['./environment-tasks-modal.component.css']
})
export class EnvironmentTasksModalComponent implements OnInit, OnChanges {
  @Input() showModal = false;
  @Input() environmentId = '';
  @Input() environmentName = '';
  @Input() environmentEmoji = '';
  @Input() environmentColor = '';
  @Input() allTasks: Task[] = [];
  @Input() allProjects: Project[] = [];
  
  @Output() closeModalEvent = new EventEmitter<void>();
  @Output() taskQuickUpdated = new EventEmitter<{taskId: string, updates: Partial<Task>}>();
  
  // Filtros de fecha
  dateFrom = '';
  dateTo = '';
  showAllTasks = false;
  
  // Filtro por proyecto
  selectedProjects: { [projectId: string]: boolean } = {};
  showProjectFilter = false;
  
  // Confirmación para muchas tareas
  showConfirmAllTasks = false;
  totalTasksCount = 0;
  
  // Tareas filtradas
  filteredTasks: Task[] = [];
  
  // Agrupación de tareas por nombre
  expandedTaskGroups: Set<string> = new Set();
  
  // Menú contextual para tareas
  showContextMenu = false;
  contextMenuX = 0;
  contextMenuY = 0;
  contextMenuTaskIndex: number | null = null;
  contextMenuTask: Task | null = null;
  
  // Edición inline de tareas
  editingTaskIndex: number | null = null;
  editingField: 'emoji' | 'name' | null = null;
  editingValue = '';
  showEmojiPickerForEdit = false;
  isSavingQuickEdit = false;
  
  
  // Menú contextual para grupos de tareas
  showGroupContextMenu = false;
  groupContextMenuX = 0;
  groupContextMenuY = 0;
  contextMenuGroupName: string | null = null;
  showEmojiPickerForGroup = false;
  isSavingGroupEmoji = false;
  groupSuggestedEmojis: string[] = []; // Emojis usados en las tareas del grupo
  
  // Long press para móviles (tareas individuales)
  private longPressTimer: any = null;
  private longPressThreshold = 500; // ms
  
  // Long press para grupos
  private groupLongPressTimer: any = null;
  
  constructor(
    private cdr: ChangeDetectorRef,
    private taskService: TaskService
  ) {}
  
  ngOnInit(): void {
    this.initializeDates();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showModal'] && this.showModal) {
      this.initializeDates();
      this.filterTasks();
    }
    if (changes['allTasks'] && this.showModal) {
      this.filterTasks();
    }
    if (changes['allProjects'] && this.showModal) {
      this.initializeProjectSelection();
      this.filterTasks();
    }
  }
  
  // Inicializar fechas con el día de hoy y proyectos
  private initializeDates(): void {
    const today = new Date();
    const formattedDate = this.formatDateForInput(today);
    this.dateFrom = formattedDate;
    this.dateTo = formattedDate;
    this.showAllTasks = false;
    this.showConfirmAllTasks = false;
    this.expandedTaskGroups.clear();
    this.showProjectFilter = false;
    this.initializeProjectSelection();
  }
  
  // Inicializar selección de proyectos (todos seleccionados por defecto)
  private initializeProjectSelection(): void {
    this.selectedProjects = {};
    this.environmentProjects.forEach(project => {
      this.selectedProjects[project.id] = true;
    });
  }
  
  // Obtener proyectos del ambiente actual
  get environmentProjects(): Project[] {
    return this.allProjects.filter(p => p.environment === this.environmentId);
  }
  
  // Verificar si todos los proyectos están seleccionados
  get allProjectsSelected(): boolean {
    const projects = this.environmentProjects;
    if (projects.length === 0) return true;
    return projects.every(p => this.selectedProjects[p.id]);
  }
  
  // Verificar si ningún proyecto está seleccionado
  get noProjectsSelected(): boolean {
    const projects = this.environmentProjects;
    if (projects.length === 0) return false;
    return projects.every(p => !this.selectedProjects[p.id]);
  }
  
  // Contar proyectos seleccionados
  get selectedProjectsCount(): number {
    return this.environmentProjects.filter(p => this.selectedProjects[p.id]).length;
  }
  
  // Toggle selección de un proyecto
  toggleProjectSelection(projectId: string): void {
    this.selectedProjects[projectId] = !this.selectedProjects[projectId];
    this.filterTasks();
  }
  
  // Seleccionar todos los proyectos
  selectAllProjects(): void {
    this.environmentProjects.forEach(project => {
      this.selectedProjects[project.id] = true;
    });
    this.filterTasks();
  }
  
  // Deseleccionar todos los proyectos
  deselectAllProjects(): void {
    this.environmentProjects.forEach(project => {
      this.selectedProjects[project.id] = false;
    });
    this.filterTasks();
  }
  
  // Toggle mostrar/ocultar filtro de proyectos
  toggleProjectFilter(): void {
    this.showProjectFilter = !this.showProjectFilter;
  }
  
  // Formatear fecha para input type="date"
  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Filtrar tareas según los criterios
  filterTasks(): void {
    if (!this.environmentId) {
      this.filteredTasks = [];
      return;
    }
    
    // Obtener todas las tareas del environment
    let environmentTasks = this.allTasks.filter(t => t.environment === this.environmentId);
    
    // Filtrar por proyectos seleccionados
    const selectedProjectIds = Object.entries(this.selectedProjects)
      .filter(([_, selected]) => selected)
      .map(([id, _]) => id);
    
    if (selectedProjectIds.length > 0 && selectedProjectIds.length < this.environmentProjects.length) {
      // Solo filtrar si hay algún proyecto seleccionado y no todos están seleccionados
      environmentTasks = environmentTasks.filter(t => t.project && selectedProjectIds.includes(t.project));
    } else if (selectedProjectIds.length === 0) {
      // Si no hay proyectos seleccionados, no mostrar tareas
      this.filteredTasks = [];
      this.cdr.detectChanges();
      return;
    }
    
    if (this.showAllTasks) {
      // Mostrar todas las tareas del environment, ordenadas por fecha más reciente
      this.filteredTasks = environmentTasks.sort((a, b) => {
        const dateA = a.start ? new Date(a.start).getTime() : 0;
        const dateB = b.start ? new Date(b.start).getTime() : 0;
        return dateB - dateA;
      });
    } else {
      // Filtrar por rango de fechas
      const fromDate = new Date(this.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(this.dateTo);
      toDate.setHours(23, 59, 59, 999);
      
      this.filteredTasks = environmentTasks
        .filter(task => {
          if (!task.start) return false;
          const taskDate = new Date(task.start);
          return taskDate >= fromDate && taskDate <= toDate;
        })
        .sort((a, b) => {
          const dateA = a.start ? new Date(a.start).getTime() : 0;
          const dateB = b.start ? new Date(b.start).getTime() : 0;
          return dateB - dateA;
        });
    }
    
    this.cdr.detectChanges();
  }
  
  // Manejar cambio en fechas
  onDateChange(): void {
    this.filterTasks();
  }
  
  // Manejar switch de "Todos"
  onToggleAllTasks(): void {
    if (!this.showAllTasks) {
      // Está intentando activar "Todos"
      let environmentTasks = this.allTasks.filter(t => t.environment === this.environmentId);
      
      // Aplicar filtro de proyectos si hay alguno seleccionado
      const selectedProjectIds = Object.entries(this.selectedProjects)
        .filter(([_, selected]) => selected)
        .map(([id, _]) => id);
      
      if (selectedProjectIds.length > 0 && selectedProjectIds.length < this.environmentProjects.length) {
        environmentTasks = environmentTasks.filter(t => t.project && selectedProjectIds.includes(t.project));
      } else if (selectedProjectIds.length === 0) {
        environmentTasks = [];
      }
      
      this.totalTasksCount = environmentTasks.length;
      
      if (this.totalTasksCount > 100) {
        // Mostrar confirmación
        this.showConfirmAllTasks = true;
      } else {
        // Activar directamente
        this.showAllTasks = true;
        this.filterTasks();
      }
    } else {
      // Desactivar "Todos"
      this.showAllTasks = false;
      this.filterTasks();
    }
  }
  
  // Confirmar carga de todas las tareas
  confirmLoadAllTasks(): void {
    this.showConfirmAllTasks = false;
    this.showAllTasks = true;
    this.filterTasks();
  }
  
  // Cancelar carga de todas las tareas
  cancelLoadAllTasks(): void {
    this.showConfirmAllTasks = false;
  }
  
  // Cerrar modal
  closeModal(): void {
    this.cancelQuickEdit();
    this.closeContextMenu();
    this.closeGroupContextMenu();
    this.closeEmojiPickerForEdit();
    this.closeEmojiPickerForGroup();
    this.closeModalEvent.emit();
  }
  
  // ==================== AGRUPACIÓN DE TAREAS ====================
  
  get groupedTasks(): { name: string; emoji: string; tasks: { task: Task; originalIndex: number }[] }[] {
    const groups = new Map<string, { task: Task; originalIndex: number }[]>();
    
    this.filteredTasks.forEach((task, index) => {
      const name = task.name || '';
      if (!groups.has(name)) {
        groups.set(name, []);
      }
      groups.get(name)!.push({ task, originalIndex: index });
    });
    
    return Array.from(groups.entries()).map(([name, tasks]) => ({
      name,
      emoji: tasks[0].task.emoji || '📝',
      tasks
    }));
  }
  
  get multipleTaskGroups(): { name: string; emoji: string; tasks: { task: Task; originalIndex: number }[] }[] {
    return this.groupedTasks.filter(group => group.tasks.length > 1);
  }
  
  get singleTasks(): { task: Task; originalIndex: number }[] {
    const singles: { task: Task; originalIndex: number }[] = [];
    this.groupedTasks.forEach(group => {
      if (group.tasks.length === 1) {
        singles.push(group.tasks[0]);
      }
    });
    return singles;
  }
  
  toggleTaskGroup(groupName: string): void {
    if (this.expandedTaskGroups.has(groupName)) {
      this.expandedTaskGroups.delete(groupName);
    } else {
      this.expandedTaskGroups.add(groupName);
    }
  }
  
  isTaskGroupExpanded(groupName: string): boolean {
    return this.expandedTaskGroups.has(groupName);
  }
  
  // ==================== MENÚ CONTEXTUAL PARA TAREAS ====================
  
  onRecentTaskContextMenu(event: MouseEvent, taskIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.contextMenuTaskIndex = taskIndex;
    this.contextMenuTask = this.filteredTasks[taskIndex] || null;
    this.contextMenuX = event.clientX;
    this.contextMenuY = event.clientY;
    this.showContextMenu = true;
  }
  
  onRecentTaskTouchStart(event: TouchEvent, taskIndex: number): void {
    this.longPressTimer = setTimeout(() => {
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      const touch = event.touches[0];
      this.contextMenuTaskIndex = taskIndex;
      this.contextMenuTask = this.filteredTasks[taskIndex] || null;
      this.contextMenuX = touch.clientX;
      this.contextMenuY = touch.clientY;
      this.showContextMenu = true;
    }, this.longPressThreshold);
  }
  
  onRecentTaskTouchEnd(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
  
  onRecentTaskTouchMove(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
  
  closeContextMenu(): void {
    this.showContextMenu = false;
    this.contextMenuTaskIndex = null;
    this.contextMenuTask = null;
  }
  
  // ==================== EDICIÓN INLINE ====================
  
  startEditEmoji(): void {
    if (this.contextMenuTaskIndex === null) return;
    
    const task = this.filteredTasks[this.contextMenuTaskIndex];
    if (!task) return;
    
    this.editingTaskIndex = this.contextMenuTaskIndex;
    this.editingField = 'emoji';
    this.editingValue = task.emoji || '📝';
    this.closeContextMenu();
    this.showEmojiPickerForEdit = true;
  }
  
  startEditName(): void {
    if (this.contextMenuTaskIndex === null) return;
    
    const task = this.filteredTasks[this.contextMenuTaskIndex];
    if (!task) return;
    
    this.editingTaskIndex = this.contextMenuTaskIndex;
    this.editingField = 'name';
    this.editingValue = task.name || '';
    this.closeContextMenu();
    
    // Focus en el input después del siguiente tick
    setTimeout(() => {
      const input = document.getElementById('edit-task-name-input-env');
      if (input) {
        input.focus();
        (input as HTMLInputElement).select();
      }
    }, 50);
  }
  
  selectEmojiForEdit(emoji: string): void {
    this.editingValue = emoji;
    this.saveQuickEdit();
  }
  
  async saveQuickEdit(): Promise<void> {
    if (this.editingTaskIndex === null || !this.editingField || this.isSavingQuickEdit) return;
    
    const task = this.filteredTasks[this.editingTaskIndex];
    if (!task || !task.id) {
      this.cancelQuickEdit();
      return;
    }
    
    const newValue = this.editingValue.trim();
    const fieldToUpdate = this.editingField;
    
    // Validar nombre no vacío
    if (fieldToUpdate === 'name' && !newValue) {
      this.cancelQuickEdit();
      return;
    }
    
    // Verificar si el valor cambió
    const currentValue = fieldToUpdate === 'emoji' ? (task.emoji || '📝') : (task.name || '');
    if (newValue === currentValue) {
      this.cancelQuickEdit();
      return;
    }
    
    this.isSavingQuickEdit = true;
    
    try {
      const updates: Partial<Task> = { [fieldToUpdate]: newValue };
      
      // Actualizar en Firebase
      await this.taskService.updateTask(task.id, updates);
      
      // Actualizar en la caché local (filteredTasks)
      this.filteredTasks[this.editingTaskIndex] = {
        ...task,
        [fieldToUpdate]: newValue
      };
      
      // Actualizar en allTasks si existe
      const allTaskIndex = this.allTasks.findIndex(t => t.id === task.id);
      if (allTaskIndex !== -1) {
        this.allTasks[allTaskIndex] = {
          ...this.allTasks[allTaskIndex],
          [fieldToUpdate]: newValue
        };
      }
      
      // Emitir evento para que el componente padre también actualice
      this.taskQuickUpdated.emit({ taskId: task.id, updates });
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al guardar edición rápida:', error);
    } finally {
      this.isSavingQuickEdit = false;
      this.cancelQuickEdit();
    }
  }
  
  cancelQuickEdit(): void {
    this.editingTaskIndex = null;
    this.editingField = null;
    this.editingValue = '';
    this.showEmojiPickerForEdit = false;
  }
  
  onEditNameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveQuickEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelQuickEdit();
    }
  }
  
  closeEmojiPickerForEdit(): void {
    this.showEmojiPickerForEdit = false;
    if (this.editingField === 'emoji') {
      this.cancelQuickEdit();
    }
  }
  
  // ==================== MENÚ CONTEXTUAL PARA GRUPOS ====================
  
  onGroupContextMenu(event: MouseEvent, groupName: string): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.contextMenuGroupName = groupName;
    this.groupContextMenuX = event.clientX;
    this.groupContextMenuY = event.clientY;
    this.showGroupContextMenu = true;
  }
  
  onGroupTouchStart(event: TouchEvent, groupName: string): void {
    this.groupLongPressTimer = setTimeout(() => {
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      const touch = event.touches[0];
      this.contextMenuGroupName = groupName;
      this.groupContextMenuX = touch.clientX;
      this.groupContextMenuY = touch.clientY;
      this.showGroupContextMenu = true;
    }, this.longPressThreshold);
  }
  
  onGroupTouchEnd(): void {
    if (this.groupLongPressTimer) {
      clearTimeout(this.groupLongPressTimer);
      this.groupLongPressTimer = null;
    }
  }
  
  onGroupTouchMove(): void {
    if (this.groupLongPressTimer) {
      clearTimeout(this.groupLongPressTimer);
      this.groupLongPressTimer = null;
    }
  }
  
  closeGroupContextMenu(): void {
    this.showGroupContextMenu = false;
    this.contextMenuGroupName = null;
  }
  
  startEditGroupEmoji(): void {
    if (!this.contextMenuGroupName) return;
    
    const group = this.multipleTaskGroups.find(g => g.name === this.contextMenuGroupName);
    if (group) {
      this.editingValue = group.emoji || '📝';
      
      // Recopilar emojis únicos usados en las tareas del grupo para sugerencias
      const emojisSet = new Set<string>();
      group.tasks.forEach(item => {
        if (item.task.emoji) {
          emojisSet.add(item.task.emoji);
        }
      });
      this.groupSuggestedEmojis = Array.from(emojisSet);
      console.log('Emojis sugeridos del grupo:', this.groupSuggestedEmojis);
    }
    
    this.showEmojiPickerForGroup = true;
    // Solo ocultamos el menú contextual, pero NO reseteamos contextMenuGroupName
    this.showGroupContextMenu = false;
  }
  
  async selectEmojiForGroup(emoji: string): Promise<void> {
    if (!this.contextMenuGroupName || this.isSavingGroupEmoji) return;
    
    const groupName = this.contextMenuGroupName;
    const group = this.multipleTaskGroups.find(g => g.name === groupName);
    if (!group) {
      this.closeEmojiPickerForGroup();
      return;
    }
    
    this.isSavingGroupEmoji = true;
    
    try {
      // Actualizar todas las tareas del grupo en paralelo
      const updatePromises = group.tasks.map(async (item) => {
        if (item.task.id) {
          await this.taskService.updateTask(item.task.id, { emoji });
          
          // Actualizar en la caché local (filteredTasks)
          this.filteredTasks[item.originalIndex] = {
            ...this.filteredTasks[item.originalIndex],
            emoji
          };
          
          // Actualizar en allTasks si existe
          const allTaskIndex = this.allTasks.findIndex(t => t.id === item.task.id);
          if (allTaskIndex !== -1) {
            this.allTasks[allTaskIndex] = {
              ...this.allTasks[allTaskIndex],
              emoji
            };
          }
        }
      });
      
      await Promise.all(updatePromises);
      
      // Emitir evento para cada tarea actualizada
      group.tasks.forEach(item => {
        if (item.task.id) {
          this.taskQuickUpdated.emit({ taskId: item.task.id, updates: { emoji } });
        }
      });
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al actualizar emoji del grupo:', error);
    } finally {
      this.isSavingGroupEmoji = false;
      this.closeEmojiPickerForGroup();
    }
  }
  
  closeEmojiPickerForGroup(): void {
    this.showEmojiPickerForGroup = false;
    this.contextMenuGroupName = null;
    this.editingValue = '';
    this.groupSuggestedEmojis = [];
  }
  
  // ==================== FORMATEO ====================
  
  formatRecentTaskDate(dateTimeString: string): string {
    const utcString = dateTimeString.includes('Z') || dateTimeString.includes('+')
      ? dateTimeString
      : dateTimeString + 'Z';
    const date = new Date(utcString);
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dateInMexico = new Date(date.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    const diaSemana = diasSemana[dateInMexico.getDay()];
    
    const fechaFormateada = date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Mexico_City'
    });
    
    return `${diaSemana}, ${fechaFormateada}`;
  }
  
  formatDuration(minutes: number): string {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }
}
