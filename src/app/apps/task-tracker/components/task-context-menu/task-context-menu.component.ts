import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/task.model';
import { TaskGroup } from '../../models/task-group.model';

export interface TaskContextMenuEvent {
  action: 'edit' | 'delete' | 'toggleHidden' | 'changeStatus' | 'copyTitle' | 'copyComplexTitle' | 'copyComplexTitleWithTitle';
  task: Task;
  status?: 'pending' | 'in-progress' | 'completed';
}

@Component({
  selector: 'app-task-context-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-context-menu.component.html',
  styleUrls: ['./task-context-menu.component.css']
})
export class TaskContextMenuComponent {
  @Input() task!: Task;
  @Input() taskGroups: TaskGroup[] = [];
  @Input() isOverdue: boolean = false;
  @Input() isRunning: boolean = false;
  
  @Output() menuAction = new EventEmitter<TaskContextMenuEvent>();
  @Output() close = new EventEmitter<void>();

  hasComplexGroup(): boolean {
    return !!(this.task?.taskGroupId && this.getTaskGroupName(this.task.taskGroupId));
  }

  getTaskGroupName(groupId: string | undefined): string | null {
    if (!groupId) return null;
    const group = this.taskGroups.find(g => g.id === groupId);
    return group ? group.name : null;
  }

  onEdit(): void {
    this.menuAction.emit({ action: 'edit', task: this.task });
    this.close.emit();
  }

  onDelete(): void {
    this.menuAction.emit({ action: 'delete', task: this.task });
    this.close.emit();
  }

  onToggleHidden(): void {
    this.menuAction.emit({ action: 'toggleHidden', task: this.task });
    this.close.emit();
  }

  onChangeStatus(status: 'pending' | 'in-progress' | 'completed'): void {
    this.menuAction.emit({ action: 'changeStatus', task: this.task, status });
    this.close.emit();
  }

  async onCopyTitle(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.task.name);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
    this.close.emit();
  }

  async onCopyComplexTitle(): Promise<void> {
    const groupName = this.getTaskGroupName(this.task.taskGroupId);
    if (groupName) {
      try {
        await navigator.clipboard.writeText(groupName);
      } catch (err) {
        console.error('Error al copiar:', err);
      }
    }
    this.close.emit();
  }

  async onCopyComplexTitleWithTitle(): Promise<void> {
    const groupName = this.getTaskGroupName(this.task.taskGroupId);
    if (groupName) {
      const text = `(${groupName}) ${this.task.name}`;
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.error('Error al copiar:', err);
      }
    }
    this.close.emit();
  }
}
