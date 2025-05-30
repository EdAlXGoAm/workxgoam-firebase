import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

type Priority = 'low' | 'medium' | 'high' | 'critical';

interface PriorityLevel {
  value: Priority;
  label: string;
  color: string;
}

@Component({
  selector: 'app-priority-selector',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PrioritySelectorComponent),
      multi: true
    }
  ],
  template: `
    <div class="priority-selector">
      <div 
        *ngFor="let level of priorityLevels; let i = index"
        class="priority-item"
        [class.selected]="selectedPriority === level.value"
        (click)="selectPriority(level.value)">
        <div 
          class="priority-point"
          [style.background-color]="level.color"
          [class.selected-point]="selectedPriority === level.value">
        </div>
        <span 
          class="priority-label"
          [class.selected-label]="selectedPriority === level.value">
          {{ level.label }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .priority-selector {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 10px 0;
      gap: 8px;
    }

    .priority-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      flex: 1;
      padding: 8px 4px;
      border-radius: 8px;
      transition: background-color 0.2s ease;
    }

    .priority-item:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }

    .priority-point {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      margin-bottom: 6px;
      transition: all 0.3s ease;
      border: 2px solid transparent;
    }

    .priority-item:hover .priority-point {
      transform: scale(1.1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .selected-point {
      border: 2px solid #000 !important;
      transform: scale(1.2);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    }

    .priority-label {
      font-size: 12px;
      color: #666;
      text-align: center;
      transition: all 0.2s ease;
      user-select: none;
    }

    .selected-label {
      font-weight: bold;
      color: #333;
    }

    .priority-item:hover .priority-label {
      color: #333;
    }
  `]
})
export class PrioritySelectorComponent implements ControlValueAccessor {
  @Output() priorityChange = new EventEmitter<Priority>();

  selectedPriority: Priority = 'medium';

  priorityLevels: PriorityLevel[] = [
    { value: 'low', label: 'Baja', color: '#4caf50' },
    { value: 'medium', label: 'Media', color: '#ff9800' },
    { value: 'high', label: 'Alta', color: '#f44336' },
    { value: 'critical', label: 'Crítica', color: '#9c27b0' }
  ];

  private onChange = (value: Priority) => {};
  private onTouched = () => {};

  selectPriority(priority: Priority) {
    this.selectedPriority = priority;
    this.onChange(priority);
    this.onTouched();
    this.priorityChange.emit(priority);
  }

  // ControlValueAccessor implementation
  writeValue(value: Priority): void {
    if (value) {
      this.selectedPriority = value;
    }
  }

  registerOnChange(fn: (value: Priority) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    // Implementar si es necesario
  }
} 