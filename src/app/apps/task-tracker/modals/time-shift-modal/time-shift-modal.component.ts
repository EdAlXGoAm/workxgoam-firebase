import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { TaskGroup } from '../../models/task-group.model';
import { TaskTimeService } from '../../services/task-time.service';

export interface TimeShiftResult {
  confirmed: boolean;
  minutes?: number;
  direction?: 'forward' | 'backward';
  fragmentIndex?: number;
}

@Component({
  selector: 'app-time-shift-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-icon">
            <i class="fas" [ngClass]="isVertical ? 'fa-arrows-alt-v' : 'fa-arrows-alt-h'"></i>
          </div>
          <h2 class="modal-title">Desplazar Tarea</h2>
          <button class="close-btn" (click)="onCancel()">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Task Info -->
        <div class="task-info">
          <span class="task-emoji">{{ task?.emoji || '📋' }}</span>
          <div class="task-details">
            <span class="task-name">{{ task?.name || 'Sin título' }}</span>
            <span class="task-time">
              {{ formatTime(task?.start) }} - {{ formatTime(task?.end) }}
            </span>
          </div>
        </div>

        <!-- Copy buttons -->
        <div class="copy-buttons">
          <button class="copy-btn" (click)="copyTitle()" title="Copiar título">
            <i class="fas fa-copy"></i>
            <span>Copy Title</span>
          </button>
          <button *ngIf="hasComplexGroup()" class="copy-btn" (click)="copyComplexTitleWithTitle()" title="Copiar título complejo + título">
            <i class="fas fa-clipboard"></i>
            <span>Copy Complex + Title</span>
          </button>
        </div>

        <!-- Fragment indicator -->
        <div *ngIf="fragmentIndex !== undefined && fragmentIndex !== null" class="fragment-badge">
          <i class="fas fa-puzzle-piece"></i>
          <span>Fragmento {{ fragmentIndex + 1 }}</span>
        </div>

        <!-- Direction selector -->
        <div class="direction-section">
          <label class="section-label">Dirección</label>
          <div class="direction-buttons">
            <button 
              class="direction-btn" 
              [class.active]="direction === 'backward'"
              (click)="direction = 'backward'">
              <i class="fas" [ngClass]="isVertical ? 'fa-arrow-up' : 'fa-arrow-left'"></i>
              <span>{{ isVertical ? 'Más temprano' : 'Atrás' }}</span>
            </button>
            <button 
              class="direction-btn" 
              [class.active]="direction === 'forward'"
              (click)="direction = 'forward'">
              <i class="fas" [ngClass]="isVertical ? 'fa-arrow-down' : 'fa-arrow-right'"></i>
              <span>{{ isVertical ? 'Más tarde' : 'Adelante' }}</span>
            </button>
          </div>
        </div>

        <!-- Time amount selector -->
        <div class="time-section">
          <label class="section-label">Tiempo a desplazar</label>
          
          <!-- Quick buttons -->
          <div class="quick-buttons">
            <button 
              *ngFor="let opt of quickOptions" 
              class="quick-btn"
              [class.active]="selectedMinutes === opt.value"
              (click)="selectedMinutes = opt.value">
              {{ opt.label }}
            </button>
          </div>

          <!-- Custom input -->
          <div class="custom-input-section">
            <label class="custom-label">O ingresa un valor personalizado:</label>
            <div class="custom-input-row">
              <input 
                type="number" 
                class="custom-input"
                [(ngModel)]="customMinutes"
                min="1"
                max="1440"
                placeholder="Minutos"
                (change)="onCustomInputChange()">
              <span class="input-suffix">minutos</span>
            </div>
          </div>

          <!-- Preview -->
          <div class="preview-section" *ngIf="selectedMinutes > 0">
            <div class="preview-label">Vista previa:</div>
            <div class="preview-times">
              <div class="preview-item">
                <span class="preview-old">{{ formatTime(task?.start) }}</span>
                <i class="fas fa-arrow-right"></i>
                <span class="preview-new">{{ getPreviewStart() }}</span>
              </div>
              <div class="preview-item">
                <span class="preview-old">{{ formatTime(task?.end) }}</span>
                <i class="fas fa-arrow-right"></i>
                <span class="preview-new">{{ getPreviewEnd() }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="modal-actions">
          <button class="btn-cancel" (click)="onCancel()">
            Cancelar
          </button>
          <button 
            class="btn-confirm" 
            (click)="onConfirm()"
            [disabled]="selectedMinutes <= 0">
            <i class="fas fa-check"></i>
            Aplicar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      padding: 16px;
      animation: fadeIn 0.2s ease-out;
      overflow: hidden;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-content {
      background: white;
      border-radius: 16px;
      width: 100%;
      max-width: 420px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px 16px 0 0;
    }

    .header-icon {
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
    }

    .modal-title {
      flex: 1;
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: white;
    }

    .close-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      cursor: pointer;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .task-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    .task-emoji {
      font-size: 32px;
    }

    .task-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .task-name {
      font-weight: 600;
      color: #111827;
      font-size: 15px;
    }

    .task-time {
      font-size: 13px;
      color: #6b7280;
    }

    .copy-buttons {
      display: flex;
      gap: 8px;
      padding: 8px 20px;
      background: #f3f4f6;
      border-bottom: 1px solid #e5e7eb;
    }

    .copy-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: white;
      font-size: 12px;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s;
    }

    .copy-btn:hover {
      background: #eef2ff;
      border-color: #6366f1;
      color: #4f46e5;
    }

    .copy-btn i {
      font-size: 11px;
    }

    .fragment-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 20px;
      background: #fef3c7;
      color: #92400e;
      font-size: 13px;
      font-weight: 500;
    }

    .fragment-badge i {
      font-size: 12px;
    }

    .direction-section,
    .time-section {
      padding: 16px 20px;
    }

    .section-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .direction-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .direction-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 16px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      background: white;
      cursor: pointer;
      transition: all 0.2s;
    }

    .direction-btn:hover {
      border-color: #a5b4fc;
      background: #f0f4ff;
    }

    .direction-btn.active {
      border-color: #6366f1;
      background: #eef2ff;
      color: #4f46e5;
    }

    .direction-btn i {
      font-size: 20px;
    }

    .direction-btn span {
      font-size: 13px;
      font-weight: 500;
    }

    .quick-buttons {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }

    .quick-btn {
      padding: 10px 8px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      background: white;
      font-size: 12px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s;
    }

    .quick-btn:hover {
      border-color: #a5b4fc;
      background: #f0f4ff;
    }

    .quick-btn.active {
      border-color: #6366f1;
      background: #6366f1;
      color: white;
    }

    .custom-input-section {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    }

    .custom-label {
      display: block;
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .custom-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .custom-input {
      flex: 1;
      padding: 10px 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    .custom-input:focus {
      border-color: #6366f1;
    }

    .input-suffix {
      font-size: 13px;
      color: #6b7280;
    }

    .preview-section {
      margin-top: 16px;
      padding: 12px;
      background: #f0fdf4;
      border-radius: 10px;
      border: 1px solid #bbf7d0;
    }

    .preview-label {
      font-size: 12px;
      font-weight: 600;
      color: #166534;
      margin-bottom: 8px;
    }

    .preview-times {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .preview-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .preview-old {
      color: #6b7280;
      text-decoration: line-through;
    }

    .preview-item i {
      color: #22c55e;
      font-size: 10px;
    }

    .preview-new {
      color: #166534;
      font-weight: 600;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
      border-radius: 0 0 16px 16px;
    }

    .btn-cancel,
    .btn-confirm {
      flex: 1;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-cancel {
      background: white;
      border: 2px solid #e5e7eb;
      color: #374151;
    }

    .btn-cancel:hover {
      background: #f3f4f6;
    }

    .btn-confirm {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border: none;
      color: white;
    }

    .btn-confirm:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }

    .btn-confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @media (max-width: 480px) {
      .modal-content {
        max-height: 100vh;
        border-radius: 0;
      }

      .modal-header {
        border-radius: 0;
      }

      .modal-actions {
        border-radius: 0;
      }

      .quick-buttons {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `]
})
export class TimeShiftModalComponent implements OnInit, OnDestroy {
  @Input() task: Task | null = null;
  @Input() fragmentIndex: number | null = null;
  @Input() isVertical: boolean = false; // true para week-timeline (up/down), false para daily (left/right)
  @Input() suggestedDirection: 'forward' | 'backward' = 'forward';
  @Input() suggestedMinutes: number = 0;
  @Input() taskGroups: TaskGroup[] = [];
  
  @Output() confirm = new EventEmitter<TimeShiftResult>();
  @Output() cancel = new EventEmitter<void>();

  direction: 'forward' | 'backward' = 'forward';
  selectedMinutes: number = 0;
  customMinutes: number | null = null;

  quickOptions: { value: number; label: string }[] = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '1 hora' },
    { value: 90, label: '1.5 h' },
    { value: 120, label: '2 horas' },
    { value: 180, label: '3 horas' },
    { value: 240, label: '4 horas' }
  ];

  private originalParent: HTMLElement | null = null;
  private originalNextSibling: Node | null = null;

  constructor(
    private taskTimeService: TaskTimeService,
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    // Mover el modal al body para evitar problemas de stacking context
    const element = this.elementRef.nativeElement;
    this.originalParent = element.parentElement;
    this.originalNextSibling = element.nextSibling;
    this.renderer.appendChild(document.body, element);

    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    (document.body as any).__scrollY = scrollY;
    this.direction = this.suggestedDirection;
    if (this.suggestedMinutes > 0) {
      this.selectedMinutes = this.suggestedMinutes;
      this.customMinutes = this.suggestedMinutes;
    }
  }

  ngOnDestroy(): void {
    // Restaurar el elemento a su posición original
    const element = this.elementRef.nativeElement;
    if (this.originalParent) {
      if (this.originalNextSibling) {
        this.renderer.insertBefore(this.originalParent, element, this.originalNextSibling);
      } else {
        this.renderer.appendChild(this.originalParent, element);
      }
    }

    const scrollY = (document.body as any).__scrollY || 0;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
    delete (document.body as any).__scrollY;
  }

  onCustomInputChange(): void {
    if (this.customMinutes && this.customMinutes > 0) {
      this.selectedMinutes = this.customMinutes;
    }
  }

  formatTime(isoString: string | undefined): string {
    if (!isoString) return '--:--';
    const date = new Date(isoString + 'Z');
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }

  getPreviewStart(): string {
    if (!this.task?.start || this.selectedMinutes <= 0) return '--:--';
    
    const shift = this.direction === 'forward' ? this.selectedMinutes : -this.selectedMinutes;
    const date = new Date(this.task.start + 'Z');
    date.setMinutes(date.getMinutes() + shift);
    
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }

  getPreviewEnd(): string {
    if (!this.task?.end || this.selectedMinutes <= 0) return '--:--';
    
    const shift = this.direction === 'forward' ? this.selectedMinutes : -this.selectedMinutes;
    const date = new Date(this.task.end + 'Z');
    date.setMinutes(date.getMinutes() + shift);
    
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }

  onConfirm(): void {
    const result: TimeShiftResult = {
      confirmed: true,
      minutes: this.selectedMinutes,
      direction: this.direction
    };
    
    if (this.fragmentIndex !== null && this.fragmentIndex !== undefined) {
      result.fragmentIndex = this.fragmentIndex;
    }
    
    this.confirm.emit(result);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  /**
   * Obtiene el nombre del grupo de tarea compleja dado su ID
   */
  getTaskGroupName(groupId: string | undefined): string | null {
    if (!groupId) return null;
    const group = this.taskGroups.find(g => g.id === groupId);
    return group ? group.name : null;
  }

  /**
   * Verifica si la tarea tiene un grupo complejo asignado
   */
  hasComplexGroup(): boolean {
    return !!(this.task?.taskGroupId && this.getTaskGroupName(this.task.taskGroupId));
  }

  /**
   * Copia el título de la tarea al portapapeles
   */
  async copyTitle(): Promise<void> {
    if (this.task) {
      try {
        await navigator.clipboard.writeText(this.task.name);
      } catch (err) {
        console.error('Error al copiar:', err);
      }
    }
  }

  /**
   * Copia el título complejo + título de la tarea al portapapeles
   * Formato: "(ComplexTitle) Title"
   */
  async copyComplexTitleWithTitle(): Promise<void> {
    if (this.task) {
      const groupName = this.getTaskGroupName(this.task.taskGroupId);
      if (groupName) {
        const text = `(${groupName}) ${this.task.name}`;
        try {
          await navigator.clipboard.writeText(text);
        } catch (err) {
          console.error('Error al copiar:', err);
        }
      }
    }
  }
}
