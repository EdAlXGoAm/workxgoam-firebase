import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskSumTemplate } from '../../models/task-sum-template.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';
import { TaskSumTemplateService } from '../../services/task-sum-template.service';

@Component({
  selector: 'app-sums-bubble',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Burbuja Flotante -->
    <div class="floating-bubble" 
         [class.has-templates]="templates.length > 0"
         [class.no-templates]="templates.length === 0"
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
        
        <!-- Ícono de suma/calculadora -->
        <g class="bubble-icon-group" transform="translate(40, 30)">
          <rect x="-10" y="-6" width="20" height="12" rx="2" fill="none" stroke="white" stroke-width="1.5"/>
          <text x="0" y="2" text-anchor="middle" fill="white" font-size="10" font-weight="bold">Σ</text>
        </g>
        
        <!-- Contador de plantillas -->
        <text x="40" y="48" 
              text-anchor="middle" 
              dominant-baseline="middle" 
              fill="white" 
              font-size="14" 
              font-weight="bold" 
              font-family="monospace"
              class="bubble-count-text">
          {{ templates.length }}
        </text>
        
        <!-- Label "Sumas" -->
        <text x="40" y="60" 
              text-anchor="middle" 
              dominant-baseline="middle" 
              fill="white" 
              font-size="6" 
              font-weight="normal" 
              letter-spacing="0.5"
              opacity="0.9"
              class="bubble-label-text">
          SUMAS
        </text>
      </svg>
    </div>

    <!-- Modal (cuando se hace click en la burbuja) -->
    <div *ngIf="isModalOpen" class="modal-backdrop" (click)="onModalBackdropClick($event)">
      <div class="modal-content" (click)="onModalContentClick($event)">
        <div class="bg-white rounded-xl p-4 md:p-6 shadow-lg">
          <!-- Header -->
          <div class="flex items-center justify-between mb-3 md:mb-4 pb-3 border-b border-gray-200">
            <h2 class="text-lg md:text-2xl font-bold flex items-center gap-2 text-gray-800">
              <i class="fas fa-calculator text-base md:text-xl text-indigo-500"></i>
              <span>Sumas Guardadas</span>
            </h2>
            <button (click)="closeModal()" class="text-gray-500 hover:text-gray-700 transition-colors p-2 -mr-2">
              <i class="fas fa-times text-xl md:text-2xl"></i>
            </button>
          </div>
          
          <!-- Contador -->
          <div class="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">
            {{ templates.length }} {{ templates.length === 1 ? 'suma guardada' : 'sumas guardadas' }}
          </div>

          <!-- Lista de plantillas -->
          <div *ngIf="templates.length > 0; else noTemplates" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-h-[60vh] overflow-y-auto pr-2">
            <div *ngFor="let template of templates" 
                 class="template-card bg-white rounded-lg shadow-md border border-gray-200 relative">
              <!-- Banda superior con ambiente -->
              <div class="template-header-band px-3 py-2 text-white text-xs font-medium flex items-center gap-2"
                   [style.background-color]="getEnvironmentColor(template.environmentId)">
                <svg class="layer-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="12" height="12" rx="1" stroke="white" stroke-width="1.2" fill="none"/>
                  <rect x="3" y="3" width="8" height="8" rx="0.5" stroke="white" stroke-width="1" fill="none" opacity="0.7"/>
                  <rect x="5" y="5" width="4" height="4" rx="0.5" stroke="white" stroke-width="0.8" fill="none" opacity="0.5"/>
                </svg>
                <span class="truncate flex-1">{{ getEnvironmentName(template.environmentId) }}</span>
                <!-- Botón de 3 puntos -->
                <button 
                  (click)="onTemplateMenuClick($event, template)"
                  class="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors flex-shrink-0"
                  [class.bg-white]="showContextMenu && selectedTemplate?.id === template.id"
                  [class.bg-opacity-20]="showContextMenu && selectedTemplate?.id === template.id">
                  <i class="fas fa-ellipsis-v text-white text-sm"></i>
                </button>
              </div>
              
              <!-- Contenido de la tarjeta -->
              <div class="p-3">
                <h4 class="font-semibold text-base mb-2 text-gray-800">{{ template.name }}</h4>
                
                <div class="text-xs text-gray-600 space-y-1 mb-3">
                  <div class="flex items-center gap-2">
                    <i class="fas fa-folder text-indigo-500"></i>
                    <span class="truncate">{{ getProjectName(template.projectId) }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <i class="fas fa-clock text-indigo-500"></i>
                    <span class="font-semibold text-indigo-600">{{ formatDuration(template.totalDuration) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ng-template #noTemplates>
            <div class="text-center py-6 md:py-8">
              <i class="fas fa-calculator text-3xl md:text-4xl mb-3 md:mb-4 text-indigo-500 opacity-60"></i>
              <h3 class="text-base md:text-xl font-semibold mb-2 text-gray-800">No hay sumas guardadas</h3>
              <p class="text-gray-600 text-xs md:text-sm px-4">
                Guarda sumas de tareas desde el modal de proyectos para verlas aquí
              </p>
            </div>
          </ng-template>
        </div>
      </div>
    </div>
    
    <!-- Menú contextual -->
    <div *ngIf="showContextMenu" 
         class="context-menu" 
         [style.left.px]="contextMenuX" 
         [style.top.px]="contextMenuY"
         (click)="$event.stopPropagation()"
         (mousedown)="$event.stopPropagation()">
      <div class="context-menu-item" (click)="onOpenTemplate()">
        <i class="fas fa-folder-open"></i>
        <span>Abrir</span>
      </div>
      <div class="context-menu-item context-menu-item-danger" (click)="onDeleteTemplate()">
        <i class="fas fa-trash"></i>
        <span>Eliminar</span>
      </div>
    </div>
  `,
  styles: [`
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
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(99, 102, 241, 0.5);
      animation: pulse 2s infinite;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    
    .floating-bubble.dragging {
      cursor: grabbing;
      transform: translateY(-50%) scale(1.1);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(99, 102, 241, 0.5);
      animation: none;
      transition: none;
    }
    
    .floating-bubble.has-templates {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    }
    
    .floating-bubble.no-templates {
      background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
    }
    
    .floating-bubble:hover {
      transform: translateY(-50%) scale(1.1);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), 0 0 0 0 rgba(99, 102, 241, 0.5);
    }
    
    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(99, 102, 241, 0.5);
      }
      50% {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 15px rgba(99, 102, 241, 0);
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
    
    .template-card {
      transition: box-shadow 0.2s ease;
      position: relative;
      z-index: 1;
    }
    
    .template-card:hover {
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
      z-index: 2;
    }
    
    .template-header-band {
      min-height: 32px;
      display: flex;
      align-items: center;
    }
    
    .layer-icon {
      flex-shrink: 0;
    }
    
    /* Menú contextual */
    .context-menu {
      position: fixed;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      min-width: 180px;
      padding: 4px 0;
    }
    
    .context-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      cursor: pointer;
      transition: background-color 0.15s ease;
      color: #374151;
    }
    
    .context-menu-item:hover {
      background-color: #f3f4f6;
    }
    
    .context-menu-item-danger {
      color: #ef4444;
    }
    
    .context-menu-item-danger:hover {
      background-color: #fee2e2;
    }
    
    .context-menu-item i {
      width: 16px;
      text-align: center;
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
      
      .floating-bubble {
        width: 70px;
        height: 70px;
        right: 15px;
      }
      
      .bubble-count-text {
        font-size: 12px;
      }
      
      .bubble-label-text {
        font-size: 5px;
      }
    }
  `]
})
export class SumsBubbleComponent implements OnInit, OnDestroy, OnChanges {
  @Input() templates: TaskSumTemplate[] = [];
  @Input() projects: Project[] = [];
  @Input() environments: Environment[] = [];
  
  @Output() openTemplate = new EventEmitter<TaskSumTemplate>();
  @Output() deleteTemplate = new EventEmitter<string>();

  isModalOpen = false;
  isDragging = false;
  bubbleTopPosition = 40;
  private dragStartY = 0;
  private initialTopPosition = 40;
  private lastClickTime = 0;
  
  showContextMenu = false;
  contextMenuX = 0;
  contextMenuY = 0;
  selectedTemplate: TaskSumTemplate | null = null;

  ngOnInit() {
    this.loadBubblePosition();
  }

  ngOnChanges(changes: SimpleChanges) {
    // El componente se actualiza automáticamente cuando cambian los templates
  }

  ngOnDestroy() {
    this.saveBubblePosition();
  }

  onBubbleClick(event: MouseEvent) {
    // Prevenir apertura si acabamos de hacer drag o si el click fue manejado recientemente en mouseUp
    // Este es principalmente un fallback para móviles
    if (this.isDragging || Date.now() - this.lastClickTime < 500) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Fallback: solo abrir si mouseUpHandler no lo manejó (caso raro)
    // Esto es principalmente para móviles donde el evento click puede dispararse sin mouseup
    this.isModalOpen = true;
  }

  onBubbleMouseDown(event: MouseEvent) {
    // No prevenir el comportamiento por defecto inmediatamente
    this.isDragging = false;
    this.dragStartY = event.clientY;
    this.initialTopPosition = this.bubbleTopPosition;
    let hasMoved = false;
    const startTime = Date.now();
    
    const onMouseMove = (e: MouseEvent) => {
      const deltaY = Math.abs(e.clientY - this.dragStartY);
      
      // Solo considerar drag si el movimiento es significativo (> 10px)
      if (!hasMoved && deltaY > 10) {
        hasMoved = true;
        this.isDragging = true;
        event.preventDefault(); // Solo prevenir cuando realmente hay drag
      }
      
      if (hasMoved) {
        const viewportHeight = window.innerHeight;
        const newTop = this.initialTopPosition + ((e.clientY - this.dragStartY) / viewportHeight) * 100;
        this.bubbleTopPosition = Math.max(10, Math.min(90, newTop));
      }
    };
    
    const onMouseUp = (e: MouseEvent) => {
      const clickTime = Date.now() - startTime;
      
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      if (hasMoved) {
        // Si hubo drag, prevenir el evento click
        e.preventDefault();
        e.stopPropagation();
        this.isDragging = false;
        this.saveBubblePosition();
      } else if (clickTime < 300) {
        // Si no hubo drag y fue un click rápido, abrir el modal
        // Prevenir el evento click para evitar doble apertura
        e.preventDefault();
        e.stopPropagation();
        this.lastClickTime = Date.now();
        this.isModalOpen = true;
      }
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp, { once: true });
  }

  onBubbleTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    
    // No prevenir default inmediatamente, esperar a ver si hay movimiento
    this.isDragging = false;
    const touch = event.touches[0];
    this.dragStartY = touch.clientY;
    this.initialTopPosition = this.bubbleTopPosition;
    let hasMoved = false;
    const startTime = Date.now();
    
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const deltaY = Math.abs(touch.clientY - this.dragStartY);
        
        // Solo considerar drag si el movimiento es significativo (> 20px)
        if (!hasMoved && deltaY > 20) {
          hasMoved = true;
          this.isDragging = true;
          e.preventDefault(); // Solo prevenir cuando realmente hay drag
        }
        
        if (hasMoved) {
          const viewportHeight = window.innerHeight;
          const newTop = this.initialTopPosition + ((touch.clientY - this.dragStartY) / viewportHeight) * 100;
          this.bubbleTopPosition = Math.max(10, Math.min(90, newTop));
        }
      }
    };
    
    const onTouchEnd = () => {
      const tapTime = Date.now() - startTime;
      
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      
      if (hasMoved) {
        // Si hubo drag, prevenir el evento click
        this.isDragging = false;
        this.saveBubblePosition();
        this.lastClickTime = Date.now();
      } else if (tapTime < 300) {
        // Si no hubo drag y fue un tap rápido, abrir el modal
        this.lastClickTime = Date.now();
        this.isModalOpen = true;
      }
    };
    
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { once: true });
  }

  closeModal() {
    this.isModalOpen = false;
    this.showContextMenu = false;
    this.selectedTemplate = null;
  }

  onModalBackdropClick(event: MouseEvent) {
    // Cerrar el menú contextual si está abierto (sin cerrar el modal)
    if (this.showContextMenu) {
      this.showContextMenu = false;
      this.selectedTemplate = null;
      // No cerrar el modal, solo el menú
      return;
    }
    // Si no hay menú abierto, cerrar el modal
    this.closeModal();
  }

  onModalContentClick(event: MouseEvent) {
    // Prevenir que el click en el contenido del modal cierre el modal
    event.stopPropagation();
    
    // Pero permitir que se cierre el menú contextual si se hace click fuera de él
    if (this.showContextMenu) {
      const target = event.target as Element;
      const clickedMenu = target.closest('.context-menu');
      const clickedButton = target.closest('button');
      const isMenuButton = clickedButton && clickedButton.querySelector('.fa-ellipsis-v');
      
      if (!clickedMenu && !isMenuButton && !target.closest('.fa-ellipsis-v')) {
        this.showContextMenu = false;
        this.selectedTemplate = null;
      }
    }
  }

  getBubbleTooltip(): string {
    return `${this.templates.length} ${this.templates.length === 1 ? 'suma guardada' : 'sumas guardadas'}`;
  }

  getEnvironmentName(environmentId: string): string {
    const env = this.environments.find(e => e.id === environmentId);
    return env?.name || 'Desconocido';
  }

  getEnvironmentColor(environmentId: string): string {
    const env = this.environments.find(e => e.id === environmentId);
    return env?.color || '#6b7280';
  }

  getProjectName(projectId: string): string {
    const project = this.projects.find(p => p.id === projectId);
    return project?.name || 'Desconocido';
  }

  formatDuration(hours: number): string {
    if (!hours || hours === 0) return '0 horas';
    
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (minutes === 0) {
      return `${wholeHours} hora${wholeHours !== 1 ? 's' : ''}`;
    } else if (wholeHours === 0) {
      return `${minutes} minutos`;
    } else {
      return `${wholeHours} hora${wholeHours !== 1 ? 's' : ''} y ${minutes} minutos`;
    }
  }

  onTemplateMenuClick(event: MouseEvent, template: TaskSumTemplate) {
    event.preventDefault();
    event.stopPropagation();
    
    // Si el menú ya está abierto para esta plantilla, cerrarlo
    if (this.showContextMenu && this.selectedTemplate?.id === template.id) {
      this.showContextMenu = false;
      this.selectedTemplate = null;
      return;
    }
    
    // Abrir menú para esta plantilla
    this.selectedTemplate = template;
    const buttonRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = 80; // Aproximadamente 2 items * 40px
    
    // Calcular posición X (preferir a la izquierda del botón)
    let x = buttonRect.right - menuWidth;
    if (x < 10) {
      // Si no cabe a la izquierda, poner a la derecha
      x = buttonRect.right + 5;
    }
    
    // Calcular posición Y (preferir debajo del botón)
    let y = buttonRect.bottom + 5;
    const spaceBelow = window.innerHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
      // Si no cabe abajo pero sí arriba, poner arriba
      y = buttonRect.top - menuHeight - 5;
    } else if (spaceBelow < menuHeight && spaceAbove < menuHeight) {
      // Si no cabe ni arriba ni abajo, ajustar a la posición disponible
      if (spaceAbove > spaceBelow) {
        y = 10;
      } else {
        y = window.innerHeight - menuHeight - 10;
      }
    }
    
    this.contextMenuX = x;
    this.contextMenuY = y;
    this.showContextMenu = true;
  }

  onOpenTemplate() {
    if (this.selectedTemplate) {
      this.openTemplate.emit(this.selectedTemplate);
      this.closeModal();
      this.showContextMenu = false;
    }
  }

  onDeleteTemplate() {
    if (this.selectedTemplate) {
      if (confirm(`¿Estás seguro de que quieres eliminar la suma "${this.selectedTemplate.name}"?`)) {
        this.deleteTemplate.emit(this.selectedTemplate.id);
        this.showContextMenu = false;
        this.selectedTemplate = null;
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.showContextMenu) return;
    
    const target = event.target as Element;
    
    // Verificar si el click fue en el menú contextual
    const clickedMenu = target.closest('.context-menu');
    if (clickedMenu) return; // No cerrar si se hace click dentro del menú
    
    // Verificar si el click fue en un botón de menú (3 puntos)
    const clickedButton = target.closest('button');
    if (clickedButton && clickedButton.querySelector('.fa-ellipsis-v')) {
      return; // No cerrar si se hace click en el botón de 3 puntos
    }
    
    // Verificar si el click fue directamente en el icono de 3 puntos
    if (target.classList.contains('fa-ellipsis-v') || target.closest('.fa-ellipsis-v')) {
      return; // No cerrar si se hace click en el icono
    }
    
    // Si llegamos aquí, el click fue fuera del menú y fuera del botón
    this.showContextMenu = false;
    this.selectedTemplate = null;
  }

  private loadBubblePosition() {
    const saved = localStorage.getItem('sums-bubble-position');
    if (saved) {
      this.bubbleTopPosition = parseFloat(saved);
    }
  }

  private saveBubblePosition() {
    localStorage.setItem('sums-bubble-position', this.bubbleTopPosition.toString());
  }
}

