import { Component, EventEmitter, Input, Output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/task.model';
import { TaskGroup } from '../../models/task-group.model';

export interface TaskContextMenuEvent {
  action: 'edit' | 'delete' | 'toggleHidden' | 'changeStatus' | 'copyTitle' | 'copyComplexTitle' | 'copyComplexTitleWithTitle'
        | 'shiftForward' | 'shiftBackward' | 'extend' | 'shrink';
  task: Task;
  status?: 'pending' | 'in-progress' | 'completed';
  minutes?: number;
}

@Component({
  selector: 'app-task-context-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-context-menu.component.html',
  styleUrls: ['./task-context-menu.component.css']
})
export class TaskContextMenuComponent implements OnDestroy {
  @Input() task!: Task;
  @Input() taskGroups: TaskGroup[] = [];
  @Input() isOverdue: boolean = false;
  @Input() isRunning: boolean = false;
  
  @Output() menuAction = new EventEmitter<TaskContextMenuEvent>();
  @Output() close = new EventEmitter<void>();

  private submenuElement: HTMLElement | null = null;
  private submenuCloseTimeout: any = null;

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

  onShiftForward(): void {
    this.menuAction.emit({ action: 'shiftForward', task: this.task, minutes: 15 });
    this.close.emit();
  }

  onShiftBackward(): void {
    this.menuAction.emit({ action: 'shiftBackward', task: this.task, minutes: 15 });
    this.close.emit();
  }

  onExtend(): void {
    this.menuAction.emit({ action: 'extend', task: this.task, minutes: 15 });
    this.close.emit();
  }

  onShrink(): void {
    this.menuAction.emit({ action: 'shrink', task: this.task, minutes: 15 });
    this.close.emit();
  }

  ngOnDestroy(): void {
    this.closeSubmenu();
  }

  onActionsMouseEnter(event: MouseEvent): void {
    // Cancelar timeout de cierre si existe
    if (this.submenuCloseTimeout) {
      clearTimeout(this.submenuCloseTimeout);
      this.submenuCloseTimeout = null;
    }
    
    if (this.submenuElement) {
      return; // Ya está abierto
    }

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    // Crear elemento directamente en el body con position fixed
    this.submenuElement = document.createElement('div');
    this.submenuElement.className = 'context-submenu-overlay';
    this.submenuElement.innerHTML = `
      <button class="context-menu-item" data-action="shiftForward">
        <i class="fas fa-forward mr-2"></i>
        Desplazar 15 min adelante
      </button>
      <button class="context-menu-item" data-action="shiftBackward">
        <i class="fas fa-backward mr-2"></i>
        Desplazar 15 min atrás
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" data-action="extend">
        <i class="fas fa-expand-arrows-alt mr-2"></i>
        Extender 15 minutos
      </button>
      <button class="context-menu-item" data-action="shrink">
        <i class="fas fa-compress-arrows-alt mr-2"></i>
        Contraer 15 minutos
      </button>
    `;

    // Agregar estilos inline al submenu con position fixed
    this.submenuElement.style.cssText = `
      position: fixed;
      left: ${rect.right}px;
      top: ${rect.top}px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 220px;
      overflow: hidden;
      z-index: 10002;
    `;

    // Agregar event listeners
    this.submenuElement.querySelectorAll('button').forEach(btn => {
      (btn as HTMLElement).style.cssText = `
        width: 100%;
        padding: 12px 16px;
        text-align: left;
        border: none;
        background: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        font-size: 14px;
        color: #374151;
        transition: background 0.15s;
      `;
      btn.addEventListener('mouseenter', () => {
        (btn as HTMLElement).style.background = '#f3f4f6';
      });
      btn.addEventListener('mouseleave', () => {
        (btn as HTMLElement).style.background = '#fff';
      });
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (action) {
          this.handleSubmenuAction(action);
        }
      });
    });

    // Estilos para el divider
    const divider = this.submenuElement.querySelector('.context-menu-divider') as HTMLElement;
    if (divider) {
      divider.style.cssText = 'height: 1px; background: #e5e7eb;';
    }

    // Estilos para los iconos
    this.submenuElement.querySelectorAll('i').forEach(icon => {
      (icon as HTMLElement).style.cssText = 'width: 20px; text-align: center; margin-right: 8px;';
    });

    // Cerrar submenú cuando el mouse sale
    this.submenuElement.addEventListener('mouseenter', () => {
      if (this.submenuCloseTimeout) {
        clearTimeout(this.submenuCloseTimeout);
        this.submenuCloseTimeout = null;
      }
    });
    
    this.submenuElement.addEventListener('mouseleave', () => {
      this.scheduleSubmenuClose();
    });

    // Agregar al body
    document.body.appendChild(this.submenuElement);
  }

  onActionsMouseLeave(): void {
    this.scheduleSubmenuClose();
  }

  private scheduleSubmenuClose(): void {
    if (this.submenuCloseTimeout) {
      clearTimeout(this.submenuCloseTimeout);
    }
    this.submenuCloseTimeout = setTimeout(() => {
      this.closeSubmenu();
    }, 150);
  }

  private closeSubmenu(): void {
    if (this.submenuCloseTimeout) {
      clearTimeout(this.submenuCloseTimeout);
      this.submenuCloseTimeout = null;
    }
    if (this.submenuElement) {
      this.submenuElement.remove();
      this.submenuElement = null;
    }
  }

  private handleSubmenuAction(action: string): void {
    switch (action) {
      case 'shiftForward':
        this.onShiftForward();
        break;
      case 'shiftBackward':
        this.onShiftBackward();
        break;
      case 'extend':
        this.onExtend();
        break;
      case 'shrink':
        this.onShrink();
        break;
    }
    this.closeSubmenu();
  }
}
