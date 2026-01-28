import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

type Priority = 'low' | 'medium' | 'high' | 'critical';

interface PriorityLevel {
  value: Priority;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
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
    <div class="priority-slider">
      <div 
        *ngFor="let level of priorityLevels; let i = index; let first = first; let last = last"
        class="priority-segment"
        [class.selected]="selectedPriority === level.value"
        [class.first]="first"
        [class.last]="last"
        [style.--segment-color]="level.color"
        [style.--segment-bg]="level.bgColor"
        (click)="selectPriority(level.value)">
        <span class="priority-dot" [style.background-color]="level.color"></span>
        <span class="priority-label-full">{{ level.label }}</span>
        <span class="priority-label-short">{{ level.shortLabel }}</span>
      </div>
    </div>
  `,
  styles: [`
    .priority-slider {
      display: flex;
      align-items: stretch;
      background: #f3f4f6;
      border-radius: 8px;
      padding: 2px;
      gap: 2px;
      height: 32px;
    }

    .priority-segment {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      flex: 1;
      padding: 0 8px;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s ease;
      user-select: none;
      background: transparent;
    }

    .priority-segment:hover:not(.selected) {
      background: rgba(0, 0, 0, 0.05);
    }

    .priority-segment.selected {
      background: var(--segment-bg);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .priority-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: transform 0.2s ease;
    }

    .priority-segment.selected .priority-dot {
      transform: scale(1.2);
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
    }

    .priority-label-full,
    .priority-label-short {
      font-size: 12px;
      font-weight: 500;
      color: #6b7280;
      white-space: nowrap;
      transition: color 0.2s ease;
    }

    .priority-label-short {
      display: none;
    }

    .priority-segment.selected .priority-label-full,
    .priority-segment.selected .priority-label-short {
      color: #1f2937;
      font-weight: 600;
    }

    /* Responsive: pantallas estrechas */
    @media (max-width: 400px) {
      .priority-slider {
        height: 28px;
      }

      .priority-segment {
        padding: 0 4px;
        gap: 4px;
      }

      .priority-label-full {
        display: none;
      }

      .priority-label-short {
        display: inline;
      }

      .priority-dot {
        width: 8px;
        height: 8px;
      }
    }

    /* Pantallas muy estrechas: solo puntos */
    @media (max-width: 300px) {
      .priority-label-short {
        display: none;
      }

      .priority-dot {
        width: 12px;
        height: 12px;
      }
    }
  `]
})
export class PrioritySelectorComponent implements ControlValueAccessor {
  @Output() priorityChange = new EventEmitter<Priority>();

  selectedPriority: Priority = 'medium';

  priorityLevels: PriorityLevel[] = [
    { value: 'low', label: 'Baja', shortLabel: 'B', color: '#4caf50', bgColor: '#e8f5e9' },
    { value: 'medium', label: 'Media', shortLabel: 'M', color: '#ff9800', bgColor: '#fff3e0' },
    { value: 'high', label: 'Alta', shortLabel: 'A', color: '#f44336', bgColor: '#ffebee' },
    { value: 'critical', label: 'Critica', shortLabel: 'C', color: '#9c27b0', bgColor: '#f3e5f5' }
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