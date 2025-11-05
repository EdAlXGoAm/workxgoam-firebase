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
         (click)="toggleModal()"
         [title]="getBubbleTooltip()">
      <div class="bubble-content">
        <div class="bubble-icon">
          <i class="fas" [class.fa-play-circle]="currentTask" [class.fa-clock]="!currentTask"></i>
        </div>
        <div class="bubble-time">
          {{ getBubbleTime() }}
        </div>
        <div class="bubble-label">
          {{ getBubbleLabel() }}
        </div>
      </div>
    </div>

    <!-- Modal (cuando se hace click en la burbuja) -->
    <div *ngIf="isModalOpen" class="modal-backdrop" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-bold flex items-center">
              <i class="fas fa-play-circle mr-3"></i>
              Tarea Actual
            </h2>
            <button (click)="closeModal()" class="text-white hover:text-gray-200 transition-colors">
              <i class="fas fa-times text-2xl"></i>
            </button>
          </div>
          
          <div class="text-sm opacity-90 mb-4">
            {{ getCurrentDateTime() }}
          </div>

          <div *ngIf="currentTask; else noCurrentTask" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Información de la tarea actual -->
            <div class="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div class="flex items-center mb-3">
                <span class="text-2xl mr-2">{{ currentTask.emoji }}</span>
                <div>
                  <h3 class="text-lg font-semibold">{{ currentTask.name }}</h3>
                  <p class="text-sm opacity-90">{{ getProjectName(currentTask.project) }}</p>
                </div>
              </div>
              
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span>Tiempo transcurrido:</span>
                  <span class="font-mono">{{ getElapsedTime() }}</span>
                </div>
                <div class="flex justify-between">
                  <span>Tiempo restante:</span>
                  <span class="font-mono">{{ getRemainingTime() }}</span>
                </div>
                <div class="flex justify-between">
                  <span>Prioridad:</span>
                  <span class="px-2 py-1 rounded text-xs" [class]="getPriorityClass(currentTask.priority)">
                    {{ currentTask.priority }}
                  </span>
                </div>
              </div>

              <!-- Barra de progreso -->
              <div class="mt-4">
                <div class="bg-white/20 rounded-full h-2">
                  <div class="bg-white rounded-full h-2 transition-all duration-300" 
                       [style.width.%]="getProgressPercentage()"></div>
                </div>
                <div class="text-xs mt-1 text-center">{{ getProgressPercentage() }}% completado</div>
              </div>
            </div>

            <!-- Información de la siguiente tarea -->
            <div class="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <h4 class="text-lg font-semibold mb-3 flex items-center">
                <i class="fas fa-clock mr-2"></i>
                Siguiente Tarea
              </h4>
              
              <div *ngIf="nextTask; else noNextTask">
                <div class="flex items-center mb-3">
                  <span class="text-2xl mr-2">{{ nextTask.emoji }}</span>
                  <div>
                    <h5 class="font-medium">{{ nextTask.name }}</h5>
                    <p class="text-sm opacity-90">{{ getProjectName(nextTask.project) }}</p>
                  </div>
                </div>
                
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span>Comienza en:</span>
                    <span class="font-mono">{{ getTimeUntilNext() }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Duración estimada:</span>
                    <span class="font-mono">{{ getTaskRealDuration(nextTask) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Horario:</span>
                    <span class="font-mono">{{ formatTime(nextTask.start) }} - {{ formatTime(nextTask.end) }}</span>
                  </div>
                </div>
              </div>
              
              <ng-template #noNextTask>
                <div class="text-center py-4 opacity-75">
                  <i class="fas fa-check-circle text-3xl mb-2"></i>
                  <p>No hay más tareas programadas</p>
                </div>
              </ng-template>
            </div>
          </div>

          <ng-template #noCurrentTask>
            <div class="text-center py-8">
              <i class="fas fa-pause-circle text-4xl mb-4 opacity-60"></i>
              <h3 class="text-xl font-semibold mb-2">No hay tarea activa</h3>
              <p class="opacity-90">
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
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(59, 130, 246, 0.5);
      animation: pulse 2s infinite;
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
    
    .bubble-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      text-align: center;
    }
    
    .bubble-icon {
      font-size: 20px;
      margin-bottom: 4px;
    }
    
    .bubble-time {
      font-size: 14px;
      font-weight: bold;
      font-family: monospace;
      line-height: 1;
    }
    
    .bubble-label {
      font-size: 8px;
      opacity: 0.9;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Modal */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      animation: fadeIn 0.2s ease-out;
      padding: 20px;
    }
    
    .modal-content {
      max-width: 900px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease-out;
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
      
      .bubble-icon {
        font-size: 18px;
      }
      
      .bubble-time {
        font-size: 12px;
      }
      
      .bubble-label {
        font-size: 7px;
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

  ngOnInit() {
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
    this.isModalOpen = !this.isModalOpen;
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
} 