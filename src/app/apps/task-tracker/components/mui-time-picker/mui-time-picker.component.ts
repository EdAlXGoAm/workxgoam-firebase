import { Component, Input, Output, EventEmitter, forwardRef, OnInit, HostListener, ElementRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mui-time-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MuiTimePickerComponent),
      multi: true
    }
  ],
  template: `
    <div class="mui-time-picker-wrapper">
      <input 
        type="text" 
        [value]="displayValue" 
        (click)="openPicker()"
        (focus)="openPicker()"
        readonly
        [placeholder]="placeholder"
        class="time-input">
      
      <!-- Modal del Time Picker -->
      <div *ngIf="isPickerOpen" 
           class="picker-overlay" 
           (mousedown)="onBackdropMouseDown($event)"
           (mouseup)="onBackdropMouseUp($event)">
        <div class="picker-modal" 
             (mousedown)="$event.stopPropagation()"
             (mouseup)="$event.stopPropagation()">
          <!-- Header con tiempo seleccionado -->
          <div class="picker-header">
            <!-- Tiempos de referencia (nueva versión) -->
            <div *ngIf="getAllReferences().length > 0" class="reference-times">
              <div *ngFor="let ref of getAllReferences()" class="reference-time">
                <span class="reference-label">{{ ref.label }}:</span>
                <span class="reference-value">{{ formatReferenceTime(ref.time) }}</span>
              </div>
            </div>
            
            <div class="selected-time-display">
              <div class="time-digits">
                <span class="hour-display" [class.selected]="currentView === 'hour'" (click)="setView('hour')">
                  {{ formatHour(selectedHour) }}
                </span>
                <span class="separator">:</span>
                <span class="minute-display" [class.selected]="currentView === 'minute'" (click)="setView('minute')">
                  {{ selectedMinute.toString().padStart(2, '0') }}
                </span>
              </div>
              <div class="am-pm-selector">
                <button 
                  (click)="setAMPM('AM')" 
                  [class.active]="ampm === 'AM'"
                  class="am-pm-btn">AM</button>
                <button 
                  (click)="setAMPM('PM')" 
                  [class.active]="ampm === 'PM'"
                  class="am-pm-btn">PM</button>
              </div>
            </div>
          </div>
          
          <!-- Clock Container -->
          <div class="clock-container">
            <!-- Vista de Horas -->
            <div *ngIf="currentView === 'hour'" class="clock-view">
              <svg class="clock-face" viewBox="0 0 240 240" width="240" height="240">
                <!-- Círculo exterior del reloj -->
                <circle cx="120" cy="120" r="110" fill="none" stroke="#e0e0e0" stroke-width="1"/>
                
                <!-- Números de las horas -->
                <g class="hour-numbers">
                  <g *ngFor="let hour of hourNumbers; let i = index">
                    <circle 
                      [attr.cx]="getHourPosition(i).x" 
                      [attr.cy]="getHourPosition(i).y" 
                      r="20"
                      [class.selected]="hour === selectedHour"
                      class="hour-circle"
                      (click)="selectHour(hour)"/>
                    <text 
                      [attr.x]="getHourPosition(i).x" 
                      [attr.y]="getHourPosition(i).y" 
                      text-anchor="middle" 
                      dominant-baseline="central"
                      class="hour-text"
                      [class.selected]="hour === selectedHour"
                      (click)="selectHour(hour)">
                      {{ hour }}
                    </text>
                  </g>
                </g>
                
                <!-- Línea que conecta el centro con la hora seleccionada -->
                <line 
                  x1="120" 
                  y1="120" 
                  [attr.x2]="hourHandPosition.x" 
                  [attr.y2]="hourHandPosition.y" 
                  stroke="#1565c0" 
                  stroke-width="2"/>
                
                <!-- Círculo en la hora seleccionada -->
                <circle 
                  [attr.cx]="hourHandPosition.x" 
                  [attr.cy]="hourHandPosition.y" 
                  r="4" 
                  fill="#1565c0"/>
                
                <!-- Centro del reloj -->
                <circle cx="120" cy="120" r="4" fill="#1565c0"/>
              </svg>
            </div>

            <!-- Vista de Minutos -->
            <div *ngIf="currentView === 'minute'" class="clock-view">
              <svg class="clock-face" viewBox="0 0 240 240" width="240" height="240">
                <!-- Círculo exterior del reloj -->
                <circle cx="120" cy="120" r="110" fill="none" stroke="#e0e0e0" stroke-width="1"/>
                
                <!-- Números de los minutos -->
                <g class="minute-numbers">
                  <g *ngFor="let minute of minuteOptions; let i = index">
                    <circle 
                      [attr.cx]="getMinutePosition(i).x" 
                      [attr.cy]="getMinutePosition(i).y" 
                      r="16"
                      [class.selected]="minute === selectedMinute"
                      class="minute-circle"
                      (click)="selectMinute(minute)"/>
                    <text 
                      [attr.x]="getMinutePosition(i).x" 
                      [attr.y]="getMinutePosition(i).y" 
                      text-anchor="middle" 
                      dominant-baseline="central"
                      class="minute-text"
                      [class.selected]="minute === selectedMinute"
                      (click)="selectMinute(minute)">
                      {{ minute.toString().padStart(2, '0') }}
                    </text>
                  </g>
                </g>
                
                <!-- Línea que conecta el centro con el minuto seleccionado -->
                <line 
                  x1="120" 
                  y1="120" 
                  [attr.x2]="minuteHandPosition.x" 
                  [attr.y2]="minuteHandPosition.y" 
                  stroke="#1565c0" 
                  stroke-width="2"/>
                
                <!-- Círculo en el minuto seleccionado -->
                <circle 
                  [attr.cx]="minuteHandPosition.x" 
                  [attr.cy]="minuteHandPosition.y" 
                  r="4" 
                  fill="#1565c0"/>
                
                <!-- Centro del reloj -->
                <circle cx="120" cy="120" r="4" fill="#1565c0"/>
              </svg>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="picker-actions">
            <button (click)="cancelSelection($event)" class="cancel-btn">CANCELAR</button>
            <button (click)="confirmTime($event)" class="ok-btn">OK</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mui-time-picker-wrapper {
      position: relative;
      width: 100%;
    }
    
    .time-input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      background: white;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    
    .time-input:focus {
      outline: none;
      border-color: #1565c0;
      box-shadow: 0 0 0 2px rgba(21, 101, 192, 0.2);
    }
    
    .picker-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1050;
    }
    
    .picker-modal {
      background: white;
      border-radius: 4px;
      width: 328px;
      max-width: 90vw;
      box-shadow: 0 11px 15px -7px rgba(0,0,0,0.2), 0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12);
      overflow: hidden;
    }
    
    .picker-header {
      background: #1565c0;
      color: white;
      padding: 16px 24px;
    }
    
    .reference-times {
      margin-bottom: 12px;
      font-size: 12px;
      opacity: 0.9;
    }
    
    .reference-time {
      margin-bottom: 4px;
      font-weight: 500;
    }
    
    .reference-label {
      opacity: 0.8;
    }
    
    .reference-value {
      background: rgba(255, 255, 255, 0.15);
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 500;
      font-size: 11px;
      margin-left: 4px;
    }
    
    .selected-time-display {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .time-digits {
      display: flex;
      align-items: center;
      font-size: 60px;
      font-weight: 400;
      line-height: 1;
    }
    
    .hour-display, .minute-display {
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    
    .hour-display.selected, .minute-display.selected {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .separator {
      margin: 0 4px;
      opacity: 0.7;
    }
    
    .am-pm-selector {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-left: 16px;
    }
    
    .am-pm-btn {
      background: none;
      border: none;
      color: white;
      font-size: 14px;
      font-weight: 500;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
      min-width: 32px;
    }
    
    .am-pm-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .am-pm-btn.active {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .clock-container {
      padding: 24px;
      display: flex;
      justify-content: center;
    }
    
    .clock-view {
      position: relative;
    }
    
    .clock-face {
      user-select: none;
    }
    
    .hour-circle, .minute-circle {
      fill: transparent;
      cursor: pointer;
      transition: fill 0.2s;
    }
    
    .hour-circle:hover, .minute-circle:hover {
      fill: rgba(21, 101, 192, 0.1);
    }
    
    .hour-circle.selected, .minute-circle.selected {
      fill: #1565c0;
    }
    
    .hour-text, .minute-text {
      font-size: 16px;
      cursor: pointer;
      fill: #333;
      transition: fill 0.2s;
      font-weight: 400;
    }
    
    .hour-text.selected, .minute-text.selected {
      fill: white;
      font-weight: 500;
    }
    
    .minute-text {
      font-size: 12px;
    }
    
    .picker-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px 16px 16px;
    }
    
    .cancel-btn, .ok-btn {
      background: none;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      text-transform: uppercase;
      transition: background-color 0.2s;
    }
    
    .cancel-btn {
      color: #666;
    }
    
    .cancel-btn:hover {
      background: rgba(0, 0, 0, 0.05);
    }
    
    .ok-btn {
      color: #1565c0;
    }
    
    .ok-btn:hover {
      background: rgba(21, 101, 192, 0.05);
    }
  `]
})
export class MuiTimePickerComponent implements OnInit, ControlValueAccessor {
  @Input() label: string = 'Seleccionar hora';
  @Input() placeholder: string = 'HH:MM AM/PM';
  @Input() referenceTime: string = ''; // Tiempo de referencia a mostrar (mantenido para compatibilidad)
  @Input() referenceLabel: string = ''; // Etiqueta para el tiempo de referencia (mantenido para compatibilidad)
  @Input() referenceTimes: { time: string, label: string }[] = []; // Múltiples referencias de tiempo
  @Output() timeChange = new EventEmitter<string>();

  isPickerOpen = false;
  selectedHour = 12;
  selectedMinute = 0;
  ampm = 'AM';
  currentView: 'hour' | 'minute' = 'hour';
  
  hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  
  private value: string = '';
  private onChange = (value: string) => {};
  private onTouched = () => {};
  private backdropMouseDownPos: { x: number, y: number } | null = null;

  constructor(private elementRef: ElementRef) {}

  ngOnInit() {
    // Inicializar con hora actual si no hay valor
    if (!this.value) {
      const now = new Date();
      this.selectedHour = now.getHours() > 12 ? now.getHours() - 12 : (now.getHours() === 0 ? 12 : now.getHours());
      this.selectedMinute = Math.round(now.getMinutes() / 5) * 5;
      this.ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    }
  }

  // Detectar clicks fuera del componente
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.isPickerOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.cancelSelection();
    }
  }

  // Detectar Escape key para cerrar
  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.isPickerOpen) {
      this.cancelSelection();
    }
  }

  onBackdropMouseDown(event: MouseEvent) {
    // Guardar la posición del mousedown para comparar con mouseup
    this.backdropMouseDownPos = { x: event.clientX, y: event.clientY };
  }

  onBackdropMouseUp(event: MouseEvent) {
    // Solo cerrar si el mouseup está cerca del mousedown (es un click, no un drag)
    if (this.backdropMouseDownPos) {
      const deltaX = Math.abs(event.clientX - this.backdropMouseDownPos.x);
      const deltaY = Math.abs(event.clientY - this.backdropMouseDownPos.y);
      const threshold = 5; // Píxeles de tolerancia para considerar que es un click
      
      if (deltaX <= threshold && deltaY <= threshold) {
        this.cancelSelection();
      }
    }
    
    this.backdropMouseDownPos = null;
  }

  get displayValue(): string {
    if (!this.value) return '';
    return this.formatTime(this.value);
  }

  openPicker() {
    if (this.value) {
      this.parseTimeValue(this.value);
    }
    this.currentView = 'hour';
    this.isPickerOpen = true;
    this.onTouched();
    
    // Bloquear scroll del body
    document.body.style.overflow = 'hidden';
  }

  cancelSelection(event?: MouseEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isPickerOpen = false;
    this.backdropMouseDownPos = null;
    document.body.style.overflow = '';
  }

  setView(view: 'hour' | 'minute') {
    this.currentView = view;
  }

  selectHour(hour: number) {
    this.selectedHour = hour;
    // Cambiar automáticamente a vista de minutos después de seleccionar hora
    setTimeout(() => {
      this.currentView = 'minute';
    }, 200);
  }

  selectMinute(minute: number) {
    this.selectedMinute = minute;
  }

  setAMPM(period: 'AM' | 'PM') {
    this.ampm = period;
  }

  confirmTime(event?: MouseEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    const hour24 = this.convertTo24Hour(this.selectedHour, this.ampm);
    const timeString = `${hour24.toString().padStart(2, '0')}:${this.selectedMinute.toString().padStart(2, '0')}`;
    
    this.value = timeString;
    this.onChange(timeString);
    this.timeChange.emit(timeString);
    
    // Usar setTimeout para asegurar que el estado se actualice correctamente
    setTimeout(() => {
      this.isPickerOpen = false;
      this.backdropMouseDownPos = null;
      document.body.style.overflow = '';
    }, 50);
  }

  formatHour(hour: number): string {
    return hour.toString().padStart(2, '0');
  }

  getHourPosition(index: number): { x: number, y: number } {
    const angle = (index * 30 - 90) * Math.PI / 180; // -90 para empezar en 12
    const radius = 80;
    return {
      x: 120 + radius * Math.cos(angle),
      y: 120 + radius * Math.sin(angle)
    };
  }

  getMinutePosition(index: number): { x: number, y: number } {
    const angle = (index * 30 - 90) * Math.PI / 180; // 12 posiciones para 60 minutos
    const radius = 80;
    return {
      x: 120 + radius * Math.cos(angle),
      y: 120 + radius * Math.sin(angle)
    };
  }

  get hourHandPosition(): { x: number, y: number } {
    const hourIndex = this.hourNumbers.indexOf(this.selectedHour);
    const angle = (hourIndex * 30 - 90) * Math.PI / 180;
    const radius = 80;
    return {
      x: 120 + radius * Math.cos(angle),
      y: 120 + radius * Math.sin(angle)
    };
  }

  get minuteHandPosition(): { x: number, y: number } {
    const minuteIndex = this.minuteOptions.indexOf(this.selectedMinute);
    const angle = (minuteIndex * 30 - 90) * Math.PI / 180;
    const radius = 80;
    return {
      x: 120 + radius * Math.cos(angle),
      y: 120 + radius * Math.sin(angle)
    };
  }

  private parseTimeValue(timeString: string) {
    const [hours, minutes] = timeString.split(':').map(Number);
    this.selectedHour = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    this.selectedMinute = minutes;
    this.ampm = hours >= 12 ? 'PM' : 'AM';
  }

  private convertTo24Hour(hour: number, ampm: string): number {
    if (ampm === 'AM') {
      return hour === 12 ? 0 : hour;
    } else {
      return hour === 12 ? 12 : hour + 12;
    }
  }

  private formatTime(timeString: string): string {
    const [hours, minutes] = timeString.split(':').map(Number);
    const hour12 = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.value = value || '';
    if (value && value.trim() !== '') {
      this.parseTimeValue(value);
    } else {
      // Si no hay valor, usar valores por defecto
      const now = new Date();
      this.selectedHour = now.getHours() > 12 ? now.getHours() - 12 : (now.getHours() === 0 ? 12 : now.getHours());
      this.selectedMinute = Math.round(now.getMinutes() / 5) * 5;
      this.ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    // Implementar si es necesario
  }

  formatReferenceTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const hour12 = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  getAllReferences(): { time: string, label: string }[] {
    const references: { time: string, label: string }[] = [];
    
    // Agregar referencias múltiples si existen
    if (this.referenceTimes && this.referenceTimes.length > 0) {
      references.push(...this.referenceTimes);
    }
    
    // Agregar referencia única si existe (para compatibilidad hacia atrás)
    if (this.referenceTime && this.referenceLabel && !references.find(ref => ref.time === this.referenceTime)) {
      references.push({ time: this.referenceTime, label: this.referenceLabel });
    }
    
    return references;
  }
} 