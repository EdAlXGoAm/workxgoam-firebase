import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, forwardRef, HostListener, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-android-date-picker',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
              {{ tempSelectedDate ? formatHeaderDate(tempSelectedDate) : 'Seleccionar fecha' }}
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
                {{ monthYearDisplay }}
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
              <div *ngFor="let day of weekDays; trackBy: trackByIndex" class="text-xs font-medium text-gray-500 text-center py-2">
                {{ day }}
              </div>
            </div>

            <!-- Calendario -->
            <div class="grid grid-cols-7 gap-1">
              <button
                *ngFor="let day of calendarDays; let i = index; trackBy: trackByDayIndex"
                type="button"
                (click)="selectDate(i)"
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
  isModalReady = false;
  selectedDate: Date | null = null;
  viewDate = new Date();
  calendarDays: CalendarDay[] = [];
  weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  
  // Valor pre-calculado para el header (evita llamar función en template)
  monthYearDisplay = '';
  
  tempSelectedDate: Date | null = null;
  private originalDate: Date | null = null;
  private modalElement: HTMLElement | null = null;
  private modalContainer: HTMLElement | null = null;
  
  // Índice del día seleccionado actualmente para optimizar actualizaciones
  private currentSelectedIndex: number = -1;
  
  // ControlValueAccessor
  private onChange = (value: string) => {};
  private onTouched = () => {};
  touched = false;
  isValid = true;

  constructor(
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.generateCalendar();
  }

  // Detectar Escape key para cerrar
  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.isOpen) {
      this.cancel();
    }
  }

  // ===== TRACK BY FUNCTIONS =====
  trackByIndex(index: number): number {
    return index;
  }

  trackByDayIndex(index: number, day: CalendarDay): number {
    // Usar el índice como key ya que las posiciones son fijas
    return index;
  }

  openPicker() {
    this.isModalReady = false;
    
    this.isOpen = true;
    this.originalDate = this.selectedDate ? new Date(this.selectedDate) : null;
    this.tempSelectedDate = this.selectedDate ? new Date(this.selectedDate) : null;
    this.viewDate = this.selectedDate ? new Date(this.selectedDate) : new Date();
    this.generateCalendar();
    this.cdr.markForCheck();
    
    requestAnimationFrame(() => {
      const modal = this.elementRef.nativeElement.querySelector('.fixed.inset-0');
      if (modal && document.body) {
        this.modalElement = modal;
        this.modalContainer = modal.parentElement;
        document.body.appendChild(modal);
        
        this.isModalReady = true;
        this.cdr.markForCheck();
      }
    });
    
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
    this.currentSelectedIndex = -1;
    
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
    this.cdr.markForCheck();
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
    this.currentSelectedIndex = -1;
    
    if (this.modalElement && this.modalContainer) {
      this.modalContainer.appendChild(this.modalElement);
      this.modalElement = null;
      this.modalContainer = null;
    }
    
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }
  
  ngOnDestroy() {
    if (this.modalElement && document.body.contains(this.modalElement)) {
      if (this.modalContainer) {
        this.modalContainer.appendChild(this.modalElement);
      } else {
        document.body.removeChild(this.modalElement);
      }
      this.modalElement = null;
      this.modalContainer = null;
    }
    
    if (this.isOpen) {
      document.body.style.overflow = '';
    }
  }

  // ===== OPTIMIZADO: Solo actualiza el día anterior y el nuevo =====
  selectDate(dayIndex: number) {
    const day = this.calendarDays[dayIndex];
    if (!day || !day.isCurrentMonth) return;
    
    // Deseleccionar el día anterior (si existe)
    if (this.currentSelectedIndex >= 0 && this.currentSelectedIndex < this.calendarDays.length) {
      this.calendarDays[this.currentSelectedIndex].isSelected = false;
    }
    
    // Seleccionar el nuevo día
    day.isSelected = true;
    this.currentSelectedIndex = dayIndex;
    
    // Actualizar la fecha temporal
    this.tempSelectedDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), day.date);
    
    this.cdr.markForCheck();
  }

  previousMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
    this.generateCalendar();
    this.cdr.markForCheck();
  }

  nextMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
    this.generateCalendar();
    this.cdr.markForCheck();
  }

  private generateCalendar() {
    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    
    // Actualizar el display del mes/año
    this.updateMonthYearDisplay();
    
    const firstDay = new Date(year, month, 1);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const today = new Date();
    this.currentSelectedIndex = -1;
    
    // Solo recrear el array si está vacío o si cambiamos de mes
    if (this.calendarDays.length !== 42) {
      this.calendarDays = new Array(42);
      for (let i = 0; i < 42; i++) {
        this.calendarDays[i] = { date: 0, isCurrentMonth: false, isToday: false, isSelected: false, fullDate: new Date() };
      }
    }
    
    // Actualizar los valores existentes en lugar de crear nuevos objetos
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = this.isSameDate(currentDate, today);
      const isSelected = this.tempSelectedDate && this.isSameDate(currentDate, this.tempSelectedDate);
      
      // Reutilizar el objeto existente
      const dayObj = this.calendarDays[i];
      dayObj.date = currentDate.getDate();
      dayObj.isCurrentMonth = isCurrentMonth;
      dayObj.isToday = isToday;
      dayObj.isSelected = !!isSelected;
      dayObj.fullDate.setTime(currentDate.getTime());
      
      if (isSelected) {
        this.currentSelectedIndex = i;
      }
    }
  }

  private updateMonthYearDisplay() {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    this.monthYearDisplay = `${months[this.viewDate.getMonth()]} ${this.viewDate.getFullYear()}`;
  }

  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
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
    this.cdr.markForCheck();
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
