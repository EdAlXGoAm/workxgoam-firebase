import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskSumTemplate } from '../../models/task-sum-template.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';
import { TaskSumTemplateService } from '../../services/task-sum-template.service';

@Component({
  selector: 'app-sums-bubble',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Burbuja Flotante -->
    <div
      (click)="onBubbleClick($event)"
      (mousedown)="onBubbleMouseDown($event)"
      (touchstart)="onBubbleTouchStart($event)"
      class="fixed right-3 z-40 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center select-none overflow-visible"
      [class.bg-indigo-500]="templates.length > 0"
      [class.bg-slate-500]="templates.length === 0"
      [class.scale-110]="isDragging"
      [class.cursor-grabbing]="isDragging"
      [class.cursor-grab]="!isDragging"
      [style.top.%]="bubbleTopPosition"
      [style.transform]="'translateY(-50%)'"
      [title]="getBubbleTooltip()"
      style="touch-action: none; transition: box-shadow 0.2s;"
    >
      <!-- Indicador de drag (puntos) -->
      <div class="absolute top-1 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-50 pointer-events-none">
        <span class="w-1 h-1 bg-white rounded-full"></span>
        <span class="w-1 h-1 bg-white rounded-full"></span>
        <span class="w-1 h-1 bg-white rounded-full"></span>
      </div>
      <span class="text-xl pointer-events-none">Σ</span>
      <!-- Badge contador -->
      <span *ngIf="templates.length > 0" 
        class="absolute w-6 h-6 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center shadow-md border-2 border-white pointer-events-none"
        style="top: -4px; left: -4px;">
        {{ templates.length }}
      </span>
    </div>

    <!-- Modal (cuando se hace click en la burbuja) -->
    <div *ngIf="isModalOpen" class="modal-backdrop">
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
  
  // Sistema "hold to drag" - requiere mantener presionado antes de arrastrar
  private bubbleDragEnabled = false;
  private bubbleHoldTimer: any = null;
  private readonly HOLD_TO_DRAG_DELAY = 400; // ms que hay que mantener presionado para activar drag

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}
  
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
    // Cancelar timer de hold-to-drag si existe
    if (this.bubbleHoldTimer) {
      clearTimeout(this.bubbleHoldTimer);
      this.bubbleHoldTimer = null;
    }
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
    this.cdr.markForCheck();
  }

  onBubbleMouseDown(event: MouseEvent) {
    this.isDragging = false;
    this.dragStartY = event.clientY;
    this.initialTopPosition = this.bubbleTopPosition;
    this.bubbleDragEnabled = false;
    let hasMoved = false;
    const startTime = Date.now();

    // Timer para activar modo drag después de mantener presionado
    this.bubbleHoldTimer = setTimeout(() => {
      this.bubbleDragEnabled = true;
    }, this.HOLD_TO_DRAG_DELAY);
    
    const onMouseMove = (e: MouseEvent) => {
      // Solo permitir drag si se mantuvo presionado el tiempo suficiente
      if (!this.bubbleDragEnabled) return;
      
      const deltaY = Math.abs(e.clientY - this.dragStartY);
      if (!hasMoved && deltaY > 5) {
        hasMoved = true;
        this.isDragging = true;
        event.preventDefault();
      }
      
      if (hasMoved) {
        const viewportHeight = window.innerHeight;
        const newTop = this.initialTopPosition + ((e.clientY - this.dragStartY) / viewportHeight) * 100;
        this.bubbleTopPosition = Math.max(10, Math.min(90, newTop));
        this.cdr.detectChanges();
      }
    };
    
    const onMouseUp = (e: MouseEvent) => {
      // Cancelar timer si existe
      if (this.bubbleHoldTimer) {
        clearTimeout(this.bubbleHoldTimer);
        this.bubbleHoldTimer = null;
      }
      
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        this.isDragging = false;
        this.saveBubblePosition();
        this.lastClickTime = Date.now();
        this.cdr.markForCheck();
      } else {
        // Click normal - no hacemos nada aquí, dejamos que el evento click lo procese
      }
      this.bubbleDragEnabled = false;
    };
    
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp, { once: true });
    });
  }

  onBubbleTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    
    this.isDragging = false;
    const touch = event.touches[0];
    this.dragStartY = touch.clientY;
    this.initialTopPosition = this.bubbleTopPosition;
    this.bubbleDragEnabled = false;
    let hasMoved = false;
    const startTime = Date.now();

    // Timer para activar modo drag después de mantener presionado
    this.bubbleHoldTimer = setTimeout(() => {
      this.bubbleDragEnabled = true;
    }, this.HOLD_TO_DRAG_DELAY);
    
    const onTouchMove = (e: TouchEvent) => {
      // Solo permitir drag si se mantuvo presionado el tiempo suficiente
      if (!this.bubbleDragEnabled) return;
      
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const deltaY = Math.abs(touch.clientY - this.dragStartY);
        
        if (!hasMoved && deltaY > 5) {
          hasMoved = true;
          this.isDragging = true;
          e.preventDefault();
        }
        
        if (hasMoved) {
          const viewportHeight = window.innerHeight;
          const newTop = this.initialTopPosition + ((touch.clientY - this.dragStartY) / viewportHeight) * 100;
          this.bubbleTopPosition = Math.max(10, Math.min(90, newTop));
          this.cdr.detectChanges();
        }
      }
    };
    
    const onTouchEnd = () => {
      // Cancelar timer si existe
      if (this.bubbleHoldTimer) {
        clearTimeout(this.bubbleHoldTimer);
        this.bubbleHoldTimer = null;
      }
      
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      
      if (hasMoved) {
        this.isDragging = false;
        this.saveBubblePosition();
        this.lastClickTime = Date.now();
        this.cdr.markForCheck();
      } else {
        // Tap normal - abrir modal DIRECTAMENTE (en móvil el evento click puede no dispararse)
        const tapTime = Date.now() - startTime;
        if (tapTime < this.HOLD_TO_DRAG_DELAY + 100) { // +100ms de tolerancia
          this.isModalOpen = true;
          // Marcar tiempo para prevenir doble toggle si click se dispara después
          this.lastClickTime = Date.now();
          this.cdr.markForCheck();
        }
      }
      this.bubbleDragEnabled = false;
    };
    
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd, { once: true });
    });
  }

  closeModal() {
    this.isModalOpen = false;
    this.showContextMenu = false;
    this.selectedTemplate = null;
    this.cdr.markForCheck();
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
    return env ? (env.emoji ? `${env.emoji} ${env.name}` : env.name) : 'Desconocido';
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

