import { Component, Input, OnInit, HostListener, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/task.model';
import { Environment } from '../../models/environment.model';

@Component({
  selector: 'app-timeline-svg',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #containerRef class="timeline-container w-full overflow-x-auto relative">
      <!-- Controles de Navegación de Fechas -->
      <div class="date-navigation mb-4 flex items-center justify-between bg-white rounded-lg p-3 shadow-sm border">
        <div class="flex items-center space-x-2">
          <button (click)="goToPreviousDay()" 
                  class="nav-btn flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  title="Día anterior">
            <i class="fas fa-chevron-left text-sm text-gray-600"></i>
          </button>
          
          <button (click)="goToToday()" 
                  [class.bg-indigo-100]="isToday()"
                  [class.text-indigo-700]="isToday()"
                  [class.bg-gray-100]="!isToday()"
                  [class.text-gray-700]="!isToday()"
                  class="nav-btn px-3 py-1 rounded-md text-sm font-medium hover:bg-indigo-50 transition-colors"
                  title="Ir a hoy">
            Hoy
          </button>
          
          <button (click)="goToNextDay()" 
                  class="nav-btn flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  title="Día siguiente">
            <i class="fas fa-chevron-right text-sm text-gray-600"></i>
          </button>
        </div>
        
        <div class="flex items-center space-x-3">
          <div class="date-display text-sm font-semibold text-gray-700">
            {{ formatSelectedDate() }}
          </div>
          
          <input type="date" 
                 [value]="getDateInputValue()"
                 (change)="onDateChange($event)"
                 class="date-picker px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
        </div>
      </div>

      <!-- Tooltip para mostrar información completa de la tarea -->
      <div *ngIf="showTooltip && tooltipTask" 
           class="tooltip-container absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl max-w-md">
        <div class="flex items-center space-x-2">
          <span class="text-lg">{{ tooltipTask.emoji }}</span>
          <div>
            <div class="font-semibold text-sm">{{ tooltipTask.name }}</div>
            <div *ngIf="tooltipTask.description" class="text-xs text-gray-300 mt-1">{{ tooltipTask.description }}</div>
            <div class="text-xs text-gray-400 mt-1">
              {{ formatTaskTime(tooltipTask.start) }} - {{ formatTaskTime(tooltipTask.end) }}
            </div>
          </div>
        </div>
        <!-- Flecha del tooltip -->
        <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-900"></div>
      </div>

      <!-- Contenedor centrado para el SVG -->
      <div class="svg-container flex justify-center overflow-x-auto">
        <svg [attr.width]="svgWidth" [attr.height]="svgHeight" [attr.viewBox]="'0 0 ' + svgWidth + ' ' + svgHeight" 
             class="timeline-svg" [style.min-width.px]="minSvgWidth">
          <!-- Tercio 1: 00:00 - 08:00 -->
          <g transform="translate(0, 0)">
            <rect x="0" y="0" [attr.width]="svgWidth" [attr.height]="sectionHeight" fill="#f0f4f8" rx="6" ry="6"/>
            <line x1="0" y1="40" [attr.x2]="svgWidth" y2="40" stroke="#888" stroke-width="1.5" />
            <text x="10" y="15" [attr.font-size]="titleFontSize" fill="#333" font-weight="bold">00:00 - 08:00</text>
            <g *ngFor="let hour of hoursPerSection[0]">
              <line [attr.x1]="getX(hour, 0)" y1="30" [attr.x2]="getX(hour, 0)" y2="50" stroke="#bbb" stroke-width="1" />
              <text [attr.x]="getX(hour, 0)" y="65" [attr.font-size]="hourFontSize" text-anchor="middle" fill="#666">{{ hour }}:00</text>
            </g>
            <g *ngFor="let task of getTasksForSection(0)">
              <!-- Borde negro exterior -->
              <rect [attr.x]="getTaskX(task, 0)" y="20" [attr.width]="getTaskWidth(task, 0)" height="40"
                    [attr.fill]="getTaskColor(task)" rx="6" ry="6" fill-opacity="0.8" 
                    stroke="rgba(0,0,0,0.6)" stroke-width="1.5" 
                    (click)="onTaskClick(task, $event)" class="cursor-pointer" />
              <!-- Borde blanco interior -->
              <rect [attr.x]="getTaskX(task, 0)" y="20" [attr.width]="getTaskWidth(task, 0)" height="40"
                    fill="none" rx="6" ry="6" 
                    stroke="rgba(255,255,255,0.8)" stroke-width="1" 
                    (click)="onTaskClick(task, $event)" class="cursor-pointer" />
              <text [attr.x]="getTaskX(task, 0) + 6" y="45" [attr.font-size]="taskFontSize" fill="#111" alignment-baseline="middle"
                    (click)="onTaskClick(task, $event)" class="cursor-pointer">
                {{ getTaskText(task, 0) }}
              </text>
            </g>
            <line *ngIf="isNowInSection(0)" [attr.x1]="getNowX(0)" y1="10" [attr.x2]="getNowX(0)" y2="70" stroke="#f87171" stroke-width="2" stroke-dasharray="4 2" />
          </g>

          <!-- Tercio 2: 08:00 - 16:00 -->
          <g [attr.transform]="'translate(0, ' + sectionHeight + ')'">
            <rect x="0" y="0" [attr.width]="svgWidth" [attr.height]="sectionHeight" fill="#e9eff5" rx="6" ry="6"/>
            <line x1="0" y1="40" [attr.x2]="svgWidth" y2="40" stroke="#888" stroke-width="1.5" />
            <text x="10" y="15" [attr.font-size]="titleFontSize" fill="#333" font-weight="bold">08:00 - 16:00</text>
            <g *ngFor="let hour of hoursPerSection[1]">
              <line [attr.x1]="getX(hour, 8)" y1="30" [attr.x2]="getX(hour, 8)" y2="50" stroke="#bbb" stroke-width="1" />
              <text [attr.x]="getX(hour, 8)" y="65" [attr.font-size]="hourFontSize" text-anchor="middle" fill="#666">{{ hour }}:00</text>
            </g>
            <g *ngFor="let task of getTasksForSection(1)">
              <!-- Borde negro exterior -->
              <rect [attr.x]="getTaskX(task, 8)" y="20" [attr.width]="getTaskWidth(task, 8)" height="40"
                    [attr.fill]="getTaskColor(task)" rx="6" ry="6" fill-opacity="0.8" 
                    stroke="rgba(0,0,0,0.6)" stroke-width="1.5" 
                    (click)="onTaskClick(task, $event)" class="cursor-pointer" />
              <!-- Borde blanco interior -->
              <rect [attr.x]="getTaskX(task, 8)" y="20" [attr.width]="getTaskWidth(task, 8)" height="40"
                    fill="none" rx="6" ry="6" 
                    stroke="rgba(255,255,255,0.8)" stroke-width="1" 
                    (click)="onTaskClick(task, $event)" class="cursor-pointer" />
              <text [attr.x]="getTaskX(task, 8) + 6" y="45" [attr.font-size]="taskFontSize" fill="#111" alignment-baseline="middle"
                    (click)="onTaskClick(task, $event)" class="cursor-pointer">
                {{ getTaskText(task, 8) }}
              </text>
            </g>
            <line *ngIf="isNowInSection(1)" [attr.x1]="getNowX(8)" y1="10" [attr.x2]="getNowX(8)" y2="70" stroke="#f87171" stroke-width="2" stroke-dasharray="4 2" />
          </g>

          <!-- Tercio 3: 16:00 - 24:00 -->
          <g [attr.transform]="'translate(0, ' + (sectionHeight * 2) + ')'">
            <rect x="0" y="0" [attr.width]="svgWidth" [attr.height]="sectionHeight" fill="#e2eaf0" rx="6" ry="6"/>
            <line x1="0" y1="40" [attr.x2]="svgWidth" y2="40" stroke="#888" stroke-width="1.5" />
            <text x="10" y="15" [attr.font-size]="titleFontSize" fill="#333" font-weight="bold">16:00 - 24:00</text>
            <g *ngFor="let hour of hoursPerSection[2]">
              <line [attr.x1]="getX(hour, 16)" y1="30" [attr.x2]="getX(hour, 16)" y2="50" stroke="#bbb" stroke-width="1" />
              <text [attr.x]="getX(hour, 16)" y="65" [attr.font-size]="hourFontSize" text-anchor="middle" fill="#666">{{ hour }}:00</text>
            </g>
            <g *ngFor="let task of getTasksForSection(2)">
              <!-- Borde negro exterior -->
              <rect [attr.x]="getTaskX(task, 16)" y="20" [attr.width]="getTaskWidth(task, 16)" height="40"
                    [attr.fill]="getTaskColor(task)" rx="6" ry="6" fill-opacity="0.8" 
                    stroke="rgba(0,0,0,0.6)" stroke-width="1.5" 
                    (click)="onTaskClick(task, $event)" class="cursor-pointer" />
              <!-- Borde blanco interior -->
              <rect [attr.x]="getTaskX(task, 16)" y="20" [attr.width]="getTaskWidth(task, 16)" height="40"
                    fill="none" rx="6" ry="6" 
                    stroke="rgba(255,255,255,0.8)" stroke-width="1" 
                    (click)="onTaskClick(task, $event)" class="cursor-pointer" />
              <text [attr.x]="getTaskX(task, 16) + 6" y="45" [attr.font-size]="taskFontSize" fill="#111" alignment-baseline="middle"
                    (click)="onTaskClick(task, $event)" class="cursor-pointer">
                {{ getTaskText(task, 16) }}
              </text>
            </g>
            <line *ngIf="isNowInSection(2)" [attr.x1]="getNowX(16)" y1="10" [attr.x2]="getNowX(16)" y2="70" stroke="#f87171" stroke-width="2" stroke-dasharray="4 2" />
          </g>
        </svg>
      </div>
    </div>
  `,
  styles: [`
    .timeline-container {
      padding: 8px;
      background: #f9fafb;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      position: relative; /* Asegurar que sea el contenedor de referencia */
    }
    
    .timeline-svg {
      display: block;
      background: #f9fafb;
      border-radius: 12px;
    }

    /* Controles de navegación de fechas */
    .date-navigation {
      backdrop-filter: blur(10px);
    }
    
    .nav-btn {
      user-select: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .nav-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .nav-btn:active {
      transform: translateY(0);
    }
    
    .date-display {
      min-width: 120px;
      text-align: center;
    }
    
    .date-picker {
      min-width: 120px;
    }
    
    .date-picker:focus {
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
    
    /* Personalización del scroll horizontal para móviles */
    .timeline-container::-webkit-scrollbar {
      height: 6px;
    }
    
    .timeline-container::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    
    .timeline-container::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }
    
    .timeline-container::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
    
    /* Para Firefox */
    .timeline-container {
      scrollbar-width: thin;
      scrollbar-color: #c1c1c1 #f1f1f1;
    }

    /* Estilos para el tooltip */
    .tooltip-container {
      animation: fadeIn 0.2s ease-in-out;
      pointer-events: none;
      z-index: 1000;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-50%) translateY(-5px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* Cursor pointer para elementos clickeables */
    .cursor-pointer {
      cursor: pointer;
    }

    /* Efecto hover para las tareas */
    .cursor-pointer:hover {
      opacity: 0.9;
      filter: brightness(1.1);
    }
  `]
})
export class TimelineSvgComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() tasks: Task[] = [];
  @Input() environments: Environment[] = [];

  @ViewChild('containerRef') containerRef!: ElementRef<HTMLDivElement>;

  // 📅 NAVEGACIÓN DE FECHAS
  selectedDate: Date = new Date(); // Fecha actualmente seleccionada
  
  // 💡 SISTEMA DE TOOLTIP
  showTooltip: boolean = false;
  tooltipTask: Task | null = null;
  tooltipTimeout: any = null;

  // Propiedades de dimensiones responsive
  svgWidth = 600; // Ancho inicial por defecto
  minSvgWidth = 320; // Ancho mínimo para móviles muy pequeños
  sectionHeight = 100; // Altura de cada sección de 8 horas
  svgHeight = this.sectionHeight * 3; // Altura total del SVG

  // 🎯 VARIABLE DE CALIBRACIÓN GLOBAL
  // Ajusta este valor para cambiar el tamaño general del timeline
  // 1.0 = 100%, 0.8 = 80%, 1.2 = 120%, etc.
  private widthScale: number = 0.7;

  // Tamaños de fuente responsivos
  titleFontSize = 12;
  hourFontSize = 10;
  taskFontSize = 12;

  // Observer para cambios de tamaño del contenedor
  private resizeObserver?: ResizeObserver;
  private containerPadding = 16; // Padding del contenedor

  // 📏 OFFSETS HORIZONTALES PARA LAS HORAS
  // Espaciado adicional al inicio y final para que las horas se vean completas
  private hourOffsetStart = 25; // Offset al inicio (primera hora)
  private hourOffsetEnd = 25;   // Offset al final (última hora)

  hoursPerSection: number[][] = [
    Array.from({length: 9}, (_, i) => i),       // 0-8 (incluye hora final)
    Array.from({length: 9}, (_, i) => i + 8),   // 8-16 (incluye hora final)
    Array.from({length: 9}, (_, i) => i + 16)   // 16-24 (incluye hora final)
  ];
  
  // Método utilitario para convertir fechas UTC de la base de datos a hora local
  private parseUTCToLocal(dateTimeString: string): Date {
    // Asegurar que el string se interprete como UTC añadiendo 'Z' si no lo tiene
    const utcString = dateTimeString + (dateTimeString.includes('Z') ? '' : 'Z');
    return new Date(utcString);
  }

  ngOnInit() {
    this.updateSvgDimensions();
  }

  ngAfterViewInit() {
    this.initializeResizeObserver();
    // Pequeño delay para asegurar que el contenedor esté completamente renderizado
    setTimeout(() => {
      this.updateSvgDimensions();
    }, 100);
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    // Limpiar timeout del tooltip
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.updateSvgDimensions();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Cerrar tooltip si se hace click fuera del timeline
    if (this.showTooltip) {
      this.hideTooltip();
    }
  }

  private initializeResizeObserver() {
    if (typeof ResizeObserver !== 'undefined' && this.containerRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateSvgDimensions();
      });
      this.resizeObserver.observe(this.containerRef.nativeElement);
    }
  }

  private updateSvgDimensions() {
    if (typeof window === 'undefined') {
      // Fallback para SSR
      this.svgWidth = Math.floor(600 * this.widthScale);
      this.updateFontSizes();
      return;
    }

    const screenWidth = window.innerWidth;
    let containerWidth = screenWidth;

    // Si tenemos acceso al contenedor, usar su ancho real
    if (this.containerRef?.nativeElement) {
      const rect = this.containerRef.nativeElement.getBoundingClientRect();
      containerWidth = rect.width;
    }

    // Calcular ancho disponible restando padding
    const availableWidth = Math.max(containerWidth - this.containerPadding, this.minSvgWidth);

    // Sistema de breakpoints más granular y responsivo (con escala aplicada)
    if (screenWidth <= 375) {
      // Móviles muy pequeños (iPhone SE, etc.)
      this.svgWidth = Math.floor(Math.max(availableWidth, this.minSvgWidth) * this.widthScale);
      this.titleFontSize = 10;
      this.hourFontSize = 8;
      this.taskFontSize = 10;
    } else if (screenWidth <= 480) {
      // Móviles pequeños
      this.svgWidth = Math.floor(Math.max(availableWidth * 1.2, 400) * this.widthScale);
      this.titleFontSize = 11;
      this.hourFontSize = 9;
      this.taskFontSize = 11;
    } else if (screenWidth <= 640) {
      // Móviles medianos / landscape
      this.svgWidth = Math.floor(Math.max(availableWidth * 1.4, 500) * this.widthScale);
      this.titleFontSize = 12;
      this.hourFontSize = 10;
      this.taskFontSize = 12;
    } else if (screenWidth <= 768) {
      // Tablets verticales
      this.svgWidth = Math.floor(Math.max(availableWidth * 0.9, 600) * this.widthScale);
      this.titleFontSize = 12;
      this.hourFontSize = 10;
      this.taskFontSize = 12;
    } else if (screenWidth <= 1024) {
      // Tablets horizontales / laptops pequeños
      this.svgWidth = Math.floor(Math.max(availableWidth * 0.95, 800) * this.widthScale);
      this.titleFontSize = 13;
      this.hourFontSize = 11;
      this.taskFontSize = 13;
    } else if (screenWidth <= 1280) {
      // Laptops
      this.svgWidth = Math.floor(Math.max(availableWidth * 0.98, 1000) * this.widthScale);
      this.titleFontSize = 14;
      this.hourFontSize = 12;
      this.taskFontSize = 14;
    } else {
      // Monitores grandes / escritorio
      this.svgWidth = Math.floor(Math.min(availableWidth * 0.98, 1400) * this.widthScale);
      this.titleFontSize = 14;
      this.hourFontSize = 12;
      this.taskFontSize = 14;
    }

    // Asegurar que el ancho no sea menor que el mínimo (también escalado)
    const scaledMinWidth = Math.floor(this.minSvgWidth * this.widthScale);
    this.svgWidth = Math.max(this.svgWidth, scaledMinWidth);
  }

  private updateFontSizes() {
    // Los tamaños de fuente ya se actualizan en updateSvgDimensions
    // Este método existe por si necesitamos lógica adicional en el futuro
  }

  // Método para truncar texto de tareas según el ancho disponible
  getTaskText(task: Task, sectionStartHour: number): string {
    const taskWidth = this.getTaskWidth(task, sectionStartHour); // Usar la sección correcta
    const emoji = task.emoji || '📋';
    const name = task.name || 'Sin título';
    
    // Ser MUCHO más generoso con el cálculo de caracteres disponibles
    const availableChars = Math.floor(taskWidth / (this.taskFontSize * 0.35)); // Factor más generoso aún
    
    // Umbrales más bajos para mostrar texto
    if (taskWidth < 20) {
      // Solo para tareas realmente diminutas
      return emoji;
    }
    
    // Calcular cuántos caracteres del nombre podemos mostrar
    const emojiSpace = 2; // Espacio que ocupa el emoji
    const ellipsisSpace = 3; // Espacio para "..."
    const availableForName = Math.max(availableChars - emojiSpace, 1);
    
    if (availableForName >= name.length) {
      // Cabe completo
      return `${emoji} ${name}`;
    } else if (availableForName >= 3) {
      // Truncar con puntos suspensivos (umbral más bajo)
      const truncatedLength = Math.max(availableForName - ellipsisSpace, 1);
      return `${emoji} ${name.substring(0, truncatedLength)}...`;
    } else if (availableForName >= 1) {
      // Mostrar al menos una letra
      return `${emoji} ${name.charAt(0)}`;
    } else {
      // Solo emoji
      return emoji;
    }
  }

  // Devuelve la posición X para una hora dentro de una sección (0-23)
  // sectionStartHour es la hora de inicio de la sección (0, 8, o 16)
  getX(hourInDay: number, sectionStartHour: number): number {
    const hourInSection = hourInDay - sectionStartHour;
    // Ancho efectivo sin los offsets
    const effectiveWidth = this.svgWidth - this.hourOffsetStart - this.hourOffsetEnd;
    // Cada sección representa 8 horas (aunque mostramos 9 incluyendo la final)
    return this.hourOffsetStart + (hourInSection / 8) * effectiveWidth;
  }

  getTaskX(task: Task, sectionStartHour: number): number {
    const taskActualStart = this.parseUTCToLocal(task.start);
    const taskActualStartHour = taskActualStart.getHours() + taskActualStart.getMinutes() / 60;

    // Determinar el inicio de la porción visible de la tarea dentro de esta sección
    const visiblePortionStartHourInDay = Math.max(taskActualStartHour, sectionStartHour);
    
    // Convertir este inicio visible a un desplazamiento desde el inicio de la sección
    const offsetFromSectionStart = visiblePortionStartHourInDay - sectionStartHour;
    
    // Ancho efectivo sin los offsets
    const effectiveWidth = this.svgWidth - this.hourOffsetStart - this.hourOffsetEnd;
    
    return this.hourOffsetStart + (offsetFromSectionStart / 8) * effectiveWidth;
  }

  getTaskWidth(task: Task, sectionStartHour: number): number {
    const start = this.parseUTCToLocal(task.start);
    const end = this.parseUTCToLocal(task.end);
    
    let taskStartHour = start.getHours() + start.getMinutes() / 60;
    let taskEndHour = end.getHours() + end.getMinutes() / 60;

    // Ajustar las horas de inicio y fin para que estén dentro de los límites de la sección
    taskStartHour = Math.max(taskStartHour, sectionStartHour);
    taskEndHour = Math.min(taskEndHour, sectionStartHour + 8);
    
    const durationInSection = taskEndHour - taskStartHour;
    
    if (durationInSection <= 0) return 0; // La tarea no está en esta parte de la sección o es inválida

    // Ancho efectivo sin los offsets
    const effectiveWidth = this.svgWidth - this.hourOffsetStart - this.hourOffsetEnd;
    
    return Math.max(8, (durationInSection / 8) * effectiveWidth);
  }

  getTasksForSection(sectionIndex: 0 | 1 | 2): Task[] {
    const sectionStartHour = sectionIndex * 8;
    const sectionEndHour = sectionStartHour + 8;

    return this.tasks.filter(task => {
      const taskStart = this.parseUTCToLocal(task.start);
      const taskEnd = this.parseUTCToLocal(task.end);
      
      // Verificar si la tarea está en la fecha seleccionada
      const taskDate = taskStart.toDateString();
      const selectedDateString = this.selectedDate.toDateString();
      
      if (taskDate !== selectedDateString) {
        return false; // La tarea no está en la fecha seleccionada
      }
      
      const taskStartHour = taskStart.getHours() + taskStart.getMinutes() / 60;
      const taskEndHour = taskEnd.getHours() + taskEnd.getMinutes() / 60;

      // La tarea se superpone con la sección si:
      // Su inicio es antes del fin de la sección Y su fin es después del inicio de la sección
      return taskStartHour < sectionEndHour && taskEndHour > sectionStartHour;
    });
  }
  
  getTaskColor(task: Task): string {
    if (task.environment && this.environments.length > 0) {
      const environment = this.environments.find(env => env.id === task.environment);
      if (environment && environment.color) {
        return environment.color;
      }
    }
    // Fallback a colores por prioridad si no hay environment o color
    // O puedes optar por un gris por defecto directamente:
    // return '#a3a3a3'; 
    switch (task.priority) {
      case 'low': return '#4ade80'; // Verde
      case 'medium': return '#60a5fa'; // Azul
      case 'high': return '#f87171'; // Rojo
      case 'critical': return '#f472b6'; // Rosa
      default: return '#a3a3a3'; // Gris
    }
  }

  getNowX(sectionStartHour: number): number {
    const now = new Date();
    const currentHourInDay = now.getHours() + now.getMinutes() / 60;
    const hourInSection = currentHourInDay - sectionStartHour;
    
    // Ancho efectivo sin los offsets
    const effectiveWidth = this.svgWidth - this.hourOffsetStart - this.hourOffsetEnd;
    
    return this.hourOffsetStart + (hourInSection / 8) * effectiveWidth;
  }

  isNowInSection(sectionIndex: 0 | 1 | 2): boolean {
    // Solo mostrar la línea de "ahora" si estamos viendo el día de hoy
    if (!this.isToday()) {
      return false;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const sectionStartHour = sectionIndex * 8;
    const sectionEndHour = sectionStartHour + 8;
    return currentHour >= sectionStartHour && currentHour < sectionEndHour;
  }

  /**
   * 🎯 Método público para cambiar la escala del timeline
   * @param scale Escala del timeline (ej: 0.8 = 80%, 1.2 = 120%)
   * @example
   * // Reducir al 70%
   * timelineComponent.setWidthScale(0.7);
   * 
   * // Aumentar al 110%
   * timelineComponent.setWidthScale(1.1);
   */
  public setWidthScale(scale: number): void {
    if (scale > 0 && scale <= 3) { // Límites razonables
      this.widthScale = scale;
      this.updateSvgDimensions();
    } else {
      console.warn('Timeline scale debe estar entre 0.1 y 3.0');
    }
  }

  /**
   * 🎯 Obtener la escala actual del timeline
   */
  public getWidthScale(): number {
    return this.widthScale;
  }

  /**
   * 📏 Configurar los offsets horizontales para las horas
   * @param startOffset Offset al inicio (por defecto 25px)
   * @param endOffset Offset al final (por defecto 25px)
   */
  public setHourOffsets(startOffset: number, endOffset: number): void {
    if (startOffset >= 0 && endOffset >= 0) {
      this.hourOffsetStart = startOffset;
      this.hourOffsetEnd = endOffset;
      // No es necesario llamar updateSvgDimensions ya que solo afecta las posiciones
    } else {
      console.warn('Los offsets deben ser valores positivos');
    }
  }

  /**
   * 📏 Obtener los offsets actuales
   */
  public getHourOffsets(): { start: number, end: number } {
    return {
      start: this.hourOffsetStart,
      end: this.hourOffsetEnd
    };
  }

  goToPreviousDay() {
    this.selectedDate.setDate(this.selectedDate.getDate() - 1);
    this.updateSvgDimensions();
  }

  goToToday() {
    this.selectedDate = new Date();
    this.updateSvgDimensions();
  }

  goToNextDay() {
    this.selectedDate.setDate(this.selectedDate.getDate() + 1);
    this.updateSvgDimensions();
  }

  formatSelectedDate() {
    return this.selectedDate.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric'
    });
  }

  getDateInputValue() {
    // Evitar problemas de zona horaria construyendo la fecha manualmente
    const year = this.selectedDate.getFullYear();
    const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      // Crear fecha en zona horaria local para evitar desfases
      const [year, month, day] = input.value.split('-').map(Number);
      this.selectedDate = new Date(year, month - 1, day); // month - 1 porque los meses en JS son 0-indexados
      this.updateSvgDimensions();
    }
  }

  isToday(): boolean {
    const today = new Date();
    return this.selectedDate.toDateString() === today.toDateString();
  }

  formatTaskTime(dateTimeString: string): string {
    if (!dateTimeString) return '';
    const date = this.parseUTCToLocal(dateTimeString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  /**
   * 🎯 Métodos públicos para navegación de fechas
   */
  
  /**
   * Ir a una fecha específica
   * @param date Fecha a la que navegar
   */
  public goToDate(date: Date): void {
    this.selectedDate = new Date(date);
    this.updateSvgDimensions();
  }

  /**
   * Obtener la fecha actualmente seleccionada
   */
  public getSelectedDate(): Date {
    return new Date(this.selectedDate);
  }

  /**
   * Navegar por semanas
   * @param direction 1 para siguiente semana, -1 para semana anterior
   */
  public navigateByWeek(direction: 1 | -1): void {
    this.selectedDate.setDate(this.selectedDate.getDate() + (7 * direction));
    this.updateSvgDimensions();
  }

  /**
   * Navegar por meses
   * @param direction 1 para siguiente mes, -1 para mes anterior
   */
  public navigateByMonth(direction: 1 | -1): void {
    this.selectedDate.setMonth(this.selectedDate.getMonth() + direction);
    this.updateSvgDimensions();
  }

  // 💡 Métodos para el sistema de tooltip
  onTaskClick(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    this.showTaskTooltip(task);
  }

  showTaskTooltip(task: Task): void {
    // Limpiar timeout previo si existe
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }

    this.tooltipTask = task;
    this.showTooltip = true;

    // Auto-ocultar después de 4 segundos
    this.tooltipTimeout = setTimeout(() => {
      this.hideTooltip();
    }, 4000);
  }

  hideTooltip(): void {
    this.showTooltip = false;
    this.tooltipTask = null;
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
  }
} 
