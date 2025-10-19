import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimelineSvgComponent } from '../timeline-svg/timeline-svg.component';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';

@Component({
  selector: 'app-board-view',
  standalone: true,
  imports: [CommonModule, FormsModule, TimelineSvgComponent],
  template: `
    <div class="w-full bg-white rounded-lg shadow-md p-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">Vista de Tablero</h2>
        <div *ngIf="emptyEnvironmentsCount > 0" class="flex items-center space-x-2">
          <span class="text-sm text-gray-600">{{emptyEnvironmentsCount}} ambiente(s) vacío(s)</span>
          <button (click)="toggleAllEmptyEnvironments()" 
                  class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg border transition-colors">
            <i class="fas mr-1" [ngClass]="collapsedEmptyEnvironments ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
            {{ collapsedEmptyEnvironments ? 'Expandir' : 'Contraer' }} vacíos
          </button>
        </div>
      </div>

      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-2">Línea del Tiempo</h3>
        <app-timeline-svg [tasks]="tasks" [environments]="environments" (editTask)="editTask.emit($event)"></app-timeline-svg>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div *ngFor="let env of orderedEnvironments" class="board-column">
          <div class="environment-header p-4 pb-2">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold p-2 rounded-md text-black flex-1"
                  [style.background-color]="env.color + 'aa'" 
                  [style.color]="'black'">{{env.name}}</h3>
              <div class="flex items-center ml-2">
                <button *ngIf="environmentHasTasks(env.id)"
                        (click)="toggleCollapseAllProjectsInEnvironment(env.id)"
                        class="p-1 text-gray-500 hover:text-gray-700 mr-1"
                        [title]="areAllProjectsCollapsed(env.id) ? 'Expandir proyectos' : 'Contraer proyectos'">
                  <i class="fas" [ngClass]="areAllProjectsCollapsed(env.id) ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
                </button>
                <button *ngIf="!environmentHasTasks(env.id)"
                        (click)="toggleEnvironmentCollapse(env.id)"
                        class="p-1 text-gray-500 hover:text-gray-700 mr-1"
                        [title]="isEnvironmentCollapsed(env.id) ? 'Expandir ambiente' : 'Contraer ambiente'">
                  <i class="fas mr-1" [ngClass]="isEnvironmentCollapsed(env.id) ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
                </button>
                <button (click)="environmentContextMenu.emit({ mouseEvent: $event, environment: env })" class="p-1 text-gray-500 hover:text-gray-700">
                  <i class="fas fa-ellipsis-v"></i>
                </button>
              </div>
            </div>
          </div>

          <div class="environment-content px-4">
            <div *ngIf="!isEnvironmentCollapsed(env.id)" class="space-y-4">
              <div *ngFor="let project of getProjectsByEnvironment(env.id)" class="project-section">
                <div class="flex items-center justify-between mb-2 p-2 bg-gray-50 rounded-lg">
                  <div class="flex items-center gap-2">
                    <button (click)="projectContextMenu.emit({ mouseEvent: $event, project })" class="p-1 text-gray-500 hover:text-gray-700">
                      <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <h4 class="text-sm font-medium text-gray-700">
                      <i class="fas fa-folder mr-1"></i>{{project.name}}
                    </h4>
                    <button *ngIf="getTasksByProject(project.id).length > 0"
                            (click)="toggleProjectCollapse(project.id)"
                            class="p-1 text-gray-500 hover:text-gray-700"
                            [title]="isProjectCollapsed(project.id) ? 'Expandir proyecto' : 'Contraer proyecto'">
                      <i class="fas" [ngClass]="isProjectCollapsed(project.id) ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
                    </button>
                  </div>
                  <button 
                    (click)="addTaskToProject.emit({ environmentId: env.id, projectId: project.id })"
                    class="bg-indigo-600 text-white px-2 py-1 rounded text-xs hover:bg-indigo-700 transition-colors"
                    title="Agregar tarea a {{project.name}}">
                    <i class="fas fa-plus mr-1"></i>Agregar
                  </button>
                </div>

                <div class="space-y-2 ml-2" *ngIf="!isProjectCollapsed(project.id) && getTasksByProject(project.id).length > 0">
                  <ng-container *ngFor="let task of getTasksByProject(project.id); let i = index">
                    <ng-container *ngIf="getEnvironmentViewMode(env.id) === 'list'; else cardItem">
                      <div *ngIf="shouldShowDaySeparator(project.id, i)" class="day-separator"><span>{{ formatListDay(task.start) }}</span></div>
                      <div class="task-list-item" 
                           [class.status-completed]="task.status === 'completed'"
                           [class.status-in-progress]="task.status === 'in-progress'"
                           [class.status-pending]="task.status === 'pending'"
                           [class.task-overdue]="isTaskOverdue(task)"
                           [class.task-running]="isTaskRunning(task)"
                           (click)="taskContextMenu.emit({ mouseEvent: $event, task })"
                           (contextmenu)="taskQuickContextMenu.emit({ mouseEvent: $event, task })"
                           [attr.title]="getTaskTooltip(task)">
                        <div class="flex items-center gap-2">
                          <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-xs"></i>
                          <span class="text-base">{{ task.emoji || '📋' }}</span>
                          <span class="truncate flex-1">{{task.name}}</span>
                          <span class="text-xs text-gray-500 ml-2 whitespace-nowrap">{{ formatTime12(task.start) }}</span>
                        </div>
                      </div>
                    </ng-container>
                    <ng-template #cardItem>
                      <div class="task-card bg-white p-3 rounded-lg shadow-sm border border-gray-200 relative"
                           [class.status-completed]="task.status === 'completed'"
                           [class.status-in-progress]="task.status === 'in-progress'"
                           [class.status-pending]="task.status === 'pending'"
                           [class.task-overdue]="isTaskOverdue(task)"
                           [class.task-running]="isTaskRunning(task)">
                        <div class="progress-bar-container">
                          <div class="progress-bar" 
                               [class.progress-pending]="task.status === 'pending'"
                               [class.progress-in-progress]="task.status === 'in-progress'"
                               [class.progress-completed]="task.status === 'completed'">
                          </div>
                        </div>
                        <button (click)="taskContextMenu.emit({ mouseEvent: $event, task })" (contextmenu)="taskQuickContextMenu.emit({ mouseEvent: $event, task })" class="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700">
                          <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="flex items-center justify-between mb-2">
                          <div class="flex items-center gap-1">
                            <span class="text-lg">{{ task.emoji || '📋' }}</span>
                            <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-sm" title="Tarea oculta"></i>
                          </div>
                          <span class="text-xs px-2 py-1 rounded" [class]="'priority-' + task.priority">
                            {{task.priority}}
                          </span>
                        </div>
                        <h4 class="font-medium">{{task.name}}</h4>
                        <p class="text-sm text-gray-600 mt-1">{{task.description}}</p>
                        <div class="mt-2 text-xs text-gray-500">
                          <div>Inicio: {{formatDate(task.start)}}</div>
                          <div>Fin: {{formatDate(task.end)}}</div>
                        </div>
                      </div>
                    </ng-template>
                  </ng-container>
                </div>
              </div>

              <div *ngIf="getTasksWithoutProjectInEnvironment(env.id).length > 0" class="project-section">
                <div class="flex items-center justify-between mb-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 class="text-sm font-medium text-yellow-700">
                    <i class="fas fa-exclamation-triangle mr-1"></i>Sin proyecto asignado
                  </h4>
                </div>
                <div class="space-y-2 ml-2">
                  <div *ngFor="let task of getTasksWithoutProjectInEnvironment(env.id)"
                       class="task-card bg-white p-3 rounded-lg shadow-sm border border-yellow-200 relative"
                       [class.task-overdue]="isTaskOverdue(task)"
                       [class.task-running]="isTaskRunning(task)">
                    <div class="progress-bar-container">
                      <div class="progress-bar" 
                           [class.progress-pending]="task.status === 'pending'"
                           [class.progress-in-progress]="task.status === 'in-progress'"
                           [class.progress-completed]="task.status === 'completed'">
                      </div>
                    </div>
                    <button (click)="taskContextMenu.emit({ mouseEvent: $event, task })" (contextmenu)="taskQuickContextMenu.emit({ mouseEvent: $event, task })" class="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700">
                      <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-1">
                        <span class="text-lg">{{task.emoji}}</span>
                        <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-sm" title="Tarea oculta"></i>
                      </div>
                      <span class="text-xs px-2 py-1 rounded" [class]="'priority-' + task.priority">
                        {{task.priority}}
                      </span>
                    </div>
                    <h4 class="font-medium">{{task.name}}</h4>
                    <p class="text-sm text-gray-600 mt-1">{{task.description}}</p>
                    <div class="mt-2 text-xs text-gray-500">
                      <div>Inicio: {{formatDate(task.start)}}</div>
                      <div>Fin: {{formatDate(task.end)}}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div *ngIf="getProjectsByEnvironment(env.id).length === 0" class="text-center py-6">
                <p class="text-gray-500 text-sm mb-2">No hay proyectos en este ambiente</p>
                <button 
                  (click)="createProject.emit(env.id)"
                  class="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300 transition-colors">
                  <i class="fas fa-plus mr-1"></i>Crear proyecto
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .board-column {
      min-height: 200px;
      max-height: 50vh;
      background-color: #f3f4f6;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .environment-header {
      flex-shrink: 0;
      position: sticky;
      top: 0;
      background-color: #f3f4f6;
      z-index: 10;
      border-radius: 8px 8px 0 0;
    }
    .environment-content {
      flex: 1;
      overflow-y: auto;
      padding-bottom: 1rem;
    }
    .environment-content::-webkit-scrollbar { width: 6px; }
    .environment-content::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
    .environment-content::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
    .environment-content::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
    .task-card { transition: all 0.2s ease; position: relative; }
    .task-card:hover { transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .task-list-item { padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; cursor: pointer; transition: background 0.2s ease; max-width: 75%; }
    .task-list-item:hover { background: #f9fafb; }
    .day-separator { display: flex; align-items: center; text-align: center; color: #6b7280; font-size: 12px; margin: 8px 0; }
    .day-separator::before, .day-separator::after { content: ''; flex: 1; border-bottom: 1px solid #e5e7eb; }
    .day-separator:not(:empty)::before { margin-right: .5em; }
    .day-separator:not(:empty)::after { margin-left: .5em; }
    .status-completed { opacity: 0.6; text-decoration: line-through; border-left: 4px solid #22c55e; }
    .status-in-progress { border-left: 4px solid #facc15; }
    .status-pending { border-left: 4px solid #3b82f6; }
    .project-section { border-left: 3px solid #e5e7eb; padding-left: 8px; margin-left: 4px; }
    .project-section:hover { border-left-color: #6366f1; }
    .progress-bar-container { position: absolute; top: 0; left: 0; right: 0; width: 100%; height: 6px; background-color: #e5e7eb; border-radius: 8px 8px 0 0; overflow: hidden; }
    .progress-bar { height: 100%; transition: width 0.3s ease; border-radius: 8px 8px 0 0; }
    .progress-pending { width: 20%; background-color: #3b82f6; }
    .progress-in-progress { width: 60%; background-color: #f59e0b; }
    .progress-completed { width: 100%; background-color: #10b981; }
    .task-overdue { border: 3px solid transparent; animation: overdue-pulse 1.5s infinite; position: relative; }
    @keyframes overdue-pulse {
      0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.4), 0 0 20px rgba(239, 68, 68, 0.3), 0 0 40px rgba(239, 68, 68, 0.2); }
      50% { border-color: #ffffff; box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.8), 0 0 25px rgba(255, 255, 255, 0.6), 0 0 45px rgba(255, 255, 255, 0.4); }
    }
    .task-overdue:hover { animation: overdue-pulse 1.5s infinite; transform: translateY(-2px); }
    .task-running { border: 3px solid transparent; animation: running-pulse 1.5s infinite; position: relative; }
    @keyframes running-pulse {
      0%, 100% { border-color: #10b981; box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.4), 0 0 20px rgba(16, 185, 129, 0.3), 0 0 40px rgba(16, 185, 129, 0.2); }
      50% { border-color: #ffffff; box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.8), 0 0 25px rgba(255, 255, 255, 0.6), 0 0 45px rgba(255, 255, 255, 0.4); }
    }
    .task-running:hover { animation: running-pulse 1.5s infinite; transform: translateY(-2px); }
  `]
})
export class BoardViewComponent {
  @Input() tasks: Task[] = [];
  @Input() projects: Project[] = [];
  @Input() environments: Environment[] = [];
  @Input() showHidden: boolean = false;
  @Input() environmentHiddenVisibility: { [envId: string]: 'hidden' | 'show-all' | 'show-24h' } = {};
  @Input() environmentViewMode: { [envId: string]: 'cards' | 'list' } = {};

  @Output() editTask = new EventEmitter<Task>();
  @Output() taskContextMenu = new EventEmitter<{ mouseEvent: MouseEvent; task: Task }>();
  @Output() taskQuickContextMenu = new EventEmitter<{ mouseEvent: MouseEvent; task: Task }>();
  @Output() environmentContextMenu = new EventEmitter<{ mouseEvent: MouseEvent; environment: Environment }>();
  @Output() projectContextMenu = new EventEmitter<{ mouseEvent: MouseEvent; project: Project }>();
  @Output() addTaskToProject = new EventEmitter<{ environmentId: string; projectId: string }>();
  @Output() createProject = new EventEmitter<string>();

  collapsedEmptyEnvironments: boolean = true;
  collapsedEnvironments: { [envId: string]: boolean } = {};
  collapsedProjects: { [projectId: string]: boolean } = {};

  get orderedEnvironments(): Environment[] {
    return [...this.environments].sort((a, b) => {
      const aHas = this.environmentHasTasks(a.id);
      const bHas = this.environmentHasTasks(b.id);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  get emptyEnvironmentsCount(): number {
    return this.environments.filter(env => !this.environmentHasTasks(env.id)).length;
  }

  environmentHasTasks(environmentId: string): boolean {
    return this.getTasksByEnvironment(environmentId).length > 0 || this.getProjectsWithTasksInEnvironment(environmentId).length > 0;
  }

  getProjectsWithTasksInEnvironment(environmentId: string): Project[] {
    return this.projects.filter(project => project.environment === environmentId && this.getTasksByProject(project.id).length > 0);
  }

  getProjectsByEnvironment(environmentId: string): Project[] {
    return this.projects.filter(project => project.environment === environmentId);
  }

  getEnvironmentViewMode(envId: string): 'cards' | 'list' {
    return this.environmentViewMode[envId] || 'cards';
  }

  private resolveEnvironmentHiddenVisibility(envId: string): 'show-all' | 'show-24h' | 'hidden' {
    if (this.showHidden) return 'show-all';
    return this.environmentHiddenVisibility[envId] || 'hidden';
  }

  getTasksByEnvironment(environmentId: string): Task[] {
    const visibility = this.resolveEnvironmentHiddenVisibility(environmentId);
    return this.tasks
      .filter(task => {
        if (task.environment !== environmentId) return false;
        if (task.hidden) {
          switch (visibility) {
            case 'hidden': return false;
            case 'show-all': return true;
            case 'show-24h':
              const taskDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
              const now = new Date();
              const hoursDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60);
              return hoursDiff <= 24;
            default: return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.start + (a.start.includes('Z') ? '' : 'Z')).getTime();
        const dateB = new Date(b.start + (b.start.includes('Z') ? '' : 'Z')).getTime();
        return dateA - dateB;
      });
  }

  getTasksByProject(projectId: string): Task[] {
    const project = this.projects.find(p => p.id === projectId);
    const environmentId = project?.environment || '';
    const visibility = this.resolveEnvironmentHiddenVisibility(environmentId);
    return this.tasks
      .filter(task => {
        if (task.project !== projectId) return false;
        if (task.hidden) {
          switch (visibility) {
            case 'hidden': return false;
            case 'show-all': return true;
            case 'show-24h':
              const taskDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
              const now = new Date();
              const hoursDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60);
              return hoursDiff <= 24;
            default: return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.start + (a.start.includes('Z') ? '' : 'Z')).getTime();
        const dateB = new Date(b.start + (b.start.includes('Z') ? '' : 'Z')).getTime();
        return dateA - dateB;
      });
  }

  getTasksWithoutProjectInEnvironment(environmentId: string): Task[] {
    const visibility = this.resolveEnvironmentHiddenVisibility(environmentId);
    return this.tasks.filter(task => {
      if (task.environment !== environmentId || (task.project && task.project !== '')) return false;
      if (task.hidden) {
        switch (visibility) {
          case 'hidden': return false;
          case 'show-all': return true;
          case 'show-24h':
            const taskDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
            const now = new Date();
            const hoursDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60);
            return hoursDiff <= 24;
          default: return false;
        }
      }
      return true;
    });
  }

  isProjectCollapsed(projectId: string): boolean {
    return !!this.collapsedProjects[projectId];
  }

  toggleProjectCollapse(projectId: string): void {
    this.collapsedProjects[projectId] = !this.isProjectCollapsed(projectId);
  }

  areAllProjectsCollapsed(environmentId: string): boolean {
    const projects = this.getProjectsByEnvironment(environmentId);
    if (projects.length === 0) return false;
    const projectsWithTasks = projects.filter(p => this.getTasksByProject(p.id).length > 0);
    if (projectsWithTasks.length === 0) return false;
    return projectsWithTasks.every(p => this.isProjectCollapsed(p.id));
  }

  toggleCollapseAllProjectsInEnvironment(environmentId: string): void {
    const shouldCollapse = !this.areAllProjectsCollapsed(environmentId);
    this.getProjectsByEnvironment(environmentId)
      .filter(p => this.getTasksByProject(p.id).length > 0)
      .forEach(p => {
        this.collapsedProjects[p.id] = shouldCollapse;
      });
  }

  isEnvironmentCollapsed(environmentId: string): boolean {
    if (this.environmentHasTasks(environmentId)) return false;
    if (Object.prototype.hasOwnProperty.call(this.collapsedEnvironments, environmentId)) {
      return this.collapsedEnvironments[environmentId];
    }
    return this.collapsedEmptyEnvironments;
  }

  toggleEnvironmentCollapse(environmentId: string): void {
    if (!this.environmentHasTasks(environmentId)) {
      this.collapsedEnvironments[environmentId] = !this.isEnvironmentCollapsed(environmentId);
    }
  }

  toggleAllEmptyEnvironments(): void {
    this.collapsedEmptyEnvironments = !this.collapsedEmptyEnvironments;
    this.collapsedEnvironments = {};
  }

  shouldShowDaySeparator(projectId: string, index: number): boolean {
    const tasks = this.getTasksByProject(projectId);
    if (index === 0) return true;
    const prev = tasks[index - 1];
    const curr = tasks[index];
    return this.getDateKey(prev.start) !== this.getDateKey(curr.start);
  }

  private getDateKey(dateString: string): string {
    const d = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  formatListDay(dateString: string): string {
    const d = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
    return d.toLocaleDateString('es-MX', { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' });
  }

  formatTime12(dateString: string): string {
    const d = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
    return d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  isTaskOverdue(task: Task): boolean {
    if (task.status === 'completed' || (task as any).completed) return false;
    const endDate = new Date(task.end + (task.end.includes('Z') ? '' : 'Z'));
    const now = new Date();
    return endDate < now;
  }

  isTaskRunning(task: Task): boolean {
    if (task.status === 'completed' || (task as any).completed) return false;
    const startDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
    const endDate = new Date(task.end + (task.end.includes('Z') ? '' : 'Z'));
    const now = new Date();
    return startDate <= now && now <= endDate;
  }

  getTaskTooltip(task: Task): string {
    const start = this.formatDate(task.start);
    const end = this.formatDate(task.end);
    const prio = task.priority;
    const hiddenIcon = (task as any).hidden ? '🙈 ' : '';
    return `${hiddenIcon}${task.emoji || ''} ${task.name}\nPrioridad: ${prio}\nInicio: ${start}\nFin: ${end}`.trim();
  }
}



