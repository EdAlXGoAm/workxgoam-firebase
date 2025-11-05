import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';
import { TaskType } from '../../models/task-type.model';
import { MuiTimePickerComponent } from '../mui-time-picker/mui-time-picker.component';
import { PrioritySelectorComponent } from '../priority-selector/priority-selector.component';
import { AndroidDatePickerComponent } from '../android-date-picker/android-date-picker.component';
import { TaskTypeService } from '../../services/task-type.service';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MuiTimePickerComponent, PrioritySelectorComponent, AndroidDatePickerComponent],
  templateUrl: './task-modal.component.html',
  styleUrls: ['./task-modal.component.css']
})
export class TaskModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() showModal = false;
  @Input() task: Partial<Task> = {};
  @Input() isEditing = false;
  @Input() environments: Environment[] = [];
  @Input() projects: Project[] = [];
  
  @Output() closeModalEvent = new EventEmitter<void>();
  @Output() saveTaskEvent = new EventEmitter<Partial<Task>>();
  @Output() openEnvironmentModal = new EventEmitter<void>();
  @Output() openProjectModal = new EventEmitter<void>();
  @Output() openTaskTypeModal = new EventEmitter<void>();
  @Output() openRemindersModal = new EventEmitter<void>();
  @Output() openCalculatorModal = new EventEmitter<{type: 'start' | 'end'}>();
  
  // Date/time fields
  startDate = '';
  startTime = '';
  endDate = '';
  endTime = '';
  deadlineDate = '';
  deadlineTime = '';
  
  // UI state
  showEmojiPicker = false;
  showDeadlineSection = false;
  dateError = '';
  selectableProjects: Project[] = [];
  taskTypes: TaskType[] = [];
  selectableTaskTypes: TaskType[] = [];
  isLoading = false;
  
  // Tareas recientes del proyecto
  recentTasks: Task[] = [];
  showRecentTasksSelector = false;
  selectedRecentTaskIndex: string = '';
  
  // Modal de confirmación de duración
  showDurationConfirmModal = false;
  pendingStartDate = '';
  pendingStartTime = '';
  calculatedEndDate = '';
  calculatedEndTime = '';
  previousStartDate = '';
  previousStartTime = '';
  
  // Modal de confirmación de duración para fragmentos
  showFragmentDurationConfirmModal = false;
  pendingFragmentIndex: number | null = null;
  pendingFragmentStartDate = '';
  pendingFragmentStartTime = '';
  calculatedFragmentEndDate = '';
  calculatedFragmentEndTime = '';
  previousFragmentStartDate = '';
  previousFragmentStartTime = '';
  
  // Flag para evitar recursión infinita en sincronización
  private isSyncingFragment = false;
  
  // Fechas originales para calcular el desplazamiento de recordatorios
  originalStartDateTime: Date | null = null;
  originalEndDateTime: Date | null = null;
  
  emojis = ['📝', '⏰', '✅', '🛏️', '🍔', 
            '😀', '😊', '😎', '🤩', '😍', '🤔', '😴', '🥳', '😇', '🤯', 
            '📅', '📌', '🔑', '📚', '💻', '📱', '🔋',
            '🏋️', '🚴', '🚗', '🍎', '🍕', '🛒', '☕', '🍷', '🎵', '🎮', '🎨', '✈️'];

  constructor(
    private cdr: ChangeDetectorRef,
    private taskTypeService: TaskTypeService,
    private taskService: TaskService
  ) {}

  get formId(): string {
    return this.isEditing ? 'editTaskForm' : 'newTaskForm';
  }
  
  ngOnInit() {
    this.initializeDateTimeFields();
    this.onEnvironmentChange();
    this.onProjectChange();
    this.checkIfDeadlineExists();
    // Guardar los valores iniciales de fecha/hora de inicio
    this.previousStartDate = this.startDate;
    this.previousStartTime = this.startTime;
    
    // Guardar las fechas originales para el desplazamiento de recordatorios
    if (this.task.start) {
      this.originalStartDateTime = new Date(this.task.start + (this.task.start.includes('Z') ? '' : 'Z'));
    }
    if (this.task.end) {
      this.originalEndDateTime = new Date(this.task.end + (this.task.end.includes('Z') ? '' : 'Z'));
    }
    
    // Sincronizar el primer fragmento con las fechas principales si existe
    this.syncFirstFragmentWithMainDates();
  }
  
  ngOnDestroy() {
    // Asegurar que el scroll se desbloquee al destruir el componente
    this.enableBodyScroll();
  }
  
  async ngOnChanges(changes: any) {
    if (this.showModal) {
      this.disableBodyScroll();
      // Mostrar carga mientras se obtienen los datos
      if (changes.showModal && changes.showModal.currentValue) {
        await this.loadInitialData();
      }
    } else {
      this.enableBodyScroll();
      // Limpiar tareas recientes al cerrar
      this.recentTasks = [];
      this.showRecentTasksSelector = false;
      this.selectedRecentTaskIndex = '';
      this.isLoading = false;
    }
  }
  
  private async loadInitialData() {
    this.isLoading = true;
    
    try {
      // Cargar tipos de tarea siempre
      await this.loadTaskTypes();
      
      // Si hay un proyecto seleccionado, cargar datos relacionados
      if (this.task.project) {
        // Filtrar tipos seleccionables
        this.selectableTaskTypes = this.taskTypes.filter(t => t.projectId === this.task.project);
        
        // Cargar tareas recientes solo si no estamos editando
        if (!this.isEditing) {
          await this.loadRecentTasks();
        }
      } else {
        this.selectableTaskTypes = [];
      }
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
  
  private disableBodyScroll() {
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = this.getScrollbarWidth() + 'px';
  }
  
  private enableBodyScroll() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
  
  private getScrollbarWidth(): number {
    // Crear un div invisible para medir el ancho del scrollbar
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    (outer.style as any).msOverflowStyle = 'scrollbar';
    document.body.appendChild(outer);

    const inner = document.createElement('div');
    outer.appendChild(inner);

    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    outer.parentNode?.removeChild(outer);

    return scrollbarWidth;
  }
  
  private initializeDateTimeFields() {
    if (this.task.start) {
      const startDateTime = this.splitDateTime(this.task.start);
      this.startDate = startDateTime.date;
      this.startTime = startDateTime.time;
    }
    
    if (this.task.end) {
      const endDateTime = this.splitDateTime(this.task.end);
      this.endDate = endDateTime.date;
      this.endTime = endDateTime.time;
    }
    
    if (this.task.deadline) {
      const deadlineDateTime = this.splitDateTime(this.task.deadline);
      this.deadlineDate = deadlineDateTime.date;
      this.deadlineTime = deadlineDateTime.time;
    }
    
    // Si hay fragmentos y fechas principales, sincronizar el primer fragmento
    // Si no hay fechas principales pero sí hay primer fragmento, usar ese para las fechas principales
    if (this.task.fragments && this.task.fragments.length > 0) {
      if (this.startDate && this.startTime && this.endDate && this.endTime) {
        // Hay fechas principales, sincronizar el primer fragmento con ellas
        this.task.fragments[0].start = this.combineDateTime(this.startDate, this.startTime);
        this.task.fragments[0].end = this.combineDateTime(this.endDate, this.endTime);
      } else if (this.task.fragments[0]?.start && this.task.fragments[0]?.end) {
        // No hay fechas principales pero sí hay primer fragmento, usar ese
        const fragmentStart = this.splitDateTime(this.task.fragments[0].start);
        const fragmentEnd = this.splitDateTime(this.task.fragments[0].end);
        this.startDate = fragmentStart.date;
        this.startTime = fragmentStart.time;
        this.endDate = fragmentEnd.date;
        this.endTime = fragmentEnd.time;
      }
    }
  }
  
  closeModal() {
    this.enableBodyScroll();
    this.closeModalEvent.emit();
  }
  
  saveTask() {
    if (!this.isFormValid()) return;
    
    // Update task with combined date/time values
    this.task.start = this.combineDateTime(this.startDate, this.startTime);
    this.task.end = this.combineDateTime(this.endDate, this.endTime);
    this.task.deadline = this.deadlineDate && this.deadlineTime 
      ? this.combineDateTime(this.deadlineDate, this.deadlineTime) 
      : null;
    
    this.saveTaskEvent.emit(this.task);
  }
  
  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }
  
  selectEmoji(emoji: string) {
    this.task.emoji = emoji;
    this.showEmojiPicker = false;
  }
  
  onEnvironmentChange() {
    if (this.task.environment) {
      this.selectableProjects = this.projects.filter(p => p.environment === this.task.environment);
    } else {
      this.selectableProjects = [];
    }
    if (!this.selectableProjects.find(p => p.id === this.task.project)) {
      this.task.project = '';
      this.task.type = undefined;
    }
    this.onProjectChange();
  }

  async onProjectChange() {
    if (this.task.project) {
      await this.loadTaskTypes();
      this.selectableTaskTypes = this.taskTypes.filter(t => t.projectId === this.task.project);
      // Cargar tareas recientes cuando se selecciona un proyecto (solo si no estamos editando)
      if (!this.isEditing) {
        this.loadRecentTasks();
      }
    } else {
      this.selectableTaskTypes = [];
      this.task.type = undefined;
      this.recentTasks = [];
      this.showRecentTasksSelector = false;
      this.selectedRecentTaskIndex = '';
    }
    // Si el tipo actual no está en los tipos seleccionables, limpiarlo
    if (this.task.type && !this.selectableTaskTypes.find(t => t.id === this.task.type)) {
      this.task.type = undefined;
    }
  }

  async loadTaskTypes() {
    try {
      this.taskTypes = await this.taskTypeService.getTaskTypes();
    } catch (error) {
      console.error('Error cargando tipos de tarea:', error);
      this.taskTypes = [];
    }
  }

  async refreshTaskTypes() {
    await this.loadTaskTypes();
    // Solo actualizar los tipos seleccionables si hay un proyecto seleccionado
    if (this.task.project) {
      this.selectableTaskTypes = this.taskTypes.filter(t => t.projectId === this.task.project);
    }
  }

  async loadRecentTasks() {
    if (!this.task.project || this.isEditing) {
      this.recentTasks = [];
      this.showRecentTasksSelector = false;
      return;
    }

    try {
      this.recentTasks = await this.taskService.getRecentTasksByProject(this.task.project, 20);
      this.showRecentTasksSelector = this.recentTasks.length > 0;
    } catch (error) {
      console.error('Error al cargar tareas recientes:', error);
      this.recentTasks = [];
      this.showRecentTasksSelector = false;
    }
  }

  onRecentTaskSelect(selectedIndex: string) {
    const index = parseInt(selectedIndex, 10);
    if (isNaN(index) || index < 0 || index >= this.recentTasks.length) {
      return;
    }
    
    const selectedTask = this.recentTasks[index];
    if (!selectedTask) {
      return;
    }
    
    // Autocompletar todos los campos desde la tarea seleccionada
    this.task.name = selectedTask.name;
    
    // Copiar emoji
    if (selectedTask.emoji) {
      this.task.emoji = selectedTask.emoji;
    }
    
    // Copiar descripción
    if (selectedTask.description) {
      this.task.description = selectedTask.description;
    }
    
    // Copiar prioridad
    if (selectedTask.priority) {
      this.task.priority = selectedTask.priority;
    }
    
    // Copiar tipo (solo si es válido para el proyecto actual)
    if (selectedTask.type && this.task.project) {
      const isValidType = this.selectableTaskTypes.some(t => t.id === selectedTask.type);
      if (isValidType) {
        this.task.type = selectedTask.type;
      }
    }
    
    // Copiar duración y ajustar fecha/hora de fin si hay fecha/hora de inicio
    if (selectedTask.duration) {
      this.task.duration = selectedTask.duration;
      
      // Si hay fecha/hora de inicio definidas, ajustar automáticamente la fecha/hora de fin
      if (this.startDate && this.startTime) {
        const newEndDateTime = this.calculateNewEndDateTime(this.startDate, this.startTime, selectedTask.duration);
        this.endDate = newEndDateTime.date;
        this.endTime = newEndDateTime.time;
        // Validar las fechas después del ajuste
        this.validateDates();
      }
    }
    
    // Resetear el selector para permitir seleccionar otra tarea
    this.selectedRecentTaskIndex = '';
    
    // Forzar actualización de la vista
    this.cdr.detectChanges();
  }
  
  onDateChange(field: 'start' | 'end' | 'deadline', date: string) {
    if (field === 'start' && this.shouldShowDurationConfirmModal()) {
      // Guardar los valores pendientes
      this.pendingStartDate = date;
      this.pendingStartTime = this.startTime;
      
      // Calcular la nueva fecha/hora de fin manteniendo la duración
      const newEndDateTime = this.calculateNewEndDateTime(date, this.startTime, this.task.duration || 0);
      this.calculatedEndDate = newEndDateTime.date;
      this.calculatedEndTime = newEndDateTime.time;
      
      // Mostrar el modal
      this.showDurationConfirmModal = true;
    } else {
      // Comportamiento normal para otros campos
      if (field === 'start') {
        this.startDate = date;
        // Sincronizar con el primer fragmento si existe
        this.syncFirstFragmentStart();
        // Si no se muestra el modal, ajustar recordatorios directamente
        if (!this.shouldShowDurationConfirmModal() && this.task.reminders && this.task.reminders.length > 0) {
          this.adjustReminders(date, this.startTime, this.endDate, this.endTime);
        }
      } else if (field === 'end') {
        this.endDate = date;
        // Sincronizar con el primer fragmento si existe
        this.syncFirstFragmentEnd();
      }
      this.updateDuration();
      this.validateDates();
    }
  }
  
  onStartTimeChange(time: string) {
    if (this.shouldShowDurationConfirmModal()) {
      // Guardar los valores pendientes
      this.pendingStartDate = this.startDate;
      this.pendingStartTime = time;
      
      // Calcular la nueva fecha/hora de fin manteniendo la duración
      const newEndDateTime = this.calculateNewEndDateTime(this.startDate, time, this.task.duration || 0);
      this.calculatedEndDate = newEndDateTime.date;
      this.calculatedEndTime = newEndDateTime.time;
      
      // Mostrar el modal
      this.showDurationConfirmModal = true;
    } else {
      // Comportamiento normal
      this.startTime = time;
      // Sincronizar con el primer fragmento si existe
      this.syncFirstFragmentStart();
      // Si no se muestra el modal, ajustar recordatorios directamente
      if (!this.shouldShowDurationConfirmModal() && this.task.reminders && this.task.reminders.length > 0 && this.startDate) {
        this.adjustReminders(this.startDate, time, this.endDate, this.endTime);
      }
      this.updateDuration();
      this.validateDates();
    }
  }
  
  onEndTimeChange(time: string) {
    this.endTime = time;
    // Sincronizar con el primer fragmento si existe
    this.syncFirstFragmentEnd();
    this.updateDuration();
    this.validateDates();
  }
  
  onDeadlineTimeChange(time: string) {
    this.deadlineTime = time;
  }
  
  private updateDuration() {
    const duration = this.calculateDuration(this.startDate, this.startTime, this.endDate, this.endTime);
    this.task.duration = duration;
  }
  
  private validateDates(): boolean {
    this.dateError = '';
    
    if (!this.startDate || !this.startTime || !this.endDate || !this.endTime) {
      return true;
    }
    
    const startDateTime = new Date(`${this.startDate}T${this.startTime}`);
    const endDateTime = new Date(`${this.endDate}T${this.endTime}`);
    
    if (endDateTime <= startDateTime) {
      this.dateError = 'La fecha de fin debe ser posterior a la fecha de inicio';
      return false;
    }
    
    return true;
  }
  
  isFormValid(): boolean {
    return this.validateDates() && 
           !!this.task.name && 
           !!this.startDate && 
           !!this.startTime && 
           !!this.endDate && 
           !!this.endTime;
  }
  
  getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  addFragment() {
    if (!this.task.fragments) {
      this.task.fragments = [];
    }
    
    // Si es el primer fragmento y hay fechas principales (inicio y fin), usar esas
    if (this.task.fragments.length === 0 && this.startDate && this.startTime && this.endDate && this.endTime) {
      this.task.fragments.push({
        start: this.combineDateTime(this.startDate, this.startTime),
        end: this.combineDateTime(this.endDate, this.endTime)
      });
      return;
    }
    
    // Determinar la fecha/hora de inicio del fragmento
    let fragmentStartDate: string;
    let fragmentStartTime: string;
    
    if (this.startDate && this.startTime) {
      // Si hay fecha/hora de inicio de la tarea, usar esa como referencia
      fragmentStartDate = this.startDate;
      fragmentStartTime = this.roundTimeToNearest30Minutes(this.startTime);
    } else {
      // Si no hay fecha/hora de inicio, usar la fecha/hora actual redondeada
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      fragmentStartDate = `${year}-${month}-${day}`;
      
      const currentTime = this.getCurrentTime();
      fragmentStartTime = this.roundTimeToNearest30Minutes(currentTime);
    }
    
    // Calcular la fecha/hora de fin (1 hora después del inicio)
    const endDateTime = this.calculateNewEndDateTime(fragmentStartDate, fragmentStartTime, 1);
    const fragmentEndDate = endDateTime.date;
    const fragmentEndTime = endDateTime.time;
    
    this.task.fragments.push({
      start: this.combineDateTime(fragmentStartDate, fragmentStartTime),
      end: this.combineDateTime(fragmentEndDate, fragmentEndTime)
    });
  }

  private roundTimeToNearest30Minutes(time: string): string {
    if (!time) return '00:00';
    
    const [hours, minutes] = time.split(':').map(Number);
    const roundedMinutes = Math.round(minutes / 30) * 30;
    
    // Si los minutos redondeados son 60, incrementar la hora y poner minutos en 0
    let finalHours = hours;
    let finalMinutes = roundedMinutes;
    
    if (roundedMinutes === 60) {
      finalHours = (hours + 1) % 24;
      finalMinutes = 0;
    }
    
    return `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
  }
  
  removeFragment(index: number) {
    if (this.task.fragments) {
      this.task.fragments.splice(index, 1);
      // Si se eliminó el primer fragmento y ahora hay otro, ese pasa a ser el primero
      // No modificamos las fechas principales para evitar pérdida de datos
    }
  }

  // Métodos para manejar fecha/hora de fragmentos
  getFragmentStartDate(fragmentIndex: number): string {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]?.start) {
      return '';
    }
    return this.splitDateTime(this.task.fragments[fragmentIndex].start).date;
  }

  getFragmentStartTime(fragmentIndex: number): string {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]?.start) {
      return '';
    }
    return this.splitDateTime(this.task.fragments[fragmentIndex].start).time;
  }

  getFragmentEndDate(fragmentIndex: number): string {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]?.end) {
      return '';
    }
    return this.splitDateTime(this.task.fragments[fragmentIndex].end).date;
  }

  getFragmentEndTime(fragmentIndex: number): string {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]?.end) {
      return '';
    }
    return this.splitDateTime(this.task.fragments[fragmentIndex].end).time;
  }

  onFragmentStartDateChange(fragmentIndex: number, date: string) {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return;
    }
    
    // Si es el primer fragmento, sincronizar con fechas principales
    if (fragmentIndex === 0 && !this.isSyncingFragment) {
      this.startDate = date;
      this.onDateChange('start', date);
      return;
    }
    
    // Para otros fragmentos, mostrar modal de confirmación si corresponde
    if (this.shouldShowFragmentDurationConfirmModal(fragmentIndex)) {
      const currentTime = this.getFragmentStartTime(fragmentIndex) || '00:00';
      this.pendingFragmentIndex = fragmentIndex;
      this.pendingFragmentStartDate = date;
      this.pendingFragmentStartTime = currentTime;
      
      // Calcular la nueva fecha/hora de fin manteniendo la duración
      const fragmentDuration = this.calculateFragmentDuration(fragmentIndex);
      const newEndDateTime = this.calculateNewEndDateTime(date, currentTime, fragmentDuration);
      this.calculatedFragmentEndDate = newEndDateTime.date;
      this.calculatedFragmentEndTime = newEndDateTime.time;
      
      this.showFragmentDurationConfirmModal = true;
    } else {
      const currentTime = this.getFragmentStartTime(fragmentIndex) || '00:00';
      this.task.fragments[fragmentIndex].start = this.combineDateTime(date, currentTime);
    }
  }

  onFragmentStartTimeChange(fragmentIndex: number, time: string) {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return;
    }
    
    // Si es el primer fragmento, sincronizar con fechas principales
    if (fragmentIndex === 0 && !this.isSyncingFragment) {
      this.startTime = time;
      this.onStartTimeChange(time);
      return;
    }
    
    // Para otros fragmentos, mostrar modal de confirmación si corresponde
    if (this.shouldShowFragmentDurationConfirmModal(fragmentIndex)) {
      const currentDate = this.getFragmentStartDate(fragmentIndex) || new Date().toISOString().split('T')[0];
      this.pendingFragmentIndex = fragmentIndex;
      this.pendingFragmentStartDate = currentDate;
      this.pendingFragmentStartTime = time;
      
      // Calcular la nueva fecha/hora de fin manteniendo la duración
      const fragmentDuration = this.calculateFragmentDuration(fragmentIndex);
      const newEndDateTime = this.calculateNewEndDateTime(currentDate, time, fragmentDuration);
      this.calculatedFragmentEndDate = newEndDateTime.date;
      this.calculatedFragmentEndTime = newEndDateTime.time;
      
      this.showFragmentDurationConfirmModal = true;
    } else {
      const currentDate = this.getFragmentStartDate(fragmentIndex) || new Date().toISOString().split('T')[0];
      this.task.fragments[fragmentIndex].start = this.combineDateTime(currentDate, time);
    }
  }

  onFragmentEndDateChange(fragmentIndex: number, date: string) {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return;
    }
    
    // Si es el primer fragmento, sincronizar con fechas principales
    if (fragmentIndex === 0 && !this.isSyncingFragment) {
      this.endDate = date;
      this.onDateChange('end', date);
      return;
    }
    
    const currentTime = this.getFragmentEndTime(fragmentIndex) || '00:00';
    this.task.fragments[fragmentIndex].end = this.combineDateTime(date, currentTime);
  }

  onFragmentEndTimeChange(fragmentIndex: number, time: string) {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return;
    }
    
    // Si es el primer fragmento, sincronizar con fechas principales
    if (fragmentIndex === 0 && !this.isSyncingFragment) {
      this.endTime = time;
      this.onEndTimeChange(time);
      return;
    }
    
    const currentDate = this.getFragmentEndDate(fragmentIndex) || new Date().toISOString().split('T')[0];
    this.task.fragments[fragmentIndex].end = this.combineDateTime(currentDate, time);
  }
  
  openTimeCalculator(type: 'start' | 'end') {
    this.openCalculatorModal.emit({ type });
  }
  
  // Métodos de utilidad
  private combineDateTime(date: string, time: string): string {
    if (!date || !time) return '';
    const [hours, minutes] = time.split(':');
    
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(5, 7)) - 1;
    const day = parseInt(date.substring(8, 10));
    
    const dateTime = new Date(year, month, day, parseInt(hours), parseInt(minutes), 0, 0);
    
    return dateTime.toISOString().slice(0, 16);
  }
  
  private splitDateTime(dateTimeString: string): { date: string, time: string } {
    if (!dateTimeString) return { date: '', time: '' };
    
    const dateTime = new Date(dateTimeString + (dateTimeString.includes('Z') ? '' : 'Z'));
    
    const year = dateTime.getFullYear();
    const month = String(dateTime.getMonth() + 1).padStart(2, '0');
    const day = String(dateTime.getDate()).padStart(2, '0');
    const hours = String(dateTime.getHours()).padStart(2, '0');
    const minutes = String(dateTime.getMinutes()).padStart(2, '0');
    
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`
    };
  }
  
  private formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  
  private calculateDuration(startDate: string, startTime: string, endDate: string, endTime: string): number {
    if (!startDate || !startTime || !endDate || !endTime) {
      return 0;
    }
    
    try {
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      const startDateTime = new Date(startDate);
      startDateTime.setHours(startHours, startMinutes, 0, 0);
      
      const endDateTime = new Date(endDate);
      endDateTime.setHours(endHours, endMinutes, 0, 0);
      
      const diffMs = endDateTime.getTime() - startDateTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      return Math.max(0, Math.round(diffHours * 100) / 100);
    } catch (error) {
      console.error('Error calculating duration:', error);
      return 0;
    }
  }
  
  getTaskReferenceDates() {
    // Usar las fechas actuales del formulario, no las originales de la tarea
    return {
      start: this.combineDateTime(this.startDate, this.startTime),
      end: this.combineDateTime(this.endDate, this.endTime),
      deadline: this.deadlineDate && this.deadlineTime 
        ? this.combineDateTime(this.deadlineDate, this.deadlineTime) 
        : null
    };
  }
  
  get currentCategorizedReminders(): {
    beforeStart: Array<{ reminder: string; index: number; description: string }>;
    duringEvent: Array<{ reminder: string; index: number; description: string }>;
    beforeDeadline: Array<{ reminder: string; index: number; description: string }>;
    afterDeadline: Array<{ reminder: string; index: number; description: string }>;
  } {
    const reminders = this.task.reminders || [];
    const dates = this.getTaskReferenceDates();
    
    // Asegurar que todas las fechas se interpreten como UTC
    const startDate = dates.start ? new Date(dates.start + (dates.start.includes('Z') ? '' : 'Z')) : null;
    const endDate = dates.end ? new Date(dates.end + (dates.end.includes('Z') ? '' : 'Z')) : null;
    const deadlineDate = dates.deadline ? new Date(dates.deadline + (dates.deadline.includes('Z') ? '' : 'Z')) : null;

    const categorized = {
      beforeStart: [] as Array<{reminder: string, index: number, description: string}>,
      duringEvent: [] as Array<{reminder: string, index: number, description: string}>,
      beforeDeadline: [] as Array<{reminder: string, index: number, description: string}>,
      afterDeadline: [] as Array<{reminder: string, index: number, description: string}>
    };

    reminders.forEach((reminder, index) => {
      // Asegurar que el recordatorio se interprete como UTC
      const reminderDate = new Date(reminder + (reminder.includes('Z') ? '' : 'Z'));
      const description = this.generateReminderDescription(reminderDate, dates);
      
      if (startDate && reminderDate < startDate) {
        // Antes del inicio del evento
        categorized.beforeStart.push({reminder, index, description});
      } else if (endDate && reminderDate <= endDate) {
        // Durante el evento (entre inicio y fin)
        categorized.duringEvent.push({reminder, index, description});
      } else if (deadlineDate && endDate && reminderDate > endDate && reminderDate <= deadlineDate) {
        // Entre el fin del evento y la fecha límite
        categorized.beforeDeadline.push({reminder, index, description});
      } else if (deadlineDate && reminderDate > deadlineDate) {
        // Después de la fecha límite
        categorized.afterDeadline.push({reminder, index, description});
      } else {
        // Si no hay fecha límite pero está después del fin, va a "durante el evento"
        categorized.duringEvent.push({reminder, index, description});
      }
    });

    return categorized;
  }

  private generateReminderDescription(reminderDate: Date, dates: any): string {
    // Asegurar que todas las fechas se interpreten como UTC
    const startDate = dates.start ? new Date(dates.start + (dates.start.includes('Z') ? '' : 'Z')) : null;
    const endDate = dates.end ? new Date(dates.end + (dates.end.includes('Z') ? '' : 'Z')) : null;
    const deadlineDate = dates.deadline ? new Date(dates.deadline + (dates.deadline.includes('Z') ? '' : 'Z')) : null;

    // Función helper para comparar fechas (considerando diferencias menores a 1 minuto como iguales)
    const isSameTime = (date1: Date, date2: Date): boolean => {
      return Math.abs(date1.getTime() - date2.getTime()) < 60000; // Menos de 1 minuto
    };

    // Verificar si coincide exactamente con alguna fecha del evento
    if (startDate && isSameTime(reminderDate, startDate)) {
      return '🎯 Al inicio';
    }
    
    if (endDate && isSameTime(reminderDate, endDate)) {
      return '🏁 Al final';
    }
    
    if (deadlineDate && isSameTime(reminderDate, deadlineDate)) {
      return '⏰ Al límite';
    }

    // Lógica existente para recordatorios que no coinciden exactamente
    if (deadlineDate && endDate && reminderDate > endDate) {
      if (reminderDate <= deadlineDate) {
        const diffMinutes = Math.floor((deadlineDate.getTime() - reminderDate.getTime()) / (1000 * 60));
        return this.formatTimeDifference(diffMinutes, 'antes del límite');
      } else {
        const diffMinutes = Math.floor((reminderDate.getTime() - deadlineDate.getTime()) / (1000 * 60));
        return this.formatTimeDifference(diffMinutes, 'después del límite');
      }
    }
    
    if (startDate && reminderDate < startDate) {
      const diffMinutes = Math.floor((startDate.getTime() - reminderDate.getTime()) / (1000 * 60));
      return this.formatTimeDifference(diffMinutes, 'antes del inicio');
    } else if (endDate && reminderDate > endDate && !deadlineDate) {
      const diffMinutes = Math.floor((reminderDate.getTime() - endDate.getTime()) / (1000 * 60));
      return this.formatTimeDifference(diffMinutes, 'después del final');
    } else if (startDate && endDate && reminderDate >= startDate && reminderDate <= endDate) {
      // Recordatorio durante el evento (entre inicio y final)
      const diffMinutes = Math.floor((reminderDate.getTime() - startDate.getTime()) / (1000 * 60));
      if (diffMinutes === 0) {
        return '🎯 Al inicio';
      } else {
        return this.formatTimeDifference(diffMinutes, 'después del inicio');
      }
    } else if (startDate) {
      const diffMinutes = Math.floor((reminderDate.getTime() - startDate.getTime()) / (1000 * 60));
      return this.formatTimeDifference(Math.abs(diffMinutes), diffMinutes >= 0 ? 'después del inicio' : 'antes del inicio');
    }
    
    return 'Recordatorio personalizado';
  }

  private formatTimeDifference(minutes: number, context: string): string {
    if (minutes < 60) {
      return `${minutes} minutos ${context}`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hora${hours > 1 ? 's' : ''} ${context}`;
      } else {
        return `${hours}h ${remainingMinutes}m ${context}`;
      }
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      if (remainingHours === 0) {
        return `${days} día${days > 1 ? 's' : ''} ${context}`;
      } else {
        return `${days}d ${remainingHours}h ${context}`;
      }
    }
  }
  
  formatReminderDateTime(dateTimeString: string): string {
    const utcString = dateTimeString.includes('Z') || dateTimeString.includes('+') 
      ? dateTimeString 
      : dateTimeString + 'Z';
    
    const date = new Date(utcString);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Mexico_City'
    });
  }
  
  toggleDeadlineSection() {
    this.showDeadlineSection = !this.showDeadlineSection;
    // Si se oculta la sección, limpiar los valores de fecha límite
    if (!this.showDeadlineSection) {
      this.deadlineDate = '';
      this.deadlineTime = '';
      this.task.deadline = null;
    }
  }
  
  private checkIfDeadlineExists() {
    // Si la tarea ya tiene una fecha límite, mostrar la sección
    if (this.task.deadline) {
      this.showDeadlineSection = true;
    }
  }
  
  // Métodos para el modal de confirmación de duración
  formatDuration(hours: number): string {
    if (hours === 0) return '0 horas';
    
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
  
  formatDateTime(date: string, time: string): string {
    if (!date || !time) return 'No definida';
    
    const dateTime = new Date(`${date}T${time}`);
    return dateTime.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
  
  cancelDurationAdjustment() {
    // Cerrar el modal sin hacer cambios
    this.showDurationConfirmModal = false;
    // Aplicar los cambios de fecha/hora de inicio sin ajustar el fin
    this.startDate = this.pendingStartDate;
    this.startTime = this.pendingStartTime;
    // Ajustar los recordatorios con el nuevo inicio
    this.adjustReminders(this.pendingStartDate, this.pendingStartTime, this.endDate, this.endTime);
    // Recalcular la duración con las nuevas fechas
    this.updateDuration();
    this.validateDates();
  }
  
  confirmDurationAdjustment() {
    // Aplicar los cambios manteniendo la duración
    this.showDurationConfirmModal = false;
    this.startDate = this.pendingStartDate;
    this.startTime = this.pendingStartTime;
    this.endDate = this.calculatedEndDate;
    this.endTime = this.calculatedEndTime;
    // Sincronizar con el primer fragmento si existe
    this.syncFirstFragmentWithMainDates();
    // Ajustar los recordatorios con el nuevo inicio
    this.adjustReminders(this.pendingStartDate, this.pendingStartTime, this.calculatedEndDate, this.calculatedEndTime);
    // La duración se mantiene igual
    this.validateDates();
  }
  
  // Métodos para sincronizar el primer fragmento con las fechas principales
  private syncFirstFragmentWithMainDates() {
    if (!this.task.fragments || this.task.fragments.length === 0) {
      return;
    }
    
    // Si hay fecha/hora de inicio y fin principales, sincronizar con el primer fragmento
    if (this.startDate && this.startTime && this.endDate && this.endTime) {
      this.task.fragments[0].start = this.combineDateTime(this.startDate, this.startTime);
      this.task.fragments[0].end = this.combineDateTime(this.endDate, this.endTime);
    } else if (this.task.fragments[0]?.start && this.task.fragments[0]?.end) {
      // Si no hay fechas principales pero sí hay primer fragmento, sincronizar hacia las fechas principales
      const fragmentStart = this.splitDateTime(this.task.fragments[0].start);
      const fragmentEnd = this.splitDateTime(this.task.fragments[0].end);
      this.startDate = fragmentStart.date;
      this.startTime = fragmentStart.time;
      this.endDate = fragmentEnd.date;
      this.endTime = fragmentEnd.time;
    }
  }
  
  private syncFirstFragmentStart() {
    if (this.isSyncingFragment || !this.task.fragments || this.task.fragments.length === 0) {
      return;
    }
    
    if (this.startDate && this.startTime) {
      this.isSyncingFragment = true;
      this.task.fragments[0].start = this.combineDateTime(this.startDate, this.startTime);
      this.isSyncingFragment = false;
    }
  }
  
  private syncFirstFragmentEnd() {
    if (this.isSyncingFragment || !this.task.fragments || this.task.fragments.length === 0) {
      return;
    }
    
    if (this.endDate && this.endTime) {
      this.isSyncingFragment = true;
      this.task.fragments[0].end = this.combineDateTime(this.endDate, this.endTime);
      this.isSyncingFragment = false;
    }
  }
  
  // Métodos para el modal de confirmación de duración de fragmentos
  private shouldShowFragmentDurationConfirmModal(fragmentIndex: number): boolean {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return false;
    }
    
    const fragment = this.task.fragments[fragmentIndex];
    const fragmentDuration = this.calculateFragmentDuration(fragmentIndex);
    
    // Mostrar el modal solo si hay una duración definida mayor a 0 y hay fecha/hora de inicio y fin
    return fragmentDuration > 0 && 
           !!fragment.start && !!fragment.end;
  }
  
  calculateFragmentDuration(fragmentIndex: number): number {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return 0;
    }
    
    const fragment = this.task.fragments[fragmentIndex];
    if (!fragment.start || !fragment.end) {
      return 0;
    }
    
    const startDateTime = this.splitDateTime(fragment.start);
    const endDateTime = this.splitDateTime(fragment.end);
    
    return this.calculateDuration(
      startDateTime.date,
      startDateTime.time,
      endDateTime.date,
      endDateTime.time
    );
  }
  
  cancelFragmentDurationAdjustment() {
    if (this.pendingFragmentIndex === null) {
      return;
    }
    
    // Cerrar el modal sin hacer cambios
    this.showFragmentDurationConfirmModal = false;
    
    // Aplicar los cambios de fecha/hora de inicio sin ajustar el fin
    if (this.task.fragments && this.task.fragments[this.pendingFragmentIndex]) {
      this.task.fragments[this.pendingFragmentIndex].start = this.combineDateTime(
        this.pendingFragmentStartDate,
        this.pendingFragmentStartTime
      );
    }
    
    // Limpiar valores pendientes
    this.pendingFragmentIndex = null;
    this.pendingFragmentStartDate = '';
    this.pendingFragmentStartTime = '';
    this.calculatedFragmentEndDate = '';
    this.calculatedFragmentEndTime = '';
  }
  
  confirmFragmentDurationAdjustment() {
    if (this.pendingFragmentIndex === null) {
      return;
    }
    
    // Aplicar los cambios manteniendo la duración
    this.showFragmentDurationConfirmModal = false;
    
    if (this.task.fragments && this.task.fragments[this.pendingFragmentIndex]) {
      this.task.fragments[this.pendingFragmentIndex].start = this.combineDateTime(
        this.pendingFragmentStartDate,
        this.pendingFragmentStartTime
      );
      this.task.fragments[this.pendingFragmentIndex].end = this.combineDateTime(
        this.calculatedFragmentEndDate,
        this.calculatedFragmentEndTime
      );
    }
    
    // Limpiar valores pendientes
    this.pendingFragmentIndex = null;
    this.pendingFragmentStartDate = '';
    this.pendingFragmentStartTime = '';
    this.calculatedFragmentEndDate = '';
    this.calculatedFragmentEndTime = '';
    
    // Forzar actualización de la vista
    this.cdr.detectChanges();
  }
  
  private calculateNewEndDateTime(newStartDate: string, newStartTime: string, duration: number): { date: string, time: string } {
    if (!newStartDate || !newStartTime || !duration) {
      return { date: '', time: '' };
    }
    
    const startDateTime = new Date(`${newStartDate}T${newStartTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);
    
    return this.splitDateTime(endDateTime.toISOString());
  }
  
  private shouldShowDurationConfirmModal(): boolean {
    // Mostrar el modal solo si:
    // 1. Ya hay una duración definida mayor a 0
    // 2. Ya hay fecha/hora de inicio y fin definidas
    // 3. No es la primera vez que se está configurando (es decir, estamos editando)
    return (this.task.duration || 0) > 0 && 
           !!this.startDate && !!this.startTime && 
           !!this.endDate && !!this.endTime &&
           (this.isEditing || (!!this.previousStartDate && !!this.previousStartTime));
  }
  
  private adjustReminders(newStartDate: string, newStartTime: string, newEndDate: string, newEndTime: string) {
    if (!this.task.reminders || this.task.reminders.length === 0) return;
    if (!this.originalStartDateTime) return;
    
    // Calcular el desplazamiento en milisegundos basado en el cambio de fecha de inicio
    const newStart = new Date(`${newStartDate}T${newStartTime}`);
    const offset = newStart.getTime() - this.originalStartDateTime.getTime();
    
    // Ajustar cada recordatorio con el mismo desplazamiento
    this.task.reminders = this.task.reminders.map(reminderStr => {
      const reminderDate = new Date(reminderStr + (reminderStr.includes('Z') ? '' : 'Z'));
      const adjustedDate = new Date(reminderDate.getTime() + offset);
      return adjustedDate.toISOString().slice(0, 16);
    });
    
    // Actualizar la fecha de inicio original para futuros ajustes
    this.originalStartDateTime = newStart;
    
    // Forzar la actualización de la vista para recalcular las descripciones
    this.cdr.detectChanges();
  }
  
  // Preparo los campos de fecha/hora antes de abrir el modal de recordatorios
  prepareTaskDatesForReminders() {
    this.task.start = this.combineDateTime(this.startDate, this.startTime);
    this.task.end = this.combineDateTime(this.endDate, this.endTime);
    this.task.deadline = this.deadlineDate && this.deadlineTime ? this.combineDateTime(this.deadlineDate, this.deadlineTime) : null;
  }
  
  async onTaskNameBlur() {
    // Solo buscar si hay un nombre válido y un proyecto seleccionado
    if (!this.task.name || this.task.name.trim() === '') {
      return;
    }
    
    // Solo buscar si hay un proyecto seleccionado para evitar cruces entre proyectos
    if (!this.task.project) {
      return;
    }
    
    try {
      // Buscar tareas con el mismo nombre y proyecto
      const matchingTasks = await this.taskService.getTasksByNameAndProject(
        this.task.name.trim(), 
        this.task.project
      );
      
      // Si hay coincidencias, tomar la más reciente (ya viene ordenada)
      if (matchingTasks.length > 0) {
        const mostRecentTask = matchingTasks[0];
        
        // Copiar los valores: tipo, emoji, descripción, prioridad y duración
        // Solo copiar el tipo si es válido para el proyecto actual
        if (mostRecentTask.type) {
          // Asegurar que los tipos estén cargados
          await this.loadTaskTypes();
          const isValidType = this.selectableTaskTypes.some(t => t.id === mostRecentTask.type);
          if (isValidType) {
            this.task.type = mostRecentTask.type;
          }
        }
        
        if (mostRecentTask.emoji) {
          this.task.emoji = mostRecentTask.emoji;
        }
        
        if (mostRecentTask.description) {
          this.task.description = mostRecentTask.description;
        }
        
        if (mostRecentTask.priority) {
          this.task.priority = mostRecentTask.priority;
        }
        
        if (mostRecentTask.duration) {
          this.task.duration = mostRecentTask.duration;
          
          // Si hay fecha/hora de inicio definidas, ajustar automáticamente la fecha/hora de fin
          if (this.startDate && this.startTime) {
            const newEndDateTime = this.calculateNewEndDateTime(this.startDate, this.startTime, mostRecentTask.duration);
            this.endDate = newEndDateTime.date;
            this.endTime = newEndDateTime.time;
            // Validar las fechas después del ajuste
            this.validateDates();
          }
        }
        
        // Forzar actualización de la vista
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error al buscar tareas por nombre y proyecto:', error);
      // No mostrar error al usuario, solo registrar en consola
    }
  }
} 