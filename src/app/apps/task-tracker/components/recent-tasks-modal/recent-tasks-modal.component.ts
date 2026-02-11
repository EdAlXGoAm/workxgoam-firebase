import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';

export interface RecentTaskGroup {
  name: string;
  emoji: string;
  tasks: { task: Task; originalIndex: number }[];
}

export interface RecentTaskItem {
  task: Task;
  originalIndex: number;
}

@Component({
  selector: 'app-recent-tasks-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recent-tasks-modal.component.html',
  styleUrls: ['./recent-tasks-modal.component.css']
})
export class RecentTasksModalComponent {
  @Input() visible = false;
  @Input() recentTasks: Task[] = [];
  @Input() multipleTaskGroups: RecentTaskGroup[] = [];
  @Input() singleTasks: RecentTaskItem[] = [];
  @Input() expandedGroupNames: string[] = [];
  @Input() editingTaskIndex: number | null = null;
  @Input() editingField: 'emoji' | 'name' | null = null;
  @Input() editingValue = '';
  @Input() showEmojiPickerForEdit = false;
  @Input() isSavingQuickEdit = false;

  @Output() close = new EventEmitter<void>();
  @Output() applyTask = new EventEmitter<number>();
  @Output() toggleGroup = new EventEmitter<string>();
  @Output() groupContextMenu = new EventEmitter<{ event: MouseEvent; groupName: string }>();
  @Output() groupTouchStart = new EventEmitter<{ event: TouchEvent; groupName: string }>();
  @Output() groupTouchEnd = new EventEmitter<void>();
  @Output() groupTouchMove = new EventEmitter<void>();
  @Output() recentTaskContextMenu = new EventEmitter<{ event: MouseEvent; taskIndex: number }>();
  @Output() recentTaskTouchStart = new EventEmitter<{ event: TouchEvent; taskIndex: number }>();
  @Output() recentTaskTouchEnd = new EventEmitter<void>();
  @Output() recentTaskTouchMove = new EventEmitter<void>();
  @Output() saveQuickEdit = new EventEmitter<void>();
  @Output() cancelQuickEdit = new EventEmitter<void>();
  @Output() editNameKeydown = new EventEmitter<KeyboardEvent>();
  @Output() showEmojiPickerForEditChange = new EventEmitter<boolean>();
  @Output() editingValueChange = new EventEmitter<string>();

  isGroupExpanded(groupName: string): boolean {
    return this.expandedGroupNames.includes(groupName);
  }

  formatRecentTaskDate(dateTimeString: string): string {
    const utcString = dateTimeString.includes('Z') || dateTimeString.includes('+')
      ? dateTimeString
      : dateTimeString + 'Z';

    const date = new Date(utcString);

    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }

    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dateInMexico = new Date(date.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    const diaSemana = diasSemana[dateInMexico.getDay()];

    const fechaFormateada = date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Mexico_City'
    });

    return `${diaSemana}, ${fechaFormateada}`;
  }

  formatDuration(hours: number): string {
    if (hours === 0) return '0 horas';

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

  onClose(): void {
    this.close.emit();
  }

  onApplyTask(index: number): void {
    this.applyTask.emit(index);
  }

  onToggleGroup(name: string): void {
    this.toggleGroup.emit(name);
  }

  onGroupContextMenu(event: MouseEvent, groupName: string): void {
    this.groupContextMenu.emit({ event, groupName });
  }

  onGroupTouchStart(event: TouchEvent, groupName: string): void {
    this.groupTouchStart.emit({ event, groupName });
  }

  onRecentTaskContextMenu(event: MouseEvent, taskIndex: number): void {
    this.recentTaskContextMenu.emit({ event, taskIndex });
  }

  onRecentTaskTouchStart(event: TouchEvent, taskIndex: number): void {
    this.recentTaskTouchStart.emit({ event, taskIndex });
  }

  setShowEmojiPickerForEdit(value: boolean): void {
    this.showEmojiPickerForEditChange.emit(value);
  }

  onEditNameKeydown(event: KeyboardEvent): void {
    this.editNameKeydown.emit(event);
  }

  trackByGroupName(_index: number, group: RecentTaskGroup): string {
    return group.name;
  }

  trackByOriginalIndex(_index: number, item: RecentTaskItem): number {
    return item.originalIndex;
  }
}
