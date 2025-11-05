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
  
  // Modal de confirmación de duración
  showDurationConfirmModal = false;
  pendingStartDate = '';
  pendingStartTime = '';
  calculatedEndDate = '';
  calculatedEndTime = '';
  previousStartDate = '';
  previousStartTime = '';
  
  // Fechas originales para calcular el desplazamiento de recordatorios
  originalStartDateTime: Date | null = null;
  originalEndDateTime: Date | null = null;
  
  emojis = ['📝', '⏰', '✅', '🛏️', '🍔', 
            '😀', '😊', '😎', '🤩', '😍', '🤔', '😴', '🥳', '😇', '🤯', 
            '📅', '📌', '🔑', '📚', '💻', '📱', '🔋',
            '🏋️', '🚴', '🚗', '🍎', '🍕', '🛒', '☕', '🍷', '🎵', '🎮', '🎨', '✈️'];

  constructor(
    private cdr: ChangeDetectorRef,
    private taskTypeService: TaskTypeService
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
  }
  
  ngOnDestroy() {
    // Asegurar que el scroll se desbloquee al destruir el componente
    this.enableBodyScroll();
  }
  
  ngOnChanges(changes: any) {
    if (this.showModal) {
      this.disableBodyScroll();
      // Recargar tipos cuando se abre el modal
      if (changes.showModal && changes.showModal.currentValue && this.task.project) {
        this.onProjectChange();
      }
    } else {
      this.enableBodyScroll();
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
    } else {
      this.selectableTaskTypes = [];
      this.task.type = undefined;
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
    this.onProjectChange();
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
        // Si no se muestra el modal, ajustar recordatorios directamente
        if (!this.shouldShowDurationConfirmModal() && this.task.reminders && this.task.reminders.length > 0) {
          this.adjustReminders(date, this.startTime, this.endDate, this.endTime);
        }
      } else if (field === 'end') {
        this.endDate = date;
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
    const now = new Date();
    const startTime = new Date(now.getTime() + 30 * 60000);
    const endTime = new Date(startTime.getTime() + 60 * 60000);
    
    this.task.fragments.push({
      start: this.formatDateTimeLocal(startTime),
      end: this.formatDateTimeLocal(endTime)
    });
  }
  
  removeFragment(index: number) {
    if (this.task.fragments) {
      this.task.fragments.splice(index, 1);
    }
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
    // Ajustar los recordatorios con el nuevo inicio
    this.adjustReminders(this.pendingStartDate, this.pendingStartTime, this.calculatedEndDate, this.calculatedEndTime);
    // La duración se mantiene igual
    this.validateDates();
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
} 