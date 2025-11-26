import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { TaskTimeService } from '../../services/task-time.service';

export interface DurationEditResult {
  confirmed: boolean;
  newDurationMinutes?: number;
  adjustStart?: boolean; // true = mantener fin, ajustar inicio; false = mantener inicio, ajustar fin
  fragmentIndex?: number;
}

@Component({
  selector: 'app-duration-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onCancel()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-icon">
            <i class="fas fa-expand-alt"></i>
          </div>
          <h2 class="modal-title">Cambiar Duración</h2>
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
            <span class="task-duration">
              <i class="fas fa-hourglass-half"></i>
              Duración actual: {{ formatDuration(currentDurationMinutes) }}
            </span>
          </div>
        </div>

        <!-- Fragment indicator -->
        <div *ngIf="fragmentIndex !== undefined && fragmentIndex !== null" class="fragment-badge">
          <i class="fas fa-puzzle-piece"></i>
          <span>Fragmento {{ fragmentIndex + 1 }} - {{ formatDuration(fragmentDurationMinutes) }}</span>
        </div>

        <!-- Adjustment mode selector -->
        <div class="adjustment-section">
          <label class="section-label">¿Qué mantener fijo?</label>
          <div class="adjustment-buttons">
            <button 
              class="adjustment-btn" 
              [class.active]="!adjustStart"
              (click)="adjustStart = false">
              <i class="fas fa-step-backward"></i>
              <div class="btn-text">
                <span class="btn-title">Mantener Inicio</span>
                <span class="btn-desc">La tarea empezará a la misma hora</span>
              </div>
            </button>
            <button 
              class="adjustment-btn" 
              [class.active]="adjustStart"
              (click)="adjustStart = true">
              <i class="fas fa-step-forward"></i>
              <div class="btn-text">
                <span class="btn-title">Mantener Fin</span>
                <span class="btn-desc">La tarea terminará a la misma hora</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Duration selector -->
        <div class="duration-section">
          <label class="section-label">Nueva duración</label>
          
          <!-- Quick buttons -->
          <div class="quick-buttons">
            <button 
              *ngFor="let opt of durationOptions" 
              class="quick-btn"
              [class.active]="selectedDuration === opt.value"
              [class.current]="opt.value === currentDurationMinutes"
              (click)="selectedDuration = opt.value">
              {{ opt.label }}
              <span *ngIf="opt.value === currentDurationMinutes" class="current-badge">actual</span>
            </button>
          </div>

          <!-- Custom input -->
          <div class="custom-input-section">
            <label class="custom-label">O ingresa una duración personalizada:</label>
            <div class="custom-input-row">
              <div class="input-group">
                <input 
                  type="number" 
                  class="custom-input"
                  [(ngModel)]="customHours"
                  min="0"
                  max="24"
                  placeholder="0"
                  (change)="onCustomInputChange()">
                <span class="input-suffix">horas</span>
              </div>
              <div class="input-group">
                <input 
                  type="number" 
                  class="custom-input"
                  [(ngModel)]="customMinutes"
                  min="0"
                  max="59"
                  step="15"
                  placeholder="0"
                  (change)="onCustomInputChange()">
                <span class="input-suffix">minutos</span>
              </div>
            </div>
          </div>

          <!-- Preview -->
          <div class="preview-section" *ngIf="selectedDuration > 0">
            <div class="preview-label">Vista previa:</div>
            <div class="preview-content">
              <div class="preview-row">
                <span class="preview-icon">
                  <i class="fas" [ngClass]="adjustStart ? 'fa-lock-open' : 'fa-lock'"></i>
                </span>
                <span class="preview-label-time">Inicio:</span>
                <span class="preview-time" [class.changed]="adjustStart">
                  {{ getPreviewStart() }}
                </span>
              </div>
              <div class="preview-row">
                <span class="preview-icon">
                  <i class="fas" [ngClass]="!adjustStart ? 'fa-lock-open' : 'fa-lock'"></i>
                </span>
                <span class="preview-label-time">Fin:</span>
                <span class="preview-time" [class.changed]="!adjustStart">
                  {{ getPreviewEnd() }}
                </span>
              </div>
              <div class="preview-row duration-row">
                <span class="preview-icon">
                  <i class="fas fa-clock"></i>
                </span>
                <span class="preview-label-time">Duración:</span>
                <span class="preview-time new-duration">
                  {{ formatDuration(selectedDuration) }}
                </span>
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
            [disabled]="selectedDuration <= 0 || selectedDuration === currentDurationMinutes">
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
      z-index: 10000;
      padding: 16px;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-content {
      background: white;
      border-radius: 16px;
      width: 100%;
      max-width: 460px;
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
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
      align-items: flex-start;
      gap: 12px;
      padding: 16px 20px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    .task-emoji {
      font-size: 32px;
      margin-top: 2px;
    }

    .task-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
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

    .task-duration {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #059669;
      font-weight: 500;
    }

    .task-duration i {
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

    .adjustment-section,
    .duration-section {
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

    .adjustment-buttons {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .adjustment-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      background: white;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    }

    .adjustment-btn:hover {
      border-color: #86efac;
      background: #f0fdf4;
    }

    .adjustment-btn.active {
      border-color: #10b981;
      background: #ecfdf5;
    }

    .adjustment-btn i {
      font-size: 18px;
      color: #10b981;
      width: 24px;
      text-align: center;
    }

    .btn-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .btn-title {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }

    .btn-desc {
      font-size: 12px;
      color: #6b7280;
    }

    .quick-buttons {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }

    .quick-btn {
      padding: 10px 6px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      background: white;
      font-size: 12px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .quick-btn:hover {
      border-color: #86efac;
      background: #f0fdf4;
    }

    .quick-btn.active {
      border-color: #10b981;
      background: #10b981;
      color: white !important;
    }

    .quick-btn.active .current-badge {
      color: white !important;
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 5px;
      border-radius: 4px;
    }

    .quick-btn.current:not(.active) {
      border-color: #a5b4fc;
      background: #eef2ff;
      color: #4f46e5;
    }

    .quick-btn.current:not(.active) .current-badge {
      color: #6366f1;
    }

    /* Asegurar que active siempre gane sobre current */
    .quick-btn.active.current {
      border-color: #10b981;
      background: #10b981;
      color: white !important;
    }

    .current-badge {
      font-size: 9px;
      text-transform: uppercase;
      opacity: 0.8;
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
      gap: 16px;
    }

    .input-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .custom-input {
      width: 70px;
      padding: 10px 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
      text-align: center;
    }

    .custom-input:focus {
      border-color: #10b981;
    }

    .input-suffix {
      font-size: 13px;
      color: #6b7280;
    }

    .preview-section {
      margin-top: 16px;
      padding: 14px;
      background: #f0fdf4;
      border-radius: 10px;
      border: 1px solid #bbf7d0;
    }

    .preview-label {
      font-size: 12px;
      font-weight: 600;
      color: #166534;
      margin-bottom: 10px;
    }

    .preview-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .preview-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }

    .preview-icon {
      width: 20px;
      text-align: center;
      color: #6b7280;
    }

    .preview-icon i {
      font-size: 11px;
    }

    .preview-label-time {
      width: 50px;
      color: #6b7280;
    }

    .preview-time {
      font-weight: 600;
      color: #374151;
    }

    .preview-time.changed {
      color: #10b981;
    }

    .duration-row {
      padding-top: 8px;
      border-top: 1px dashed #bbf7d0;
      margin-top: 4px;
    }

    .new-duration {
      color: #059669 !important;
      font-size: 14px;
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
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border: none;
      color: white;
    }

    .btn-confirm:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
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

      .custom-input-row {
        flex-direction: column;
        gap: 10px;
      }

      .input-group {
        width: 100%;
      }

      .custom-input {
        flex: 1;
        width: auto;
      }
    }
  `]
})
export class DurationEditModalComponent implements OnInit {
  @Input() task: Task | null = null;
  @Input() fragmentIndex: number | null = null;
  @Input() suggestedAdjustStart: boolean = false; // true si se arrastró desde el borde izquierdo/superior
  
  @Output() confirm = new EventEmitter<DurationEditResult>();
  @Output() cancel = new EventEmitter<void>();

  adjustStart: boolean = false;
  selectedDuration: number = 0;
  customHours: number = 0;
  customMinutes: number = 0;
  currentDurationMinutes: number = 0;
  fragmentDurationMinutes: number = 0;

  durationOptions: { value: number; label: string }[] = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '1 hora' },
    { value: 90, label: '1.5 h' },
    { value: 120, label: '2 horas' },
    { value: 180, label: '3 horas' },
    { value: 240, label: '4 horas' }
  ];

  constructor(private taskTimeService: TaskTimeService) {}

  ngOnInit(): void {
    this.adjustStart = this.suggestedAdjustStart;
    
    if (this.task) {
      // Calcular duración actual
      if (this.fragmentIndex !== null && this.fragmentIndex !== undefined) {
        this.fragmentDurationMinutes = this.taskTimeService.getFragmentDurationMinutes(this.task, this.fragmentIndex);
        this.currentDurationMinutes = this.fragmentDurationMinutes;
      } else {
        this.currentDurationMinutes = this.taskTimeService.getTaskDurationMinutes(this.task);
      }
      
      this.selectedDuration = this.currentDurationMinutes;
      this.customHours = Math.floor(this.currentDurationMinutes / 60);
      this.customMinutes = this.currentDurationMinutes % 60;
    }
  }

  onCustomInputChange(): void {
    const totalMinutes = (this.customHours * 60) + this.customMinutes;
    if (totalMinutes > 0) {
      this.selectedDuration = totalMinutes;
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

  formatDuration(minutes: number): string {
    return this.taskTimeService.formatDuration(minutes);
  }

  getPreviewStart(): string {
    if (!this.task?.start || this.selectedDuration <= 0) return '--:--';
    
    if (this.adjustStart) {
      // El inicio cambia, el fin se mantiene
      const end = new Date(this.task.end + 'Z');
      const newStart = new Date(end.getTime() - (this.selectedDuration * 60 * 1000));
      return newStart.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else {
      // El inicio se mantiene
      return this.formatTime(this.task.start);
    }
  }

  getPreviewEnd(): string {
    if (!this.task?.end || this.selectedDuration <= 0) return '--:--';
    
    if (!this.adjustStart) {
      // El fin cambia, el inicio se mantiene
      const start = new Date(this.task.start + 'Z');
      const newEnd = new Date(start.getTime() + (this.selectedDuration * 60 * 1000));
      return newEnd.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else {
      // El fin se mantiene
      return this.formatTime(this.task.end);
    }
  }

  onConfirm(): void {
    const result: DurationEditResult = {
      confirmed: true,
      newDurationMinutes: this.selectedDuration,
      adjustStart: this.adjustStart
    };
    
    if (this.fragmentIndex !== null && this.fragmentIndex !== undefined) {
      result.fragmentIndex = this.fragmentIndex;
    }
    
    this.confirm.emit(result);
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

