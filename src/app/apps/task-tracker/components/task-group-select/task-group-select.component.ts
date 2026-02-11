import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskGroup } from '../../models/task-group.model';
import { TaskGroupService } from '../../services/task-group.service';
import { TaskService } from '../../services/task.service';
import { Task } from '../../models/task.model';

@Component({
  selector: 'app-task-group-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-group-select.component.html',
  styleUrls: ['./task-group-select.component.css']
})
export class TaskGroupSelectComponent implements OnInit, OnChanges {
  @Input() projectId: string | undefined;
  @Input() taskGroups: TaskGroup[] = [];
  @Input() value: string | undefined; // ID del grupo seleccionado
  @Input() placeholder: string = 'Seleccionar o crear grupo...';
  @Input() emptyMessage: string = 'No hay grupos disponibles';
  @Input() disabled: boolean = false;
  @Input() autoOpen: boolean = false;

  @Output() valueChange = new EventEmitter<string | undefined>();
  @Output() groupCreated = new EventEmitter<TaskGroup>();
  @Output() groupDeleted = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('containerRef', { static: false }) containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('inputRef', { static: false }) inputRef!: ElementRef<HTMLDivElement>;
  @ViewChild('searchInputRef', { static: false }) searchInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('dropdownRef', { static: false }) dropdownRef!: ElementRef<HTMLDivElement>;

  isOpen = false;
  searchQuery = '';
  dropdownPosition = { top: 0, left: 0, width: 0 };
  taskUsageCounts = new Map<string, number>();
  allTasks: Task[] = [];

  constructor(
    private taskGroupService: TaskGroupService,
    private taskService: TaskService
  ) {}

  ngOnInit() {
    if (this.autoOpen) {
      setTimeout(() => {
        this.calculateDropdownPosition();
      }, 10);
    }
    this.loadTaskUsageCounts();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['projectId'] && !changes['projectId'].firstChange) {
      this.loadTaskUsageCounts();
    }
    if (changes['isOpen'] && this.isOpen) {
      this.searchQuery = '';
    }
  }

  async loadTaskUsageCounts() {
    if (!this.projectId) {
      this.taskUsageCounts.clear();
      return;
    }

    try {
      this.allTasks = await this.taskService.getTasks();
      const projectTasks = this.allTasks.filter(t => t.project === this.projectId);
      
      this.taskUsageCounts.clear();
      this.taskGroups.forEach(group => {
        const count = projectTasks.filter(t => t.taskGroupId === group.id).length;
        this.taskUsageCounts.set(group.id, count);
      });
    } catch (error) {
      console.error('Error al cargar conteos de uso:', error);
    }
  }

  get selectedTaskGroup(): TaskGroup | null {
    if (!this.value) return null;
    return this.taskGroups.find(g => g.id === this.value) || null;
  }

  get filteredTaskGroups(): TaskGroup[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      return [...this.taskGroups].sort((a, b) => a.name.localeCompare(b.name));
    }
    return this.taskGroups
      .filter(g => g.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get canCreateNewGroup(): boolean {
    if (!this.searchQuery || !this.searchQuery.trim()) {
      return false;
    }
    const queryLower = this.searchQuery.trim().toLowerCase();
    return !this.taskGroups.some(g => g.name.toLowerCase() === queryLower);
  }

  getTaskGroupUsageCount(groupId: string): number {
    return this.taskUsageCounts.get(groupId) || 0;
  }

  calculateDropdownPosition() {
    if (this.inputRef?.nativeElement) {
      const rect = this.inputRef.nativeElement.getBoundingClientRect();
      this.dropdownPosition = {
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      };
    }
  }

  toggleDropdown(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (this.disabled) return;

    if (!this.isOpen) {
      this.calculateDropdownPosition();
      this.isOpen = true;
      const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
      if (!isMobile) {
        setTimeout(() => {
          this.searchInputRef?.nativeElement?.focus();
        }, 50);
      }
    } else {
      this.isOpen = false;
    }
  }

  closeWithoutSelection() {
    this.isOpen = false;
    this.close.emit();
  }

  handleSelect(group: TaskGroup) {
    const prevId = this.value;
    this.value = group.id;
    this.valueChange.emit(group.id);
    this.isOpen = false;
    // Actualizar contadores en la lista: una tarea menos en el grupo anterior, una más en el nuevo
    this.updateUsageCountsOptimistic(prevId, group.id);
  }

  handleClearSelection(e?: Event) {
    if (e) {
      e.stopPropagation();
    }
    const prevId = this.value;
    this.value = undefined;
    this.valueChange.emit(undefined);
    this.isOpen = false;
    // Actualizar contador: una tarea menos en el grupo que se deseleccionó
    if (prevId) {
      this.updateUsageCountsOptimistic(prevId, undefined);
    }
  }

  /** Actualiza los contadores mostrados en la lista sin recargar desde el servidor (optimista). */
  private updateUsageCountsOptimistic(leftGroupId: string | undefined, addedToGroupId: string | undefined) {
    const next = new Map(this.taskUsageCounts);
    if (leftGroupId) {
      const c = next.get(leftGroupId) ?? 0;
      next.set(leftGroupId, Math.max(0, c - 1));
    }
    if (addedToGroupId) {
      next.set(addedToGroupId, (next.get(addedToGroupId) ?? 0) + 1);
    }
    this.taskUsageCounts = next;
  }

  async handleCreateCustom() {
    if (!this.searchQuery.trim() || !this.projectId) {
      console.log('[TaskGroupSelect] handleCreateCustom salida temprana', { searchQuery: this.searchQuery?.trim(), projectId: this.projectId });
      return;
    }
    console.log('[TaskGroupSelect] handleCreateCustom inicio', { name: this.searchQuery.trim(), projectId: this.projectId });

    try {
      const newGroupId = await this.taskGroupService.createTaskGroup({
        projectId: this.projectId,
        name: this.searchQuery.trim()
      });
      console.log('[TaskGroupSelect] createTaskGroup OK', { newGroupId });

      // Recargar grupos (el padre debería hacer esto, pero por ahora lo hacemos aquí)
      const newGroup: TaskGroup = {
        id: newGroupId,
        userId: '',
        projectId: this.projectId,
        name: this.searchQuery.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.groupCreated.emit(newGroup);
      console.log('[TaskGroupSelect] groupCreated emitido', { groupId: newGroup.id, name: newGroup.name });
      this.handleSelect(newGroup);
      console.log('[TaskGroupSelect] handleSelect llamado, value=', this.value);
    } catch (error) {
      console.error('[TaskGroupSelect] Error al crear grupo:', error);
      alert('Error al crear el grupo. Por favor intenta nuevamente.');
    }
  }

  async handleDelete(groupId: string, e: Event) {
    e.stopPropagation();
    const count = this.getTaskGroupUsageCount(groupId);
    
    if (count > 0) {
      alert(`No se puede eliminar el grupo porque tiene ${count} tarea${count !== 1 ? 's' : ''} asociada${count !== 1 ? 's' : ''}.`);
      return;
    }

    if (window.confirm('¿Estás seguro de eliminar este grupo?')) {
      try {
        await this.taskGroupService.deleteTaskGroup(groupId);
        this.groupDeleted.emit(groupId);
        
        // Si el grupo eliminado era el seleccionado, limpiar selección
        if (this.value === groupId) {
          this.value = undefined;
          this.valueChange.emit(undefined);
        }
      } catch (error: any) {
        console.error('Error eliminando grupo:', error);
        alert(error.message || 'Error al eliminar el grupo');
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Node;
    const isInsideContainer = this.containerRef?.nativeElement?.contains(target);
    const isInsideDropdown = this.dropdownRef?.nativeElement?.contains(target);
    
    if (!isInsideContainer && !isInsideDropdown && this.isOpen) {
      this.isOpen = false;
      this.close.emit();
    }
  }

  @HostListener('window:scroll', ['$event'])
  onWindowScroll() {
    if (this.isOpen) {
      this.calculateDropdownPosition();
    }
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize() {
    if (this.isOpen) {
      this.calculateDropdownPosition();
    }
  }
}
