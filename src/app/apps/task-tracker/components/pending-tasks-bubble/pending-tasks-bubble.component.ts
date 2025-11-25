import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';
import { TaskType } from '../../models/task-type.model';

@Component({
  selector: 'app-pending-tasks-bubble',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Burbuja Flotante -->
    <div class="floating-bubble" 
         [class.has-tasks]="pendingTasks.length > 0"
         [class.no-tasks]="pendingTasks.length === 0"
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
        
        <!-- Ícono de tareas -->
        <g class="bubble-icon-group" transform="translate(40, 25)">
          <path d="M-8,-8 L8,-8 L8,8 L-8,8 Z M-6,-2 L-2,-2 L-2,2 L-6,2 Z M0,-2 L6,-2 M0,2 L6,2" 
                stroke="white" 
                stroke-width="1.5" 
                fill="none" 
                stroke-linecap="round"/>
          <polyline points="-5,-5 -3,-3 -1,-5" 
                    stroke="white" 
                    stroke-width="1.5" 
                    fill="none" 
                    stroke-linecap="round" 
                    stroke-linejoin="round"/>
        </g>
        
        <!-- Contador de tareas -->
        <text x="40" y="48" 
              text-anchor="middle" 
              dominant-baseline="middle" 
              fill="white" 
              font-size="14" 
              font-weight="bold" 
              font-family="monospace"
              class="bubble-count-text">
          {{ pendingTasks.length }}
        </text>
        
        <!-- Label "Pendientes" -->
        <text x="40" y="60" 
              text-anchor="middle" 
              dominant-baseline="middle" 
              fill="white" 
              font-size="6" 
              font-weight="normal" 
              letter-spacing="0.5"
              opacity="0.9"
              class="bubble-label-text">
          PENDIENTES
        </text>
      </svg>
    </div>

    <!-- Modal (cuando se hace click en la burbuja) -->
      <div *ngIf="isModalOpen" class="modal-backdrop" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="bg-white rounded-xl p-4 md:p-6 shadow-lg">
            <!-- Header -->
            <div class="flex items-center justify-between mb-3 md:mb-4 pb-3 border-b border-gray-200">
            <h2 class="text-lg md:text-2xl font-bold flex items-center gap-2 text-gray-800">
              <i class="fas fa-tasks text-base md:text-xl text-orange-500"></i>
              <span>Tareas Pendientes</span>
            </h2>
            <button (click)="closeModal()" class="text-gray-500 hover:text-gray-700 transition-colors p-2 -mr-2">
              <i class="fas fa-times text-xl md:text-2xl"></i>
            </button>
          </div>
          
          <!-- Contador -->
          <div class="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">
            {{ pendingTasks.length }} {{ pendingTasks.length === 1 ? 'tarea pendiente' : 'tareas pendientes' }}
          </div>

          <!-- Lista de tareas pendientes -->
          <div *ngIf="pendingTasks.length > 0; else noPendingTasks" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-h-[60vh] overflow-y-auto pr-2">
            <div *ngFor="let task of pendingTasks" 
                 class="task-card-pending bg-white rounded-lg shadow-md border border-gray-200 relative">
               <!-- Banda superior con ambiente y proyecto -->
               <div class="task-header-band px-3 py-2 text-white text-xs font-medium flex items-center gap-2"
                    [style.background-color]="getEnvironmentColor(task.environment)">
                 <svg class="layer-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                   <rect x="1" y="1" width="12" height="12" rx="1" stroke="white" stroke-width="1.2" fill="none"/>
                   <rect x="3" y="3" width="8" height="8" rx="0.5" stroke="white" stroke-width="1" fill="none" opacity="0.7"/>
                   <rect x="5" y="5" width="4" height="4" rx="0.5" stroke="white" stroke-width="0.8" fill="none" opacity="0.5"/>
                 </svg>
                 <span class="truncate">{{ getEnvironmentName(task.environment) }}</span>
                 <div class="ml-auto">
                   <div class="project-selector flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity px-2 py-1 rounded"
                        (click)="toggleProjectDropdown(task.id, $event)"
                        [class.active]="openDropdownTaskId === task.id">
                     <svg class="folder-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M1 3H5L6 4H11V10H1V3Z" stroke="white" stroke-width="1" fill="none"/>
                       <path d="M1 3V2C1 1.5 1.5 1 2 1H5L6 2H11" stroke="white" stroke-width="1" fill="none"/>
                     </svg>
                     <span class="truncate max-w-[100px] text-xs">{{ getProjectName(task.project) || 'Sin proyecto' }}</span>
                     <svg class="dropdown-arrow transition-transform" 
                          [class.rotated]="openDropdownTaskId === task.id"
                          width="8" height="6" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M1 1L4 4L7 1" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                     </svg>
                   </div>
                 </div>
               </div>
              
              <!-- Contenido de la tarjeta -->
              <div class="p-3">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-1">
                    <span class="text-lg">{{ task.emoji || '📋' }}</span>
                    <div *ngIf="getTaskTypeColor(task)" 
                         class="w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" 
                         [style.background-color]="getTaskTypeColor(task)"></div>
                    <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-sm" title="Tarea oculta"></i>
                  </div>
                  <span class="text-xs px-2 py-1 rounded" [class]="'priority-' + task.priority">
                    {{ task.priority }}
                  </span>
                </div>
                
                <h4 class="font-medium text-sm mb-1 truncate">{{ task.name }}</h4>
                <p class="text-xs text-gray-600 mb-2 line-clamp-2">{{ task.description || 'Sin descripción' }}</p>
                
                <div class="text-xs text-gray-500 space-y-1 mb-3">
                  <div class="flex items-center gap-1">
                    <i class="fas fa-play text-gray-400"></i>
                    <span>{{ formatDate(task.start) }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <i class="fas fa-stop text-gray-400"></i>
                    <span>{{ formatDate(task.end) }}</span>
                  </div>
                </div>
                
                <!-- Botón de editar -->
                <button (click)="onEditTask(task)" 
                        class="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <i class="fas fa-edit"></i>
                  <span>Editar</span>
                </button>
              </div>
            </div>
          </div>

          <ng-template #noPendingTasks>
            <div class="text-center py-6 md:py-8">
              <i class="fas fa-check-circle text-3xl md:text-4xl mb-3 md:mb-4 text-green-500 opacity-60"></i>
              <h3 class="text-base md:text-xl font-semibold mb-2 text-gray-800">No hay tareas pendientes</h3>
              <p class="text-gray-600 text-xs md:text-sm px-4">
                No se encontraron tareas con tipo "Pendiente" o "Pending"
              </p>
            </div>
          </ng-template>
        </div>
      </div>
    </div>
    
    <!-- Dropdowns de proyectos (renderizados fuera del modal, al mismo nivel) -->
    <ng-container *ngIf="isModalOpen">
      <div *ngFor="let task of pendingTasks">
        <div *ngIf="openDropdownTaskId === task.id" 
             class="project-dropdown fixed bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px] max-w-[300px] max-h-[250px] overflow-y-auto"
             [style.top.px]="getDropdownTop(task.id)"
             [style.left.px]="getDropdownLeft(task.id)"
             [style.right.px]="getDropdownRight(task.id)"
             (click)="$event.stopPropagation()">
          <div class="p-2">
            <div *ngFor="let project of getProjectsByEnvironment(task.environment)" 
                 class="project-option px-3 py-2 rounded-md cursor-pointer hover:bg-gray-100 transition-colors flex items-center gap-2"
                 [class.selected]="project.id === task.project"
                 (click)="onProjectSelected(task, project.id)">
              <svg class="folder-icon-small flex-shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 4H7L8 5H15V13H1V4Z" stroke="#4b5563" stroke-width="1.2" fill="none"/>
                <path d="M1 4V3C1 2.5 1.5 2 2 2H7L8 3H15" stroke="#4b5563" stroke-width="1.2" fill="none"/>
              </svg>
              <span class="flex-1 text-sm text-gray-700 truncate">{{ project.name }}</span>
              <svg *ngIf="project.id === task.project" class="check-icon flex-shrink-0" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="8" fill="#10b981" stroke="#10b981" stroke-width="1"/>
                <path d="M5 9L8 12L13 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div *ngIf="getProjectsByEnvironment(task.environment).length === 0" 
                 class="px-3 py-2 text-xs text-gray-500 text-center">
              No hay proyectos disponibles
            </div>
          </div>
        </div>
      </div>
    </ng-container>
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
      top: 40%;
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
      z-index: 999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(251, 146, 60, 0.5);
      animation: pulse 2s infinite;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    
    .floating-bubble.dragging {
      cursor: grabbing;
      transform: translateY(-50%) scale(1.1);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(251, 146, 60, 0.5);
      animation: none;
      transition: none;
    }
    
    .floating-bubble.has-tasks {
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    }
    
    .floating-bubble.no-tasks {
      background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
    }
    
    .floating-bubble:hover {
      transform: translateY(-50%) scale(1.1);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(251, 146, 60, 0.5);
    }
    
    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(251, 146, 60, 0.5);
      }
      50% {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 15px rgba(251, 146, 60, 0);
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
    
    .bubble-count-text {
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
      max-width: 1200px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease-out;
      -webkit-overflow-scrolling: touch;
      position: relative;
      z-index: 2000;
    }
    
    /* Grid de tareas - importante para z-index */
    .grid {
      position: relative;
      z-index: 1;
    }
    
    /* Tarjetas de tareas pendientes */
    .task-card-pending {
      transition: box-shadow 0.2s ease;
      position: relative;
      z-index: 1;
    }
    
    .task-card-pending:hover {
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
      z-index: 2;
    }
    
    .task-card-pending h4 {
      color: #111827;
      font-weight: 500;
      font-size: 0.875rem;
      margin-bottom: 0.25rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .task-card-pending p {
      color: #4b5563;
      font-size: 0.75rem;
      margin-bottom: 0.5rem;
    }
    
     .task-header-band {
       min-height: 32px;
       display: flex;
       align-items: center;
     }
     
     .layer-icon {
       flex-shrink: 0;
     }
     
     .project-selector {
       user-select: none;
       -webkit-tap-highlight-color: transparent;
     }
     
     .project-selector.active {
       background-color: rgba(255, 255, 255, 0.2);
     }
     
     .dropdown-arrow {
       flex-shrink: 0;
       transition: transform 0.2s ease;
     }
     
     .dropdown-arrow.rotated {
       transform: rotate(180deg);
     }
     
     .project-dropdown {
       animation: slideDown 0.2s ease-out;
       position: fixed !important;
       z-index: 9999 !important;
       box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
       -webkit-overflow-scrolling: touch;
       pointer-events: auto;
       will-change: transform;
     }
     
     .project-dropdown::-webkit-scrollbar {
       width: 6px;
     }
     
     .project-dropdown::-webkit-scrollbar-track {
       background: #f1f1f1;
       border-radius: 3px;
     }
     
     .project-dropdown::-webkit-scrollbar-thumb {
       background: #c1c1c1;
       border-radius: 3px;
     }
     
     .project-dropdown::-webkit-scrollbar-thumb:hover {
       background: #a8a8a8;
     }
     
     .project-option {
       user-select: none;
       -webkit-tap-highlight-color: transparent;
     }
     
     .project-option.selected {
       background-color: #eff6ff;
     }
     
     .project-option.selected .folder-icon-small path {
       stroke: #3b82f6;
     }
     
     .project-option.selected span {
       color: #3b82f6;
       font-weight: 500;
     }
     
     @keyframes slideDown {
       from {
         opacity: 0;
         transform: translateY(-10px);
       }
       to {
         opacity: 1;
         transform: translateY(0);
       }
     }
    
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
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
       
       .bubble-count-text {
         font-size: 12px;
       }
       
       .bubble-label-text {
         font-size: 5px;
       }
       
       .drag-indicator-group circle {
         r: 1.2;
       }
       
       .project-dropdown {
         min-width: calc(100vw - 40px);
         max-width: calc(100vw - 40px);
         max-height: 200px;
       }
       
       .project-selector {
         padding: 0.375rem 0.5rem;
       }
       
       .project-selector span {
         font-size: 0.7rem;
         max-width: 80px;
       }
     }
  `]
})
export class PendingTasksBubbleComponent implements OnInit, OnDestroy, OnChanges {
  @Input() tasks: Task[] = [];
  @Input() projects: Project[] = [];
  @Input() environments: Environment[] = [];
  @Input() taskTypes: TaskType[] = [];
  
  @Output() editTask = new EventEmitter<Task>();
  @Output() updateTaskProject = new EventEmitter<{ taskId: string, projectId: string }>();

  pendingTasks: Task[] = [];
  isModalOpen: boolean = false;
  openDropdownTaskId: string | null = null;
  private dropdownPositions: { [taskId: string]: { top: number, left?: number, right?: number } } = {};
  
  // Propiedades para drag and drop
  bubbleTopPosition: number = 40; // Porcentaje del viewport (40% = arriba de la burbuja actual)
  isDragging: boolean = false;
  private dragStartY: number = 0;
  private dragStartTop: number = 0;
  private lastDragEndTime: number = 0;

  ngOnInit() {
    this.loadBubblePosition();
    this.updatePendingTasks();
  }

  ngOnDestroy() {
    // Restaurar overflow del body por si acaso
    document.body.style.overflow = '';
    // Cerrar dropdown si está abierto
    this.openDropdownTaskId = null;
    this.dropdownPositions = {};
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tasks'] || changes['taskTypes'] || changes['projects'] || changes['environments']) {
      this.updatePendingTasks();
    }
  }

  private updatePendingTasks(): void {
    this.pendingTasks = this.getPendingTasks();
  }

  getPendingTasks(): Task[] {
    return this.tasks.filter(task => {
      if (!task.type) return false;
      const taskType = this.taskTypes.find(tt => tt.id === task.type);
      if (!taskType) return false;
      const typeNameLower = taskType.name.toLowerCase();
      return typeNameLower === 'pendiente' || typeNameLower === 'pending';
    });
  }

  getEnvironmentName(environmentId: string): string {
    const env = this.environments.find(e => e.id === environmentId);
    return env?.name || 'Sin ambiente';
  }

  getEnvironmentColor(environmentId: string): string {
    const env = this.environments.find(e => e.id === environmentId);
    return env?.color || '#6b7280';
  }

  getProjectName(projectId: string): string {
    if (!projectId) return '';
    const project = this.projects.find(p => p.id === projectId);
    return project ? project.name : '';
  }

  getTaskTypeColor(task: Task): string | null {
    if (!task.type || !this.taskTypes.length) return null;
    const taskType = this.taskTypes.find(t => t.id === task.type);
    return taskType?.color || null;
  }

  getProjectsByEnvironment(environmentId: string): Project[] {
    return this.projects.filter(p => p.environment === environmentId);
  }

  toggleProjectDropdown(taskId: string, event: Event): void {
    event.stopPropagation();
    
    if (this.openDropdownTaskId === taskId) {
      // Cerrar si ya está abierto
      this.openDropdownTaskId = null;
      delete this.dropdownPositions[taskId];
      return;
    }
    
    // Cerrar otros dropdowns abiertos
    const previousTaskId = this.openDropdownTaskId;
    this.openDropdownTaskId = null;
    if (previousTaskId) {
      delete this.dropdownPositions[previousTaskId];
    }
    
    // Calcular posición del dropdown
    const target = event.target as HTMLElement;
    const selectorElement = target.closest('.project-selector') as HTMLElement;
    
    if (selectorElement) {
      const rect = selectorElement.getBoundingClientRect();
      const dropdownWidth = 250; // Ancho aproximado del dropdown
      const dropdownHeight = 250; // Altura máxima del dropdown
      const spacing = 8; // Espacio entre el selector y el dropdown
      const padding = 10; // Padding mínimo desde los bordes
      
      // Calcular posición desde arriba
      let top = rect.bottom + spacing;
      
      // Verificar si cabe hacia abajo
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        // Mostrar arriba del selector
        top = rect.top - dropdownHeight - spacing;
      }
      
      // Asegurar que no se salga por arriba
      if (top < padding) {
        top = padding;
      }
      
      // Asegurar que no se salga por abajo
      if (top + dropdownHeight > window.innerHeight - padding) {
        top = window.innerHeight - dropdownHeight - padding;
      }
      
      // Calcular posición horizontal
      // Intentar alinear con el selector desde la izquierda
      let left = rect.left;
      let right: number | undefined = undefined;
      
      // Verificar si cabe desde la izquierda
      if (left + dropdownWidth > window.innerWidth - padding) {
        // No cabe, usar posición desde la derecha
        right = window.innerWidth - rect.right;
        left = undefined as any;
        
        // Si tampoco cabe desde la derecha, centrar
        if (right + dropdownWidth > window.innerWidth - padding) {
          left = Math.max(padding, (window.innerWidth - dropdownWidth) / 2);
          right = undefined as any;
        }
      }
      
      // Asegurar que no se salga por la izquierda
      if (left !== undefined && left < padding) {
        left = padding;
      }
      
      this.dropdownPositions[taskId] = {
        top: top,
        left: left,
        right: right
      };
      
      // Usar setTimeout para asegurar que Angular actualice el DOM antes de mostrar
      setTimeout(() => {
        this.openDropdownTaskId = taskId;
      }, 0);
    }
  }

  getDropdownTop(taskId: string): number {
    const position = this.dropdownPositions[taskId];
    return position?.top || 0;
  }

  getDropdownLeft(taskId: string): number | undefined {
    const position = this.dropdownPositions[taskId];
    return position?.left;
  }

  getDropdownRight(taskId: string): number | undefined {
    const position = this.dropdownPositions[taskId];
    return position?.right;
  }

  onProjectSelected(task: Task, projectId: string): void {
    if (task.project !== projectId) {
      this.updateTaskProject.emit({ taskId: task.id, projectId });
    }
    this.openDropdownTaskId = null;
    delete this.dropdownPositions[task.id];
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Cerrar dropdown si se hace click fuera
    if (this.openDropdownTaskId !== null) {
      const target = event.target as HTMLElement;
      // Verificar si el click fue dentro del selector o del dropdown
      const clickedInSelector = target.closest('.project-selector');
      const clickedInDropdown = target.closest('.project-dropdown');
      
      if (!clickedInSelector && !clickedInDropdown) {
        this.openDropdownTaskId = null;
      }
    }
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize() {
    // Cerrar dropdown al redimensionar para evitar posicionamiento incorrecto
    if (this.openDropdownTaskId !== null) {
      const taskId = this.openDropdownTaskId;
      this.openDropdownTaskId = null;
      delete this.dropdownPositions[taskId];
    }
  }

  @HostListener('window:scroll', ['$event'])
  onWindowScroll() {
    // Cerrar dropdown al hacer scroll para evitar posicionamiento incorrecto
    if (this.openDropdownTaskId !== null) {
      const taskId = this.openDropdownTaskId;
      this.openDropdownTaskId = null;
      delete this.dropdownPositions[taskId];
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const dateStr = dateString.includes('Z') ? dateString : dateString + 'Z';
    const date = new Date(dateStr);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getBubbleTooltip(): string {
    const count = this.pendingTasks.length;
    if (count === 0) {
      return 'No hay tareas pendientes\nClick para ver detalles';
    }
    return `${count} ${count === 1 ? 'tarea pendiente' : 'tareas pendientes'}\nClick para ver detalles`;
  }

  toggleModal(): void {
    this.isModalOpen = !this.isModalOpen;
    if (this.isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.openDropdownTaskId = null;
    this.dropdownPositions = {};
    document.body.style.overflow = '';
  }

  onEditTask(task: Task): void {
    this.editTask.emit(task);
    this.closeModal();
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
    this.toggleModal();
  }

  onBubbleMouseDown(event: MouseEvent): void {
    this.dragStartY = event.clientY;
    this.dragStartTop = this.bubbleTopPosition;
    let hasMoved = false;
    const startTime = Date.now();
    
    const mouseMoveHandler = (e: MouseEvent) => {
      const deltaY = Math.abs(e.clientY - this.dragStartY);
      
      if (!hasMoved && deltaY > 15) {
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
      
      if (hasMoved) {
        this.endDrag();
        // Prevenir que el evento click se dispare después del drag
        e.preventDefault();
        e.stopPropagation();
        // Marcar que acabamos de hacer drag
        this.lastDragEndTime = Date.now();
      } else if (clickTime < 300) {
        // Si fue un click rápido sin movimiento, abrir modal
        // Prevenir el evento click para evitar doble apertura
        e.preventDefault();
        e.stopPropagation();
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
    
    const touch = event.touches[0];
    this.dragStartY = touch.clientY;
    this.dragStartTop = this.bubbleTopPosition;
    let hasMoved = false;
    const startTime = Date.now();
    
    const touchMoveHandler = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const deltaY = Math.abs(e.touches[0].clientY - this.dragStartY);
        
        if (!hasMoved && deltaY > 20) {
          hasMoved = true;
          this.isDragging = true;
          e.preventDefault();
        }
        
        if (hasMoved) {
          this.onDragMove(e.touches[0].clientY);
        }
      }
    };
    
    const touchEndHandler = () => {
      const tapTime = Date.now() - startTime;
      
      if (hasMoved) {
        this.endDrag();
        this.lastDragEndTime = Date.now();
      } else if (tapTime < 300) {
        this.lastDragEndTime = Date.now();
        this.toggleModal();
      }
      document.removeEventListener('touchmove', touchMoveHandler);
      document.removeEventListener('touchend', touchEndHandler);
    };
    
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('touchend', touchEndHandler, { once: true });
  }

  private onDragMove(clientY: number): void {
    if (!this.isDragging) return;
    
    const deltaY = clientY - this.dragStartY;
    const viewportHeight = window.innerHeight;
    const deltaPercent = (deltaY / viewportHeight) * 100;
    
    let newTop = this.dragStartTop + deltaPercent;
    
    // Limitar entre 5% y 95% para que no se salga del viewport
    newTop = Math.max(5, Math.min(95, newTop));
    
    this.bubbleTopPosition = newTop;
  }

  private endDrag(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.lastDragEndTime = Date.now();
      this.saveBubblePosition();
    }
  }

  private saveBubblePosition(): void {
    try {
      localStorage.setItem('pendingTasksBubble_bubblePosition', JSON.stringify(this.bubbleTopPosition));
    } catch (error) {
      console.error('Error al guardar la posición de la burbuja:', error);
    }
  }

  private loadBubblePosition(): void {
    try {
      const saved = localStorage.getItem('pendingTasksBubble_bubblePosition');
      if (saved) {
        const position = JSON.parse(saved);
        if (typeof position === 'number' && position >= 5 && position <= 95) {
          this.bubbleTopPosition = position;
        }
      }
    } catch (error) {
      console.error('Error al cargar la posición de la burbuja:', error);
    }
  }
}

