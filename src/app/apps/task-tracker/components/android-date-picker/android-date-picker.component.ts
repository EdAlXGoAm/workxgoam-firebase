import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, forwardRef, HostListener, ElementRef, ViewChild, TemplateRef, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-android-date-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AndroidDatePickerComponent),
      multi: true
    }
  ],
  template: `
    <div class="relative">
      <!-- Input field que muestra la fecha seleccionada -->
      <button
        type="button"
        (click)="openPicker()"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-left bg-white hover:bg-gray-50 transition-colors"
        [class.border-red-300]="!isValid && touched"
        [class.focus:ring-red-500]="!isValid && touched"
        [class.focus:border-red-500]="!isValid && touched">
        <div class="flex items-center justify-between">
          <span [class.text-gray-400]="!selectedDate" [class.text-gray-900]="selectedDate">
            {{ selectedDate ? formatDisplayDate(selectedDate) : placeholder }}
          </span>
          <i class="fas fa-calendar-alt text-gray-400"></i>
        </div>
      </button>

      <!-- Popup del date picker estilo Android -->
      <div *ngIf="isOpen" 
           class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
           [class.picker-hidden]="!isModalReady"
           style="overflow: hidden;">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
             (mousedown)="$event.stopPropagation()"
             (mouseup)="$event.stopPropagation()">
          <!-- Header del picker -->
          <div class="bg-indigo-600 text-white p-6">
            <div class="text-sm font-medium opacity-90">{{ label }}</div>
            <div class="text-2xl font-bold mt-1">
              {{ selectedDate ? formatHeaderDate(selectedDate) : 'Seleccionar fecha' }}
            </div>
          </div>

          <!-- Contenido del picker -->
          <div class="p-6">
            <!-- Navegación del mes -->
            <div class="flex items-center justify-between mb-6">
              <button
                type="button"
                (click)="previousMonth()"
                class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <i class="fas fa-chevron-left text-gray-600"></i>
              </button>
              
              <div class="text-lg font-semibold text-gray-800">
                {{ getMonthYearDisplay() }}
              </div>
              
              <button
                type="button"
                (click)="nextMonth()"
                class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                <i class="fas fa-chevron-right text-gray-600"></i>
              </button>
            </div>

            <!-- Días de la semana -->
            <div class="grid grid-cols-7 gap-1 mb-2">
              <div *ngFor="let day of weekDays" class="text-xs font-medium text-gray-500 text-center py-2">
                {{ day }}
              </div>
            </div>

            <!-- Calendario -->
            <div class="grid grid-cols-7 gap-1">
              <button
                *ngFor="let day of calendarDays"
                type="button"
                (click)="selectDate(day)"
                [disabled]="!day.isCurrentMonth"
                class="w-10 h-10 flex items-center justify-center rounded-full text-sm transition-all duration-200"
                [class.text-gray-400]="!day.isCurrentMonth"
                [class.text-gray-800]="day.isCurrentMonth && !day.isSelected && !day.isToday"
                [class.bg-indigo-600]="day.isSelected"
                [class.text-white]="day.isSelected"
                [class.font-bold]="day.isSelected"
                [class.bg-gray-100]="day.isToday && !day.isSelected"
                [class.font-semibold]="day.isToday"
                [class.hover:bg-indigo-100]="day.isCurrentMonth && !day.isSelected"
                [class.hover:text-indigo-600]="day.isCurrentMonth && !day.isSelected">
                {{ day.date }}
              </button>
            </div>
          </div>

          <!-- Botones de acción -->
          <div class="flex justify-end space-x-2 p-6 pt-0">
            <button
              type="button"
              (click)="cancel()"
              class="px-6 py-2 text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg transition-colors">
              CANCELAR
            </button>
            <button
              type="button"
              (click)="confirm()"
              class="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              ACEPTAR
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .picker-hidden {
      visibility: hidden !important;
      opacity: 0 !important;
    }
  `]
})
export class AndroidDatePickerComponent implements OnInit, OnDestroy, ControlValueAccessor {
  @Input() label = 'Fecha';
  @Input() placeholder = 'Seleccionar fecha';
  @Input() required = false;
  @Output() dateChange = new EventEmitter<string>();

  isOpen = false;
  isModalReady = false;  // Flag para controlar visibilidad después de mover al body
  selectedDate: Date | null = null;
  viewDate = new Date();
  calendarDays: CalendarDay[] = [];
  weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  
  private tempSelectedDate: Date | null = null;
  private originalDate: Date | null = null;
  private modalElement: HTMLElement | null = null;
  private modalContainer: HTMLElement | null = null;
  
  // ControlValueAccessor
  private onChange = (value: string) => {};
  private onTouched = () => {};
  touched = false;
  isValid = true;

  constructor(private elementRef: ElementRef) {}

  ngOnInit() {
    this.generateCalendar();
  }

  // Removed: Detectar clicks fuera del componente - Los modales ya no se cierran con click fuera

  // Detectar Escape key para cerrar
  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.isOpen) {
      this.cancel();
    }
  }

  // Removed: onBackdropMouseDown y onBackdropMouseUp - Los modales ya no se cierran con click fuera

  openPicker() {
    // Resetear flag de visibilidad - el modal se creará oculto
    this.isModalReady = false;
    
    this.isOpen = true;
    this.originalDate = this.selectedDate ? new Date(this.selectedDate) : null;
    this.tempSelectedDate = this.selectedDate ? new Date(this.selectedDate) : null;
    this.viewDate = this.selectedDate ? new Date(this.selectedDate) : new Date();
    this.generateCalendar();
    
    // Mover el modal al body INMEDIATAMENTE y luego hacerlo visible
    // Usamos requestAnimationFrame para esperar un frame de renderizado
    requestAnimationFrame(() => {
      const modal = this.elementRef.nativeElement.querySelector('.fixed.inset-0');
      if (modal && document.body) {
        this.modalElement = modal;
        this.modalContainer = modal.parentElement;
        document.body.appendChild(modal);
        
        // Ahora que está en el body, hacerlo visible
        this.isModalReady = true;
      }
    });
    
    // Bloquear scroll del body
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    (document.body as any).__scrollY = scrollY;
  }

  cancel() {
    this.isOpen = false;
    this.isModalReady = false;
    this.tempSelectedDate = this.originalDate;
    
    // Devolver el modal al contenedor original si fue movido
    if (this.modalElement && this.modalContainer) {
      this.modalContainer.appendChild(this.modalElement);
      this.modalElement = null;
      this.modalContainer = null;
    }
    
    const scrollY = (document.body as any).__scrollY || 0;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
    delete (document.body as any).__scrollY;
  }

  confirm() {
    if (this.tempSelectedDate) {
      this.selectedDate = new Date(this.tempSelectedDate);
      const dateString = this.formatDateForInput(this.selectedDate);
      this.onChange(dateString);
      this.dateChange.emit(dateString);
    }
    this.isOpen = false;
    this.isModalReady = false;
    
    // Devolver el modal al contenedor original si fue movido
    if (this.modalElement && this.modalContainer) {
      this.modalContainer.appendChild(this.modalElement);
      this.modalElement = null;
      this.modalContainer = null;
    }
    
    document.body.style.overflow = '';
  }
  
  ngOnDestroy() {
    // Limpiar el modal si está en el body
    if (this.modalElement && document.body.contains(this.modalElement)) {
      if (this.modalContainer) {
        this.modalContainer.appendChild(this.modalElement);
      } else {
        document.body.removeChild(this.modalElement);
      }
      this.modalElement = null;
      this.modalContainer = null;
    }
    
    // Asegurar que el scroll se desbloquee si el componente se destruye con el modal abierto
    if (this.isOpen) {
      document.body.style.overflow = '';
    }
  }

  selectDate(day: CalendarDay) {
    if (!day.isCurrentMonth) return;
    
    const selectedDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), day.date);
    this.tempSelectedDate = selectedDate;
    this.generateCalendar();
  }

  previousMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
    this.generateCalendar();
  }

  private generateCalendar() {
    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    
    // Primer día del mes
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Días del mes anterior para completar la primera fila
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Generar 42 días (6 semanas)
    this.calendarDays = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = this.isSameDate(currentDate, today);
      const isSelected = this.tempSelectedDate && this.isSameDate(currentDate, this.tempSelectedDate);
      
      this.calendarDays.push({
        date: currentDate.getDate(),
        isCurrentMonth,
        isToday,
        isSelected: !!isSelected,
        fullDate: new Date(currentDate)
      });
    }
  }

  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  }

  getMonthYearDisplay(): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${months[this.viewDate.getMonth()]} ${this.viewDate.getFullYear()}`;
  }

  formatDisplayDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  formatHeaderDate(date: Date): string {
    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
    
    return `${weekDays[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    if (value) {
      this.selectedDate = new Date(value + 'T00:00:00');
      this.viewDate = new Date(this.selectedDate);
      this.generateCalendar();
    } else {
      this.selectedDate = null;
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // Implementar si es necesario
  }
}

interface CalendarDay {
  date: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  fullDate: Date;
} 