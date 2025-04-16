import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription as RxSubscription, Subscription as SubType, Subject, takeUntil } from 'rxjs';
import { SubscriptionService, Subscription } from '../../services/subscription.service';

@Component({
  selector: 'app-suscripciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './suscripciones.component.html',
  styleUrls: ['./suscripciones.component.css']
})
export class SuscripcionesComponent implements OnInit, OnDestroy {
  // Variables para el calendario
  currentDate: Date = new Date();
  monthNames: string[] = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  calendarDays: any[] = [];
  
  // Variables para la gestión de suscripciones
  subscriptions: Subscription[] = [];
  isEditing: boolean = false;
  currentEditId: string | null = null;
  showConfirmModal: boolean = false;
  isLoading: boolean = true;

  // Para limpiar suscripciones cuando se destruye el componente
  private destroy$ = new Subject<void>();
  
  // Formulario para suscripción
  subscriptionForm = {
    id: null as string | null,
    name: '',
    cost: 0,
    currency: 'MXN',
    startDate: '',
    endDate: '',
    isRecurring: false,
    category: 'entertainment'
  };
  
  // Variables para resumen
  totalSubscriptions: number = 0;
  totalCostMXN: number = 0;
  totalCostUSD: number = 0;
  recurringCount: number = 0;
  
  // Variables para tabs
  activeTab: string = 'monthly';
  
  constructor(private subscriptionService: SubscriptionService) {}

  ngOnInit(): void {
    // Suscribirse a los cambios en las suscripciones
    this.subscriptionService.getSubscriptions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(subs => {
        this.subscriptions = subs;
        this.isLoading = false;
        this.updateCalendar();
        this.updateSummary();
      });
  }

  ngOnDestroy(): void {
    // Limpieza al destruir el componente
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Métodos para el manejo del calendario
  updateCalendar(): void {
    this.calendarDays = [];
    
    // Obtener primer día del mes y último día del mes
    const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
    const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
    
    // Obtener día de la semana del primer día (0 = Domingo, 6 = Sábado)
    const firstDayOfWeek = firstDay.getDay();
    
    // Agregar días vacíos al principio si es necesario
    for (let i = 0; i < firstDayOfWeek; i++) {
      this.calendarDays.push({ isEmpty: true });
    }
    
    // Agregar los días del mes
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const currentDayDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), i);
      const subscriptionsForDay = this.getSubscriptionsForDay(currentDayDate);
      const isToday = this.isCurrentDay(i);
      
      this.calendarDays.push({
        day: i,
        isToday: isToday,
        subscriptions: subscriptionsForDay,
        totalCost: subscriptionsForDay.reduce((sum, sub) => sum + sub.costMXN, 0)
      });
    }
    
    // Agregar días vacíos al final si es necesario
    const lastDayOfWeek = lastDay.getDay();
    for (let i = lastDayOfWeek + 1; i <= 6; i++) {
      this.calendarDays.push({ isEmpty: true });
    }
  }
  
  isCurrentDay(day: number): boolean {
    const today = new Date();
    return (
      this.currentDate.getMonth() === today.getMonth() &&
      this.currentDate.getFullYear() === today.getFullYear() &&
      day === today.getDate()
    );
  }
  
  // Utilidad para normalizar una fecha a YYYY-MM-DD sin tiempo ni zona horaria
  normalizeDate(dateString: string): string {
    // Extraer solo la parte de la fecha (YYYY-MM-DD) para evitar problemas de zona horaria
    return dateString.split('T')[0];
  }
  
  // Añadir días a una fecha representada como string 'YYYY-MM-DD'
  addDaysToDateString(dateString: string, days: number): string {
    // Crear fecha a partir del string, asegurándose de usar UTC para evitar problemas de zona horaria
    const parts = dateString.split('-').map(part => parseInt(part, 10));
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    
    // Añadir los días
    date.setUTCDate(date.getUTCDate() + days);
    
    // Formatear a YYYY-MM-DD
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
  
  getSubscriptionsForDay(date: Date): Subscription[] {
    // Convertir la fecha del día actual a string normalizado (YYYY-MM-DD)
    const dateString = this.formatDate(date);
    const dayOfMonth = date.getDate();
    
    return this.subscriptions.filter(sub => {
      // Si es recurrente, verificar si es el mismo día del mes
      if (sub.isRecurring) {
        const startDate = new Date(this.normalizeDate(sub.startDate));
        return startDate.getDate() === dayOfMonth;
      }
      
      // Para suscripciones no recurrentes
      // Normalizar la fecha de inicio
      const normalizedStartDate = this.normalizeDate(sub.startDate);
      
      // Si tiene fecha de fin, verificar si está en el rango
      if (sub.endDate) {
        // Normalizar la fecha de fin
        const normalizedEndDate = this.normalizeDate(sub.endDate);
        
        // Calcular el día siguiente a la fecha de fin
        const dayAfterEndDate = this.addDaysToDateString(normalizedEndDate, 1);
        
        // Verificar si la fecha actual está en el rango [inicio, fin+1)
        return dateString >= normalizedStartDate && dateString < dayAfterEndDate;
      } else {
        // Para fechas únicas, solo mostrar en el día exacto
        return dateString === normalizedStartDate;
      }
    });
  }
  
  prevMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.updateCalendar();
  }
  
  nextMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.updateCalendar();
  }
  
  // Métodos para gestión de suscripciones
  async submitForm(): Promise<void> {
    if (!this.subscriptionForm.name || this.subscriptionForm.cost <= 0 || !this.subscriptionForm.startDate) {
      this.showNotification('Por favor complete todos los campos requeridos', 'error');
      return;
    }
    
    if (this.isEditing && this.currentEditId) {
      // Editar suscripción existente
      const updateData = {
        name: this.subscriptionForm.name,
        cost: this.subscriptionForm.cost,
        currency: this.subscriptionForm.currency,
        startDate: this.subscriptionForm.startDate,
        endDate: this.subscriptionForm.endDate || null,
        isRecurring: this.subscriptionForm.isRecurring,
        category: this.subscriptionForm.category,
        color: this.subscriptionService.getCategoryColor(this.subscriptionForm.category)
      };
      
      const success = await this.subscriptionService.updateSubscription(this.currentEditId, updateData);
      
      if (success) {
        this.showNotification('Suscripción actualizada correctamente', 'success');
        this.resetForm();
      } else {
        this.showNotification('Error al actualizar la suscripción', 'error');
      }
    } else {
      // Añadir nueva suscripción
      const newSubscription = {
        name: this.subscriptionForm.name,
        cost: this.subscriptionForm.cost,
        costMXN: 0, // Se calcula en el servicio
        costUSD: 0, // Se calcula en el servicio
        currency: this.subscriptionForm.currency,
        startDate: this.subscriptionForm.startDate,
        endDate: this.subscriptionForm.endDate || null,
        isRecurring: this.subscriptionForm.isRecurring,
        category: this.subscriptionForm.category,
        color: this.subscriptionService.getCategoryColor(this.subscriptionForm.category),
        userId: '' // Se asigna en el servicio
      };
      
      const id = await this.subscriptionService.addSubscription(newSubscription);
      
      if (id) {
        this.showNotification('Suscripción agregada correctamente', 'success');
        this.resetForm();
      } else {
        this.showNotification('Error al añadir la suscripción', 'error');
      }
    }
  }
  
  editSubscription(id: string): void {
    const subscription = this.subscriptions.find(sub => sub.id === id);
    if (!subscription) return;
    
    this.isEditing = true;
    this.currentEditId = id;
    
    this.subscriptionForm = {
      id: subscription.id || null,
      name: subscription.name,
      cost: subscription.cost,
      currency: subscription.currency,
      startDate: subscription.startDate,
      endDate: subscription.endDate || '',
      isRecurring: subscription.isRecurring,
      category: subscription.category
    };
  }
  
  async deleteSubscription(id: string): Promise<void> {
    const success = await this.subscriptionService.deleteSubscription(id);
    
    if (success) {
      this.showNotification('Suscripción eliminada', 'info');
      
      // Si estábamos editando esta suscripción, resetear el formulario
      if (this.isEditing && this.currentEditId === id) {
        this.resetForm();
      }
    } else {
      this.showNotification('Error al eliminar la suscripción', 'error');
    }
  }
  
  resetForm(): void {
    this.isEditing = false;
    this.currentEditId = null;
    
    this.subscriptionForm = {
      id: null,
      name: '',
      cost: 0,
      currency: 'MXN',
      startDate: '',
      endDate: '',
      isRecurring: false,
      category: 'entertainment'
    };
  }
  
  confirmClearAll(): void {
    this.showConfirmModal = true;
  }
  
  async clearAll(): Promise<void> {
    const success = await this.subscriptionService.deleteAllSubscriptions();
    
    if (success) {
      this.showConfirmModal = false;
      this.showNotification('Todas las suscripciones han sido eliminadas', 'warning');
    } else {
      this.showNotification('Error al eliminar las suscripciones', 'error');
    }
  }
  
  cancelClearAll(): void {
    this.showConfirmModal = false;
  }
  
  // Métodos de utilidad
  updateSummary(): void {
    this.totalSubscriptions = this.subscriptions.length;
    this.totalCostMXN = this.subscriptions.reduce((sum, sub) => sum + sub.costMXN, 0);
    this.totalCostUSD = this.subscriptions.reduce((sum, sub) => sum + sub.costUSD, 0);
    this.recurringCount = this.subscriptions.filter(sub => sub.isRecurring).length;
  }
  
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
  
  formatDisplayDate(dateString: string): string {
    const date = new Date(dateString);
    return `${date.getDate()} ${this.monthNames[date.getMonth()]} ${date.getFullYear()}`;
  }
  
  getCategory(serviceName: string): string {
    // Clasificación simple basada en palabras clave
    const name = serviceName.toLowerCase();
    
    if (name.includes('netflix') || name.includes('disney') || name.includes('hbo') || 
        name.includes('spotify') || name.includes('youtube premium') || name.includes('prime video')) {
      return 'entertainment';
    } else if (name.includes('office') || name.includes('adobe') || name.includes('slack') || 
               name.includes('dropbox') || name.includes('google workspace') || name.includes('notion')) {
      return 'productivity';
    } else if (name.includes('coursera') || name.includes('udemy') || name.includes('masterclass') || 
               name.includes('linkedin learning') || name.includes('skillshare')) {
      return 'education';
    } else if (name.includes('vpn') || name.includes('hosting') || name.includes('domain') || 
               name.includes('cloud') || name.includes('github') || name.includes('figma')) {
      return 'tools';
    } else {
      return 'other';
    }
  }
  
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
  
  // Notificaciones temporales (simuladas por ahora)
  showNotification(message: string, type: string): void {
    console.log(`[${type}] ${message}`);
    // Aquí podrías implementar una notificación real
  }
} 