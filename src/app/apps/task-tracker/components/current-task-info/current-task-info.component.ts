import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';

@Component({
  selector: 'app-current-task-info',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Burbuja Flotante -->
    <div class="floating-bubble" 
         [class.has-task]="currentTask"
         [class.no-task]="!currentTask"
         [class.dragging]="isDragging"
         [style.top.%]="bubbleTopPosition"
         (click)="onBubbleClick($event)"
         (mousedown)="onBubbleMouseDown($event)"
         (touchstart)="onBubbleTouchStart($event)"
         [title]="getBubbleTooltip()">
      <svg class="bubble-svg-content" viewBox="0 0 80 80" preserveAspectRatio="xMidYMid meet">
        <!-- Drag indicator (puntos arriba) -->
        <g class="drag-indicator-group">
          <circle cx="30" cy="8" r="1.5" fill="rgba(255, 255, 255, 0.6)"/>
          <circle cx="30" cy="12" r="1.5" fill="rgba(255, 255, 255, 0.6)"/>
          <circle cx="35" cy="8" r="1.5" fill="rgba(255, 255, 255, 0.6)"/>
          <circle cx="35" cy="12" r="1.5" fill="rgba(255, 255, 255, 0.6)"/>
          <circle cx="40" cy="8" r="1.5" fill="rgba(255, 255, 255, 0.6)"/>
          <circle cx="40" cy="12" r="1.5" fill="rgba(255, 255, 255, 0.6)"/>
          <circle cx="45" cy="8" r="1.5" fill="rgba(255, 255, 255, 0.6)"/>
          <circle cx="45" cy="12" r="1.5" fill="rgba(255, 255, 255, 0.6)"/>
          <circle cx="50" cy="8" r="1.5" fill="rgba(255, 255, 255, 0.6)"/>
          <circle cx="50" cy="12" r="1.5" fill="rgba(255, 255, 255, 0.6)"/>
        </g>
        
        <!-- Ícono dinámico (play-circle si hay tarea, clock si no) -->
        <g *ngIf="currentTask" class="bubble-icon-group" transform="translate(40, 25)">
          <!-- Play circle icon -->
          <circle cx="0" cy="0" r="9" stroke="white" stroke-width="1.5" fill="none"/>
          <polygon points="-2,-4 -2,4 5,0" fill="white"/>
        </g>
        
        <g *ngIf="!currentTask" class="bubble-icon-group" transform="translate(40, 25)">
          <!-- Clock icon -->
          <circle cx="0" cy="0" r="9" stroke="white" stroke-width="1.5" fill="none"/>
          <line x1="0" y1="0" x2="0" y2="-5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="0" y1="0" x2="4" y2="0" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </g>
        
        <!-- Tiempo (dinámico) -->
        <text x="40" y="48" 
              text-anchor="middle" 
              dominant-baseline="middle" 
              fill="white" 
              font-size="14" 
              font-weight="bold" 
              font-family="monospace"
              class="bubble-time-text">
          {{ getBubbleTime() }}
        </text>
        
        <!-- Label (dinámico) -->
        <text x="40" y="60" 
              text-anchor="middle" 
              dominant-baseline="middle" 
              fill="white" 
              font-size="6" 
              font-weight="normal" 
              letter-spacing="0.5"
              opacity="0.9"
              class="bubble-label-text">
          {{ getBubbleLabel().toUpperCase() }}
        </text>
      </svg>
    </div>

    <!-- Modal (cuando se hace click en la burbuja) -->
    <div *ngIf="isModalOpen" class="modal-backdrop" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 md:p-6 text-white shadow-lg">
          <!-- Header más compacto en móvil -->
          <div class="flex items-center justify-between mb-3 md:mb-4">
            <h2 class="text-lg md:text-2xl font-bold flex items-center gap-2">
              <i class="fas fa-play-circle text-base md:text-xl"></i>
              <span class="hidden sm:inline">Tarea Actual</span>
              <span class="sm:hidden">Actual</span>
            </h2>
            <button (click)="closeModal()" class="text-white hover:text-gray-200 transition-colors p-2 -mr-2">
              <i class="fas fa-times text-xl md:text-2xl"></i>
            </button>
          </div>
          
          <!-- Fecha/hora más compacta en móvil -->
          <div class="text-xs md:text-sm opacity-90 mb-3 md:mb-4">
            {{ getCurrentDateTime() }}
          </div>

          <div *ngIf="currentTask; else noCurrentTask" class="grid grid-cols-1 gap-4 md:gap-6">
            <!-- Información de la tarea actual -->
            <div class="bg-white/10 rounded-lg p-3 md:p-4 backdrop-blur-sm">
              <div class="flex items-start gap-2 mb-3">
                <span class="text-xl md:text-2xl flex-shrink-0">{{ currentTask.emoji }}</span>
                <div class="flex-1 min-w-0">
                  <h3 class="text-base md:text-lg font-semibold truncate">{{ currentTask.name }}</h3>
                  <p class="text-xs md:text-sm opacity-90 truncate">{{ getProjectName(currentTask.project) }}</p>
                </div>
              </div>
              
              <div class="space-y-2 text-xs md:text-sm">
                <div class="flex justify-between items-center">
                  <span class="text-xs md:text-sm">Transcurrido:</span>
                  <span class="font-mono font-bold text-sm md:text-base">{{ getElapsedTime() }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs md:text-sm">Restante:</span>
                  <span class="font-mono font-bold text-sm md:text-base">{{ getRemainingTime() }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs md:text-sm">Prioridad:</span>
                  <span class="px-2 py-0.5 md:py-1 rounded text-xs font-medium" [class]="getPriorityClass(currentTask.priority)">
                    {{ currentTask.priority }}
                  </span>
                </div>
              </div>

              <!-- Barra de progreso -->
              <div class="mt-3 md:mt-4">
                <div class="bg-white/20 rounded-full h-2">
                  <div class="bg-white rounded-full h-2 transition-all duration-300" 
                       [style.width.%]="getProgressPercentage()"></div>
                </div>
                <div class="text-xs mt-1 text-center">{{ getProgressPercentage() }}% completado</div>
              </div>
            </div>

            <!-- Información de la siguiente tarea -->
            <div class="bg-white/10 rounded-lg p-3 md:p-4 backdrop-blur-sm">
              <h4 class="text-base md:text-lg font-semibold mb-2 md:mb-3 flex items-center gap-2">
                <i class="fas fa-clock text-sm md:text-base"></i>
                <span class="hidden sm:inline">Siguiente Tarea</span>
                <span class="sm:hidden">Siguiente</span>
              </h4>
              
              <div *ngIf="nextTask; else noNextTask">
                <div class="flex items-start gap-2 mb-3">
                  <span class="text-xl md:text-2xl flex-shrink-0">{{ nextTask.emoji }}</span>
                  <div class="flex-1 min-w-0">
                    <h5 class="font-medium text-sm md:text-base truncate">{{ nextTask.name }}</h5>
                    <p class="text-xs md:text-sm opacity-90 truncate">{{ getProjectName(nextTask.project) }}</p>
                  </div>
                </div>
                
                <div class="space-y-2 text-xs md:text-sm">
                  <div class="flex justify-between items-center">
                    <span class="text-xs md:text-sm">Comienza en:</span>
                    <span class="font-mono font-bold text-sm md:text-base">{{ getTimeUntilNext() }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-xs md:text-sm">Duración:</span>
                    <span class="font-mono text-sm md:text-base">{{ getTaskRealDuration(nextTask) }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-xs md:text-sm">Horario:</span>
                    <span class="font-mono text-xs md:text-sm">{{ formatTime(nextTask.start) }} - {{ formatTime(nextTask.end) }}</span>
                  </div>
                </div>
              </div>
              
              <ng-template #noNextTask>
                <div class="text-center py-3 md:py-4 opacity-75">
                  <i class="fas fa-check-circle text-2xl md:text-3xl mb-2"></i>
                  <p class="text-xs md:text-sm">No hay más tareas programadas</p>
                </div>
              </ng-template>
            </div>
          </div>

          <ng-template #noCurrentTask>
            <div class="text-center py-6 md:py-8">
              <i class="fas fa-pause-circle text-3xl md:text-4xl mb-3 md:mb-4 opacity-60"></i>
              <h3 class="text-base md:text-xl font-semibold mb-2">No hay tarea activa</h3>
              <p class="opacity-90 text-xs md:text-sm px-4">
                <span *ngIf="nextTask">
                  La siguiente tarea "<strong>{{ nextTask.name }}</strong>" comienza {{ getTimeUntilNext() }}
                </span>
                <span *ngIf="!nextTask">
                  No hay tareas programadas para hoy
                </span>
              </p>
            </div>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .priority-low { background-color: #10b981; }
    .priority-medium { background-color: #f59e0b; }
    .priority-high { background-color: #ef4444; }
    .priority-critical { background-color: #dc2626; color: white; }
    
    /* Burbuja flotante */
    .floating-bubble {
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: move;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(59, 130, 246, 0.5);
      animation: pulse 2s infinite;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    
    .floating-bubble.dragging {
      cursor: grabbing;
      transform: translateY(-50%) scale(1.1);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(59, 130, 246, 0.5);
      animation: none;
      transition: none;
    }
    
    .floating-bubble.has-task {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }
    
    .floating-bubble.no-task {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    }
    
    .floating-bubble:hover {
      transform: translateY(-50%) scale(1.1);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(59, 130, 246, 0.5);
    }
    
    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(59, 130, 246, 0.5);
      }
      50% {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 15px rgba(59, 130, 246, 0);
      }
    }
    
    .bubble-svg-content {
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
    }
    
    .floating-bubble:hover .drag-indicator-group circle {
      fill: rgba(255, 255, 255, 0.9);
    }
    
    .bubble-time-text {
      user-select: none;
    }
    
    .bubble-label-text {
      user-select: none;
    }
    
    /* Modal */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      animation: fadeIn 0.2s ease-out;
      padding: 12px;
    }
    
    .modal-content {
      max-width: 900px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease-out;
      -webkit-overflow-scrolling: touch;
    }
    
    /* Optimizaciones para móviles */
    @media (max-width: 640px) {
      .modal-backdrop {
        padding: 8px;
        align-items: flex-start;
        padding-top: 40px;
      }
      
      .modal-content {
        max-height: calc(100vh - 48px);
        width: calc(100vw - 16px);
      }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* Responsivo para móviles */
    @media (max-width: 768px) {
      .floating-bubble {
        width: 70px;
        height: 70px;
        right: 15px;
      }
      
      .bubble-svg-content {
        width: 100%;
        height: 100%;
      }
      
      .bubble-time-text {
        font-size: 12px;
      }
      
      .bubble-label-text {
        font-size: 5px;
      }
      
      .drag-indicator-group circle {
        r: 1.2;
      }
    }
  `]
})
export class CurrentTaskInfoComponent implements OnInit, OnDestroy, OnChanges {
  @Input() tasks: Task[] = [];
  @Input() projects: Project[] = [];
  @Input() environments: Environment[] = [];

  currentTask: Task | null = null;
  nextTask: Task | null = null;
  isModalOpen: boolean = false;
  private intervalId: any;
  
  // Propiedades para drag and drop
  bubbleTopPosition: number = 50; // Porcentaje del viewport (50% = centrado)
  isDragging: boolean = false;
  private dragStartY: number = 0;
  private dragStartTop: number = 0;
  private lastDragEndTime: number = 0;

  ngOnInit() {
    this.loadBubblePosition();
    this.updateTaskInfo();
    // Actualizar cada 30 segundos para mejor responsividad
    this.intervalId = setInterval(() => {
      this.updateTaskInfo();
    }, 30000);
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    // Restaurar overflow del body por si acaso
    document.body.style.overflow = '';
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tasks'] || changes['projects'] || changes['environments']) {
      this.updateTaskInfo();
    }
  }

  private updateTaskInfo() {
    const now = new Date();
    const currentTime = now.getTime();

    console.log('Actualizando información de tareas...');
    console.log('Hora actual:', now.toISOString());
    console.log('Total de tareas:', this.tasks.length);

    // Buscar tarea actual
    this.currentTask = this.tasks.find(task => {
      if (task.completed || task.hidden) return false;
      
      // Asegurar que las fechas se interpreten correctamente
      const startTimeStr = task.start.includes('Z') ? task.start : task.start + 'Z';
      const endTimeStr = task.end.includes('Z') ? task.end : task.end + 'Z';
      
      const startTime = new Date(startTimeStr).getTime();
      const endTime = new Date(endTimeStr).getTime();
      
      const isActive = currentTime >= startTime && currentTime <= endTime;
      
      console.log(`Tarea: ${task.name}`);
      console.log(`  Inicio: ${task.start} -> ${new Date(startTimeStr).toLocaleString()}`);
      console.log(`  Fin: ${task.end} -> ${new Date(endTimeStr).toLocaleString()}`);
      console.log(`  Activa: ${isActive}`);
      
      return isActive;
    }) || null;

    // Buscar siguiente tarea
    const upcomingTasks = this.tasks
      .filter(task => {
        if (task.completed || task.hidden) return false;
        const startTimeStr = task.start.includes('Z') ? task.start : task.start + 'Z';
        const startTime = new Date(startTimeStr).getTime();
        return startTime > currentTime;
      })
      .sort((a, b) => {
        const aStartStr = a.start.includes('Z') ? a.start : a.start + 'Z';
        const bStartStr = b.start.includes('Z') ? b.start : b.start + 'Z';
        return new Date(aStartStr).getTime() - new Date(bStartStr).getTime();
      });

    this.nextTask = upcomingTasks[0] || null;

    console.log('Tarea actual encontrada:', this.currentTask?.name || 'Ninguna');
    console.log('Siguiente tarea:', this.nextTask?.name || 'Ninguna');
  }

  getCurrentDateTime(): string {
    return new Date().toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getProjectName(projectId: string): string {
    const project = this.projects.find(p => p.id === projectId);
    return project ? project.name : 'Sin proyecto';
  }

  getElapsedTime(): string {
    if (!this.currentTask) return '0:00';
    
    const now = new Date().getTime();
    const startTimeStr = this.currentTask.start.includes('Z') ? this.currentTask.start : this.currentTask.start + 'Z';
    const startTime = new Date(startTimeStr).getTime();
    const elapsed = Math.max(0, now - startTime);
    
    return this.formatDuration(elapsed / (1000 * 60)); // Convert to minutes
  }

  getRemainingTime(): string {
    if (!this.currentTask) return '0:00';
    
    const now = new Date().getTime();
    const endTimeStr = this.currentTask.end.includes('Z') ? this.currentTask.end : this.currentTask.end + 'Z';
    const endTime = new Date(endTimeStr).getTime();
    const remaining = Math.max(0, endTime - now);
    
    return this.formatDuration(remaining / (1000 * 60)); // Convert to minutes
  }

  getTimeUntilNext(): string {
    if (!this.nextTask) return '';
    
    const now = new Date().getTime();
    const startTimeStr = this.nextTask.start.includes('Z') ? this.nextTask.start : this.nextTask.start + 'Z';
    const startTime = new Date(startTimeStr).getTime();
    const timeUntil = startTime - now;
    
    if (timeUntil <= 0) return 'Ahora';
    
    const minutes = Math.floor(timeUntil / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `en ${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `en ${hours}h ${minutes % 60}m`;
    } else {
      return `en ${minutes}m`;
    }
  }

  getProgressPercentage(): number {
    if (!this.currentTask) return 0;
    
    const now = new Date().getTime();
    const startTimeStr = this.currentTask.start.includes('Z') ? this.currentTask.start : this.currentTask.start + 'Z';
    const endTimeStr = this.currentTask.end.includes('Z') ? this.currentTask.end : this.currentTask.end + 'Z';
    const startTime = new Date(startTimeStr).getTime();
    const endTime = new Date(endTimeStr).getTime();
    
    if (now <= startTime) return 0;
    if (now >= endTime) return 100;
    
    const total = endTime - startTime;
    const elapsed = now - startTime;
    
    return Math.round((elapsed / total) * 100);
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}`;
    }
    return `${mins}m`;
  }

  formatTime(timeString: string): string {
    const timeStr = timeString.includes('Z') ? timeString : timeString + 'Z';
    return new Date(timeStr).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getPriorityClass(priority: string): string {
    return `priority-${priority}`;
  }

  getTaskRealDuration(task: Task): string {
    if (!task.start || !task.end) return '0:00';
    
    const startTimeStr = task.start.includes('Z') ? task.start : task.start + 'Z';
    const endTimeStr = task.end.includes('Z') ? task.end : task.end + 'Z';
    
    const startTime = new Date(startTimeStr).getTime();
    const endTime = new Date(endTimeStr).getTime();
    
    const duration = Math.max(0, endTime - startTime);
    
    return this.formatDuration(duration / (1000 * 60)); // Convert to minutes
  }

  // Métodos para la burbuja flotante
  getBubbleTime(): string {
    if (this.currentTask) {
      // Si hay tarea actual, mostrar minutos restantes
      const now = new Date().getTime();
      const endTimeStr = this.currentTask.end.includes('Z') ? this.currentTask.end : this.currentTask.end + 'Z';
      const endTime = new Date(endTimeStr).getTime();
      const remaining = Math.max(0, endTime - now);
      const minutes = Math.floor(remaining / (1000 * 60));
      
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}:${mins.toString().padStart(2, '0')}`;
      }
      return `${minutes}m`;
    } else if (this.nextTask) {
      // Si no hay tarea actual pero sí siguiente, mostrar tiempo hasta la siguiente
      const now = new Date().getTime();
      const startTimeStr = this.nextTask.start.includes('Z') ? this.nextTask.start : this.nextTask.start + 'Z';
      const startTime = new Date(startTimeStr).getTime();
      const timeUntil = startTime - now;
      
      if (timeUntil <= 0) return 'Ya';
      
      const minutes = Math.floor(timeUntil / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      if (days > 0) {
        return `${days}d`;
      } else if (hours > 0) {
        return `${hours}h`;
      } else {
        return `${minutes}m`;
      }
    }
    return '--';
  }

  getBubbleLabel(): string {
    if (this.currentTask) {
      return 'Restante';
    } else if (this.nextTask) {
      return 'Próxima';
    }
    return 'Sin tareas';
  }

  getBubbleTooltip(): string {
    if (this.currentTask) {
      return `Tarea actual: ${this.currentTask.name}\nClick para ver detalles`;
    } else if (this.nextTask) {
      return `Próxima tarea: ${this.nextTask.name}\nClick para ver detalles`;
    }
    return 'No hay tareas programadas\nClick para ver detalles';
  }

  toggleModal(): void {
    console.log('🔄 toggleModal llamado, estado actual:', this.isModalOpen);
    this.isModalOpen = !this.isModalOpen;
    console.log('✅ Modal ahora está:', this.isModalOpen ? 'ABIERTO' : 'CERRADO');
    // Prevenir scroll del body cuando el modal está abierto
    if (this.isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
    document.body.style.overflow = '';
  }

  // Métodos para drag and drop de la burbuja
  onBubbleClick(event: MouseEvent): void {
    // Prevenir la apertura del modal si estamos o acabamos de hacer drag
    // El evento click se previene en mouseUpHandler cuando se maneja el click allí
    if (this.isDragging || Date.now() - this.lastDragEndTime < 500) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Fallback: solo abrir si mouseUpHandler no lo manejó (caso raro)
    // Esto es principalmente para móviles donde el evento click puede dispararse sin mouseup
    console.log('👆 Click en burbuja (fallback), abriendo modal');
    this.toggleModal();
  }

  onBubbleMouseDown(event: MouseEvent): void {
    console.log('🖱️ MouseDown en burbuja');
    // NO prevenir default aún, esperamos a ver si hay movimiento
    this.dragStartY = event.clientY;
    this.dragStartTop = this.bubbleTopPosition;
    let hasMoved = false;
    const startTime = Date.now();
    
    const mouseMoveHandler = (e: MouseEvent) => {
      const deltaY = Math.abs(e.clientY - this.dragStartY);
      
      // Solo iniciar drag si se movió más de 15 pixeles (aumentado para menos sensibilidad)
      if (!hasMoved && deltaY > 15) {
        console.log('✊ Movimiento detectado, iniciando drag (delta:', deltaY, 'px)');
        hasMoved = true;
        this.isDragging = true;
        event.preventDefault();
      }
      
      if (hasMoved) {
        this.onDragMove(e.clientY);
      }
    };
    
    const mouseUpHandler = (e: MouseEvent) => {
      const clickTime = Date.now() - startTime;
      console.log('🖱️ MouseUp, hasMoved:', hasMoved, 'clickTime:', clickTime);
      
      if (hasMoved) {
        this.endDrag();
        // Prevenir que el evento click se dispare después del drag
        e.preventDefault();
        e.stopPropagation();
        this.lastDragEndTime = Date.now();
      } else if (clickTime < 300) {
        // Si no hubo movimiento y fue un click rápido, abrir modal
        // Prevenir el evento click para evitar doble apertura
        e.preventDefault();
        e.stopPropagation();
        console.log('👆 Click detectado, abriendo modal');
        this.lastDragEndTime = Date.now();
        this.toggleModal();
      }
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };
    
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler, { once: true });
  }

  onBubbleTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    
    console.log('👆 TouchStart en burbuja');
    const touch = event.touches[0];
    this.dragStartY = touch.clientY;
    this.dragStartTop = this.bubbleTopPosition;
    let hasMoved = false;
    const startTime = Date.now();
    
    const touchMoveHandler = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const deltaY = Math.abs(e.touches[0].clientY - this.dragStartY);
        
        // Solo iniciar drag si se movió más de 20 pixeles (más en touch para compensar imprecisión)
        if (!hasMoved && deltaY > 20) {
          console.log('✊ Movimiento touch detectado, iniciando drag (delta:', deltaY, 'px)');
          hasMoved = true;
          this.isDragging = true;
          e.preventDefault();
        }
        
        if (hasMoved) {
          this.onDragMove(e.touches[0].clientY);
        }
      }
    };
    
    const touchEndHandler = (e: TouchEvent) => {
      const tapTime = Date.now() - startTime;
      console.log('👆 TouchEnd, hasMoved:', hasMoved, 'tapTime:', tapTime);
      
      if (hasMoved) {
        this.endDrag();
        this.lastDragEndTime = Date.now();
      } else if (tapTime < 300) {
        // Fue un tap rápido, abrir modal
        console.log('👆 Tap detectado, abriendo modal');
        this.lastDragEndTime = Date.now();
        this.toggleModal();
      }
      document.removeEventListener('touchmove', touchMoveHandler);
      document.removeEventListener('touchend', touchEndHandler);
    };
    
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('touchend', touchEndHandler, { once: true });
  }

  private startDrag(clientY: number): void {
    this.isDragging = true;
    this.dragStartY = clientY;
    this.dragStartTop = this.bubbleTopPosition;
  }

  private onDragMove(clientY: number): void {
    if (!this.isDragging) return;
    
    const deltaY = clientY - this.dragStartY;
    const viewportHeight = window.innerHeight;
    const deltaPercent = (deltaY / viewportHeight) * 100;
    
    let newTop = this.dragStartTop + deltaPercent;
    
    // Limitar entre 5% y 95% para que no se salga del viewport
    newTop = Math.max(5, Math.min(95, newTop));
    
    console.log('📍 Moviendo burbuja a:', newTop.toFixed(1) + '%');
    this.bubbleTopPosition = newTop;
  }

  private endDrag(): void {
    if (this.isDragging) {
      console.log('🏁 Finalizando drag');
      this.isDragging = false;
      this.lastDragEndTime = Date.now();
      this.saveBubblePosition();
    }
  }

  private saveBubblePosition(): void {
    try {
      localStorage.setItem('currentTaskInfo_bubblePosition', JSON.stringify(this.bubbleTopPosition));
      console.log('Posición de burbuja guardada:', this.bubbleTopPosition);
    } catch (error) {
      console.error('Error al guardar la posición de la burbuja:', error);
    }
  }

  private loadBubblePosition(): void {
    try {
      const saved = localStorage.getItem('currentTaskInfo_bubblePosition');
      if (saved) {
        const position = JSON.parse(saved);
        if (typeof position === 'number' && position >= 5 && position <= 95) {
          this.bubbleTopPosition = position;
          console.log('Posición de burbuja cargada:', this.bubbleTopPosition);
        }
      }
    } catch (error) {
      console.error('Error al cargar la posición de la burbuja:', error);
    }
  }
} 