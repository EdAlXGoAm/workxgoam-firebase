import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, AfterViewInit, AfterViewChecked, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeekTimelineSvgComponent } from '../week-timeline-svg/week-timeline-svg.component';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';
import { TaskType } from '../../models/task-type.model';
import { TaskGroup } from '../../models/task-group.model';

@Component({
  selector: 'app-week-view',
  standalone: true,
  imports: [CommonModule, FormsModule, WeekTimelineSvgComponent],
  template: `
    <div class="w-full bg-white rounded-lg shadow-md p-3 md:p-4 lg:p-6 week-view-container" [class.wide-layout]="isWideLayout">
      <div class="flex flex-wrap justify-between items-center gap-2 mb-3 md:mb-4">
        <h2 class="text-lg md:text-xl font-bold">Vista Semanal</h2>
        <div *ngIf="emptyEnvironmentsCount > 0" class="flex items-center gap-1.5 md:gap-2">
          <span class="text-xs md:text-sm text-gray-600">
            <span class="hidden sm:inline">{{emptyEnvironmentsCount}} ambiente(s) vacío(s)</span>
            <span class="sm:hidden">{{emptyEnvironmentsCount}} vacío(s)</span>
          </span>
          <button (click)="toggleAllEmptyEnvironments()" 
                  class="px-2 py-1 md:px-3 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 rounded-lg border transition-colors whitespace-nowrap">
            <i class="fas text-xs md:mr-1" [ngClass]="collapsedEmptyEnvironments ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
            <span class="sm:inline text-xs">{{ collapsedEmptyEnvironments ? ' Expandir' : ' Contraer' }} vacíos</span>
          </button>
        </div>
      </div>

      <div #weekLayoutWrapper class="week-layout-wrapper">
        <div class="timeline-section">
          <h3 class="text-base md:text-lg font-semibold mb-2 text-center w-full">Vista Semanal</h3>
          <app-week-timeline-svg 
            [tasks]="tasks" 
            [environments]="environments" 
            [taskTypes]="taskTypes" 
            [projects]="projects"
            [taskGroups]="taskGroups"
            (editTask)="editTask.emit($event)" 
            (deleteTask)="deleteTask.emit($event)"
            (toggleHidden)="toggleHidden.emit($event)"
            (changeStatus)="changeStatus.emit($event)"
            (taskUpdated)="taskUpdated.emit($event)"
            (createTaskWithRange)="createTaskWithRange.emit($event)">
          </app-week-timeline-svg>
        </div>

        <div class="environments-section">
          <!-- Sincronización Compacta -->
          <div class="mb-4">
            <div class="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <!-- Texto compacto -->
              <div class="flex items-center gap-2 text-xs text-gray-600">
                <i class="fas fa-sync-alt text-indigo-600"></i>
                <span class="hidden sm:inline">Sincronizar orden:</span>
                <span class="sm:hidden">Sincronizar:</span>
              </div>
              
              <!-- Barra de búsqueda -->
              <div class="flex items-center gap-1.5 flex-1 max-w-xs">
                <div class="relative flex-1">
                  <input 
                    type="text"
                    [(ngModel)]="searchFilterText"
                    (input)="onSearchFilterChange()"
                    placeholder="Buscar tarea..."
                    class="w-full pl-7 pr-7 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                  <i class="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                  <button 
                    *ngIf="searchFilterText"
                    (click)="clearSearchFilter()"
                    class="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5">
                    <i class="fas fa-times text-xs"></i>
                  </button>
                </div>
              </div>
              
              <!-- Botones compactos -->
              <div class="flex items-center gap-1.5">
                <button 
                  (click)="saveOrderToDatabase.emit()"
                  [disabled]="isSavingOrderToDatabase || isLoadingOrderFromDatabase"
                  [class.opacity-50]="isSavingOrderToDatabase || isLoadingOrderFromDatabase"
                  [class.cursor-not-allowed]="isSavingOrderToDatabase || isLoadingOrderFromDatabase"
                  class="px-2.5 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                  [title]="'Guardar orden en base de datos'">
                  <i class="fas text-xs" [class.fa-save]="!isSavingOrderToDatabase" [class.fa-spinner]="isSavingOrderToDatabase" [class.fa-spin]="isSavingOrderToDatabase"></i>
                  <span class="hidden sm:inline">{{ isSavingOrderToDatabase ? 'Guardando...' : 'Guardar' }}</span>
                  <span class="sm:hidden">💾</span>
                </button>
                
                <button 
                  (click)="loadOrderFromDatabase.emit()"
                  [disabled]="isSavingOrderToDatabase || isLoadingOrderFromDatabase"
                  [class.opacity-50]="isSavingOrderToDatabase || isLoadingOrderFromDatabase"
                  [class.cursor-not-allowed]="isSavingOrderToDatabase || isLoadingOrderFromDatabase"
                  class="px-2.5 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors flex items-center gap-1.5"
                  [title]="'Cargar orden desde base de datos'">
                  <i class="fas text-xs" [class.fa-download]="!isLoadingOrderFromDatabase" [class.fa-spinner]="isLoadingOrderFromDatabase" [class.fa-spin]="isLoadingOrderFromDatabase"></i>
                  <span class="hidden sm:inline">{{ isLoadingOrderFromDatabase ? 'Cargando...' : 'Cargar' }}</span>
                  <span class="sm:hidden">📥</span>
                </button>
              </div>
            </div>
            
            <!-- Mensaje de sincronización compacto -->
            <div *ngIf="orderSyncMessage" 
                 class="mt-2 p-2 rounded text-xs flex items-center gap-1.5 transition-all duration-300"
                 [class.bg-green-100]="orderSyncMessageType === 'success'"
                 [class.text-green-800]="orderSyncMessageType === 'success'"
                 [class.bg-red-100]="orderSyncMessageType === 'error'"
                 [class.text-red-800]="orderSyncMessageType === 'error'"
                 [class.bg-blue-100]="orderSyncMessageType === 'info'"
                 [class.text-blue-800]="orderSyncMessageType === 'info'">
              <i class="fas text-xs" 
                 [class.fa-check-circle]="orderSyncMessageType === 'success'"
                 [class.fa-exclamation-circle]="orderSyncMessageType === 'error'"
                 [class.fa-info-circle]="orderSyncMessageType === 'info'"></i>
              <span>{{ orderSyncMessage }}</span>
            </div>
          </div>

          <!-- Spinner de carga mientras se ordenan los environments -->
          <div *ngIf="isLoadingEnvironmentOrder" class="flex justify-center items-center py-12">
            <div class="flex flex-col items-center">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p class="text-gray-600 text-sm">Cargando orden de environments...</p>
            </div>
          </div>

          <div *ngIf="!isLoadingEnvironmentOrder" class="environments-grid">
        <div *ngFor="let env of orderedEnvironments" class="board-column" [class.board-column-empty]="!environmentHasTasks(env.id)" [class.board-column-collapsed]="isEnvironmentCollapsed(env.id)">
          <div class="environment-header p-4 pb-2">
            <div class="flex items-center justify-between">
              <h3 class="font-medium px-3 py-1.5 rounded-full text-sm flex-1 inline-flex items-center gap-1 text-gray-700"
                  [style.background-color]="env.color + '20'" 
                  [style.border]="'1px solid ' + env.color + '40'">{{env.emoji ? env.emoji + ' ' : ''}}{{env.name}}</h3>
              <div class="flex items-center ml-2">
                <div class="flex items-center mr-1 border-r border-gray-300 pr-1">
                  <button (click)="moveEnvironmentUp.emit(env.id); $event.stopPropagation()"
                          class="p-1 text-gray-500 hover:text-gray-700"
                          [title]="'Mover arriba'"
                          [disabled]="!canMoveEnvironmentUp(env.id)">
                    <i class="fas fa-arrow-up text-xs"></i>
                  </button>
                  <button (click)="moveEnvironmentDown.emit(env.id); $event.stopPropagation()"
                          class="p-1 text-gray-500 hover:text-gray-700"
                          [title]="'Mover abajo'"
                          [disabled]="!canMoveEnvironmentDown(env.id)">
                    <i class="fas fa-arrow-down text-xs"></i>
                  </button>
                </div>
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
              <!-- PRIMERA ITERACIÓN: Proyectos con tareas PASADAS -->
              <div *ngFor="let project of getProjectsWithPastTasksInEnv(env.id)" class="project-section">
                <div class="flex items-center justify-between mb-2 p-2 rounded-lg" style="background-color: #283E4B;">
                  <div class="flex items-center gap-2">
                    <button (click)="projectContextMenu.emit({ mouseEvent: $event, project })" class="p-1 text-white hover:text-gray-300">
                      <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <img *ngIf="project.image" 
                         [src]="project.image" 
                         class="w-6 h-6 rounded object-cover flex-shrink-0"
                         alt="">
                    <h4 class="text-sm font-medium text-white">
                      <i *ngIf="!project.image" class="fas fa-folder mr-1 text-white"></i>{{project.name}}
                    </h4>
                    <button *ngIf="getPastTasksByProject(project.id).length > 0"
                            (click)="toggleProjectSectionCollapse(project.id, 'past')"
                            class="p-1 text-white hover:text-gray-300"
                            [title]="isProjectSectionCollapsed(project.id, 'past') ? 'Expandir tareas' : 'Contraer tareas'">
                      <i class="fas text-white" [ngClass]="isProjectSectionCollapsed(project.id, 'past') ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
                    </button>
                  </div>
                  <button 
                    (click)="addTaskToProject.emit({ environmentId: env.id, projectId: project.id })"
                    class="bg-indigo-600 text-white px-2 py-1 rounded text-xs hover:bg-indigo-700 transition-colors"
                    title="Agregar tarea a {{project.name}}">
                    <i class="fas fa-plus mr-1"></i>Agregar
                  </button>
                </div>

                <!-- SECCIÓN PASADAS -->
                <div *ngIf="getPastTasksByProject(project.id).length > 0" 
                     class="tasks-section tasks-section-past">
                  <div class="section-header section-header-past" 
                       (click)="toggleProjectSectionCollapse(project.id, 'past')">
                    <div class="section-divider"></div>
                    <span class="section-label">
                      <i class="fas fa-history mr-1"></i>Pasadas ({{getPastTasksByProject(project.id).length}})
                    </span>
                    <i class="fas text-xs" [ngClass]="isProjectSectionCollapsed(project.id, 'past') ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
                  </div>
                  <div class="space-y-2 ml-2" *ngIf="!isProjectSectionCollapsed(project.id, 'past')">
                    <ng-container *ngFor="let task of getPastTasksByProject(project.id); let i = index">
                      <ng-container *ngIf="getEnvironmentViewMode(env.id) === 'list'; else cardItemPast">
                        <div class="task-card-wrapper">
                          <div class="task-bar-running" *ngIf="isTaskRunning(task)"></div>
                          <div class="task-bar-status"
                               [class.bar-pending]="task.status === 'pending'"
                               [class.bar-in-progress]="task.status === 'in-progress'"
                               [class.bar-completed]="task.status === 'completed'"></div>
                          <div class="task-list-item" 
                               [class.status-completed]="task.status === 'completed'"
                               [class.task-overdue]="isTaskOverdue(task)"
                               (click)="taskContextMenu.emit({ mouseEvent: $event, task })"
                               (contextmenu)="taskContextMenu.emit({ mouseEvent: $event, task })"
                               [attr.title]="getTaskTooltip(task)">
                            <div *ngIf="isTaskUpdating(task)" class="task-loading-overlay">
                              <div class="task-loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i>
                              </div>
                            </div>
                            <div class="flex items-center gap-2">
                              <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-xs"></i>
                              <span class="text-base">{{ task.emoji || '📋' }}</span>
                              <div *ngIf="getTaskTypeColor(task)" 
                                   class="w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" 
                                   [style.background-color]="getTaskTypeColor(task)"></div>
                              <span *ngIf="getTaskGroupName(task)" 
                                    class="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                                {{getTaskGroupName(task)}}
                              </span>
                              <span class="truncate flex-1">{{task.name}}</span>
                              <span class="text-xs text-gray-500 ml-2 whitespace-nowrap">{{ formatTime12(task.start) }}</span>
                            </div>
                          </div>
                        </div>
                      </ng-container>
                      <ng-template #cardItemPast>
                        <div class="task-card-wrapper">
                          <div class="task-bar-running" *ngIf="isTaskRunning(task)"></div>
                          <div class="task-bar-status"
                               [class.bar-pending]="task.status === 'pending'"
                               [class.bar-in-progress]="task.status === 'in-progress'"
                               [class.bar-completed]="task.status === 'completed'"></div>
                          <div class="task-card-content bg-white p-3 rounded-lg shadow-sm border border-gray-200 relative"
                               [class.status-completed]="task.status === 'completed'"
                               [class.task-overdue]="isTaskOverdue(task)">
                            <div *ngIf="isTaskUpdating(task)" class="task-loading-overlay">
                              <div class="task-loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i>
                              </div>
                            </div>
                            <div class="progress-bar-container">
                              <div class="progress-bar" 
                                   [class.progress-pending]="task.status === 'pending'"
                                   [class.progress-in-progress]="task.status === 'in-progress'"
                                   [class.progress-completed]="task.status === 'completed'">
                              </div>
                            </div>
                            <button (click)="taskContextMenu.emit({ mouseEvent: $event, task })" (contextmenu)="$event.preventDefault(); taskContextMenu.emit({ mouseEvent: $event, task })" class="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700">
                              <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="flex items-center justify-between mb-2">
                              <div class="flex items-center gap-1">
                                <span class="text-lg">{{ task.emoji || '📋' }}</span>
                                <div *ngIf="getTaskTypeColor(task)" 
                                     class="w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" 
                                     [style.background-color]="getTaskTypeColor(task)"></div>
                                <span *ngIf="getTaskGroupName(task)" 
                                      class="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium ml-1">
                                  {{getTaskGroupName(task)}}
                                </span>
                                <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-sm" title="Tarea oculta"></i>
                              </div>
                              <span class="text-xs px-2 py-1 rounded" [class]="'priority-' + task.priority">
                                {{task.priority}}
                              </span>
                            </div>
                            <h4 class="font-medium flex items-center gap-2">
                              <span>{{task.name}}</span>
                            </h4>
                            <p class="text-sm text-gray-600 mt-1 task-description-clamp">{{task.description}}</p>
                            <div class="mt-2 text-xs text-gray-500">
                              <div>Inicio: {{formatDate(task.start)}}</div>
                              <div>Fin: {{formatDate(task.end)}}</div>
                            </div>
                          </div>
                        </div>
                      </ng-template>
                    </ng-container>
                  </div>
                </div>
              </div>

              <!-- SEGUNDA ITERACIÓN: Proyectos con tareas HOY/ACTIVAS -->
              <div *ngFor="let project of getProjectsWithTodayTasksInEnv(env.id)" class="project-section">
                <div class="flex items-center justify-between mb-2 p-2 rounded-lg" style="background-color: #283E4B;">
                  <div class="flex items-center gap-2">
                    <button (click)="projectContextMenu.emit({ mouseEvent: $event, project })" class="p-1 text-white hover:text-gray-300">
                      <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <img *ngIf="project.image" 
                         [src]="project.image" 
                         class="w-6 h-6 rounded object-cover flex-shrink-0"
                         alt="">
                    <h4 class="text-sm font-medium text-white">
                      <i *ngIf="!project.image" class="fas fa-folder mr-1 text-white"></i>{{project.name}}
                    </h4>
                    <button *ngIf="getTodayTasksByProject(project.id).length > 0"
                            (click)="toggleProjectSectionCollapse(project.id, 'today')"
                            class="p-1 text-white hover:text-gray-300"
                            [title]="isProjectSectionCollapsed(project.id, 'today') ? 'Expandir tareas' : 'Contraer tareas'">
                      <i class="fas text-white" [ngClass]="isProjectSectionCollapsed(project.id, 'today') ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
                    </button>
                  </div>
                  <button 
                    (click)="addTaskToProject.emit({ environmentId: env.id, projectId: project.id })"
                    class="bg-indigo-600 text-white px-2 py-1 rounded text-xs hover:bg-indigo-700 transition-colors"
                    title="Agregar tarea a {{project.name}}">
                    <i class="fas fa-plus mr-1"></i>Agregar
                  </button>
                </div>

                <!-- SECCIÓN HOY/ACTIVAS -->
                <div *ngIf="getTodayTasksByProject(project.id).length > 0" 
                     class="tasks-section tasks-section-today">
                  <div class="section-header section-header-today" 
                       (click)="toggleProjectSectionCollapse(project.id, 'today')">
                    <div class="section-divider"></div>
                    <span class="section-label">
                      <i class="fas fa-sun mr-1"></i>Hoy/Activas ({{getTodayTasksByProject(project.id).length}})
                    </span>
                    <i class="fas text-xs" [ngClass]="isProjectSectionCollapsed(project.id, 'today') ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
                  </div>
                  <div class="space-y-2 ml-2" *ngIf="!isProjectSectionCollapsed(project.id, 'today')">
                    <ng-container *ngFor="let task of getTodayTasksByProject(project.id); let i = index">
                      <ng-container *ngIf="getEnvironmentViewMode(env.id) === 'list'; else cardItemToday">
                        <div class="task-card-wrapper">
                          <div class="task-bar-running" *ngIf="isTaskRunning(task)"></div>
                          <div class="task-bar-status"
                               [class.bar-pending]="task.status === 'pending'"
                               [class.bar-in-progress]="task.status === 'in-progress'"
                               [class.bar-completed]="task.status === 'completed'"></div>
                          <div class="task-list-item" 
                               [class.status-completed]="task.status === 'completed'"
                               [class.task-overdue]="isTaskOverdue(task)"
                               (click)="taskContextMenu.emit({ mouseEvent: $event, task })"
                               (contextmenu)="taskContextMenu.emit({ mouseEvent: $event, task })"
                               [attr.title]="getTaskTooltip(task)">
                            <div *ngIf="isTaskUpdating(task)" class="task-loading-overlay">
                              <div class="task-loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i>
                              </div>
                            </div>
                            <div class="flex items-center gap-2">
                              <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-xs"></i>
                              <span class="text-base">{{ task.emoji || '📋' }}</span>
                              <div *ngIf="getTaskTypeColor(task)" 
                                   class="w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" 
                                   [style.background-color]="getTaskTypeColor(task)"></div>
                              <span *ngIf="getTaskGroupName(task)" 
                                    class="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                                {{getTaskGroupName(task)}}
                              </span>
                              <span class="truncate flex-1">{{task.name}}</span>
                              <span class="text-xs text-gray-500 ml-2 whitespace-nowrap">{{ formatTime12(task.start) }}</span>
                            </div>
                          </div>
                        </div>
                      </ng-container>
                      <ng-template #cardItemToday>
                        <div class="task-card-wrapper">
                          <div class="task-bar-running" *ngIf="isTaskRunning(task)"></div>
                          <div class="task-bar-status"
                               [class.bar-pending]="task.status === 'pending'"
                               [class.bar-in-progress]="task.status === 'in-progress'"
                               [class.bar-completed]="task.status === 'completed'"></div>
                          <div class="task-card-content bg-white p-3 rounded-lg shadow-sm border border-gray-200 relative"
                               [class.status-completed]="task.status === 'completed'"
                               [class.task-overdue]="isTaskOverdue(task)">
                            <div *ngIf="isTaskUpdating(task)" class="task-loading-overlay">
                              <div class="task-loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i>
                              </div>
                            </div>
                            <div class="progress-bar-container">
                              <div class="progress-bar" 
                                   [class.progress-pending]="task.status === 'pending'"
                                   [class.progress-in-progress]="task.status === 'in-progress'"
                                   [class.progress-completed]="task.status === 'completed'">
                              </div>
                            </div>
                            <button (click)="taskContextMenu.emit({ mouseEvent: $event, task })" (contextmenu)="$event.preventDefault(); taskContextMenu.emit({ mouseEvent: $event, task })" class="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700">
                              <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="flex items-center justify-between mb-2">
                              <div class="flex items-center gap-1">
                                <span class="text-lg">{{ task.emoji || '📋' }}</span>
                                <div *ngIf="getTaskTypeColor(task)" 
                                     class="w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" 
                                     [style.background-color]="getTaskTypeColor(task)"></div>
                                <span *ngIf="getTaskGroupName(task)" 
                                      class="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium ml-1">
                                  {{getTaskGroupName(task)}}
                                </span>
                                <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-sm" title="Tarea oculta"></i>
                              </div>
                              <span class="text-xs px-2 py-1 rounded" [class]="'priority-' + task.priority">
                                {{task.priority}}
                              </span>
                            </div>
                            <h4 class="font-medium flex items-center gap-2">
                              <span>{{task.name}}</span>
                            </h4>
                            <p class="text-sm text-gray-600 mt-1 task-description-clamp">{{task.description}}</p>
                            <div class="mt-2 text-xs text-gray-500">
                              <div>Inicio: {{formatDate(task.start)}}</div>
                              <div>Fin: {{formatDate(task.end)}}</div>
                            </div>
                          </div>
                        </div>
                      </ng-template>
                    </ng-container>
                  </div>
                </div>
              </div>

              <!-- TERCERA ITERACIÓN: Proyectos con tareas PRÓXIMAS -->
              <div *ngFor="let project of getProjectsWithFutureTasksInEnv(env.id)" class="project-section">
                <div class="flex items-center justify-between mb-2 p-2 rounded-lg" style="background-color: #283E4B;">
                  <div class="flex items-center gap-2">
                    <button (click)="projectContextMenu.emit({ mouseEvent: $event, project })" class="p-1 text-white hover:text-gray-300">
                      <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <img *ngIf="project.image" 
                         [src]="project.image" 
                         class="w-6 h-6 rounded object-cover flex-shrink-0"
                         alt="">
                    <h4 class="text-sm font-medium text-white">
                      <i *ngIf="!project.image" class="fas fa-folder mr-1 text-white"></i>{{project.name}}
                    </h4>
                    <button *ngIf="getFutureTasksByProject(project.id).length > 0"
                            (click)="toggleProjectSectionCollapse(project.id, 'future')"
                            class="p-1 text-white hover:text-gray-300"
                            [title]="isProjectSectionCollapsed(project.id, 'future') ? 'Expandir tareas' : 'Contraer tareas'">
                      <i class="fas text-white" [ngClass]="isProjectSectionCollapsed(project.id, 'future') ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
                    </button>
                  </div>
                  <button 
                    (click)="addTaskToProject.emit({ environmentId: env.id, projectId: project.id })"
                    class="bg-indigo-600 text-white px-2 py-1 rounded text-xs hover:bg-indigo-700 transition-colors"
                    title="Agregar tarea a {{project.name}}">
                    <i class="fas fa-plus mr-1"></i>Agregar
                  </button>
                </div>

                <!-- SECCIÓN PRÓXIMAS -->
                <div *ngIf="getFutureTasksByProject(project.id).length > 0" 
                     class="tasks-section tasks-section-future">
                  <div class="section-header section-header-future"
                       (click)="toggleProjectSectionCollapse(project.id, 'future')">
                    <div class="section-divider"></div>
                    <span class="section-label">
                      <i class="fas fa-calendar-alt mr-1"></i>Próximas ({{getFutureTasksByProject(project.id).length}})
                    </span>
                    <i class="fas text-xs" [ngClass]="isProjectSectionCollapsed(project.id, 'future') ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
                  </div>
                  <div class="space-y-2 ml-2" *ngIf="!isProjectSectionCollapsed(project.id, 'future')">
                    <ng-container *ngFor="let task of getFutureTasksByProject(project.id); let i = index">
                      <ng-container *ngIf="getEnvironmentViewMode(env.id) === 'list'; else cardItemFuture">
                        <div class="task-card-wrapper">
                          <div class="task-bar-running" *ngIf="isTaskRunning(task)"></div>
                          <div class="task-bar-status"
                               [class.bar-pending]="task.status === 'pending'"
                               [class.bar-in-progress]="task.status === 'in-progress'"
                               [class.bar-completed]="task.status === 'completed'"></div>
                          <div class="task-list-item" 
                               [class.status-completed]="task.status === 'completed'"
                               [class.task-overdue]="isTaskOverdue(task)"
                               (click)="taskContextMenu.emit({ mouseEvent: $event, task })"
                               (contextmenu)="taskContextMenu.emit({ mouseEvent: $event, task })"
                               [attr.title]="getTaskTooltip(task)">
                            <div *ngIf="isTaskUpdating(task)" class="task-loading-overlay">
                              <div class="task-loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i>
                              </div>
                            </div>
                            <div class="flex items-center gap-2">
                              <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-xs"></i>
                              <span class="text-base">{{ task.emoji || '📋' }}</span>
                              <div *ngIf="getTaskTypeColor(task)" 
                                   class="w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" 
                                   [style.background-color]="getTaskTypeColor(task)"></div>
                              <span *ngIf="getTaskGroupName(task)" 
                                    class="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                                {{getTaskGroupName(task)}}
                              </span>
                              <span class="truncate flex-1">{{task.name}}</span>
                              <span class="text-xs text-gray-500 ml-2 whitespace-nowrap">{{ formatTime12(task.start) }}</span>
                            </div>
                          </div>
                        </div>
                      </ng-container>
                      <ng-template #cardItemFuture>
                        <div class="task-card-wrapper">
                          <div class="task-bar-running" *ngIf="isTaskRunning(task)"></div>
                          <div class="task-bar-status"
                               [class.bar-pending]="task.status === 'pending'"
                               [class.bar-in-progress]="task.status === 'in-progress'"
                               [class.bar-completed]="task.status === 'completed'"></div>
                          <div class="task-card-content bg-white p-3 rounded-lg shadow-sm border border-gray-200 relative"
                               [class.status-completed]="task.status === 'completed'"
                               [class.task-overdue]="isTaskOverdue(task)">
                            <div *ngIf="isTaskUpdating(task)" class="task-loading-overlay">
                              <div class="task-loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i>
                              </div>
                            </div>
                            <div class="progress-bar-container">
                              <div class="progress-bar" 
                                   [class.progress-pending]="task.status === 'pending'"
                                   [class.progress-in-progress]="task.status === 'in-progress'"
                                   [class.progress-completed]="task.status === 'completed'">
                              </div>
                            </div>
                            <button (click)="taskContextMenu.emit({ mouseEvent: $event, task })" (contextmenu)="$event.preventDefault(); taskContextMenu.emit({ mouseEvent: $event, task })" class="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700">
                              <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="flex items-center justify-between mb-2">
                              <div class="flex items-center gap-1">
                                <span class="text-lg">{{ task.emoji || '📋' }}</span>
                                <div *ngIf="getTaskTypeColor(task)" 
                                     class="w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" 
                                     [style.background-color]="getTaskTypeColor(task)"></div>
                                <span *ngIf="getTaskGroupName(task)" 
                                      class="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium ml-1">
                                  {{getTaskGroupName(task)}}
                                </span>
                                <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-sm" title="Tarea oculta"></i>
                              </div>
                              <span class="text-xs px-2 py-1 rounded" [class]="'priority-' + task.priority">
                                {{task.priority}}
                              </span>
                            </div>
                            <h4 class="font-medium flex items-center gap-2">
                              <span>{{task.name}}</span>
                            </h4>
                            <p class="text-sm text-gray-600 mt-1 task-description-clamp">{{task.description}}</p>
                            <div class="mt-2 text-xs text-gray-500">
                              <div>Inicio: {{formatDate(task.start)}}</div>
                              <div>Fin: {{formatDate(task.end)}}</div>
                            </div>
                          </div>
                        </div>
                      </ng-template>
                    </ng-container>
                  </div>
                </div>
              </div>

              <!-- Proyectos sin tareas visibles - en doble columna -->
              <div *ngIf="getProjectsWithoutVisibleTasks(env.id).length > 0" class="project-section">
                <div class="grid grid-cols-2 gap-2">
                  <div *ngFor="let project of getProjectsWithoutVisibleTasks(env.id)" class="project-section">
                    <div class="flex items-center justify-between mb-2 p-2 rounded-lg" style="background-color: #283E4B;">
                      <div class="flex items-center gap-2 flex-1 min-w-0">
                        <button (click)="projectContextMenu.emit({ mouseEvent: $event, project })" class="p-1 text-white hover:text-gray-300 flex-shrink-0">
                          <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <img *ngIf="project.image" 
                             [src]="project.image" 
                             class="w-5 h-5 rounded object-cover flex-shrink-0"
                             alt="">
                        <h4 class="text-xs font-medium text-white truncate">
                          <i *ngIf="!project.image" class="fas fa-folder mr-1 text-white"></i>{{project.name}}
                        </h4>
                      </div>
                      <button 
                        (click)="addTaskToProject.emit({ environmentId: env.id, projectId: project.id })"
                        class="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-xs hover:bg-indigo-700 transition-colors flex-shrink-0 ml-1"
                        title="Agregar tarea a {{project.name}}">
                        <i class="fas fa-plus"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div *ngIf="getTasksWithoutProjectInEnvironment(env.id).length > 0" class="project-section">
                <div class="flex items-center justify-between mb-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 class="text-sm font-medium text-yellow-700">
                    <i class="fas fa-exclamation-triangle mr-1"></i>Sin proyecto asignado
                  </h4>
                </div>
                <div class="space-y-2 ml-2">
                  <div *ngFor="let task of getTasksWithoutProjectInEnvironment(env.id)" class="task-card-wrapper">
                    <div class="task-bar-running" *ngIf="isTaskRunning(task)"></div>
                    <div class="task-bar-status"
                         [class.bar-pending]="task.status === 'pending'"
                         [class.bar-in-progress]="task.status === 'in-progress'"
                         [class.bar-completed]="task.status === 'completed'"></div>
                    <div class="task-card-content bg-white p-3 rounded-lg shadow-sm border border-yellow-200 relative"
                         [class.status-completed]="task.status === 'completed'"
                         [class.task-overdue]="isTaskOverdue(task)">
                      <div class="progress-bar-container">
                        <div class="progress-bar" 
                             [class.progress-pending]="task.status === 'pending'"
                             [class.progress-in-progress]="task.status === 'in-progress'"
                             [class.progress-completed]="task.status === 'completed'">
                        </div>
                      </div>
                      <button (click)="taskContextMenu.emit({ mouseEvent: $event, task })" (contextmenu)="$event.preventDefault(); taskContextMenu.emit({ mouseEvent: $event, task })" class="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700">
                        <i class="fas fa-ellipsis-v"></i>
                      </button>
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-1">
                          <span class="text-lg">{{task.emoji}}</span>
                          <div *ngIf="getTaskTypeColor(task)" 
                               class="w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" 
                               [style.background-color]="getTaskTypeColor(task)"></div>
                          <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-sm" title="Tarea oculta"></i>
                        </div>
                        <span class="text-xs px-2 py-1 rounded" [class]="'priority-' + task.priority">
                          {{task.priority}}
                        </span>
                      </div>
                      <h4 class="font-medium">{{task.name}}</h4>
                      <p class="text-sm text-gray-600 mt-1 task-description-clamp">{{task.description}}</p>
                      <div class="mt-2 text-xs text-gray-500">
                        <div>Inicio: {{formatDate(task.start)}}</div>
                        <div>Fin: {{formatDate(task.end)}}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div *ngIf="getProjectsByEnvironment(env.id).length === 0" class="text-center py-2">
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
    </div>
  `,
  styles: [`
    .week-view-container {
      position: relative;
    }
    
    .week-layout-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .timeline-section {
      width: 100%;
    }
    
    .environments-section {
      width: 100%;
    }
    
    .environments-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    
    /* Tablet: 2 columnas */
    @media (min-width: 768px) and (max-width: 1023px) {
      .environments-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }
    }
    
    /* Desktop pequeño: 2 columnas */
    @media (min-width: 1024px) and (max-width: 1279px) {
      .environments-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }
    }
    
    /* Desktop mediano: 3 columnas (hasta WIDE_LAYOUT_BREAKPOINT - 1 = 1649px) */
    @media (min-width: 1280px) and (max-width: 1649px) {
      .environments-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
      }
    }
    
    /* Layout de 2 columnas controlado por la variable WIDE_LAYOUT_BREAKPOINT (1650px) */
    .wide-layout.week-view-container {
      padding: 1.5rem;
    }
    
    .wide-layout .week-layout-wrapper {
      flex-direction: row;
      align-items: stretch;
      min-height: 600px;
      gap: 1.5rem;
      overflow: hidden;
    }
    
    .wide-layout .timeline-section {
      position: sticky;
      top: 0;
      width: 600px;
      flex-shrink: 0;
      height: auto;
      max-height: calc(100vh - 150px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .wide-layout .timeline-section h3 {
      flex-shrink: 0;
    }
    
    .wide-layout .timeline-section app-week-timeline-svg {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .wide-layout .timeline-section ::ng-deep .timeline-component-wrapper {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .wide-layout .timeline-section ::ng-deep .timeline-controls-section {
      flex-shrink: 0;
    }
    
    .wide-layout .timeline-section ::ng-deep .week-timeline-container {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
    
    .wide-layout .environments-section {
      flex: 1;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 0.5rem;
    }
    
    .wide-layout .environments-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    
    /* 3 columnas cuando hay suficiente altura (900px+) */
    @media (min-height: 900px) {
      .wide-layout .environments-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    
    .board-column {
      min-height: 200px;
      max-height: 50vh;
      background-color: #f3f4f6;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: background-color 0.2s ease;
    }
    
    .board-column-collapsed {
      background-color: #d1d5db;
    }
    
    .board-column-collapsed .environment-header {
      background-color: #d1d5db;
    }
    
    .wide-layout .board-column {
      max-height: none;
    }
    .board-column-empty {
      min-height: auto;
    }
    .environment-header {
      flex-shrink: 0;
      position: sticky;
      top: 0;
      background-color: #f3f4f6;
      z-index: 10;
      border-radius: 8px 8px 0 0;
      transition: background-color 0.2s ease;
    }
    .environment-content {
      flex: 1;
      overflow-y: auto;
      padding-bottom: 1rem;
    }
    .board-column-empty .environment-content {
      padding-bottom: 0.5rem;
    }
    .environment-content::-webkit-scrollbar { width: 6px; }
    .environment-content::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
    .environment-content::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
    .environment-content::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
    .task-card-wrapper { display: flex; flex-direction: row; }
    .task-bar-running { width: 4px; background-color: #10b981; border-radius: 8px 0 0 8px; flex-shrink: 0; }
    .task-bar-status { width: 4px; flex-shrink: 0; }
    .bar-pending { background-color: #3b82f6; }
    .bar-in-progress { background-color: #facc15; }
    .bar-completed { background-color: #22c55e; }
    .task-card-content { transition: all 0.2s ease; position: relative; flex: 1; }
    .task-card-content:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .task-list-item { padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 0 8px 8px 0; background: #ffffff; cursor: pointer; transition: background 0.2s ease; max-width: 75%; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; flex: 1; }
    .task-list-item:hover { background: #f9fafb; }
    .day-separator { display: flex; align-items: center; text-align: center; color: #6b7280; font-size: 12px; margin: 8px 0; }
    .day-separator::before, .day-separator::after { content: ''; flex: 1; border-bottom: 1px solid #e5e7eb; }
    .day-separator:not(:empty)::before { margin-right: .5em; }
    .day-separator:not(:empty)::after { margin-left: .5em; }
    .status-completed { opacity: 0.6; text-decoration: line-through; }
    .project-section { border-left: 3px solid #e5e7eb; padding-left: 8px; margin-left: 4px; }
    .project-section:hover { border-left-color: #6366f1; }
    .progress-bar-container { position: absolute; top: 0; left: 0; right: 0; width: 100%; height: 6px; background-color: #e5e7eb; border-radius: 8px 8px 0 0; overflow: hidden; }
    .progress-bar { height: 100%; transition: width 0.3s ease; border-radius: 8px 8px 0 0; }
    .progress-pending { width: 20%; background-color: #3b82f6; }
    .progress-in-progress { width: 60%; background-color: #f59e0b; }
    .progress-completed { width: 100%; background-color: #10b981; }
    .task-overdue { border: 2px solid #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.6), 0 0 16px rgba(239, 68, 68, 0.3); position: relative; }
    .task-overdue:hover { }
    button[disabled] { opacity: 0.4; cursor: not-allowed; }
    button[disabled]:hover { opacity: 0.4; }
    /* Descripción de tarea con saltos de línea y límite de 3 líneas */
    .task-description-clamp {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.4;
    }
    .task-loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.8);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .task-loading-spinner {
      font-size: 24px;
      color: #3b82f6;
    }
    /* Secciones de tareas por fecha */
    .tasks-section {
      margin-top: 8px;
      border-radius: 6px;
      padding: 8px;
      transition: background-color 0.2s ease;
    }
    .tasks-section-today {
      background-color: rgba(16, 185, 129, 0.08);
    }
    .tasks-section-future {
      background-color: rgba(99, 102, 241, 0.08);
    }
    .section-header {
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 4px 0;
      margin-bottom: 8px;
    }
    .section-header:hover {
      opacity: 0.8;
    }
    .section-divider {
      flex: 1;
      height: 1px;
      background-color: #d1d5db;
      margin-right: 8px;
    }
    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
      margin-right: 8px;
    }
    .section-header-today .section-label {
      color: #059669;
    }
    .section-header-today .section-divider {
      background-color: #059669;
    }
    .section-header-future .section-label {
      color: #4f46e5;
    }
    .section-header-future .section-divider {
      background-color: #4f46e5;
    }
  `]
})
export class WeekViewComponent implements OnChanges, AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild('weekLayoutWrapper', { static: false }) weekLayoutWrapper!: ElementRef<HTMLDivElement>;
  
  // ==========================================
  // 🎯 VARIABLE DE CALIBRACIÓN - BREAKPOINT DE 2 COLUMNAS
  // Ajusta este valor para cambiar cuándo el layout cambia a 2 columnas
  // ==========================================
  readonly WIDE_LAYOUT_BREAKPOINT = 1650; // px - Antes era 1920
  
  // Flag para saber si estamos en layout ancho (2 columnas)
  isWideLayout = false;
  
  @Input() tasks: Task[] = [];
  @Input() projects: Project[] = [];
  @Input() environments: Environment[] = [];
  private _orderedEnvironmentsCache: Environment[] = [];
  @Input() taskTypes: TaskType[] = [];
  @Input() taskGroups: TaskGroup[] = [];
  @Input() showHidden: boolean = false;
  @Input() environmentHiddenVisibility: { [envId: string]: 'hidden' | 'show-all' | 'show-24h' | 'date-range' } = {};
  @Input() environmentViewMode: { [envId: string]: 'cards' | 'list' } = {};
  @Input() environmentSortOrder: { [envId: string]: 'asc' | 'desc' } = {};
  @Input() environmentCustomOrder: { [envId: string]: number } = {};
  @Input() isLoadingEnvironmentOrder: boolean = false;
  @Input() isSavingOrderToDatabase: boolean = false;
  @Input() isLoadingOrderFromDatabase: boolean = false;
  @Input() orderSyncMessage: string = '';
  @Input() orderSyncMessageType: 'success' | 'error' | 'info' = 'info';
  @Input() tasksUpdatingStatus: { [taskId: string]: boolean } = {};

  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<Task>();
  @Output() toggleHidden = new EventEmitter<Task>();
  @Output() changeStatus = new EventEmitter<{ task: Task; status: 'pending' | 'in-progress' | 'completed' }>();
  @Output() taskUpdated = new EventEmitter<Task>();
  @Output() taskContextMenu = new EventEmitter<{ mouseEvent: MouseEvent; task: Task }>();
  @Output() taskQuickContextMenu = new EventEmitter<{ mouseEvent: MouseEvent; task: Task }>();
  @Output() environmentContextMenu = new EventEmitter<{ mouseEvent: MouseEvent; environment: Environment }>();
  @Output() projectContextMenu = new EventEmitter<{ mouseEvent: MouseEvent; project: Project }>();
  @Output() addTaskToProject = new EventEmitter<{ environmentId: string; projectId: string }>();
  @Output() createProject = new EventEmitter<string>();
  @Output() moveEnvironmentUp = new EventEmitter<string>();
  @Output() moveEnvironmentDown = new EventEmitter<string>();
  @Output() saveOrderToDatabase = new EventEmitter<void>();
  @Output() loadOrderFromDatabase = new EventEmitter<void>();
  @Output() createTaskWithRange = new EventEmitter<{ startTime: Date; endTime: Date }>();

  collapsedEmptyEnvironments: boolean = true;
  collapsedEnvironments: { [envId: string]: boolean } = {};
  collapsedProjects: { [projectId: string]: boolean } = {};
  collapsedProjectSections: { [key: string]: boolean } = {}; // key = projectId_today | projectId_future
  private heightCalculated: boolean = false;
  private isCalculating: boolean = false;
  private resizeObserver?: ResizeObserver;
  private resizeListener?: () => void;

  searchFilterText: string = '';
  private readonly SEARCH_FILTER_CACHE_KEY = 'taskTracker_searchFilterText';

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {
    // Cargar el texto de búsqueda desde localStorage
    this.searchFilterText = localStorage.getItem(this.SEARCH_FILTER_CACHE_KEY) || '';
  }
  
  isTaskUpdating(task: Task): boolean {
    return !!this.tasksUpdatingStatus[task.id];
  }

  // Método para verificar si estamos en layout ancho
  private checkWideLayout(): void {
    this.isWideLayout = window.innerWidth >= this.WIDE_LAYOUT_BREAKPOINT;
  }

  // Handler para resize (guardado como arrow function para mantener el contexto)
  private onWindowResize = (): void => {
    const wasWideLayout = this.isWideLayout;
    this.checkWideLayout();
    
    // Si cambió el estado del layout, recalcular altura
    if (wasWideLayout !== this.isWideLayout) {
      this.heightCalculated = false;
      if (this.isWideLayout) {
        this.calculateAndSetHeight();
      } else {
        // Limpiar estilos cuando no es wide layout
        if (this.weekLayoutWrapper?.nativeElement) {
          this.weekLayoutWrapper.nativeElement.style.height = '';
          this.weekLayoutWrapper.nativeElement.style.maxHeight = '';
        }
      }
      this.cdr.detectChanges();
    }
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['environments'] || changes['environmentCustomOrder'] || changes['tasks']) {
      this.updateOrderedEnvironmentsCache();
      // Solo resetear el cálculo si realmente cambió el contenido significativo
      // No resetear por cambios menores que no afectan la altura
    }
  }

  ngAfterViewInit(): void {
    this.checkWideLayout();
    window.addEventListener('resize', this.onWindowResize);
    
    if (this.isWideLayout) {
      this.setupResizeObserver();
      // Esperar a que el elemento esté disponible y renderizado
      setTimeout(() => {
        if (this.weekLayoutWrapper?.nativeElement && !this.heightCalculated && !this.isCalculating) {
          this.calculateAndSetHeight();
        }
      }, 300);
    }
  }

  ngAfterViewChecked(): void {
    // Solo calcular una vez cuando el elemento esté disponible y no se haya calculado aún
    if (this.isWideLayout && 
        this.weekLayoutWrapper?.nativeElement && 
        !this.heightCalculated && 
        !this.isCalculating) {
      // Usar setTimeout para evitar ejecutarse en cada ciclo
      setTimeout(() => {
        if (this.weekLayoutWrapper?.nativeElement && !this.heightCalculated && !this.isCalculating) {
          this.calculateAndSetHeight();
        }
      }, 100);
    }
  }

  private calculateAndSetHeight(): void {
    if (!this.weekLayoutWrapper?.nativeElement || !this.isWideLayout || this.isCalculating) {
      return;
    }

    this.isCalculating = true;
    this.ngZone.runOutsideAngular(() => {
      const wrapper = this.weekLayoutWrapper.nativeElement;
      const container = wrapper.closest('.week-view-container') as HTMLElement;
      
      if (!container) {
        this.isCalculating = false;
        return;
      }

      // Obtener la posición del wrapper relativa al viewport
      const wrapperRect = wrapper.getBoundingClientRect();
      const wrapperTop = wrapperRect.top;
      
      // Calcular altura disponible: viewport height - posición del wrapper - margen inferior
      const viewportHeight = window.innerHeight;
      const marginBottom = 20; // Margen inferior
      let availableHeight = viewportHeight - wrapperTop - marginBottom;
      
      // Asegurar una altura mínima
      const minHeight = 600;
      let calculatedHeight = Math.max(minHeight, availableHeight);
      
      // Aplicar la altura calculada inicialmente
      wrapper.style.height = `${calculatedHeight}px`;
      wrapper.style.maxHeight = `${calculatedHeight}px`;
      
      // Verificar si hay scroll en la página después del renderizado y ajustar iterativamente
      setTimeout(() => {
        let iterations = 0;
        const maxIterations = 5;
        
        const adjustHeight = () => {
          const hasPageScroll = document.documentElement.scrollHeight > window.innerHeight;
          
          if (hasPageScroll && iterations < maxIterations) {
            const scrollDifference = document.documentElement.scrollHeight - window.innerHeight;
            const currentHeight = parseInt(wrapper.style.height) || calculatedHeight;
            const newHeight = Math.max(minHeight, currentHeight - scrollDifference - 5);
            
            wrapper.style.height = `${newHeight}px`;
            wrapper.style.maxHeight = `${newHeight}px`;
            
            iterations++;
            
            // Verificar nuevamente después de un breve delay
            setTimeout(() => {
              if (document.documentElement.scrollHeight > window.innerHeight) {
                adjustHeight();
              } else {
                // Marcar como completado cuando ya no hay scroll
                this.heightCalculated = true;
                this.isCalculating = false;
              }
            }, 50);
          } else {
            // Marcar como completado cuando ya no hay scroll o se alcanzó el máximo de iteraciones
            this.heightCalculated = true;
            this.isCalculating = false;
          }
        };
        
        adjustHeight();
      }, 200);
    });
  }

  private setupResizeObserver(): void {
    // Solo recalcular en resize si realmente cambió el tamaño significativamente
    let lastWindowWidth = window.innerWidth;
    let lastWindowHeight = window.innerHeight;
    
    this.resizeListener = () => {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;
      
      // Solo recalcular si el cambio es significativo (más de 50px) y estamos en modo desktop
      if (currentWidth >= this.WIDE_LAYOUT_BREAKPOINT && 
          (Math.abs(currentWidth - lastWindowWidth) > 50 || Math.abs(currentHeight - lastWindowHeight) > 50)) {
        if (!this.isCalculating) {
          this.isCalculating = true;
          setTimeout(() => {
            this.calculateAndSetHeight();
            this.isCalculating = false;
          }, 100);
        }
        lastWindowWidth = currentWidth;
        lastWindowHeight = currentHeight;
      }
    };

    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    // Remover listener de wide layout
    window.removeEventListener('resize', this.onWindowResize);
  }

  get orderedEnvironments(): Environment[] {
    return this._orderedEnvironmentsCache;
  }

  private updateOrderedEnvironmentsCache(): void {
    const isMobile = window.innerWidth < 768;
    
    this._orderedEnvironmentsCache = [...this.environments].sort((a, b) => {
      if (isMobile) {
        const aOrder = this.environmentCustomOrder[a.id] ?? Infinity;
        const bOrder = this.environmentCustomOrder[b.id] ?? Infinity;
        
        if (aOrder !== Infinity || bOrder !== Infinity) {
          if (aOrder !== bOrder) {
            return aOrder - bOrder;
          }
        }
        return a.name.localeCompare(b.name);
      }
      
      const aHas = this.environmentHasTasks(a.id);
      const bHas = this.environmentHasTasks(b.id);
      
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      
      const aOrder = this.environmentCustomOrder[a.id] ?? Infinity;
      const bOrder = this.environmentCustomOrder[b.id] ?? Infinity;
      
      if (aOrder !== Infinity || bOrder !== Infinity) {
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
      }
      
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

  getProjectsWithVisibleTasks(environmentId: string): Project[] {
    return this.projects.filter(project => 
      project.environment === environmentId && 
      this.getTasksByProject(project.id).length > 0
    );
  }

  getProjectsWithoutVisibleTasks(environmentId: string): Project[] {
    return this.projects.filter(project => 
      project.environment === environmentId && 
      this.getTasksByProject(project.id).length === 0
    );
  }

  // Proyectos que tienen al menos una tarea pasada en el environment
  getProjectsWithPastTasksInEnv(environmentId: string): Project[] {
    return this.projects.filter(project => 
      project.environment === environmentId && 
      this.getPastTasksByProject(project.id).length > 0
    );
  }

  // Proyectos que tienen al menos una tarea activa/hoy en el environment
  getProjectsWithTodayTasksInEnv(environmentId: string): Project[] {
    return this.projects.filter(project => 
      project.environment === environmentId && 
      this.getTodayTasksByProject(project.id).length > 0
    );
  }

  // Proyectos que tienen al menos una tarea futura en el environment
  getProjectsWithFutureTasksInEnv(environmentId: string): Project[] {
    return this.projects.filter(project => 
      project.environment === environmentId && 
      this.getFutureTasksByProject(project.id).length > 0
    );
  }

  getEnvironmentViewMode(envId: string): 'cards' | 'list' {
    return this.environmentViewMode[envId] || 'cards';
  }

  private resolveEnvironmentHiddenVisibility(envId: string): 'show-all' | 'show-24h' | 'hidden' | 'date-range' {
    if (this.showHidden) return 'show-all';
    return this.environmentHiddenVisibility[envId] || 'hidden';
  }
  
  private getEnvironmentSortOrder(envId: string): 'asc' | 'desc' {
    return this.environmentSortOrder[envId] || 'asc';
  }

  getTasksByEnvironment(environmentId: string): Task[] {
    const visibility = this.resolveEnvironmentHiddenVisibility(environmentId);
    const filtered = this.tasks
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
            case 'date-range':
              // El filtrado por fecha se hace en el componente padre antes de pasar las tareas
              // Aquí solo permitimos mostrar tareas ocultas si están en modo date-range
              return true;
            default: return false;
          }
        }
        return true;
      });
    
    const sortOrder = this.getEnvironmentSortOrder(environmentId);
    
    // Ordenar primero por día (sin hora) según el ordenamiento, luego por hora dentro del día
    return filtered.sort((a, b) => {
      const dateA = new Date(a.start + (a.start.includes('Z') ? '' : 'Z'));
      const dateB = new Date(b.start + (b.start.includes('Z') ? '' : 'Z'));
      
      // Obtener solo la fecha (sin hora) para comparar días
      const dayA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime();
      const dayB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();
      
      // Comparar días primero
      if (dayA !== dayB) {
        return sortOrder === 'desc' ? dayB - dayA : dayA - dayB;
      }
      
      // Si están en el mismo día, ordenar por hora según el ordenamiento
      const timeA = dateA.getTime();
      const timeB = dateB.getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }

  getTasksByProject(projectId: string): Task[] {
    const project = this.projects.find(p => p.id === projectId);
    const environmentId = project?.environment || '';
    const visibility = this.resolveEnvironmentHiddenVisibility(environmentId);
    const filtered = this.tasks
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
            case 'date-range':
              // El filtrado por fecha se hace en el componente padre antes de pasar las tareas
              // Aquí solo permitimos mostrar tareas ocultas si están en modo date-range
              return true;
            default: return false;
          }
        }
        return true;
      })
      .filter(task => this.taskMatchesSearchFilter(task));
    
    const sortOrder = this.getEnvironmentSortOrder(environmentId);
    
    // Ordenar primero por día (sin hora) según el ordenamiento, luego por hora dentro del día
    return filtered.sort((a, b) => {
      const dateA = new Date(a.start + (a.start.includes('Z') ? '' : 'Z'));
      const dateB = new Date(b.start + (b.start.includes('Z') ? '' : 'Z'));
      
      // Obtener solo la fecha (sin hora) para comparar días
      const dayA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime();
      const dayB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();
      
      // Comparar días primero
      if (dayA !== dayB) {
        return sortOrder === 'desc' ? dayB - dayA : dayA - dayB;
      }
      
      // Si están en el mismo día, ordenar por hora según el ordenamiento
      const timeA = dateA.getTime();
      const timeB = dateB.getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }

  getTasksWithoutProjectInEnvironment(environmentId: string): Task[] {
    const visibility = this.resolveEnvironmentHiddenVisibility(environmentId);
    const filtered = this.tasks.filter(task => {
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
          case 'date-range':
            // El filtrado por fecha se hace en el componente padre antes de pasar las tareas
            // Aquí solo permitimos mostrar tareas ocultas si están en modo date-range
            return true;
          default: return false;
        }
      }
      return true;
    })
    .filter(task => this.taskMatchesSearchFilter(task));
    
    const sortOrder = this.getEnvironmentSortOrder(environmentId);
    
    // Ordenar primero por día (sin hora) según el ordenamiento, luego por hora dentro del día
    return filtered.sort((a, b) => {
      const dateA = new Date(a.start + (a.start.includes('Z') ? '' : 'Z'));
      const dateB = new Date(b.start + (b.start.includes('Z') ? '' : 'Z'));
      
      // Obtener solo la fecha (sin hora) para comparar días
      const dayA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime();
      const dayB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();
      
      // Comparar días primero
      if (dayA !== dayB) {
        return sortOrder === 'desc' ? dayB - dayA : dayA - dayB;
      }
      
      // Si están en el mismo día, ordenar por hora según el ordenamiento
      const timeA = dateA.getTime();
      const timeB = dateB.getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }

  isProjectCollapsed(projectId: string): boolean {
    return !!this.collapsedProjects[projectId];
  }

  toggleProjectCollapse(projectId: string): void {
    this.collapsedProjects[projectId] = !this.isProjectCollapsed(projectId);
  }

  // Control de colapso por sección de proyecto (today/future)
  isProjectSectionCollapsed(projectId: string, section: 'past' | 'today' | 'future'): boolean {
    return !!this.collapsedProjectSections[`${projectId}_${section}`];
  }

  toggleProjectSectionCollapse(projectId: string, section: 'past' | 'today' | 'future'): void {
    const key = `${projectId}_${section}`;
    this.collapsedProjectSections[key] = !this.collapsedProjectSections[key];
  }

  areAllProjectsCollapsed(environmentId: string): boolean {
    const projects = this.getProjectsByEnvironment(environmentId);
    if (projects.length === 0) return false;
    const projectsWithTasks = projects.filter(p => this.getTasksByProject(p.id).length > 0);
    if (projectsWithTasks.length === 0) return false;
    // Verificar que todas las secciones (past, today, future) de cada proyecto estén colapsadas
    const sections: ('past' | 'today' | 'future')[] = ['past', 'today', 'future'];
    return projectsWithTasks.every(p => 
      sections.every(section => this.isProjectSectionCollapsed(p.id, section))
    );
  }

  toggleCollapseAllProjectsInEnvironment(environmentId: string): void {
    const shouldCollapse = !this.areAllProjectsCollapsed(environmentId);
    const sections: ('past' | 'today' | 'future')[] = ['past', 'today', 'future'];
    this.getProjectsByEnvironment(environmentId)
      .filter(p => this.getTasksByProject(p.id).length > 0)
      .forEach(p => {
        this.collapsedProjects[p.id] = shouldCollapse;
        // También colapsar/expandir todas las secciones del proyecto
        sections.forEach(section => {
          this.collapsedProjectSections[`${p.id}_${section}`] = shouldCollapse;
        });
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

  getTaskTypeColor(task: Task): string | null {
    if (!task.type || !this.taskTypes.length) return null;
    const taskType = this.taskTypes.find(t => t.id === task.type);
    return taskType?.color || null;
  }

  getTaskGroupName(task: Task): string | null {
    if (!task.taskGroupId) return null;
    const group = this.taskGroups.find(g => g.id === task.taskGroupId);
    return group?.name || null;
  }

  taskMatchesSearchFilter(task: Task): boolean {
    if (!this.searchFilterText.trim()) return true;
    const searchLower = this.searchFilterText.toLowerCase().trim();
    
    // Buscar en el nombre de la tarea
    if (task.name.toLowerCase().includes(searchLower)) return true;
    
    // Buscar en el nombre del grupo (Complex title)
    const groupName = this.getTaskGroupName(task);
    if (groupName && groupName.toLowerCase().includes(searchLower)) return true;
    
    return false;
  }

  onSearchFilterChange(): void {
    localStorage.setItem(this.SEARCH_FILTER_CACHE_KEY, this.searchFilterText);
  }

  clearSearchFilter(): void {
    this.searchFilterText = '';
    localStorage.removeItem(this.SEARCH_FILTER_CACHE_KEY);
  }

  // Verifica si una tarea es de "hoy" (inicio hoy O activa ahora)
  isTaskForToday(task: Task): boolean {
    const now = new Date();
    const startDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
    const endDate = new Date(task.end + (task.end.includes('Z') ? '' : 'Z'));
    
    // Es de hoy si: inicio es hoy O está activa ahora
    const isStartToday = startDate.toDateString() === now.toDateString();
    const isActive = startDate <= now && now <= endDate;
    
    return isStartToday || isActive;
  }

  // Tareas de hoy por proyecto
  getTodayTasksByProject(projectId: string): Task[] {
    return this.getTasksByProject(projectId).filter(task => this.isTaskForToday(task));
  }

  // Verifica si una tarea ya pasó (endDate < now y no es de hoy)
  isTaskPast(task: Task): boolean {
    const now = new Date();
    const endDate = new Date(task.end + (task.end.includes('Z') ? '' : 'Z'));
    // Es pasada si ya terminó y no es de hoy
    return endDate < now && !this.isTaskForToday(task);
  }

  // Tareas pasadas por proyecto
  getPastTasksByProject(projectId: string): Task[] {
    return this.getTasksByProject(projectId).filter(task => this.isTaskPast(task));
  }

  // Tareas futuras por proyecto (excluyendo pasadas)
  getFutureTasksByProject(projectId: string): Task[] {
    return this.getTasksByProject(projectId).filter(task => 
      !this.isTaskForToday(task) && !this.isTaskPast(task)
    );
  }

  canMoveEnvironmentUp(envId: string): boolean {
    const envHasTasks = this.environmentHasTasks(envId);
    const environmentsInSameGroup = this.environments
      .filter(env => this.environmentHasTasks(env.id) === envHasTasks)
      .map(env => ({
        env,
        order: this.environmentCustomOrder[env.id] ?? Infinity
      }))
      .sort((a, b) => a.order - b.order);

    const currentIndex = environmentsInSameGroup.findIndex(item => item.env.id === envId);
    return currentIndex > 0;
  }

  canMoveEnvironmentDown(envId: string): boolean {
    const envHasTasks = this.environmentHasTasks(envId);
    const environmentsInSameGroup = this.environments
      .filter(env => this.environmentHasTasks(env.id) === envHasTasks)
      .map(env => ({
        env,
        order: this.environmentCustomOrder[env.id] ?? Infinity
      }))
      .sort((a, b) => a.order - b.order);

    const currentIndex = environmentsInSameGroup.findIndex(item => item.env.id === envId);
    return currentIndex < environmentsInSameGroup.length - 1;
  }
}

