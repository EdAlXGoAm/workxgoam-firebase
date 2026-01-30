import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ElementRef, Renderer2, HostListener, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';
import { TaskType } from '../../models/task-type.model';
import { TaskGroup } from '../../models/task-group.model';
import { WeekTimelineSvgComponent } from '../../components/week-timeline-svg/week-timeline-svg.component';

export interface ProjectTasksModalData {
  project: Project;
  tasks: Task[];
  taskGroups: TaskGroup[];
  startDateFilter?: string;
  endDateFilter?: string;
  editingTemplateId?: string | null;
  selectedTaskIds?: string[];
}

@Component({
  selector: 'app-project-tasks-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, WeekTimelineSvgComponent],
  templateUrl: './project-tasks-modal.component.html',
  styleUrls: ['./project-tasks-modal.component.css']
})
export class ProjectTasksModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() showModal: boolean = false;
  @Input() project: Project | null = null;
  @Input() tasks: Task[] = [];
  @Input() allTasks: Task[] = []; // Todas las tareas (para el timeline)
  @Input() projects: Project[] = [];
  @Input() environments: Environment[] = [];
  @Input() taskTypes: TaskType[] = [];
  @Input() taskGroups: TaskGroup[] = [];
  @Input() initialStartDateFilter: string = '';
  @Input() initialEndDateFilter: string = '';
  @Input() editingTemplateId: string | null = null;
  @Input() initialSelectedTaskIds: string[] | null = null;

  @Output() closeModal = new EventEmitter<void>();
  @Output() saveSumTemplate = new EventEmitter<{ name: string, selectedTaskIds: string[], startDateFilter: string, endDateFilter: string }>();
  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<Task>();
  @Output() toggleHidden = new EventEmitter<Task>();
  @Output() changeStatus = new EventEmitter<{ task: Task, status: 'pending' | 'in-progress' | 'completed' }>();
  @Output() taskUpdated = new EventEmitter<Task>();

  // Estado interno
  projectTasksForModal: Task[] = [];
  projectTaskIncluded: { [taskId: string]: boolean } = {};
  lastSelectedTaskIndex: number | null = null;
  isCalendarExpanded: boolean = false;
  
  // Filtros de fecha
  startDateFilter: string = '';
  endDateFilter: string = '';
  pendingStartDateFilter: string = '';
  pendingEndDateFilter: string = '';
  isFilteringTasks: boolean = false;
  hasFilterChanges: boolean = false;
  
  // Modal guardar suma
  showSaveSumTemplateModal: boolean = false;
  newSumTemplateName: string = '';

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    if (this.showModal) {
      this.initializeModal();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showModal'] && this.showModal) {
      this.initializeModal();
    }
    if (changes['tasks'] && this.showModal) {
      this.loadProjectTasks();
    }
  }

  ngOnDestroy(): void {
    this.restoreBodyScroll();
  }

  private initializeModal(): void {
    // Si hay filtros iniciales (desde una plantilla guardada), usarlos
    // Si no, usar la fecha de hoy como filtro por defecto para optimizar la carga
    if (this.initialStartDateFilter || this.initialEndDateFilter) {
      this.startDateFilter = this.initialStartDateFilter;
      this.endDateFilter = this.initialEndDateFilter;
      this.pendingStartDateFilter = this.initialStartDateFilter;
      this.pendingEndDateFilter = this.initialEndDateFilter;
    } else {
      // Por defecto, filtrar solo el día actual para optimizar la carga inicial
      const today = this.getTodayDateString();
      this.startDateFilter = today;
      this.endDateFilter = today;
      this.pendingStartDateFilter = today;
      this.pendingEndDateFilter = today;
    }
    
    this.hasFilterChanges = false;
    this.isFilteringTasks = false;
    this.isCalendarExpanded = false;
    this.lastSelectedTaskIndex = null;
    
    this.loadProjectTasks();
    
    // Restaurar selección si se proporciona
    if (this.initialSelectedTaskIds && this.initialSelectedTaskIds.length > 0) {
      this.projectTaskIncluded = {};
      this.projectTasksForModal.forEach(task => {
        this.projectTaskIncluded[task.id] = this.initialSelectedTaskIds!.includes(task.id);
      });
    }
    
    this.lockBodyScroll();
  }

  /**
   * Obtiene la fecha de hoy en formato YYYY-MM-DD
   */
  private getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadProjectTasks(): void {
    if (!this.project) return;
    
    let projectTasks = this.tasks.filter(t => t.project === this.project!.id);
    
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
      return dateB - dateA;
    });
    
    this.projectTasksForModal = projectTasks;
    
    // Inicializar todos los checkboxes como true (incluidos por defecto) solo si no hay selección inicial
    if (!this.initialSelectedTaskIds) {
      this.projectTaskIncluded = {};
      this.projectTasksForModal.forEach(task => {
        this.projectTaskIncluded[task.id] = true;
      });
    }
  }

  private lockBodyScroll(): void {
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    (document.body as any).__scrollY = scrollY;
  }

  private restoreBodyScroll(): void {
    const scrollY = (document.body as any).__scrollY || 0;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
    delete (document.body as any).__scrollY;
  }

  onClose(): void {
    this.restoreBodyScroll();
    this.closeModal.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.showModal && !this.showSaveSumTemplateModal) {
      event.preventDefault();
      this.onClose();
    }
  }

  // ============ FILTROS DE FECHA ============

  onDateFilterChange(): void {
    this.hasFilterChanges = 
      this.pendingStartDateFilter !== this.startDateFilter || 
      this.pendingEndDateFilter !== this.endDateFilter;
  }

  async applyDateFilters(): Promise<void> {
    this.isFilteringTasks = true;
    this.hasFilterChanges = false;
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      const currentIncluded = { ...this.projectTaskIncluded };
      
      this.startDateFilter = this.pendingStartDateFilter;
      this.endDateFilter = this.pendingEndDateFilter;
      
      this.loadProjectTasks();
      
      // Restaurar checkboxes
      Object.keys(currentIncluded).forEach(taskId => {
        if (this.projectTasksForModal.find(t => t.id === taskId)) {
          this.projectTaskIncluded[taskId] = currentIncluded[taskId];
        }
      });
    } finally {
      this.isFilteringTasks = false;
    }
  }

  clearDateFilters(): void {
    this.pendingStartDateFilter = '';
    this.pendingEndDateFilter = '';
    this.hasFilterChanges = 
      this.pendingStartDateFilter !== this.startDateFilter || 
      this.pendingEndDateFilter !== this.endDateFilter;
  }

  /**
   * Establece un filtro rápido y lo aplica automáticamente
   */
  async setQuickFilter(type: 'today' | 'yesterday' | 'week' | 'month' | 'all'): Promise<void> {
    const today = new Date();
    let startDate = '';
    let endDate = '';

    switch (type) {
      case 'today':
        startDate = this.getTodayDateString();
        endDate = this.getTodayDateString();
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = this.formatDateToString(yesterday);
        endDate = this.formatDateToString(yesterday);
        break;
      case 'week':
        // Inicio de la semana (lunes)
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - diffToMonday);
        startDate = this.formatDateToString(monday);
        endDate = this.getTodayDateString();
        break;
      case 'month':
        // Inicio del mes
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = this.formatDateToString(firstOfMonth);
        endDate = this.getTodayDateString();
        break;
      case 'all':
        startDate = '';
        endDate = '';
        break;
    }

    this.pendingStartDateFilter = startDate;
    this.pendingEndDateFilter = endDate;
    
    // Aplicar automáticamente el filtro
    await this.applyDateFilters();
  }

  /**
   * Verifica si un filtro rápido está activo (aplicado)
   */
  isQuickFilterActive(type: 'today' | 'yesterday' | 'week' | 'month' | 'all'): boolean {
    const today = new Date();

    switch (type) {
      case 'today':
        const todayStr = this.getTodayDateString();
        return this.startDateFilter === todayStr && this.endDateFilter === todayStr;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = this.formatDateToString(yesterday);
        return this.startDateFilter === yesterdayStr && this.endDateFilter === yesterdayStr;
      case 'week':
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - diffToMonday);
        const mondayStr = this.formatDateToString(monday);
        const todayStrWeek = this.getTodayDateString();
        return this.startDateFilter === mondayStr && this.endDateFilter === todayStrWeek;
      case 'month':
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstOfMonthStr = this.formatDateToString(firstOfMonth);
        const todayStrMonth = this.getTodayDateString();
        return this.startDateFilter === firstOfMonthStr && this.endDateFilter === todayStrMonth;
      case 'all':
        return !this.startDateFilter && !this.endDateFilter;
      default:
        return false;
    }
  }

  /**
   * Formatea una fecha a string YYYY-MM-DD
   */
  private formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ============ CALENDARIO ============

  toggleCalendarExpanded(): void {
    this.isCalendarExpanded = !this.isCalendarExpanded;
  }

  getSelectedProjectTasks(): Task[] {
    return this.projectTasksForModal.filter(task => 
      this.projectTaskIncluded[task.id] !== false
    );
  }

  // ============ AGRUPACIÓN DE TAREAS ============

  getGroupedProjectTasks(): { [dateKey: string]: Task[] } {
    const grouped: { [dateKey: string]: Task[] } = {};
    
    this.projectTasksForModal.forEach(task => {
      if (task.start) {
        const dateStr = task.start.includes('Z') ? task.start : task.start + 'Z';
        const date = new Date(dateStr);
        const dateKey = date.toISOString().split('T')[0];
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(task);
      } else {
        const noDateKey = 'sin-fecha';
        if (!grouped[noDateKey]) {
          grouped[noDateKey] = [];
        }
        grouped[noDateKey].push(task);
      }
    });
    
    return grouped;
  }

  getGroupedProjectTasksByGroup(): { [dateKey: string]: { groups: { [groupId: string]: Task[] }, individual: Task[] } } {
    const grouped: { [dateKey: string]: { groups: { [groupId: string]: Task[] }, individual: Task[] } } = {};
    
    this.projectTasksForModal.forEach(task => {
      let dateKey: string;
      
      if (task.start) {
        const dateStr = task.start.includes('Z') ? task.start : task.start + 'Z';
        const date = new Date(dateStr);
        dateKey = date.toISOString().split('T')[0];
      } else {
        dateKey = 'sin-fecha';
      }
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = { groups: {}, individual: [] };
      }
      
      if (task.taskGroupId) {
        if (!grouped[dateKey].groups[task.taskGroupId]) {
          grouped[dateKey].groups[task.taskGroupId] = [];
        }
        grouped[dateKey].groups[task.taskGroupId].push(task);
      } else {
        grouped[dateKey].individual.push(task);
      }
    });
    
    return grouped;
  }

  getGroupedProjectTasksKeys(): string[] {
    const grouped = this.getGroupedProjectTasks();
    return Object.keys(grouped).sort((a, b) => {
      if (a === 'sin-fecha') return 1;
      if (b === 'sin-fecha') return -1;
      return b.localeCompare(a);
    });
  }

  getTaskGroupName(groupId: string): string {
    const group = this.taskGroups.find(g => g.id === groupId);
    return group ? group.name : 'Grupo desconocido';
  }

  getGroupTasks(groupId: string): Task[] {
    return this.projectTasksForModal.filter(t => t.taskGroupId === groupId);
  }

  isGroupSelected(groupId: string): boolean {
    const groupTasks = this.getGroupTasks(groupId);
    if (groupTasks.length === 0) return false;
    return groupTasks.every(task => this.projectTaskIncluded[task.id] !== false);
  }

  toggleGroupSelection(groupId: string): void {
    const groupTasks = this.getGroupTasks(groupId);
    const isCurrentlySelected = this.isGroupSelected(groupId);
    const newState = !isCurrentlySelected;
    
    groupTasks.forEach(task => {
      this.projectTaskIncluded[task.id] = newState;
    });
    
    setTimeout(() => {
      this.updateGroupCheckboxesIndeterminate();
    }, 0);
  }

  getGroupTotalDuration(groupId: string): string {
    const groupTasks = this.getGroupTasks(groupId);
    let totalHours = 0;
    
    groupTasks.forEach(task => {
      const duration = this.getTaskDuration(task);
      if (duration !== null) {
        totalHours += duration;
      }
    });
    
    return this.formatTaskDuration(totalHours);
  }

  getGroupUniqueDates(groupId: string): number {
    const groupTasks = this.getGroupTasks(groupId);
    const uniqueDates = new Set<string>();
    
    groupTasks.forEach(task => {
      if (task.start) {
        const dateStr = task.start.includes('Z') ? task.start : task.start + 'Z';
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          uniqueDates.add(date.toISOString().split('T')[0]);
        }
      }
    });
    
    return uniqueDates.size;
  }

  getGroupMostRecentDateKey(groupId: string): string {
    const groupTasks = this.getGroupTasks(groupId);
    if (groupTasks.length === 0) return 'sin-fecha';
    
    let mostRecentDate: Date | null = null;
    let mostRecentDateKey = 'sin-fecha';
    
    groupTasks.forEach(task => {
      const dateString = task.end || task.start;
      if (dateString) {
        const dateStr = dateString.includes('Z') ? dateString : dateString + 'Z';
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          if (!mostRecentDate || date > mostRecentDate) {
            mostRecentDate = date;
            mostRecentDateKey = date.toISOString().split('T')[0];
          }
        }
      }
    });
    
    return mostRecentDateKey;
  }

  getGroupKeysForDate(dateKey: string): string[] {
    const dayData = this.getGroupedProjectTasksByGroup()[dateKey];
    if (!dayData) return [];
    
    return Object.keys(dayData.groups).filter(groupId => {
      const mostRecentDateKey = this.getGroupMostRecentDateKey(groupId);
      return mostRecentDateKey === dateKey;
    });
  }

  getGroupTasksForDate(dateKey: string, groupId: string): Task[] {
    return this.getGroupTasks(groupId);
  }

  getIndividualTasksForDate(dateKey: string): Task[] {
    const dayData = this.getGroupedProjectTasksByGroup()[dateKey];
    if (!dayData) return [];
    return dayData.individual;
  }

  getFirstTaskDateForDay(dateKey: string): string | null {
    const dayData = this.getGroupedProjectTasksByGroup()[dateKey];
    if (!dayData) return null;
    
    for (const groupId of Object.keys(dayData.groups)) {
      if (dayData.groups[groupId].length > 0 && dayData.groups[groupId][0].start) {
        return dayData.groups[groupId][0].start;
      }
    }
    
    if (dayData.individual.length > 0 && dayData.individual[0].start) {
      return dayData.individual[0].start;
    }
    
    return null;
  }

  // ============ DURACIONES ============

  getTaskDuration(task: Task): number | null {
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
    
    if (task.duration && task.duration > 0) {
      return task.duration;
    }
    
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
      if (this.projectTaskIncluded[task.id] !== false) {
        const duration = this.getTaskDuration(task);
        if (duration !== null) {
          totalHours += duration;
        }
      }
    });
    
    return this.formatTaskDuration(totalHours);
  }

  getDayTotalDuration(dateKey: string): string {
    const grouped = this.getGroupedProjectTasks();
    const dayTasks = grouped[dateKey] || [];
    
    let totalHours = 0;
    
    dayTasks.forEach(task => {
      if (this.projectTaskIncluded[task.id] !== false) {
        const duration = this.getTaskDuration(task);
        if (duration !== null) {
          totalHours += duration;
        }
      }
    });
    
    return this.formatTaskDuration(totalHours);
  }

  // ============ FORMATEO ============

  formatTaskDate(dateString: string | null | undefined): string {
    if (!dateString) return 'Sin fecha';
    
    try {
      const dateStr = dateString.includes('Z') ? dateString : dateString + 'Z';
      const taskDate = new Date(dateStr);
      
      if (isNaN(taskDate.getTime())) {
        return 'Sin fecha';
      }
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      
      if (taskDateOnly.getTime() === todayOnly.getTime()) {
        return 'Hoy';
      } else if (taskDateOnly.getTime() === yesterdayOnly.getTime()) {
        return 'Ayer';
      } else {
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

  // ============ CHECKBOX HANDLERS ============

  getTaskGlobalIndex(task: Task): number {
    return this.projectTasksForModal.findIndex(t => t.id === task.id);
  }

  handleCheckboxChange(task: Task, index: number, event: MouseEvent): void {
    event.preventDefault();
    
    const isShiftPressed = event.shiftKey;
    const currentState = this.projectTaskIncluded[task.id];
    const newState = !currentState;
    
    if (task.taskGroupId && !isShiftPressed) {
      this.toggleGroupSelection(task.taskGroupId);
    } else if (isShiftPressed && this.lastSelectedTaskIndex !== null) {
      const startIndex = Math.min(this.lastSelectedTaskIndex, index);
      const endIndex = Math.max(this.lastSelectedTaskIndex, index);
      
      for (let i = startIndex; i <= endIndex; i++) {
        const rangeTask = this.projectTasksForModal[i];
        if (rangeTask) {
          this.projectTaskIncluded[rangeTask.id] = newState;
        }
      }
      
      setTimeout(() => {
        this.updateGroupCheckboxesIndeterminate();
      }, 0);
    } else {
      this.projectTaskIncluded[task.id] = newState;
      
      if (task.taskGroupId) {
        setTimeout(() => {
          this.updateGroupCheckboxesIndeterminate();
        }, 0);
      }
    }
    
    this.lastSelectedTaskIndex = index;
  }

  updateGroupCheckboxesIndeterminate(): void {
    const uniqueGroupIds = new Set<string>();
    this.projectTasksForModal.forEach(task => {
      if (task.taskGroupId) {
        uniqueGroupIds.add(task.taskGroupId);
      }
    });
    
    uniqueGroupIds.forEach(groupId => {
      const checkbox = document.querySelector(`input[data-group-id="${groupId}"]`) as HTMLInputElement;
      if (checkbox) {
        const groupTasks = this.getGroupTasks(groupId);
        const selectedCount = groupTasks.filter(task => this.projectTaskIncluded[task.id] !== false).length;
        checkbox.indeterminate = selectedCount > 0 && selectedCount < groupTasks.length;
      }
    });
  }

  // ============ GUARDAR SUMA ============

  openSaveSumTemplateModal(): void {
    this.newSumTemplateName = '';
    this.showSaveSumTemplateModal = true;
  }

  closeSaveSumTemplateModal(): void {
    this.showSaveSumTemplateModal = false;
    this.newSumTemplateName = '';
  }

  saveSum(): void {
    if (!this.newSumTemplateName.trim()) {
      alert('Por favor ingresa un nombre para la suma');
      return;
    }
    
    const selectedTaskIds = this.projectTasksForModal
      .filter(task => this.projectTaskIncluded[task.id] !== false)
      .map(task => task.id);
    
    this.saveSumTemplate.emit({
      name: this.newSumTemplateName.trim(),
      selectedTaskIds,
      startDateFilter: this.startDateFilter,
      endDateFilter: this.endDateFilter
    });
    
    this.closeSaveSumTemplateModal();
  }

  // ============ EVENTOS DE TAREAS (pass-through) ============

  onEditTask(task: Task): void {
    this.editTask.emit(task);
  }

  onDeleteTask(task: Task): void {
    this.deleteTask.emit(task);
  }

  onToggleHidden(task: Task): void {
    this.toggleHidden.emit(task);
  }

  onChangeStatus(event: { task: Task, status: 'pending' | 'in-progress' | 'completed' }): void {
    this.changeStatus.emit(event);
  }

  onTaskUpdated(task: Task): void {
    this.taskUpdated.emit(task);
  }
}
