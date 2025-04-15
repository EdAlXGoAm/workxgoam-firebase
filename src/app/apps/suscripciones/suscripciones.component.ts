import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

interface Subscription {
  id: number;
  name: string;
  cost: number;
  costMXN: number;
  costUSD: number;
  currency: string;
  startDate: string;
  endDate: string | null;
  isRecurring: boolean;
  category: string;
  color: string;
}

@Component({
  selector: 'app-suscripciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './suscripciones.component.html',
  styleUrls: ['./suscripciones.component.css']
})
export class SuscripcionesComponent implements OnInit {
  // Variables para el calendario
  currentDate: Date = new Date();
  monthNames: string[] = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  calendarDays: any[] = [];
  
  // Variables para la gestión de suscripciones
  subscriptions: Subscription[] = [];
  isEditing: boolean = false;
  currentEditId: number | null = null;
  showConfirmModal: boolean = false;
  
  // Tasa de cambio fija
  readonly EXCHANGE_RATE: number = 17.5;
  
  // Formulario para suscripción
  subscriptionForm = {
    id: null as number | null,
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
  
  ngOnInit(): void {
    // Cargar datos guardados si existen
    const savedSubscriptions = localStorage.getItem('subscriptions');
    if (savedSubscriptions) {
      this.subscriptions = JSON.parse(savedSubscriptions);
    }
    
    // Inicializar componente
    this.updateCalendar();
    this.updateSummary();
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
  submitForm(): void {
    if (!this.subscriptionForm.name || this.subscriptionForm.cost <= 0 || !this.subscriptionForm.startDate) {
      this.showNotification('Por favor complete todos los campos requeridos', 'error');
      return;
    }
    
    // Convertir a MXN si es necesario
    const costMXN = this.subscriptionForm.currency === 'USD' 
      ? this.subscriptionForm.cost * this.EXCHANGE_RATE 
      : this.subscriptionForm.cost;
      
    const costUSD = this.subscriptionForm.currency === 'MXN' 
      ? this.subscriptionForm.cost / this.EXCHANGE_RATE 
      : this.subscriptionForm.cost;
    
    if (this.isEditing && this.currentEditId) {
      // Editar suscripción existente
      const index = this.subscriptions.findIndex(sub => sub.id === this.currentEditId);
      if (index !== -1) {
        this.subscriptions[index] = {
          id: this.currentEditId,
          name: this.subscriptionForm.name,
          cost: this.subscriptionForm.cost,
          costMXN: costMXN,
          costUSD: costUSD,
          currency: this.subscriptionForm.currency,
          startDate: this.subscriptionForm.startDate,
          endDate: this.subscriptionForm.endDate || null,
          isRecurring: this.subscriptionForm.isRecurring,
          category: this.subscriptionForm.category,
          color: this.getCategoryColor(this.subscriptionForm.category)
        };
        
        this.showNotification('Suscripción actualizada correctamente', 'success');
      }
    } else {
      // Agregar nueva suscripción
      const newId = this.subscriptions.length > 0 
        ? Math.max(...this.subscriptions.map(s => s.id)) + 1 
        : 1;
      
      const newSubscription: Subscription = {
        id: newId,
        name: this.subscriptionForm.name,
        cost: this.subscriptionForm.cost,
        costMXN: costMXN,
        costUSD: costUSD,
        currency: this.subscriptionForm.currency,
        startDate: this.subscriptionForm.startDate,
        endDate: this.subscriptionForm.endDate || null,
        isRecurring: this.subscriptionForm.isRecurring,
        category: this.subscriptionForm.category,
        color: this.getCategoryColor(this.subscriptionForm.category)
      };
      
      this.subscriptions.push(newSubscription);
      this.showNotification('Suscripción agregada correctamente', 'success');
    }
    
    this.saveSubscriptions();
    this.updateCalendar();
    this.updateSummary();
    this.resetForm();
  }
  
  editSubscription(id: number): void {
    const subscription = this.subscriptions.find(sub => sub.id === id);
    if (!subscription) return;
    
    this.isEditing = true;
    this.currentEditId = id;
    
    this.subscriptionForm = {
      id: subscription.id,
      name: subscription.name,
      cost: subscription.cost,
      currency: subscription.currency,
      startDate: subscription.startDate,
      endDate: subscription.endDate || '',
      isRecurring: subscription.isRecurring,
      category: subscription.category
    };
  }
  
  deleteSubscription(id: number): void {
    this.subscriptions = this.subscriptions.filter(sub => sub.id !== id);
    this.saveSubscriptions();
    this.updateCalendar();
    this.updateSummary();
    this.showNotification('Suscripción eliminada', 'info');
    
    // Si estábamos editando esta suscripción, resetear el formulario
    if (this.isEditing && this.currentEditId === id) {
      this.resetForm();
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
  
  clearAll(): void {
    this.subscriptions = [];
    this.saveSubscriptions();
    this.updateCalendar();
    this.updateSummary();
    this.showConfirmModal = false;
    this.showNotification('Todas las suscripciones han sido eliminadas', 'warning');
  }
  
  cancelClearAll(): void {
    this.showConfirmModal = false;
  }
  
  // Métodos de utilidad
  saveSubscriptions(): void {
    localStorage.setItem('subscriptions', JSON.stringify(this.subscriptions));
  }
  
  updateSummary(): void {
    this.totalSubscriptions = this.subscriptions.length;
    this.totalCostMXN = this.subscriptions.reduce((sum, sub) => sum + sub.costMXN, 0);
    this.totalCostUSD = this.subscriptions.reduce((sum, sub) => sum + sub.costUSD, 0);
    this.recurringCount = this.subscriptions.filter(sub => sub.isRecurring).length;
  }
  
  formatDate(date: Date): string {
    // Formatear a YYYY-MM-DD en UTC para evitar problemas de zona horaria
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  formatDisplayDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
  
  getCategoryColor(category: string): string {
    const colors: {[key: string]: string} = {
      'entertainment': 'bg-blue-500',
      'productivity': 'bg-green-500',
      'education': 'bg-purple-500',
      'tools': 'bg-yellow-500',
      'other': 'bg-red-500'
    };
    return colors[category] || 'bg-gray-500';
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