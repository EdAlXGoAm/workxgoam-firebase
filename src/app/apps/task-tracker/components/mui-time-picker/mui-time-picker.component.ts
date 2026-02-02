import { Component, Input, Output, EventEmitter, forwardRef, OnInit, OnChanges, OnDestroy, SimpleChanges, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, ViewChild, AfterViewInit } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mui-time-picker',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
           (click)="onOverlayClick($event)">
        <div class="picker-modal" (click)="$event.stopPropagation()">
          <!-- Header con tiempo seleccionado -->
          <div class="picker-header">
            <!-- Tiempos de referencia -->
            <div *ngIf="cachedReferences.length > 0" class="reference-times">
              <div *ngFor="let ref of cachedReferences; trackBy: trackByRefTime" class="reference-time">
                <span class="reference-label">{{ ref.label }}:</span>
                <span class="reference-value">{{ ref.formattedTime }}</span>
              </div>
            </div>
            
            <div class="selected-time-display">
              <div class="time-digits">
                <span #hourDisplay class="hour-display" [class.selected]="currentView === 'hour'" (click)="setView('hour')">
                  {{ formattedHour }}
                </span>
                <span class="separator">:</span>
                <span #minuteDisplay class="minute-display" [class.selected]="currentView === 'minute'" (click)="setView('minute')">
                  {{ formattedMinute }}
                </span>
              </div>
              <div class="am-pm-selector">
                <button type="button"
                  (click)="setAMPM('AM')" 
                  [class.active]="ampm === 'AM'"
                  class="am-pm-btn">AM</button>
                <button type="button"
                  (click)="setAMPM('PM')" 
                  [class.active]="ampm === 'PM'"
                  class="am-pm-btn">PM</button>
              </div>
            </div>
          </div>
          
          <!-- Clock Container -->
          <div class="clock-container">
            <svg #clockSvg 
                 class="clock-face" 
                 viewBox="0 0 240 240" 
                 width="240" 
                 height="240">
              <!-- Círculo exterior del reloj -->
              <circle cx="120" cy="120" r="110" fill="none" stroke="#e0e0e0" stroke-width="1"/>
              
              <!-- Área interactiva transparente -->
              <circle cx="120" cy="120" r="110" fill="transparent" class="clock-interactive-area"/>
              
              <!-- Vista de Horas (siempre en DOM, se oculta con CSS) -->
              <g class="hour-numbers" [class.hidden]="currentView !== 'hour'">
                <!-- Elementos de hora con IDs para manipulación directa -->
                <circle *ngFor="let i of [0,1,2,3,4,5,6,7,8,9,10,11]"
                  [id]="'hour-circle-' + i"
                  [attr.cx]="hourPositions[i].x" 
                  [attr.cy]="hourPositions[i].y" 
                  r="20"
                  class="hour-circle"/>
                <text *ngFor="let i of [0,1,2,3,4,5,6,7,8,9,10,11]"
                  [id]="'hour-text-' + i"
                  [attr.x]="hourPositions[i].x" 
                  [attr.y]="hourPositions[i].y" 
                  text-anchor="middle" 
                  dominant-baseline="central"
                  class="hour-text">{{ hourNumbers[i] }}</text>
                
                <!-- Manecilla de hora -->
                <line id="hour-hand-line" x1="120" y1="120" x2="120" y2="40" stroke="#1565c0" stroke-width="2"/>
                <circle id="hour-hand-dot" cx="120" cy="40" r="4" fill="#1565c0"/>
                <circle cx="120" cy="120" r="4" fill="#1565c0"/>
              </g>

              <!-- Vista de Minutos (siempre en DOM, se oculta con CSS) -->
              <g class="minute-numbers" [class.hidden]="currentView !== 'minute'">
                <!-- Elementos de minuto con IDs para manipulación directa -->
                <circle *ngFor="let i of [0,1,2,3,4,5,6,7,8,9,10,11]"
                  [id]="'minute-circle-' + i"
                  [attr.cx]="minutePositions[i].x" 
                  [attr.cy]="minutePositions[i].y" 
                  r="16"
                  class="minute-circle"/>
                <text *ngFor="let i of [0,1,2,3,4,5,6,7,8,9,10,11]"
                  [id]="'minute-text-' + i"
                  [attr.x]="minutePositions[i].x" 
                  [attr.y]="minutePositions[i].y" 
                  text-anchor="middle" 
                  dominant-baseline="central"
                  class="minute-text">{{ minuteOptions[i].toString().padStart(2, '0') }}</text>
                
                <!-- Manecilla de minuto -->
                <line id="minute-hand-line" x1="120" y1="120" x2="120" y2="40" stroke="#1565c0" stroke-width="2"/>
                <circle id="minute-hand-dot" cx="120" cy="40" r="4" fill="#1565c0"/>
                <circle cx="120" cy="120" r="4" fill="#1565c0"/>
              </g>
            </svg>
          </div>
          
          <!-- Actions -->
          <div class="picker-actions">
            <button type="button" (click)="cancelSelection($event)" class="cancel-btn">CANCELAR</button>
            <button type="button" (click)="confirmTime($event)" class="ok-btn">OK</button>
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
      touch-action: none;
    }
    
    .clock-face {
      user-select: none;
      cursor: pointer;
      touch-action: none;
    }
    
    .clock-interactive-area {
      cursor: pointer;
    }
    
    .hour-circle, .minute-circle {
      fill: transparent;
      cursor: pointer;
      pointer-events: none;
    }
    
    .hour-circle.selected, .minute-circle.selected {
      fill: #1565c0;
    }
    
    .hour-text, .minute-text {
      font-size: 16px;
      cursor: pointer;
      fill: #333;
      font-weight: 400;
      pointer-events: none;
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
    
    .hidden {
      display: none;
    }
  `]
})
export class MuiTimePickerComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit, ControlValueAccessor {
  @ViewChild('clockSvg') clockSvg!: ElementRef<SVGSVGElement>;
  @ViewChild('hourDisplay') hourDisplayEl!: ElementRef<HTMLSpanElement>;
  @ViewChild('minuteDisplay') minuteDisplayEl!: ElementRef<HTMLSpanElement>;
  
  @Input() label: string = 'Seleccionar hora';
  @Input() placeholder: string = 'HH:MM AM/PM';
  @Input() referenceTime: string = '';
  @Input() referenceLabel: string = '';
  @Input() referenceTimes: { time: string, label: string }[] = [];
  @Output() timeChange = new EventEmitter<string>();

  isPickerOpen = false;
  selectedHour = 12;
  selectedMinute = 0;
  ampm: 'AM' | 'PM' = 'AM';
  currentView: 'hour' | 'minute' = 'hour';
  
  // Valores formateados para el header
  formattedHour = '12';
  formattedMinute = '00';
  
  // Arrays estáticos
  readonly hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  readonly minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  
  // Posiciones pre-calculadas
  readonly hourPositions: { x: number, y: number }[];
  readonly minutePositions: { x: number, y: number }[];
  
  // Referencias cacheadas
  cachedReferences: { time: string, label: string, formattedTime: string }[] = [];
  
  private value: string = '';
  private onChange = (value: string) => {};
  private onTouched = () => {};
  
  // Estado del drag
  private isDragging = false;
  private readonly CENTER = { x: 120, y: 120 };
  private readonly RADIUS = 80;
  
  // ===== CACHE DE ELEMENTOS DOM PARA MANIPULACIÓN DIRECTA =====
  private hourCircles: SVGCircleElement[] = [];
  private hourTexts: SVGTextElement[] = [];
  private minuteCircles: SVGCircleElement[] = [];
  private minuteTexts: SVGTextElement[] = [];
  private hourHandLine: SVGLineElement | null = null;
  private hourHandDot: SVGCircleElement | null = null;
  private minuteHandLine: SVGLineElement | null = null;
  private minuteHandDot: SVGCircleElement | null = null;
  
  // Índices actuales para saber qué elemento tiene la clase selected
  private currentHourIndex = 0;
  private currentMinuteIndex = 0;
  
  // Event listeners para cleanup
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundTouchMove: ((e: TouchEvent) => void) | null = null;
  private boundTouchEnd: ((e: TouchEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    // Pre-calcular posiciones
    this.hourPositions = this.hourNumbers.map((_, i) => {
      const angle = (i * 30 - 90) * Math.PI / 180;
      return {
        x: this.CENTER.x + this.RADIUS * Math.cos(angle),
        y: this.CENTER.y + this.RADIUS * Math.sin(angle)
      };
    });
    
    this.minutePositions = this.minuteOptions.map((_, i) => {
      const angle = (i * 30 - 90) * Math.PI / 180;
      return {
        x: this.CENTER.x + this.RADIUS * Math.cos(angle),
        y: this.CENTER.y + this.RADIUS * Math.sin(angle)
      };
    });
  }

  ngOnInit() {
    if (!this.value) {
      const now = new Date();
      this.selectedHour = now.getHours() > 12 ? now.getHours() - 12 : (now.getHours() === 0 ? 12 : now.getHours());
      this.selectedMinute = Math.round(now.getMinutes() / 5) * 5;
      if (this.selectedMinute >= 60) this.selectedMinute = 55;
      this.ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    }
    this.updateFormattedValues();
    this.currentHourIndex = this.hourNumbers.indexOf(this.selectedHour);
    this.currentMinuteIndex = this.minuteOptions.indexOf(this.selectedMinute);
    this.updateCachedReferences();
  }

  ngAfterViewInit() {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['referenceTime'] || changes['referenceLabel'] || changes['referenceTimes']) {
      this.updateCachedReferences();
    }
  }

  ngOnDestroy() {
    this.removeGlobalListeners();
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
    
    this.updateFormattedValues();
    this.currentHourIndex = this.hourNumbers.indexOf(this.selectedHour);
    this.currentMinuteIndex = this.minuteOptions.indexOf(this.selectedMinute);
    
    document.body.style.overflow = 'hidden';
    this.cdr.markForCheck();
    
    // Configurar después de que el DOM se actualice
    setTimeout(() => {
      this.cacheClockElements();
      this.initializeClockState();
      this.setupClockListeners();
    }, 0);
  }

  // ===== CACHE DE ELEMENTOS DOM =====
  private cacheClockElements() {
    if (!this.clockSvg?.nativeElement) return;
    
    const svg = this.clockSvg.nativeElement;
    
    // Cachear elementos de hora
    this.hourCircles = [];
    this.hourTexts = [];
    for (let i = 0; i < 12; i++) {
      const circle = svg.getElementById(`hour-circle-${i}`) as SVGCircleElement;
      const text = svg.getElementById(`hour-text-${i}`) as SVGTextElement;
      if (circle) this.hourCircles.push(circle);
      if (text) this.hourTexts.push(text);
    }
    
    // Cachear elementos de minuto
    this.minuteCircles = [];
    this.minuteTexts = [];
    for (let i = 0; i < 12; i++) {
      const circle = svg.getElementById(`minute-circle-${i}`) as SVGCircleElement;
      const text = svg.getElementById(`minute-text-${i}`) as SVGTextElement;
      if (circle) this.minuteCircles.push(circle);
      if (text) this.minuteTexts.push(text);
    }
    
    // Cachear manecillas
    this.hourHandLine = svg.getElementById('hour-hand-line') as SVGLineElement;
    this.hourHandDot = svg.getElementById('hour-hand-dot') as SVGCircleElement;
    this.minuteHandLine = svg.getElementById('minute-hand-line') as SVGLineElement;
    this.minuteHandDot = svg.getElementById('minute-hand-dot') as SVGCircleElement;
  }

  // ===== INICIALIZAR ESTADO VISUAL =====
  private initializeClockState() {
    // Establecer estado inicial de horas
    if (this.hourCircles.length > 0 && this.currentHourIndex >= 0) {
      this.hourCircles[this.currentHourIndex]?.classList.add('selected');
      this.hourTexts[this.currentHourIndex]?.classList.add('selected');
      this.updateHourHandDirect(this.currentHourIndex);
    }
    
    // Establecer estado inicial de minutos
    if (this.minuteCircles.length > 0 && this.currentMinuteIndex >= 0) {
      this.minuteCircles[this.currentMinuteIndex]?.classList.add('selected');
      this.minuteTexts[this.currentMinuteIndex]?.classList.add('selected');
      this.updateMinuteHandDirect(this.currentMinuteIndex);
    }
  }

  private setupClockListeners() {
    if (!this.clockSvg?.nativeElement) return;
    
    const svg = this.clockSvg.nativeElement;
    
    this.ngZone.runOutsideAngular(() => {
      svg.addEventListener('mousedown', this.onClockMouseDown.bind(this));
      svg.addEventListener('touchstart', this.onClockTouchStart.bind(this), { passive: false });
      
      this.boundKeyDown = this.onKeyDown.bind(this);
      document.addEventListener('keydown', this.boundKeyDown);
    });
  }

  private removeClockListeners() {
    if (this.clockSvg?.nativeElement) {
      const svg = this.clockSvg.nativeElement;
      svg.removeEventListener('mousedown', this.onClockMouseDown.bind(this));
      svg.removeEventListener('touchstart', this.onClockTouchStart.bind(this));
    }
    
    if (this.boundKeyDown) {
      document.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = null;
    }
  }

  private removeGlobalListeners() {
    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove);
      this.boundMouseMove = null;
    }
    if (this.boundMouseUp) {
      document.removeEventListener('mouseup', this.boundMouseUp);
      this.boundMouseUp = null;
    }
    if (this.boundTouchMove) {
      document.removeEventListener('touchmove', this.boundTouchMove);
      this.boundTouchMove = null;
    }
    if (this.boundTouchEnd) {
      document.removeEventListener('touchend', this.boundTouchEnd);
      this.boundTouchEnd = null;
    }
  }

  // ========== MOUSE EVENTS ==========
  private onClockMouseDown(e: MouseEvent) {
    e.preventDefault();
    this.isDragging = true;
    
    this.handleClockInteraction(e.clientX, e.clientY);
    
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    e.preventDefault();
    this.handleClockInteraction(e.clientX, e.clientY);
  }

  private onMouseUp(e: MouseEvent) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.removeGlobalListeners();
    
    if (this.currentView === 'hour') {
      this.ngZone.run(() => {
        this.currentView = 'minute';
        this.cdr.markForCheck();
      });
    }
  }

  // ========== TOUCH EVENTS ==========
  private onClockTouchStart(e: TouchEvent) {
    e.preventDefault();
    this.isDragging = true;
    
    const touch = e.touches[0];
    this.handleClockInteraction(touch.clientX, touch.clientY);
    
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
    document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    document.addEventListener('touchend', this.boundTouchEnd);
  }

  private onTouchMove(e: TouchEvent) {
    if (!this.isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    this.handleClockInteraction(touch.clientX, touch.clientY);
  }

  private onTouchEnd(e: TouchEvent) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.removeGlobalListeners();
    
    if (this.currentView === 'hour') {
      this.ngZone.run(() => {
        this.currentView = 'minute';
        this.cdr.markForCheck();
      });
    }
  }

  // ========== CLOCK INTERACTION (MANIPULACIÓN DIRECTA DEL DOM) ==========
  private handleClockInteraction(clientX: number, clientY: number) {
    if (!this.clockSvg?.nativeElement) return;
    
    const svg = this.clockSvg.nativeElement;
    const rect = svg.getBoundingClientRect();
    
    const scaleX = 240 / rect.width;
    const scaleY = 240 / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    const dx = x - this.CENTER.x;
    const dy = y - this.CENTER.y;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    angle = (angle + 90 + 360) % 360;
    
    if (this.currentView === 'hour') {
      this.selectHourDirect(angle);
    } else {
      this.selectMinuteDirect(angle);
    }
  }

  // ===== SELECCIÓN DIRECTA DE HORA (SIN ANGULAR) =====
  private selectHourDirect(angle: number) {
    const newIndex = Math.round(angle / 30) % 12;
    
    if (newIndex !== this.currentHourIndex) {
      // Quitar selected del anterior
      this.hourCircles[this.currentHourIndex]?.classList.remove('selected');
      this.hourTexts[this.currentHourIndex]?.classList.remove('selected');
      
      // Agregar selected al nuevo
      this.hourCircles[newIndex]?.classList.add('selected');
      this.hourTexts[newIndex]?.classList.add('selected');
      
      // Actualizar manecilla directamente
      this.updateHourHandDirect(newIndex);
      
      // Actualizar estado interno
      this.currentHourIndex = newIndex;
      this.selectedHour = this.hourNumbers[newIndex];
      this.formattedHour = this.selectedHour.toString().padStart(2, '0');
      
      // Actualizar solo el header (mínimo uso de Angular)
      if (this.hourDisplayEl?.nativeElement) {
        this.hourDisplayEl.nativeElement.textContent = this.formattedHour;
      }
    }
  }

  // ===== SELECCIÓN DIRECTA DE MINUTO (SIN ANGULAR) =====
  private selectMinuteDirect(angle: number) {
    const newIndex = Math.round(angle / 30) % 12;
    
    if (newIndex !== this.currentMinuteIndex) {
      // Quitar selected del anterior
      this.minuteCircles[this.currentMinuteIndex]?.classList.remove('selected');
      this.minuteTexts[this.currentMinuteIndex]?.classList.remove('selected');
      
      // Agregar selected al nuevo
      this.minuteCircles[newIndex]?.classList.add('selected');
      this.minuteTexts[newIndex]?.classList.add('selected');
      
      // Actualizar manecilla directamente
      this.updateMinuteHandDirect(newIndex);
      
      // Actualizar estado interno
      this.currentMinuteIndex = newIndex;
      this.selectedMinute = this.minuteOptions[newIndex];
      this.formattedMinute = this.selectedMinute.toString().padStart(2, '0');
      
      // Actualizar solo el header
      if (this.minuteDisplayEl?.nativeElement) {
        this.minuteDisplayEl.nativeElement.textContent = this.formattedMinute;
      }
    }
  }

  // ===== ACTUALIZAR MANECILLAS DIRECTAMENTE =====
  private updateHourHandDirect(index: number) {
    const pos = this.hourPositions[index];
    if (this.hourHandLine) {
      this.hourHandLine.setAttribute('x2', pos.x.toString());
      this.hourHandLine.setAttribute('y2', pos.y.toString());
    }
    if (this.hourHandDot) {
      this.hourHandDot.setAttribute('cx', pos.x.toString());
      this.hourHandDot.setAttribute('cy', pos.y.toString());
    }
  }

  private updateMinuteHandDirect(index: number) {
    const pos = this.minutePositions[index];
    if (this.minuteHandLine) {
      this.minuteHandLine.setAttribute('x2', pos.x.toString());
      this.minuteHandLine.setAttribute('y2', pos.y.toString());
    }
    if (this.minuteHandDot) {
      this.minuteHandDot.setAttribute('cx', pos.x.toString());
      this.minuteHandDot.setAttribute('cy', pos.y.toString());
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.isPickerOpen) {
      this.ngZone.run(() => {
        this.cancelSelection();
      });
    }
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('picker-overlay')) {
      this.cancelSelection();
    }
  }

  cancelSelection(event?: MouseEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isPickerOpen = false;
    this.isDragging = false;
    document.body.style.overflow = '';
    this.removeClockListeners();
    this.removeGlobalListeners();
    this.clearDomCache();
    this.cdr.markForCheck();
  }

  setView(view: 'hour' | 'minute') {
    this.currentView = view;
    this.cdr.markForCheck();
  }

  setAMPM(period: 'AM' | 'PM') {
    this.ampm = period;
    this.cdr.markForCheck();
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
    
    this.isPickerOpen = false;
    document.body.style.overflow = '';
    this.removeClockListeners();
    this.removeGlobalListeners();
    this.clearDomCache();
    this.cdr.markForCheck();
  }

  private clearDomCache() {
    this.hourCircles = [];
    this.hourTexts = [];
    this.minuteCircles = [];
    this.minuteTexts = [];
    this.hourHandLine = null;
    this.hourHandDot = null;
    this.minuteHandLine = null;
    this.minuteHandDot = null;
  }

  // ========== HELPER METHODS ==========
  private updateFormattedValues() {
    this.formattedHour = this.selectedHour.toString().padStart(2, '0');
    this.formattedMinute = this.selectedMinute.toString().padStart(2, '0');
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByRefTime(index: number, ref: { time: string }): string {
    return ref.time;
  }

  private parseTimeValue(timeString: string) {
    const [hours, minutes] = timeString.split(':').map(Number);
    this.selectedHour = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    
    const roundedMinutes = Math.round(minutes / 5) * 5;
    this.selectedMinute = roundedMinutes >= 60 ? 55 : roundedMinutes;
    
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

  // ControlValueAccessor
  writeValue(value: string): void {
    this.value = value || '';
    if (value && value.trim() !== '') {
      this.parseTimeValue(value);
    } else {
      const now = new Date();
      this.selectedHour = now.getHours() > 12 ? now.getHours() - 12 : (now.getHours() === 0 ? 12 : now.getHours());
      this.selectedMinute = Math.round(now.getMinutes() / 5) * 5;
      if (this.selectedMinute >= 60) this.selectedMinute = 55;
      this.ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    }
    this.updateFormattedValues();
    this.currentHourIndex = this.hourNumbers.indexOf(this.selectedHour);
    this.currentMinuteIndex = this.minuteOptions.indexOf(this.selectedMinute);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {}

  private formatReferenceTime(time: string): string {
    if (!time || !time.includes(':')) return '';
    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return '';
    const hour12 = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  private updateCachedReferences(): void {
    const references: { time: string, label: string, formattedTime: string }[] = [];
    
    if (this.referenceTimes && this.referenceTimes.length > 0) {
      for (const ref of this.referenceTimes) {
        if (ref.time && ref.label) {
          const formatted = this.formatReferenceTime(ref.time);
          if (formatted) {
            references.push({ ...ref, formattedTime: formatted });
          }
        }
      }
    }
    
    if (this.referenceTime && this.referenceLabel && !references.find(ref => ref.time === this.referenceTime)) {
      const formatted = this.formatReferenceTime(this.referenceTime);
      if (formatted) {
        references.push({ 
          time: this.referenceTime, 
          label: this.referenceLabel,
          formattedTime: formatted
        });
      }
    }
    
    this.cachedReferences = references;
  }
}
