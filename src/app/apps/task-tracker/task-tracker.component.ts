import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from '@angular/fire/firestore';
import { TaskService } from './services/task.service';
import { ProjectService } from './services/project.service';
import { EnvironmentService } from './services/environment.service';
import { Task } from './models/task.model';
import { Project } from './models/project.model';
import { Environment } from './models/environment.model';
import { ManagementModalComponent } from './components/management-modal/management-modal.component';
import { TimelineSvgComponent } from './components/timeline-svg/timeline-svg.component';
import { CurrentTaskInfoComponent } from './components/current-task-info/current-task-info.component';
import { TaskModalComponent } from './components/task-modal/task-modal.component';
import { RemindersModalComponent } from './components/reminders-modal/reminders-modal.component';

@Component({
  selector: 'app-task-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ManagementModalComponent, TimelineSvgComponent, CurrentTaskInfoComponent, TaskModalComponent, RemindersModalComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <header class="bg-indigo-600 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div class="flex items-center space-x-3">
            <i class="fas fa-tasks text-2xl"></i>
            <h1 class="text-2xl font-bold">TaskFlow</h1>
          </div>
          <div class="flex items-center space-x-4">
            <button (click)="openNewTaskModal()" class="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition">
              <i class="fas fa-plus mr-2"></i>Nueva Tarea
            </button>
            <div class="relative">
              <button class="flex items-center space-x-2">
                <img [src]="userPhotoUrl" alt="User" class="w-8 h-8 rounded-full">
                <span class="hidden md:inline">{{userName}}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="max-w-7xl mx-auto px-4 py-6">
        <!-- Current Task Info Card -->
        <app-current-task-info 
          [tasks]="tasks" 
          [projects]="projects" 
          [environments]="environments">
        </app-current-task-info>

        <!-- View Selector -->
        <div class="bg-white rounded-lg shadow-md p-4 mb-6">
          <div class="flex flex-wrap justify-between items-center">
            <div class="flex space-x-2 mb-4 md:mb-0">
              <button (click)="switchView('board')" [class.bg-indigo-600]="currentView === 'board'" [class.text-white]="currentView === 'board'" [class.bg-white]="currentView !== 'board'" [class.text-gray-700]="currentView !== 'board'" class="px-4 py-2 rounded-lg font-medium hover:bg-gray-100">
                <i class="fas fa-columns mr-2"></i>Tablero
              </button>
              <button (click)="switchView('timeline')" [class.bg-indigo-600]="currentView === 'timeline'" [class.text-white]="currentView === 'timeline'" [class.bg-white]="currentView !== 'timeline'" [class.text-gray-700]="currentView !== 'timeline'" class="px-4 py-2 rounded-lg font-medium hover:bg-gray-100">
                <i class="fas fa-stream mr-2"></i>Línea del Tiempo
              </button>
              <button (click)="openManagementModal()" class="px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300">
                <i class="fas fa-cog mr-2"></i>Gestionar
              </button>
            </div>
            <div class="flex items-center space-x-2">
              <div class="relative">
                <input type="text" [(ngModel)]="searchQuery" (input)="filterTasks()" placeholder="Buscar tareas..." class="pl-10 pr-4 py-2 border rounded-lg w-full md:w-64">
                <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
              </div>
              <button (click)="toggleShowHidden()" class="p-2 hover:text-indigo-600" [class.text-indigo-600]="showHidden">
                <i class="fas fa-filter"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Views Container -->
        <div class="views-container">
          <!-- Board View -->
          <div *ngIf="currentView === 'board'" class="w-full bg-white rounded-lg shadow-md p-4">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-bold">Vista de Tablero</h2>
              <div *ngIf="emptyEnvironmentsCount > 0" class="flex items-center space-x-2">
                <span class="text-sm text-gray-600">{{emptyEnvironmentsCount}} ambiente(s) vacío(s)</span>
                <button (click)="toggleAllEmptyEnvironments()" 
                        class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg border transition-colors">
                  <i class="fas" [ngClass]="collapsedEmptyEnvironments ? 'fa-chevron-down' : 'fa-chevron-up'" class="mr-1"></i>
                  {{ collapsedEmptyEnvironments ? 'Expandir' : 'Contraer' }} vacíos
                </button>
              </div>
            </div>
            <!-- Timeline View integrada -->
            <div class="mb-6">
              <h3 class="text-lg font-semibold mb-2">Línea del Tiempo</h3>
              <app-timeline-svg [tasks]="tasks" [environments]="environments" (editTask)="editTask($event)"></app-timeline-svg>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div *ngFor="let env of orderedEnvironments" class="board-column">
                <!-- Header fijo del ambiente -->
                <div class="environment-header p-4 pb-2">
                  <div class="flex items-center justify-between">
                    <h3 class="font-semibold p-2 rounded-md text-black flex-1"
                        [style.background-color]="env.color + 'aa'" 
                        [style.color]="'black'">{{env.name}}</h3>
                    <div class="flex items-center ml-2">
                      <!-- Botón de colapso solo para environments vacíos -->
                      <button *ngIf="!environmentHasTasks(env.id)"
                              (click)="toggleEnvironmentCollapse(env.id)"
                              class="p-1 text-gray-500 hover:text-gray-700 mr-1"
                              [title]="isEnvironmentCollapsed(env.id) ? 'Expandir ambiente' : 'Contraer ambiente'">
                        <i class="fas" [ngClass]="isEnvironmentCollapsed(env.id) ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
                      </button>
                      <button (click)="onEnvironmentContextMenu($event, env)" class="p-1 text-gray-500 hover:text-gray-700">
                        <i class="fas fa-ellipsis-v"></i>
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- Contenido con scroll del ambiente -->
                <div class="environment-content px-4">
                  <!-- Proyectos dentro del ambiente -->
                  <div *ngIf="!isEnvironmentCollapsed(env.id)" class="space-y-4">
                    <div *ngFor="let project of getProjectsByEnvironment(env.id)" class="project-section">
                      <!-- Header del proyecto con botón agregar -->
                      <div class="flex items-center justify-between mb-2 p-2 bg-gray-50 rounded-lg">
                        <div class="flex items-center gap-2">
                          <button (click)="onProjectContextMenu($event, project)" class="p-1 text-gray-500 hover:text-gray-700">
                            <i class="fas fa-ellipsis-v"></i>
                          </button>
                          <h4 class="text-sm font-medium text-gray-700">
                            <i class="fas fa-folder mr-1"></i>{{project.name}}
                          </h4>
                        </div>
                        <button 
                          (click)="openNewTaskModalForProject(env.id, project.id)"
                          class="bg-indigo-600 text-white px-2 py-1 rounded text-xs hover:bg-indigo-700 transition-colors"
                          title="Agregar tarea a {{project.name}}">
                          <i class="fas fa-plus mr-1"></i>Agregar
                        </button>
                      </div>
                      
                      <!-- Tareas del proyecto -->
                      <div class="space-y-2 ml-2">
                        <div *ngFor="let task of getTasksByProject(project.id)"
                             class="task-card bg-white p-3 rounded-lg shadow-sm border border-gray-200 relative"
                             [class.status-completed]="task.status === 'completed'"
                             [class.status-in-progress]="task.status === 'in-progress'"
                             [class.status-pending]="task.status === 'pending'"
                             [class.task-overdue]="isTaskOverdue(task)"
                             [class.task-running]="isTaskRunning(task)">
                          <!-- Barra de progreso superior -->
                          <div class="progress-bar-container">
                            <div class="progress-bar" 
                                 [class.progress-pending]="task.status === 'pending'"
                                 [class.progress-in-progress]="task.status === 'in-progress'"
                                 [class.progress-completed]="task.status === 'completed'">
                            </div>
                          </div>
                          
                          <button (click)="onTaskContextMenu($event, task)" class="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700">
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
                        
                        <!-- Mensaje si el proyecto no tiene tareas -->
                        <div *ngIf="getTasksByProject(project.id).length === 0" class="text-center py-4">
                          <p class="text-gray-500 text-sm">No hay tareas en este proyecto</p>
                          <button 
                            (click)="openNewTaskModalForProject(env.id, project.id)"
                            class="mt-2 text-indigo-600 hover:text-indigo-800 text-sm">
                            <i class="fas fa-plus mr-1"></i>Crear primera tarea
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Tareas sin proyecto asignado dentro del ambiente -->
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
                          <!-- Barra de progreso superior -->
                          <div class="progress-bar-container">
                            <div class="progress-bar" 
                                 [class.progress-pending]="task.status === 'pending'"
                                 [class.progress-in-progress]="task.status === 'in-progress'"
                                 [class.progress-completed]="task.status === 'completed'">
                            </div>
                          </div>
                          
                          <button (click)="onTaskContextMenu($event, task)" class="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700">
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
                    
                    <!-- Mensaje si el ambiente no tiene proyectos -->
                    <div *ngIf="getProjectsByEnvironment(env.id).length === 0" class="text-center py-6">
                      <p class="text-gray-500 text-sm mb-2">No hay proyectos en este ambiente</p>
                      <button 
                        (click)="openNewProjectModal()"
                        class="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300 transition-colors">
                        <i class="fas fa-plus mr-1"></i>Crear proyecto
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Timeline View -->
          <div *ngIf="currentView === 'timeline'" class="w-full bg-white rounded-lg shadow-md p-4">
            <h2 class="text-xl font-bold mb-4">Línea del Tiempo</h2>
            <app-timeline-svg [tasks]="tasks" [environments]="environments" (editTask)="editTask($event)"></app-timeline-svg>
          </div>
        </div>
      </main>

      <!-- Tareas Huérfanas Section -->
      <section *ngIf="orphanedTasks.length > 0" class="max-w-7xl mx-auto px-4 py-6">
        <div class="bg-white rounded-lg shadow-md p-4">
          <h2 class="text-xl font-bold mb-4 text-orange-600">Tareas Sin Asignar (Huérfanas)</h2>
          <p class="text-sm text-gray-600 mb-4">
            Estas tareas no están asociadas a ningún entorno o proyecto. Puedes seleccionarlas y asignarlas a un proyecto existente.
          </p>
          <div class="mb-4 flex justify-between items-center">
            <button (click)="openAssignOrphanedTasksModal()" 
                    [disabled]="noOrphanedSelected || isAssigningOrphanedTasks"
                    class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
              <i class="fas fa-check-double mr-2"></i>
              {{ isAssigningOrphanedTasks ? 'Asignando...' : 'Asignar Seleccionadas' }}
            </button>
            <div *ngIf="orphanedTasks.length > 0" class="flex items-center">
                <input type="checkbox" id="selectAllOrphaned" 
                       [checked]="allOrphanedSelected" 
                       (change)="toggleSelectAllOrphaned($event)"
                       class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2">
                <label for="selectAllOrphaned" class="text-sm text-gray-700">Seleccionar todas</label>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sel.</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr *ngFor="let task of orphanedTasks" [class.bg-indigo-50]="selectedOrphanedTasks[task.id]">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <input type="checkbox" [(ngModel)]="selectedOrphanedTasks[task.id]" class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {{ task.emoji }} {{ task.name }}
                      <i *ngIf="task.hidden" class="fas fa-eye-slash text-gray-400 text-sm ml-2" title="Tarea oculta"></i>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{{ task.description || '-' }}</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                          [class.bg-green-100]="task.priority === 'low'" [class.text-green-800]="task.priority === 'low'"
                          [class.bg-blue-100]="task.priority === 'medium'" [class.text-blue-800]="task.priority === 'medium'"
                          [class.bg-red-100]="task.priority === 'high'" [class.text-red-800]="task.priority === 'high'"
                          [class.bg-pink-100]="task.priority === 'critical'" [class.text-pink-800]="task.priority === 'critical'">
                      {{ task.priority }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button (click)="editTask(task)" class="text-indigo-600 hover:text-indigo-900 mr-3">
                      <i class="fas fa-pencil-alt mr-1"></i>Editar
                    </button>
                    <button (click)="deleteTask(task)" class="text-red-600 hover:text-red-900">
                      <i class="fas fa-trash mr-1"></i>Eliminar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Modals -->
      <app-management-modal 
        *ngIf="showManagementModal" 
        [showModal]="showManagementModal"
        [environments]="environments"
        [projects]="projects"
        (closeModal)="closeManagementModal()"
      ></app-management-modal>

      <!-- Assign Orphaned Tasks Modal -->
      <div *ngIf="showAssignOrphanedTasksModal" class="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">Asignar Tareas a Proyecto</h3>
              <button (click)="closeAssignOrphanedTasksModal()" class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <form (ngSubmit)="assignSelectedOrphanedTasks()" class="space-y-4">
              <div>
                <label for="assignProjectTarget" class="block text-sm font-medium text-gray-700">Seleccionar Proyecto Destino</label>
                <select id="assignProjectTarget" name="assignProjectTarget" [(ngModel)]="projectForAssigningOrphans" required
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white">
                  <option value="" disabled>Elige un proyecto...</option>
                  <option *ngFor="let proj of projects" [value]="proj.id">
                    {{ proj.name }} (Entorno: {{ getEnvironmentName(proj.environment) || 'N/A' }})
                  </option>
                </select>
              </div>
              <div class="flex justify-end space-x-3 pt-4">
                <button type="button" (click)="closeAssignOrphanedTasksModal()"
                        class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" [disabled]="!projectForAssigningOrphans || isAssigningOrphanedTasks"
                        class="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                  {{ isAssigningOrphanedTasks ? 'Asignando...' : 'Confirmar Asignación' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- New Task Modal -->
      <app-task-modal
        *ngIf="showNewTaskModal"
        [showModal]="showNewTaskModal"
        [isEditing]="false"
        [task]="newTask"
        [environments]="orderedEnvironments"
        [projects]="projects"
        (closeModalEvent)="closeNewTaskModal()"
        (saveTaskEvent)="saveTask()"
        (openEnvironmentModal)="openNewEnvironmentModal()"
        (openProjectModal)="openNewProjectModal()"
        (openRemindersModal)="openRemindersModal('new')"
        (openCalculatorModal)="openTimeCalculator($event.type, 'new')">
      </app-task-modal>

      <!-- New Environment Modal -->
      <div *ngIf="showNewEnvironmentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all">
          <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200">
            <h3 class="text-xl font-semibold text-gray-800">Nuevo Ambiente</h3>
            <button (click)="closeNewEnvironmentModal()" class="text-gray-400 hover:text-gray-600 transition">
              <i class="fas fa-times fa-lg"></i>
            </button>
          </div>
          <div class="p-6">
            <form (ngSubmit)="saveNewEnvironment()" class="space-y-4">
              <div>
                <label for="envName" class="block text-sm font-medium text-gray-700 mb-1">Nombre del Ambiente</label>
                <input type="text" id="envName" name="envName" [(ngModel)]="newEnvironment.name" required 
                       class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                       placeholder="Ingresa el nombre del ambiente">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">Color</label>
                
                <!-- Colores sugeridos -->
                <div class="mb-6">
                  <p class="text-xs text-gray-500 mb-3">Colores sugeridos:</p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      *ngFor="let color of suggestedColors"
                      type="button"
                      (click)="selectSuggestedColor(color)"
                      class="w-8 h-8 rounded-full border-2 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      [style.background-color]="color"
                      [class.border-gray-800]="newEnvironment.color === color"
                      [class.border-gray-300]="newEnvironment.color !== color"
                      [title]="color">
                    </button>
                  </div>
                </div>

                <!-- Color Picker Personalizado -->
                <div class="mb-4">
                  <p class="text-xs text-gray-500 mb-3">O elige un color personalizado:</p>
                  <div class="flex gap-4">
                    <!-- Área principal del color picker -->
                    <div class="relative">
                      <div 
                        class="w-48 h-32 border border-gray-300 rounded-lg cursor-crosshair relative overflow-hidden"
                        [style.background]="'linear-gradient(to right, white, hsl(' + colorPickerHue + ', 100%, 50%)), linear-gradient(to top, black, transparent)'"
                        (click)="onColorAreaClick($event)">
                        
                        <!-- Indicador de posición -->
                        <div 
                          class="absolute w-3 h-3 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                          [style.left]="colorPickerSaturation + '%'"
                          [style.top]="(100 - colorPickerLightness) + '%'"
                          style="box-shadow: 0 0 0 1px rgba(0,0,0,0.3);">
                        </div>
                      </div>
                    </div>

                    <!-- Barra de matiz -->
                    <div class="relative">
                      <div 
                        class="w-6 h-32 border border-gray-300 rounded cursor-pointer"
                        style="background: linear-gradient(to bottom, 
                          hsl(0, 100%, 50%) 0%, 
                          hsl(60, 100%, 50%) 16.66%, 
                          hsl(120, 100%, 50%) 33.33%, 
                          hsl(180, 100%, 50%) 50%, 
                          hsl(240, 100%, 50%) 66.66%, 
                          hsl(300, 100%, 50%) 83.33%, 
                          hsl(360, 100%, 50%) 100%)"
                        (click)="onHueBarClick($event)">
                        
                        <!-- Indicador de matiz -->
                        <div 
                          class="absolute w-full h-0.5 bg-white border border-gray-400 transform -translate-y-1/2 pointer-events-none"
                          [style.top]="(colorPickerHue / 360) * 100 + '%'">
                        </div>
                      </div>
                    </div>

                    <!-- Vista previa -->
                    <div class="flex flex-col items-center gap-2">
                      <p class="text-xs text-gray-500">Vista previa:</p>
                      <div 
                        class="w-16 h-16 border border-gray-300 rounded-lg"
                        [style.background-color]="newEnvironment.color || '#3B82F6'">
                      </div>
                      <p class="text-xs font-mono text-gray-600">{{ newEnvironment.color || '#3B82F6' }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex justify-end space-x-3 pt-4">
                <button type="button" (click)="closeNewEnvironmentModal()"
                        class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">
                  Cancelar
                </button>
                <button type="submit"
                        class="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  Crear Ambiente
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- New Project Modal -->
      <div *ngIf="showNewProjectModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">Nuevo Proyecto</h3>
              <button (click)="closeNewProjectModal()" class="text-gray-500 hover:text-gray-700">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <form (ngSubmit)="saveNewProject()" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del proyecto</label>
                <input type="text" [(ngModel)]="newProject.name" name="projectName" class="w-full px-3 py-2 border rounded-lg" required>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea [(ngModel)]="newProject.description" name="projectDescription" rows="3" class="w-full px-3 py-2 border rounded-lg"></textarea>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
                <select [(ngModel)]="newProject.environment" name="projectEnvironment" class="w-full px-3 py-2 border rounded-lg bg-white" required>
                  <option value="" disabled>Seleccionar ambiente</option>
                  <option *ngFor="let env of orderedEnvironments" [value]="env.id">{{env.name}}</option>
                </select>
              </div>
              
              <div class="flex justify-end space-x-3 pt-4">
                <button type="button" (click)="closeNewProjectModal()" class="px-4 py-2 border rounded-lg font-medium">
                  Cancelar
                </button>
                <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  Guardar Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Context Menu -->
      <div *ngIf="showContextMenu" 
           class="context-menu" 
           [style.left]="contextMenuPosition.x + 'px'" 
           [style.top]="contextMenuPosition.y + 'px'"
           (click)="$event.stopPropagation()">
        <div class="context-menu-item" (click)="editTask(selectedTask!)">
          <i class="fas fa-edit"></i>
          <span>Editar</span>
        </div>
        <div class="context-menu-item" (click)="deleteTask(selectedTask!)">
          <i class="fas fa-trash"></i>
          <span>Eliminar</span>
        </div>
        <div class="context-menu-item" (click)="toggleHidden(selectedTask!)">
          <i class="fas" [ngClass]="selectedTask!.hidden ? 'fa-eye' : 'fa-eye-slash'"></i>
          <span>{{ selectedTask!.hidden ? 'Mostrar' : 'Ocultar' }}</span>
        </div>
        <div class="context-menu-item context-menu-item-completed" (click)="changeStatus(selectedTask!, 'completed')" *ngIf="selectedTask?.status !== 'completed'">
          <i class="fas fa-check"></i>
          <span>Marcar completada</span>
        </div>
        <div class="context-menu-item context-menu-item-progress" (click)="changeStatus(selectedTask!, 'in-progress')" *ngIf="selectedTask?.status !== 'in-progress'">
          <i class="fas fa-spinner"></i>
          <span>Marcar en progreso</span>
        </div>
        <div class="context-menu-item context-menu-item-pending" (click)="changeStatus(selectedTask!, 'pending')" *ngIf="selectedTask?.status !== 'pending'">
          <i class="fas fa-play"></i>
          <span>Marcar pendiente</span>
        </div>
      </div>

      <!-- Environment Context Menu -->
      <div *ngIf="showEnvironmentContextMenu" 
           class="context-menu" 
           [style.left]="environmentContextMenuPosition.x + 'px'" 
           [style.top]="environmentContextMenuPosition.y + 'px'"
           (click)="$event.stopPropagation()">
        <div class="context-menu-item" (click)="createProjectForEnvironment(selectedEnvironment!.id)">
          <i class="fas fa-folder-plus"></i>
          <span>Crear Proyecto</span>
        </div>
        <hr class="my-1 border-gray-200">
        <!-- Opciones de visibilidad de tareas ocultas -->
        <div class="context-menu-item" 
             [class.context-menu-item-active]="getEnvironmentHiddenVisibility(selectedEnvironment!.id) === 'show-all'"
             (click)="setEnvironmentHiddenVisibility(selectedEnvironment!.id, 'show-all')">
          <i class="fas fa-eye"></i>
          <span>Mostrar ocultos</span>
        </div>
        <div class="context-menu-item" 
             [class.context-menu-item-active]="getEnvironmentHiddenVisibility(selectedEnvironment!.id) === 'show-24h'"
             (click)="setEnvironmentHiddenVisibility(selectedEnvironment!.id, 'show-24h')">
          <i class="fas fa-clock"></i>
          <span>Mostrar ocultos 24h</span>
        </div>
        <div class="context-menu-item" 
             [class.context-menu-item-active]="getEnvironmentHiddenVisibility(selectedEnvironment!.id) === 'hidden'"
             (click)="setEnvironmentHiddenVisibility(selectedEnvironment!.id, 'hidden')">
          <i class="fas fa-eye-slash"></i>
          <span>Ocultar ocultos</span>
        </div>
        <hr class="my-1 border-gray-200">
        <div class="context-menu-item context-menu-item-danger" (click)="deleteEnvironment(selectedEnvironment!)">
          <i class="fas fa-trash"></i>
          <span>Eliminar Ambiente</span>
        </div>
      </div>

      <!-- Project Context Menu -->
      <div *ngIf="showProjectContextMenu" 
           class="context-menu" 
           [style.left]="projectContextMenuPosition.x + 'px'" 
           [style.top]="projectContextMenuPosition.y + 'px'"
           (click)="$event.stopPropagation()">
        <div class="context-menu-item context-menu-item-danger" (click)="deleteProject(selectedProject!)">
          <i class="fas fa-trash"></i>
          <span>Eliminar Proyecto</span>
        </div>
      </div>

      <!-- Edit Task Modal -->
      <app-task-modal
        *ngIf="showEditTaskModal"
        [showModal]="showEditTaskModal"
        [isEditing]="true"
        [task]="selectedTask || {}"
        [environments]="orderedEnvironments"
        [projects]="projects"
        (closeModalEvent)="showEditTaskModal = false"
        (saveTaskEvent)="saveEditedTask()"
        (openEnvironmentModal)="openNewEnvironmentModal()"
        (openProjectModal)="openNewProjectModal()"
        (openRemindersModal)="openRemindersModal('edit')"
        (openCalculatorModal)="openTimeCalculator($event.type, 'edit')">
      </app-task-modal>

      <!-- Time Calculator Modal -->
      <div *ngIf="showTimeCalculatorModal" 
           class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
           (mousedown)="onCalculatorBackdropMouseDown($event)"
           (mouseup)="onCalculatorBackdropMouseUp($event)">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md"
             (mousedown)="$event.stopPropagation()"
             (mouseup)="$event.stopPropagation()">
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">
                Calcular {{ calculatorType === 'start' ? 'Hora de Inicio' : 'Hora de Fin' }}
              </h3>
              <button (click)="closeTimeCalculator()" class="text-gray-500 hover:text-gray-700">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  {{ calculatorType === 'start' ? 'Restar de la hora de fin:' : 'Sumar a la hora de inicio:' }}
                </label>
                <input 
                  type="text" 
                  [(ngModel)]="calculatorInput"
                  (input)="validateCalculatorInput()"
                  placeholder="ej: 1.5, 2h, 30, 1.5+0.5"
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  [class.border-red-500]="calculatorError && calculatorInput"
                  [class.border-green-500]="calculatorIsValid && calculatorInput">
              </div>
              
              <div class="text-sm text-gray-600">
                <p class="mb-1"><strong>Formatos válidos:</strong></p>
                <ul class="list-disc pl-5 space-y-1">
                  <li><strong>Minutos:</strong> 30, 45, 90</li>
                  <li><strong>Horas:</strong> 1h, 2.5h, 1.25 h</li>
                  <li><strong>Operaciones:</strong> 1+0.5, 2*1.5, 3-0.25h</li>
                  <li><strong>Con paréntesis:</strong> (45) h, (1.5+0.5) h, (2*1.5) h</li>
                </ul>
              </div>
              
              <div *ngIf="calculatorError && calculatorInput" class="bg-red-50 border border-red-200 rounded-lg p-3">
                <div class="flex items-center">
                  <i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>
                  <span class="text-red-600 text-sm">{{ calculatorError }}</span>
                </div>
              </div>
              
              <div *ngIf="calculatorIsValid && calculatorInput" class="bg-green-50 border border-green-200 rounded-lg p-3">
                <div class="flex items-center">
                  <i class="fas fa-check-circle text-green-600 mr-2"></i>
                  <span class="text-green-600 text-sm">{{ getCalculatorPreview() }}</span>
                </div>
              </div>
            </div>
            
            <div class="flex justify-end space-x-3 pt-6">
              <button type="button" (click)="closeTimeCalculator()" class="px-4 py-2 border rounded-lg font-medium">
                Cancelar
              </button>
              <button 
                type="button" 
                (click)="applyTimeCalculation()"
                [disabled]="!calculatorIsValid || !calculatorInput"
                [class.opacity-50]="!calculatorIsValid || !calculatorInput"
                [class.cursor-not-allowed]="!calculatorIsValid || !calculatorInput"
                class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:hover:bg-indigo-600">
                <i class="fas fa-calculator mr-2"></i>Calcular
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Status Change Confirmation Modal -->
      <div *ngIf="showStatusChangeModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">{{ getStatusChangeModalTitle() }}</h3>
              <button (click)="closeStatusChangeModal()" class="text-gray-500 hover:text-gray-700">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="mb-6">
              <p class="text-gray-700 mb-4">{{ getStatusChangeModalMessage() }}</p>
              
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div class="flex items-center">
                  <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                  <span class="text-blue-700 text-sm">
                    <span *ngIf="statusChangeWillHide">Las tareas ocultas no aparecerán en la vista normal, pero puedes verlas activando el filtro de tareas ocultas.</span>
                    <span *ngIf="!statusChangeWillHide">Si la tarea estaba oculta, volverá a ser visible en la vista normal.</span>
                  </span>
                </div>
              </div>
            </div>
            
            <div class="flex justify-end space-x-3">
              <button 
                type="button" 
                (click)="confirmStatusChangeWithVisibility(false)"
                class="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">
                <span *ngIf="statusChangeWillHide">No ocultar</span>
                <span *ngIf="!statusChangeWillHide">No mostrar</span>
              </button>
              <button 
                type="button" 
                (click)="confirmStatusChangeWithVisibility(true)"
                class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                <i class="fas" [ngClass]="statusChangeWillHide ? 'fa-eye-slash' : 'fa-eye'" class="mr-2"></i>
                <span *ngIf="statusChangeWillHide">Sí, ocultar</span>
                <span *ngIf="!statusChangeWillHide">Sí, mostrar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de Gestión de Recordatorios -->
      <app-reminders-modal
        *ngIf="showRemindersModal"
        [showModal]="showRemindersModal"
        [reminders]="remindersModalContext === 'new' ? (newTask.reminders || []) : (selectedTask?.reminders || [])"
        [taskDates]="{
          start: remindersModalContext === 'new' ? newTask.start : selectedTask?.start,
          end: remindersModalContext === 'new' ? newTask.end : selectedTask?.end,
          deadline: remindersModalContext === 'new' ? newTask.deadline : selectedTask?.deadline
        }"
        (closeModalEvent)="closeRemindersModal()"
        (remindersChanged)="remindersModalContext === 'new' ? (newTask.reminders = $event) : (selectedTask ? selectedTask.reminders = $event : null)">
      </app-reminders-modal>
  `,
  styles: [`
    .priority-low { background-color: #4caf50; }
    .priority-medium { background-color: #ff9800; }
    .priority-high { background-color: #f44336; }
    .priority-critical { background-color: #9c27b0; }
    
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
    
    .environment-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .environment-content::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    
    .environment-content::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }
    
    .environment-content::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
    
    .task-card {
      transition: all 0.2s ease;
      position: relative;
    }
    
    .task-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    
    .emoji-picker {
      position: absolute;
      top: 100%;
      margin-top: 8px;
      right: 0;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 10px;
      width: 300px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .emoji-option {
      font-size: 20px;
      padding: 5px;
      cursor: pointer;
      display: inline-block;
    }
    
    .emoji-option:hover {
      transform: scale(1.2);
    }

    .context-menu {
      position: fixed;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 1000;
      min-width: 200px;
    }

    .context-menu-item {
      padding: 8px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .context-menu-item:hover {
      background: #f3f4f6;
    }

    .context-menu-item-active {
      background: #e0f2fe;
      color: #0277bd;
      font-weight: 500;
    }

    .context-menu-item-active:hover {
      background: #b3e5fc;
      color: #01579b;
    }

    .context-menu-item-danger {
      color: #dc2626;
    }

    .context-menu-item-danger:hover {
      background: #fef2f2;
      color: #b91c1c;
    }

    .context-menu-item-completed {
      color: #10b981;
    }

    .context-menu-item-completed:hover {
      background: #ecfdf5;
      color: #059669;
    }

    .context-menu-item-progress {
      color: #f59e0b;
    }

    .context-menu-item-progress:hover {
      background: #fffbeb;
      color: #d97706;
    }

    .context-menu-item-pending {
      color: #3b82f6;
    }

    .context-menu-item-pending:hover {
      background: #eff6ff;
      color: #2563eb;
    }

    .task-options {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
    }

    .task-option-btn {
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(255,255,255,0.8);
      cursor: pointer;
      font-size: 12px;
    }

    .task-option-btn:hover {
      background: rgba(255,255,255,1);
    }

    /* Destacar estado de la tarea */
    .status-completed {
      opacity: 0.6;
      text-decoration: line-through;
      border-left: 4px solid #22c55e;
    }
    .status-in-progress {
      border-left: 4px solid #facc15;
    }
    .status-pending {
      border-left: 4px solid #3b82f6;
    }

    .project-section {
      border-left: 3px solid #e5e7eb;
      padding-left: 8px;
      margin-left: 4px;
    }

    .project-section:hover {
      border-left-color: #6366f1;
    }

    .progress-bar-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 6px;
      background-color: #e5e7eb;
      border-radius: 8px 8px 0 0;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      transition: width 0.3s ease;
      border-radius: 8px 8px 0 0;
    }

    .progress-pending {
      width: 20%;
      background-color: #3b82f6;
    }

    .progress-in-progress {
      width: 60%;
      background-color: #f59e0b;
    }

    .progress-completed {
      width: 100%;
      background-color: #10b981;
    }

    /* Tareas vencidas - efecto parpadeante */
    .task-overdue {
      border: 3px solid transparent;
      animation: overdue-pulse 1.5s infinite;
      position: relative;
    }

    @keyframes overdue-pulse {
      0%, 100% {
        border-color: #ef4444;
        box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.4), 
                    0 0 20px rgba(239, 68, 68, 0.3),
                    0 0 40px rgba(239, 68, 68, 0.2);
      }
      50% {
        border-color: #ffffff;
        box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.8), 
                    0 0 25px rgba(255, 255, 255, 0.6),
                    0 0 45px rgba(255, 255, 255, 0.4);
      }
    }

    /* Asegurar que el efecto se vea incluso en tareas hover */
    .task-overdue:hover {
      animation: overdue-pulse 1.5s infinite;
      transform: translateY(-2px);
    }

    /* Tareas en progreso - efecto parpadeante verde-blanco */
    .task-running {
      border: 3px solid transparent;
      animation: running-pulse 1.5s infinite;
      position: relative;
    }

    @keyframes running-pulse {
      0%, 100% {
        border-color: #10b981;
        box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.4), 
                    0 0 20px rgba(16, 185, 129, 0.3),
                    0 0 40px rgba(16, 185, 129, 0.2);
      }
      50% {
        border-color: #ffffff;
        box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.8), 
                    0 0 25px rgba(255, 255, 255, 0.6),
                    0 0 45px rgba(255, 255, 255, 0.4);
      }
    }

    /* Asegurar que el efecto se vea incluso en tareas hover */
    .task-running:hover {
      animation: running-pulse 1.5s infinite;
      transform: translateY(-2px);
    }

    .task-running::before {
      animation: pulse 2s infinite;
    }
    
    .reminder-item {
      transition: all 0.2s ease;
    }
    
    .reminder-item:hover {
      background-color: #f3f4f6;
      border: 1px solid #e5e7eb;
    }
    
    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
      }
      50% {
        transform: scale(1.05);
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.5);
      }
    }
  `]
})
export class TaskTrackerComponent implements OnInit {
  currentView: 'board' | 'timeline' = 'board';
  showNewTaskModal = false;
  searchQuery = '';
  userName = '';
  userPhotoUrl = '';
  tasks: Task[] = [];
  projects: Project[] = [];
  environments: Environment[] = [];
  filteredTasks: Task[] = [];
  showNewEnvironmentModal = false;
  showNewProjectModal = false;
  showManagementModal = false;

  // Nuevo: Estado para contraer environments vacíos
  collapsedEmptyEnvironments = true; // Por defecto contraídos
  collapsedEnvironments: { [envId: string]: boolean } = {}; // Control individual

  // Control de visibilidad de tareas ocultas por environment
  environmentHiddenVisibility: { [envId: string]: 'hidden' | 'show-all' | 'show-24h' } = {}; // Control de visibilidad individual por environment

  newTask: Partial<Task> = {
    name: '',
    emoji: '',
    description: '',
    start: '',
    end: '',
    environment: '',
    project: '',
    priority: 'medium',
    duration: 0,
    deadline: null,
    reminders: [],
    fragments: []
  };
  showEmojiPicker = false;
  emojis = ['😀', '😊', '😎', '🤩', '😍', '🤔', '😴', '🥳', '😇', '🤯', 
            '📝', '📅', '📌', '✅', '🔑', '⏰', '📚', '💻', '📱', '🔋',
            '🏋️', '🚴', '🚗', '🍎', '🍕', '🍔', '🛒', '☕', '🍷', '🎵', '🎮', '🎨', '🛏️', '✈️'];
  filteredProjects: Project[] = [];
  newEnvironment: Partial<Environment> = {
    name: '',
    color: '#3B82F6'
  };
  
  newProject: Partial<Project> = {
    name: '',
    description: '',
    environment: ''
  };
  showContextMenu = false;
  contextMenuPosition = { x: 0, y: 0 };
  selectedTask: Task | null = null;
  showEditTaskModal = false;
  showHidden = false;
  selectableProjectsForNewTask: Project[] = [];

  // Variables para menú contextual de ambientes
  showEnvironmentContextMenu = false;
  environmentContextMenuPosition = { x: 0, y: 0 };
  selectedEnvironment: Environment | null = null;

  // Variables para menú contextual de proyectos
  showProjectContextMenu = false;
  projectContextMenuPosition = { x: 0, y: 0 };
  selectedProject: Project | null = null;

  // Propiedades para tareas huérfanas
  orphanedTasks: Task[] = [];
  selectedOrphanedTasks: { [taskId: string]: boolean } = {};
  showAssignOrphanedTasksModal: boolean = false;
  projectForAssigningOrphans: string = '';
  isAssigningOrphanedTasks: boolean = false;
  selectableProjectsForEditTask: Project[] = [];

  // Colores sugeridos para entornos
  suggestedColors: string[] = [
    '#3B82F6', // Azul
    '#10B981', // Verde
    '#F59E0B', // Amarillo
    '#EF4444', // Rojo
    '#8B5CF6', // Púrpura
    '#F97316', // Naranja
    '#06B6D4', // Cyan
    '#84CC16', // Lima
    '#EC4899', // Rosa
    '#6B7280'  // Gris
  ];

  // Propiedades para el color picker personalizado
  colorPickerHue: number = 220; // Hue para el azul por defecto
  colorPickerSaturation: number = 76; // Saturación por defecto
  colorPickerLightness: number = 60; // Luminosidad por defecto

  // Propiedades para manejar fechas y horas por separado
  newTaskStartDate: string = '';
  newTaskStartTime: string = '';
  newTaskEndDate: string = '';
  newTaskEndTime: string = '';
  newTaskDeadlineDate: string = '';
  newTaskDeadlineTime: string = '';
  
  editTaskStartDate: string = '';
  editTaskStartTime: string = '';
  editTaskEndDate: string = '';
  editTaskEndTime: string = '';
  editTaskDeadlineDate: string = '';
  editTaskDeadlineTime: string = '';

  // Propiedades para validación de fechas
  newTaskDateError: string = '';
  editTaskDateError: string = '';

  // Variables para el modal de cálculo de tiempo
  showTimeCalculatorModal = false;
  calculatorInput = '';
  calculatorType: 'start' | 'end' = 'start'; // determina si calcula hora de inicio o fin
  calculatorContext: 'new' | 'edit' = 'new'; // determina si está en modal de nueva tarea o edición
  calculatorError = '';
  calculatorIsValid = false;

  // Variables para el modal de confirmación de cambio de estado
  showStatusChangeModal = false;
  pendingStatusChange: { task: Task; status: 'pending' | 'in-progress' | 'completed' } | null = null;
  statusChangeWillHide = false; // Para mostrar diferente mensaje según si va a ocultar o mostrar

  // Propiedades para recordatorios con fecha/hora separadas
  newTaskReminderDates: string[] = [];
  newTaskReminderTimes: string[] = [];
  editTaskReminderDates: string[] = [];
  editTaskReminderTimes: string[] = [];
  newTaskReminderErrors: string[] = [];
  editTaskReminderErrors: string[] = [];

  // Modal de gestión de recordatorios
  showRemindersModal = false;
  remindersModalContext: 'new' | 'edit' = 'new';
  remindersActiveTab: 'relative' | 'now' | 'ai' | 'manual' = 'relative';
  
  // Campos para agregar recordatorios
  reminderRelativeReference: 'start' | 'end' | 'deadline' = 'start';
  reminderRelativeDirection: 'before' | 'after' = 'before';
  reminderRelativeTime = '';
  reminderFromNowDirection: 'in' | 'before' | 'after' = 'in';
  reminderFromNowTime = '';
  reminderAiInput = '';
  reminderManualDate = '';
  reminderManualTime = '';
  
  // Errores y estados
  reminderRelativeError = '';
  reminderFromNowError = '';
  reminderAiError = '';
  reminderManualError = '';

  // Propiedades para manejo de modales inteligentes
  private calculatorBackdropMouseDownPos: { x: number, y: number } | null = null;

  constructor(
    private authService: AuthService,
    private firestore: Firestore,
    private taskService: TaskService,
    private projectService: ProjectService,
    private environmentService: EnvironmentService,
    private elementRef: ElementRef
  ) {}

  async ngOnInit() {
    await this.loadInitialData();
    this.initializeNewTask();
    // Cargar el estado del filtro desde localStorage
    this.loadShowHiddenState();
  }

  async loadInitialData(): Promise<void> {
    try {
      await this.loadUserData();
      await Promise.all([
        this.loadEnvironments(),
        this.loadProjects()
      ]);
      await this.loadTasks();
    } catch (error) {
      console.error("Error loading initial data for TaskTrackerComponent:", error);
    }
  }

  private async loadUserData() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = user.displayName || 'Usuario';
      this.userPhotoUrl = user.photoURL || 'https://randomuser.me/api/portraits/women/44.jpg';
    }
  }

  private async loadTasks() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      this.tasks = await this.taskService.getTasks();
      this.processTasks();
      console.log('Tareas cargadas:', this.tasks);
    } catch (error) {
      console.error('Error al cargar tareas:', error);
    }
  }

  private processTasks(): void {
    this.filterTasks();
    this.loadOrphanedTasks();
  }

  private loadOrphanedTasks(): void {
    this.orphanedTasks = this.tasks.filter(task => !task.environment || task.environment === '');
    const newSelection: { [taskId: string]: boolean } = {};
    this.orphanedTasks.forEach(task => {
      if (this.selectedOrphanedTasks[task.id]) {
        newSelection[task.id] = true;
      }
    });
    this.selectedOrphanedTasks = newSelection;
  }

  private async loadProjects() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const projectsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}projects`);
    const q = query(projectsRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    this.projects = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Project));
    this.filteredProjects = [...this.projects];
  }

  private async loadEnvironments() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const environmentsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}environments`);
    const q = query(environmentsRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    this.environments = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Environment));
  }

  switchView(view: 'board' | 'timeline') {
    this.currentView = view;
  }

  openNewTaskModal() {
    this.resetNewTask();
    this.showNewTaskModal = true;
  }

  openNewTaskModalForProject(environmentId: string, projectId: string) {
    this.resetNewTask();
    // Preseleccionar ambiente primero
    this.newTask.environment = environmentId;
    // Cargar proyectos disponibles para el ambiente
    this.onNewTaskEnvironmentChange();
    // Ahora preseleccionar el proyecto (después de que se carguen los proyectos disponibles)
    this.newTask.project = projectId;
    this.showNewTaskModal = true;
  }

  closeNewTaskModal() {
    this.showNewTaskModal = false;
  }

  filterTasks() {
    let tasksToFilter = this.tasks.filter(task => task.environment && task.environment !== '');
    
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      tasksToFilter = tasksToFilter.filter(task =>
        task.name.toLowerCase().includes(q) ||
        (task.description && task.description.toLowerCase().includes(q)) ||
        (task.project && this.projects.find(p=>p.id === task.project)?.name.toLowerCase().includes(q))
      );
    }
    this.filteredTasks = tasksToFilter;
  }

  toggleShowHidden() {
    this.showHidden = !this.showHidden;
    this.saveShowHiddenState(); // Guardar el nuevo estado
    this.filterTasks();
    // Actualizar la vista con los nuevos filtros aplicados
    this.processTasks();
  }

  async saveTask() {
    // Validar fechas antes de guardar
    if (!this.validateNewTaskDates()) {
      return; // No guardar si hay errores de validación
    }

    try {
      await this.taskService.createTask(this.newTask as Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt'>);
      await this.loadTasks();
      this.closeNewTaskModal();
      this.resetNewTask();
    } catch (error) {
      console.error('Error al guardar la tarea:', error);
    }
  }

  private resetNewTask() {
    this.newTask = {
      name: '',
      emoji: '',
      description: '',
      start: '',
      end: '',
      environment: '',
      project: '',
      priority: 'medium',
      duration: 0,
      deadline: null,
      reminders: [],
      fragments: []
    };
    
    // Limpiar errores de validación
    this.newTaskDateError = '';
    
    // Establecer tiempos por defecto directamente
    const now = new Date();
    const msQuarter = 15 * 60 * 1000; // 15 minutos en milisegundos
    
    // Hora de inicio: el próximo múltiplo de 15 minutos después de la hora actual
    const startTime = new Date(Math.ceil(now.getTime() / msQuarter) * msQuarter);
    
    // Hora de fin: 15 minutos después de la hora de inicio
    const endTime = new Date(startTime.getTime() + msQuarter);
    
    // Formatear y establecer los valores
    this.newTask.start = this.formatDateTimeLocalForDefaults(startTime);
    this.newTask.end = this.formatDateTimeLocalForDefaults(endTime);
    
    // Inicializar fechas y horas separadas usando HORA LOCAL (corregido)
    this.newTaskStartDate = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}`;
    this.newTaskStartTime = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
    this.newTaskEndDate = `${endTime.getFullYear()}-${String(endTime.getMonth() + 1).padStart(2, '0')}-${String(endTime.getDate()).padStart(2, '0')}`;
    this.newTaskEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Deadline por defecto vacío
    this.newTaskDeadlineDate = '';
    this.newTaskDeadlineTime = '';
    
    // Limpiar arrays de recordatorios
    this.newTaskReminderDates = [];
    this.newTaskReminderTimes = [];
    this.newTaskReminderErrors = [];
    
    this.onNewTaskEnvironmentChange();
    
    // Calcular duración inicial automáticamente
    this.updateNewTaskDuration();
  }

  private formatDateTimeLocalForDefaults(date: Date): string {
    // Convertir a UTC para guardar en la base de datos (igual que combineDateTime)
    return date.toISOString().slice(0, 16);
  }

  private formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  selectEmoji(emoji: string) {
    if (this.showNewTaskModal && this.newTask) {
      this.newTask.emoji = emoji;
    } else if (this.showEditTaskModal && this.selectedTask) {
      this.selectedTask.emoji = emoji;
    }
    this.showEmojiPicker = false;
  }

  addReminder() {
    // Determinar si estamos en nueva tarea o editando
    const isEditing = this.showEditTaskModal && this.selectedTask;
    const remindersList = isEditing ? this.selectedTask!.reminders : this.newTask.reminders;
    
    // Agregar nuevo recordatorio con fecha/hora por defecto (en 1 hora)
    const defaultReminderTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hora desde ahora
    
    const dateStr = `${defaultReminderTime.getFullYear()}-${String(defaultReminderTime.getMonth() + 1).padStart(2, '0')}-${String(defaultReminderTime.getDate()).padStart(2, '0')}`;
    const timeStr = `${defaultReminderTime.getHours().toString().padStart(2, '0')}:${defaultReminderTime.getMinutes().toString().padStart(2, '0')}`;
    
    if (isEditing) {
      // Modo edición
      if (!this.selectedTask!.reminders) {
        this.selectedTask!.reminders = [];
      }
      this.editTaskReminderDates.push(dateStr);
      this.editTaskReminderTimes.push(timeStr);
      this.editTaskReminderErrors.push('');
      this.selectedTask!.reminders.push(this.combineDateTime(dateStr, timeStr));
    } else {
      // Modo nueva tarea
      if (!this.newTask.reminders) {
        this.newTask.reminders = [];
      }
      this.newTaskReminderDates.push(dateStr);
      this.newTaskReminderTimes.push(timeStr);
      this.newTaskReminderErrors.push('');
      this.newTask.reminders.push(this.combineDateTime(dateStr, timeStr));
    }
  }

  removeReminder(index: number) {
    // Determinar si estamos en nueva tarea o editando
    const isEditing = this.showEditTaskModal && this.selectedTask;
    
    if (isEditing) {
      // Modo edición
      if (this.selectedTask!.reminders) {
        this.selectedTask!.reminders.splice(index, 1);
        this.editTaskReminderDates.splice(index, 1);
        this.editTaskReminderTimes.splice(index, 1);
        this.editTaskReminderErrors.splice(index, 1);
      }
    } else {
      // Modo nueva tarea
      if (this.newTask.reminders) {
        this.newTask.reminders.splice(index, 1);
        this.newTaskReminderDates.splice(index, 1);
        this.newTaskReminderTimes.splice(index, 1);
        this.newTaskReminderErrors.splice(index, 1);
      }
    }
  }

  addFragment() {
    if (!this.newTask.fragments) {
      this.newTask.fragments = [];
    }
    const now = new Date();
    const startTime = new Date(now.getTime() + 30 * 60000);
    const endTime = new Date(startTime.getTime() + 60 * 60000);
    
    this.newTask.fragments.push({
      start: this.formatDateTimeLocal(startTime),
      end: this.formatDateTimeLocal(endTime)
    });
  }

  removeFragment(index: number) {
    if (this.newTask.fragments) {
      this.newTask.fragments.splice(index, 1);
    }
  }

  openNewEnvironmentModal() {
    this.showNewEnvironmentModal = true;
    this.initializeColorPicker();
  }

  closeNewEnvironmentModal() {
    this.showNewEnvironmentModal = false;
  }

  openNewProjectModal() {
    // Preseleccionar el ambiente si ya hay uno seleccionado en la tarea
    if (this.showNewTaskModal && this.newTask && this.newTask.environment) {
      this.newProject.environment = this.newTask.environment;
    } else if (this.showEditTaskModal && this.selectedTask && this.selectedTask.environment) {
      this.newProject.environment = this.selectedTask.environment;
    }
    
    this.showNewProjectModal = true;
  }

  closeNewProjectModal() {
    this.showNewProjectModal = false;
  }

  openManagementModal() {
    this.showManagementModal = true;
  }

  closeManagementModal() {
    this.showManagementModal = false;
    this.loadInitialData();
  }

  private initializeNewTask() {
    this.newTask = {
      name: '',
      emoji: '',
      description: '',
      start: '',
      end: '',
      environment: '',
      project: '',
      priority: 'medium',
      duration: 0,
      deadline: null,
      reminders: [],
      fragments: []
    };
    
    // Establecer tiempos por defecto directamente
    const now = new Date();
    const msQuarter = 15 * 60 * 1000; // 15 minutos en milisegundos
    
    // Hora de inicio: el próximo múltiplo de 15 minutos después de la hora actual
    const startTime = new Date(Math.ceil(now.getTime() / msQuarter) * msQuarter);
    
    // Hora de fin: 15 minutos después de la hora de inicio
    const endTime = new Date(startTime.getTime() + msQuarter);
    
    // Formatear y establecer los valores
    this.newTask.start = this.formatDateTimeLocalForDefaults(startTime);
    this.newTask.end = this.formatDateTimeLocalForDefaults(endTime);
    
    // Inicializar fechas y horas separadas usando HORA LOCAL (corregido)
    this.newTaskStartDate = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}`;
    this.newTaskStartTime = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
    this.newTaskEndDate = `${endTime.getFullYear()}-${String(endTime.getMonth() + 1).padStart(2, '0')}-${String(endTime.getDate()).padStart(2, '0')}`;
    this.newTaskEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Deadline por defecto vacío
    this.newTaskDeadlineDate = '';
    this.newTaskDeadlineTime = '';
    
    // Limpiar arrays de recordatorios
    this.newTaskReminderDates = [];
    this.newTaskReminderTimes = [];
    this.newTaskReminderErrors = [];
    
    this.onNewTaskEnvironmentChange();
    
    // Calcular duración inicial automáticamente
    this.updateNewTaskDuration();
  }

  async saveNewEnvironment() {
    try {
      const createdEnvironmentId = await this.environmentService.createEnvironment(this.newEnvironment as Omit<Environment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>);
      await this.loadEnvironments();
      
      // Auto-seleccionar el nuevo ambiente en la tarea
      if (this.showNewTaskModal && this.newTask) {
        this.newTask.environment = createdEnvironmentId;
        this.onNewTaskEnvironmentChange(); // Cargar proyectos disponibles para el nuevo ambiente
      } else if (this.showEditTaskModal && this.selectedTask) {
        this.selectedTask.environment = createdEnvironmentId;
        this.onEditTaskEnvironmentChange(); // Cargar proyectos disponibles para el nuevo ambiente
      }
      
      this.closeNewEnvironmentModal();
      this.resetNewEnvironment();
    } catch (error) {
      console.error('Error al guardar el ambiente:', error);
    }
  }

  async saveNewProject() {
    try {
      const createdProjectId = await this.projectService.createProject(this.newProject as Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>);
      await this.loadProjects();
      
      // Auto-seleccionar el nuevo proyecto en la tarea
      if (this.showNewTaskModal && this.newTask) {
        // También asegurarnos de que el ambiente esté seleccionado
        if (this.newProject.environment) {
          this.newTask.environment = this.newProject.environment;
          this.onNewTaskEnvironmentChange(); // Cargar proyectos disponibles
        }
        this.newTask.project = createdProjectId;
      } else if (this.showEditTaskModal && this.selectedTask) {
        // También asegurarnos de que el ambiente esté seleccionado
        if (this.newProject.environment) {
          this.selectedTask.environment = this.newProject.environment;
          this.onEditTaskEnvironmentChange(); // Cargar proyectos disponibles
        }
        this.selectedTask.project = createdProjectId;
      }
      
      this.closeNewProjectModal();
      this.resetNewProject();
    } catch (error) {
      console.error('Error al guardar el proyecto:', error);
    }
  }

  private resetNewEnvironment() {
    this.newEnvironment = {
      name: '',
      color: '#3B82F6'
    };
  }

  private resetNewProject() {
    this.newProject = {
      name: '',
      description: '',
      environment: ''
    };
  }

  getTaskProgress(task: Task): number {
    const start = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
    const end = new Date(task.end + (task.end.includes('Z') ? '' : 'Z'));
    const now = new Date();
    const total = end.getTime() - start.getTime();
    const current = now.getTime() - start.getTime();
    return Math.min(100, Math.max(0, (current / total) * 100));
  }

  getTasksByEnvironment(environmentId: string): Task[] {
    const visibility = this.getEnvironmentHiddenVisibility(environmentId);
    
    return this.filteredTasks
      .filter(task => {
        // Filtrar por environment
        if (task.environment !== environmentId) return false;
        
        // Aplicar filtro de visibilidad según la configuración del environment
        if (task.hidden) {
          switch (visibility) {
            case 'hidden':
              return false; // No mostrar tareas ocultas
            case 'show-all':
              return true; // Mostrar todas las tareas ocultas
            case 'show-24h':
              // Mostrar solo las tareas ocultas de las últimas 24 horas
              const taskDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
              const now = new Date();
              const hoursDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60);
              return hoursDiff <= 24;
            default:
              return false;
          }
        }
        
        return true; // Mostrar tareas no ocultas
      })
      .sort((a, b) => {
        const dateA = new Date(a.start + (a.start.includes('Z') ? '' : 'Z')).getTime();
        const dateB = new Date(b.start + (b.start.includes('Z') ? '' : 'Z')).getTime();
        return dateA - dateB;
      });
  }

  getProjectsByEnvironment(environmentId: string): Project[] {
    return this.projects.filter(project => project.environment === environmentId);
  }

  getTasksByProject(projectId: string): Task[] {
    // Obtener el environment del proyecto para aplicar su configuración de visibilidad
    const project = this.projects.find(p => p.id === projectId);
    const environmentId = project?.environment || '';
    const visibility = this.getEnvironmentHiddenVisibility(environmentId);
    
    return this.filteredTasks
      .filter(task => {
        // Filtrar por proyecto
        if (task.project !== projectId) return false;
        
        // Aplicar filtro de visibilidad según la configuración del environment padre
        if (task.hidden) {
          switch (visibility) {
            case 'hidden':
              return false; // No mostrar tareas ocultas
            case 'show-all':
              return true; // Mostrar todas las tareas ocultas
            case 'show-24h':
              // Mostrar solo las tareas ocultas de las últimas 24 horas
              const taskDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
              const now = new Date();
              const hoursDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60);
              return hoursDiff <= 24;
            default:
              return false;
          }
        }
        
        return true; // Mostrar tareas no ocultas
      })
      .sort((a, b) => {
        const dateA = new Date(a.start + (a.start.includes('Z') ? '' : 'Z')).getTime();
        const dateB = new Date(b.start + (b.start.includes('Z') ? '' : 'Z')).getTime();
        return dateA - dateB;
      });
  }

  getProjectName(projectId: string): string {
    const project = this.projects.find(p => p.id === projectId);
    return project ? project.name : 'Sin proyecto';
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    
    // El string viene de la base de datos en UTC, convertir a hora local
    const date = new Date(dateString + (dateString.includes('Z') ? '' : 'Z')); // Asegurar que se interprete como UTC
    
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  onTaskContextMenu(event: MouseEvent, task: Task) {
    event.preventDefault();
    event.stopPropagation();
    this.selectedTask = task;
    
    // Calcular la altura aproximada del menú contextual
    // Contamos los elementos que aparecerán en el menú
    let menuItemsCount = 3; // Editar, Eliminar, Mostrar/Ocultar (siempre presentes)
    
    // Contar elementos de estado que aparecerán
    if (task.status !== 'completed') menuItemsCount++; // Marcar completada
    if (task.status !== 'in-progress') menuItemsCount++; // Marcar en progreso  
    if (task.status !== 'pending') menuItemsCount++; // Marcar pendiente
    
    // Altura aproximada: 40px por item + padding
    const menuHeight = menuItemsCount * 40 + 16; // 16px de padding total
    
    // Obtener dimensiones del viewport
    const viewportHeight = window.innerHeight;
    
    // Coordenadas del click
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    // Verificar si el menú cabe hacia abajo desde la posición del click
    const spaceBelow = viewportHeight - clickY;
    const spaceAbove = clickY;
    
    let finalY = clickY;
    
    // Si no cabe hacia abajo pero sí hacia arriba, posicionarlo hacia arriba
    if (spaceBelow < menuHeight && spaceAbove >= menuHeight) {
      finalY = clickY - menuHeight;
    }
    // Si no cabe hacia abajo pero el espacio arriba es mayor, usarlo
    else if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      finalY = clickY - menuHeight;
    }
    // Si no cabe en ningún lado, ajustar para que esté visible
    else if (spaceBelow < menuHeight && spaceAbove < menuHeight) {
      if (spaceAbove > spaceBelow) {
        finalY = 10; // Pegarlo arriba con margen
      } else {
        finalY = viewportHeight - menuHeight - 10; // Pegarlo abajo con margen
      }
    }
    
    // Asegurar que no se salga por los lados
    let finalX = clickX;
    const menuWidth = 200; // Ancho aproximado del menú
    const spaceRight = window.innerWidth - clickX;
    
    if (spaceRight < menuWidth) {
      finalX = clickX - menuWidth;
    }
    
    // Asegurar que no se salga por la izquierda
    if (finalX < 0) {
      finalX = 10;
    }
    
    this.contextMenuPosition = { x: finalX, y: finalY };
    this.showContextMenu = true;
  }

  onEnvironmentContextMenu(event: MouseEvent, environment: Environment) {
    event.preventDefault();
    event.stopPropagation();
    this.selectedEnvironment = environment;
    
    // Calcular la altura del menú de ambiente (2 elementos: Crear Proyecto, Eliminar Ambiente)
    const menuHeight = 2 * 40 + 16; // 2 items * 40px + padding
    
    // Obtener dimensiones del viewport
    const viewportHeight = window.innerHeight;
    
    // Coordenadas del click
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    // Verificar espacio disponible
    const spaceBelow = viewportHeight - clickY;
    const spaceAbove = clickY;
    
    let finalY = clickY;
    
    // Lógica de posicionamiento inteligente
    if (spaceBelow < menuHeight && spaceAbove >= menuHeight) {
      finalY = clickY - menuHeight;
    } else if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      finalY = clickY - menuHeight;
    } else if (spaceBelow < menuHeight && spaceAbove < menuHeight) {
      if (spaceAbove > spaceBelow) {
        finalY = 10;
      } else {
        finalY = viewportHeight - menuHeight - 10;
      }
    }
    
    // Verificar posición horizontal
    let finalX = clickX;
    const menuWidth = 200;
    const spaceRight = window.innerWidth - clickX;
    
    if (spaceRight < menuWidth) {
      finalX = clickX - menuWidth;
    }
    if (finalX < 0) {
      finalX = 10;
    }
    
    this.environmentContextMenuPosition = { x: finalX, y: finalY };
    this.showEnvironmentContextMenu = true;
  }

  onProjectContextMenu(event: MouseEvent, project: Project) {
    event.preventDefault();
    event.stopPropagation();
    this.selectedProject = project;
    
    // Calcular la altura del menú de proyecto (1 elemento: Eliminar Proyecto)
    const menuHeight = 1 * 40 + 16; // 1 item * 40px + padding
    
    // Obtener dimensiones del viewport
    const viewportHeight = window.innerHeight;
    
    // Coordenadas del click
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    // Verificar espacio disponible
    const spaceBelow = viewportHeight - clickY;
    const spaceAbove = clickY;
    
    let finalY = clickY;
    
    // Lógica de posicionamiento inteligente
    if (spaceBelow < menuHeight && spaceAbove >= menuHeight) {
      finalY = clickY - menuHeight;
    } else if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      finalY = clickY - menuHeight;
    } else if (spaceBelow < menuHeight && spaceAbove < menuHeight) {
      if (spaceAbove > spaceBelow) {
        finalY = 10;
      } else {
        finalY = viewportHeight - menuHeight - 10;
      }
    }
    
    // Verificar posición horizontal
    let finalX = clickX;
    const menuWidth = 200;
    const spaceRight = window.innerWidth - clickX;
    
    if (spaceRight < menuWidth) {
      finalX = clickX - menuWidth;
    }
    if (finalX < 0) {
      finalX = 10;
    }
    
    this.projectContextMenuPosition = { x: finalX, y: finalY };
    this.showProjectContextMenu = true;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Si el time calculator está abierto y el click está fuera del componente
    if (this.showTimeCalculatorModal && event.target && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeTimeCalculator();
    }
    
    // Funcionalidad existente para otros context menus
    if (this.showContextMenu && event.target && !(event.target as Element).closest('.context-menu')) {
      this.closeContextMenu();
    }
    if (this.showEnvironmentContextMenu && event.target && !(event.target as Element).closest('.environment-context-menu')) {
      this.closeEnvironmentContextMenu();
    }
    if (this.showProjectContextMenu && event.target && !(event.target as Element).closest('.project-context-menu')) {
      this.closeProjectContextMenu();
    }
  }

  closeContextMenu() {
    this.showContextMenu = false;
  }

  closeEnvironmentContextMenu() {
    this.showEnvironmentContextMenu = false;
  }

  closeProjectContextMenu() {
    this.showProjectContextMenu = false;
  }

  async editTask(task: Task) {
    this.selectedTask = JSON.parse(JSON.stringify(task));
    
    // Limpiar errores de validación
    this.editTaskDateError = '';
    
    // Guardar el proyecto original antes de cargar proyectos disponibles
    const originalProject = this.selectedTask?.project;
    
    // Inicializar fechas y horas separadas para edición ANTES de cargar proyectos
    if (this.selectedTask && this.selectedTask.start) {
      const startDateTime = this.splitDateTime(this.selectedTask.start);
      this.editTaskStartDate = startDateTime.date;
      this.editTaskStartTime = startDateTime.time;
    } else {
      // Proporcionar valores por defecto válidos
      const now = new Date();
      this.editTaskStartDate = now.toISOString().split('T')[0];
      this.editTaskStartTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
    
    if (this.selectedTask && this.selectedTask.end) {
      const endDateTime = this.splitDateTime(this.selectedTask.end);
      this.editTaskEndDate = endDateTime.date;
      this.editTaskEndTime = endDateTime.time;
    } else {
      // Proporcionar valores por defecto válidos (1 hora después del inicio)
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000); // +1 hora
      this.editTaskEndDate = endTime.toISOString().split('T')[0];
      this.editTaskEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    }
    
    if (this.selectedTask && this.selectedTask.deadline) {
      const deadlineDateTime = this.splitDateTime(this.selectedTask.deadline);
      this.editTaskDeadlineDate = deadlineDateTime.date;
      this.editTaskDeadlineTime = deadlineDateTime.time;
    } else {
      // Para deadline, mantener valores vacíos cuando no hay deadline
      this.editTaskDeadlineDate = '';
      this.editTaskDeadlineTime = '';
    }
    
    // Inicializar recordatorios para edición
    this.editTaskReminderDates = [];
    this.editTaskReminderTimes = [];
    this.editTaskReminderErrors = [];
    
    if (this.selectedTask?.reminders) {
      this.selectedTask.reminders.forEach((reminder, index) => {
        const reminderDateTime = this.splitDateTime(reminder);
        this.editTaskReminderDates[index] = reminderDateTime.date;
        this.editTaskReminderTimes[index] = reminderDateTime.time;
        this.editTaskReminderErrors[index] = '';
      });
    }
    
    // Cargar proyectos disponibles para el ambiente seleccionado
    this.onEditTaskEnvironmentChange();
    
    // Restaurar el proyecto original después de cargar los proyectos disponibles
    if (this.selectedTask && originalProject) {
      this.selectedTask.project = originalProject;
    }
    
    // Calcular duración inicial automáticamente basada en las fechas/horas de la tarea
    this.updateEditTaskDuration();
    
    // Abrir el modal después de inicializar todo
    this.showEditTaskModal = true;
    this.closeContextMenu();
  }

  async deleteTask(task: Task) {
    if (confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      try {
        await this.taskService.deleteTask(task.id);
        await this.loadTasks();
      } catch (error) {
        console.error('Error al eliminar la tarea:', error);
      }
    }
    this.closeContextMenu();
  }

  async toggleHidden(task: Task) {
    try {
      await this.taskService.updateTask(task.id, { hidden: !task.hidden });
      await this.loadTasks();
    } catch (error) {
      console.error('Error al cambiar visibilidad:', error);
    }
    this.closeContextMenu();
  }

  async changeStatus(task: Task, status: 'pending' | 'in-progress' | 'completed') {
    // Determinar si se debe preguntar sobre ocultar/mostrar
    const currentStatus = task.status;
    
    // Configurar el cambio pendiente
    this.pendingStatusChange = { task, status };
    
    // Determinar el mensaje según el cambio de estado
    if (status === 'completed') {
      // Al completar una tarea, preguntar si quiere ocultarla
      this.statusChangeWillHide = true;
    } else if (currentStatus === 'completed' && (status === 'pending' || status === 'in-progress')) {
      // Al sacar de completada, preguntar si quiere mostrarla (en caso de que esté oculta)
      this.statusChangeWillHide = false;
    } else {
      // Para otros cambios, aplicar directamente sin modal
      await this.applyStatusChange(task, status, false);
      return;
    }
    
    // Mostrar el modal de confirmación
    this.showStatusChangeModal = true;
    this.closeContextMenu();
  }

  async applyStatusChange(task: Task, status: 'pending' | 'in-progress' | 'completed', changeVisibility: boolean = false) {
    try {
      const updates: Partial<Task> = { status };
      
      // Actualizar campos de completado
      if (status === 'completed') {
        updates.completed = true;
        updates.completedAt = new Date().toISOString();
        // Si se eligió ocultar, agregarlo a las actualizaciones
        if (changeVisibility) {
          updates.hidden = true;
        }
      } else {
        updates.completed = false;
        updates.completedAt = null;
        // Si se eligió mostrar, agregarlo a las actualizaciones
        if (changeVisibility) {
          updates.hidden = false;
        }
      }
      
      await this.taskService.updateTask(task.id, updates);
      await this.loadTasks();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
    }
  }

  async saveEditedTask() {
    if (!this.selectedTask) return;
    
    // Validar fechas antes de guardar
    if (!this.validateEditTaskDates()) {
      return; // No guardar si hay errores de validación
    }
    
    try {
      // Excluir campos del sistema que no deben actualizarse
      const { id, userId, createdAt, ...updates } = this.selectedTask;
      await this.taskService.updateTask(this.selectedTask.id, updates);
      await this.loadTasks();
      this.showEditTaskModal = false;
      this.selectedTask = null;
    } catch (error) {
      console.error('Error al actualizar la tarea:', error);
    }
  }

  onNewTaskEnvironmentChange(): void {
    if (this.newTask.environment) {
      this.selectableProjectsForNewTask = this.projects.filter(
        p => p.environment === this.newTask.environment
      );
    } else {
      this.selectableProjectsForNewTask = []; 
    }
    this.newTask.project = '';
  }

  onEditTaskEnvironmentChange(): void {
    if (this.selectedTask && this.selectedTask.environment) {
      this.selectableProjectsForEditTask = this.projects.filter(
        p => p.environment === this.selectedTask!.environment
      );
    } else {
      this.selectableProjectsForEditTask = [];
    }
    if (this.selectedTask) {
      this.selectedTask.project = '';
    }
  }

  openAssignOrphanedTasksModal(): void {
    console.log('openAssignOrphanedTasksModal called');
    console.log('Selected orphaned tasks IDs:', this.getSelectedOrphanedTasksIds());
    console.log('selectedOrphanedTasks object:', this.selectedOrphanedTasks);
    console.log('noOrphanedSelected:', this.noOrphanedSelected);
    console.log('isAssigningOrphanedTasks:', this.isAssigningOrphanedTasks);

    if (this.getSelectedOrphanedTasksIds().length === 0) {
      alert("Por favor, selecciona al menos una tarea huérfana para asignar.");
      return;
    }
    this.projectForAssigningOrphans = '';
    this.showAssignOrphanedTasksModal = true;
    console.log('showAssignOrphanedTasksModal set to true');
  }

  closeAssignOrphanedTasksModal(): void {
    this.showAssignOrphanedTasksModal = false;
  }

  getSelectedOrphanedTasksIds(): string[] {
    return Object.keys(this.selectedOrphanedTasks).filter(taskId => this.selectedOrphanedTasks[taskId]);
  }

  async assignSelectedOrphanedTasks(): Promise<void> {
    const selectedIds = this.getSelectedOrphanedTasksIds();
    if (selectedIds.length === 0) {
      alert("No hay tareas seleccionadas.");
      return;
    }
    if (!this.projectForAssigningOrphans) {
      alert("Por favor, selecciona un proyecto destino.");
      return;
    }

    const targetProject = this.projects.find(p => p.id === this.projectForAssigningOrphans);
    if (!targetProject) {
      alert("Proyecto destino no encontrado. Por favor, recarga.");
      return;
    }

    this.isAssigningOrphanedTasks = true;
    try {
      const updatePromises = selectedIds.map(taskId => {
        return this.taskService.updateTask(taskId, { 
          project: targetProject.id, 
          environment: targetProject.environment 
        });
      });
      await Promise.all(updatePromises);
      alert(`${selectedIds.length} tarea(s) asignada(s) exitosamente al proyecto "${targetProject.name}".`);
      
      await this.loadTasks();
      this.selectedOrphanedTasks = {};
      this.closeAssignOrphanedTasksModal();

    } catch (error) {
      console.error("Error asignando tareas huérfanas:", error);
      alert(`Error al asignar tareas: ${error}`);
    } finally {
      this.isAssigningOrphanedTasks = false;
    }
  }

  toggleSelectAllOrphaned(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const checked = inputElement.checked;
    const newSelection: { [taskId: string]: boolean } = {};
    this.orphanedTasks.forEach(task => newSelection[task.id] = checked);
    this.selectedOrphanedTasks = newSelection;
  }

  get allOrphanedSelected(): boolean {
    return this.orphanedTasks.length > 0 && this.orphanedTasks.every(task => this.selectedOrphanedTasks[task.id]);
  }

  get noOrphanedSelected(): boolean {
    return this.getSelectedOrphanedTasksIds().length === 0;
  }

  getEnvironmentName(envId: string): string | undefined {
    const env = this.environments.find(e => e.id === envId);
    return env?.name;
  }

  getTasksWithoutProjectInEnvironment(environmentId: string): Task[] {
    const visibility = this.getEnvironmentHiddenVisibility(environmentId);
    
    return this.filteredTasks.filter(task => {
      // Filtrar por environment y sin proyecto
      if (task.environment !== environmentId || (task.project && task.project !== '')) return false;
      
      // Aplicar filtro de visibilidad según la configuración del environment
      if (task.hidden) {
        switch (visibility) {
          case 'hidden':
            return false; // No mostrar tareas ocultas
          case 'show-all':
            return true; // Mostrar todas las tareas ocultas
          case 'show-24h':
            // Mostrar solo las tareas ocultas de las últimas 24 horas
            const taskDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
            const now = new Date();
            const hoursDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60);
            return hoursDiff <= 24;
          default:
            return false;
        }
      }
      
      return true; // Mostrar tareas no ocultas
    });
  }

  createProjectForEnvironment(environmentId: string) {
    // Preseleccionar el ambiente en el nuevo proyecto
    this.newProject.environment = environmentId;
    this.openNewProjectModal();
    this.closeEnvironmentContextMenu();
  }

  async deleteEnvironment(environment: Environment) {
    const hasProjects = this.projects.some(p => p.environment === environment.id);
    const hasTasks = this.tasks.some(t => t.environment === environment.id);
    
    let confirmMessage = `¿Estás seguro de que quieres eliminar el ambiente "${environment.name}"?`;
    
    if (hasProjects || hasTasks) {
      confirmMessage += '\n\nEste ambiente contiene:';
      if (hasProjects) {
        const projectCount = this.projects.filter(p => p.environment === environment.id).length;
        confirmMessage += `\n- ${projectCount} proyecto(s)`;
      }
      if (hasTasks) {
        const taskCount = this.tasks.filter(t => t.environment === environment.id).length;
        confirmMessage += `\n- ${taskCount} tarea(s)`;
      }
      confirmMessage += '\n\nTodos los proyectos y tareas de este ambiente también serán eliminados.';
    }
    
    if (confirm(confirmMessage)) {
      try {
        // Eliminar todas las tareas del ambiente
        const tasksToDelete = this.tasks.filter(t => t.environment === environment.id);
        for (const task of tasksToDelete) {
          await this.taskService.deleteTask(task.id);
        }
        
        // Eliminar todos los proyectos del ambiente
        const projectsToDelete = this.projects.filter(p => p.environment === environment.id);
        for (const project of projectsToDelete) {
          await this.projectService.deleteProject(project.id);
        }
        
        // Eliminar el ambiente
        await this.environmentService.deleteEnvironment(environment.id);
        
        // Recargar datos
        await this.loadInitialData();
        
        alert(`Ambiente "${environment.name}" eliminado exitosamente.`);
      } catch (error) {
        console.error('Error al eliminar el ambiente:', error);
        alert(`Error al eliminar el ambiente: ${error}`);
      }
    }
    this.closeEnvironmentContextMenu();
  }

  async deleteProject(project: Project) {
    const projectTasks = this.tasks.filter(t => t.project === project.id);
    
    let confirmMessage = `¿Estás seguro de que quieres eliminar el proyecto "${project.name}"?`;
    
    if (projectTasks.length > 0) {
      confirmMessage += `\n\nEste proyecto contiene ${projectTasks.length} tarea(s) que serán desvinculadas del proyecto y se convertirán en tareas sin proyecto asignado.`;
    }
    
    if (confirm(confirmMessage)) {
      try {
        // Desvincular tareas del proyecto (no eliminarlas, solo quitar la referencia)
        for (const task of projectTasks) {
          await this.taskService.updateTask(task.id, { 
            project: '',
            // Mantener el ambiente para que no se conviertan en huérfanas
          });
        }
        
        // Eliminar el proyecto
        await this.projectService.deleteProject(project.id);
        
        // Recargar datos
        await this.loadInitialData();
        
        if (projectTasks.length > 0) {
          alert(`Proyecto "${project.name}" eliminado exitosamente. ${projectTasks.length} tarea(s) fueron desvinculadas del proyecto.`);
        } else {
          alert(`Proyecto "${project.name}" eliminado exitosamente.`);
        }
      } catch (error) {
        console.error('Error al eliminar el proyecto:', error);
        alert(`Error al eliminar el proyecto: ${error}`);
      }
    }
    this.closeProjectContextMenu();
  }

  private loadShowHiddenState(): void {
    const savedState = localStorage.getItem('taskTracker_showHidden');
    if (savedState !== null) {
      this.showHidden = JSON.parse(savedState);
      // Aplicar el filtro con el estado recuperado
      this.filterTasks();
    }
  }

  private saveShowHiddenState(): void {
    localStorage.setItem('taskTracker_showHidden', JSON.stringify(this.showHidden));
  }

  getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  calculateDuration(startDate: string, startTime: string, endDate: string, endTime: string): number {
    if (!startDate || !startTime || !endDate || !endTime) {
      return 0;
    }

    try {
      // Crear objetos Date para inicio y fin
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      const startDateTime = new Date(startDate);
      startDateTime.setHours(startHours, startMinutes, 0, 0);
      
      const endDateTime = new Date(endDate);
      endDateTime.setHours(endHours, endMinutes, 0, 0);
      
      // Calcular diferencia en milisegundos
      const diffMs = endDateTime.getTime() - startDateTime.getTime();
      
      // Convertir a horas
      const diffHours = diffMs / (1000 * 60 * 60);
      
      // Redondear a 2 decimales y asegurar que no sea negativo
      return Math.max(0, Math.round(diffHours * 100) / 100);
    } catch (error) {
      console.error('Error calculating duration:', error);
      return 0;
    }
  }

  updateNewTaskDuration(): void {
    const duration = this.calculateDuration(
      this.newTaskStartDate,
      this.newTaskStartTime,
      this.newTaskEndDate,
      this.newTaskEndTime
    );
    this.newTask.duration = duration;
    
    // Validar fechas automáticamente
    this.validateNewTaskDates();
  }

  updateEditTaskDuration(): void {
    if (!this.selectedTask) return;
    
    const duration = this.calculateDuration(
      this.editTaskStartDate,
      this.editTaskStartTime,
      this.editTaskEndDate,
      this.editTaskEndTime
    );
    this.selectedTask.duration = duration;
    
    // Validar fechas automáticamente
    this.validateEditTaskDates();
  }

  // Métodos para el color picker personalizado
  selectSuggestedColor(color: string): void {
    this.newEnvironment.color = color;
    // Convertir hex a HSL para sincronizar el color picker
    const hsl = this.hexToHsl(color);
    this.colorPickerHue = hsl.h;
    this.colorPickerSaturation = hsl.s;
    this.colorPickerLightness = hsl.l;
  }

  // Convertir HSL a HEX
  hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  // Convertir HEX a HSL
  hexToHsl(hex: string): {h: number, s: number, l: number} {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  // Actualizar color basado en HSL
  updateColorFromHsl(): void {
    const hexColor = this.hslToHex(this.colorPickerHue, this.colorPickerSaturation, this.colorPickerLightness);
    this.newEnvironment.color = hexColor;
  }

  // Manejar click en el área de saturación/luminosidad
  onColorAreaClick(event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    this.colorPickerSaturation = Math.round((x / rect.width) * 100);
    this.colorPickerLightness = Math.round(100 - (y / rect.height) * 100);
    this.updateColorFromHsl();
  }

  // Manejar click en la barra de matiz
  onHueBarClick(event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const y = event.clientY - rect.top;
    
    this.colorPickerHue = Math.round((y / rect.height) * 360);
    this.updateColorFromHsl();
  }

  // Inicializar color picker al abrir modal
  initializeColorPicker(): void {
    const currentColor = this.newEnvironment.color || '#3B82F6';
    const hsl = this.hexToHsl(currentColor);
    this.colorPickerHue = hsl.h;
    this.colorPickerSaturation = hsl.s;
    this.colorPickerLightness = hsl.l;
  }

  // Métodos para manejar fecha y hora por separado
  combineDateTime(date: string, time: string): string {
    if (!date || !time) return '';
    const [hours, minutes] = time.split(':');
    
    // Crear fecha en zona horaria local
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(5, 7)) - 1; // Los meses en JS son 0-11
    const day = parseInt(date.substring(8, 10));
    
    const dateTime = new Date(year, month, day, parseInt(hours), parseInt(minutes), 0, 0);
    
    // Convertir a UTC para guardar en la base de datos (esto es lo correcto)
    return dateTime.toISOString().slice(0, 16);
  }

  splitDateTime(dateTimeString: string): { date: string, time: string } {
    if (!dateTimeString) return { date: '', time: '' };
    
    // El string viene de la base de datos en UTC, necesitamos convertir a hora local
    const dateTime = new Date(dateTimeString + (dateTimeString.includes('Z') ? '' : 'Z')); // Asegurar que se interprete como UTC
    
    // Convertir a hora local del usuario
    const year = dateTime.getFullYear();
    const month = String(dateTime.getMonth() + 1).padStart(2, '0');
    const day = String(dateTime.getDate()).padStart(2, '0');
    const hours = String(dateTime.getHours()).padStart(2, '0');
    const minutes = String(dateTime.getMinutes()).padStart(2, '0');
    
    const date = `${year}-${month}-${day}`;
    const time = `${hours}:${minutes}`;
    
    return { date, time };
  }

  onNewTaskStartTimeChange(time: string) {
    this.newTaskStartTime = time;
    this.updateNewTaskDateTime('start');
    this.updateNewTaskDuration();
  }

  onNewTaskEndTimeChange(time: string) {
    this.newTaskEndTime = time;
    this.updateNewTaskDateTime('end');
    this.updateNewTaskDuration();
  }

  onNewTaskDeadlineTimeChange(time: string) {
    this.newTaskDeadlineTime = time;
    this.updateNewTaskDateTime('deadline');
  }

  onEditTaskStartTimeChange(time: string) {
    this.editTaskStartTime = time;
    this.updateEditTaskDateTime('start');
    this.updateEditTaskDuration();
  }

  onEditTaskEndTimeChange(time: string) {
    this.editTaskEndTime = time;
    this.updateEditTaskDateTime('end');
    this.updateEditTaskDuration();
  }

  onEditTaskDeadlineTimeChange(time: string) {
    this.editTaskDeadlineTime = time;
    this.updateEditTaskDateTime('deadline');
  }

  private updateNewTaskDateTime(field: 'start' | 'end' | 'deadline') {
    let dateValue = '';
    let timeValue = '';
    
    switch (field) {
      case 'start':
        dateValue = this.newTaskStartDate;
        timeValue = this.newTaskStartTime;
        break;
      case 'end':
        dateValue = this.newTaskEndDate;
        timeValue = this.newTaskEndTime;
        break;
      case 'deadline':
        dateValue = this.newTaskDeadlineDate;
        timeValue = this.newTaskDeadlineTime;
        break;
    }

    const combinedDateTime = this.combineDateTime(dateValue, timeValue);
    
    if (field === 'deadline') {
      this.newTask.deadline = combinedDateTime || null;
    } else {
      (this.newTask as any)[field] = combinedDateTime;
    }
  }

  private updateEditTaskDateTime(field: 'start' | 'end' | 'deadline') {
    if (!this.selectedTask) return;
    
    let dateValue = '';
    let timeValue = '';
    
    switch (field) {
      case 'start':
        dateValue = this.editTaskStartDate;
        timeValue = this.editTaskStartTime;
        break;
      case 'end':
        dateValue = this.editTaskEndDate;
        timeValue = this.editTaskEndTime;
        break;
      case 'deadline':
        dateValue = this.editTaskDeadlineDate;
        timeValue = this.editTaskDeadlineTime;
        break;
    }

    const combinedDateTime = this.combineDateTime(dateValue, timeValue);
    
    if (field === 'deadline') {
      this.selectedTask.deadline = combinedDateTime || null;
    } else {
      (this.selectedTask as any)[field] = combinedDateTime;
    }
  }

  onNewTaskDateChange(field: 'start' | 'end' | 'deadline', date: string) {
    switch (field) {
      case 'start':
        this.newTaskStartDate = date;
        break;
      case 'end':
        this.newTaskEndDate = date;
        break;
      case 'deadline':
        this.newTaskDeadlineDate = date;
        break;
    }
    this.updateNewTaskDateTime(field);
    // Actualizar duración solo si cambió fecha de inicio o fin
    if (field === 'start' || field === 'end') {
      this.updateNewTaskDuration();
    }
  }

  onEditTaskDateChange(field: 'start' | 'end' | 'deadline', date: string) {
    switch (field) {
      case 'start':
        this.editTaskStartDate = date;
        break;
      case 'end':
        this.editTaskEndDate = date;
        break;
      case 'deadline':
        this.editTaskDeadlineDate = date;
        break;
    }
    this.updateEditTaskDateTime(field);
    // Actualizar duración solo si cambió fecha de inicio o fin
    if (field === 'start' || field === 'end') {
      this.updateEditTaskDuration();
    }
  }

  // Métodos para validación de fechas
  validateNewTaskDates(): boolean {
    this.newTaskDateError = '';
    
    if (!this.newTaskStartDate || !this.newTaskStartTime || !this.newTaskEndDate || !this.newTaskEndTime) {
      return true; // No validar si no están completas las fechas
    }

    const startDateTime = new Date(`${this.newTaskStartDate}T${this.newTaskStartTime}`);
    const endDateTime = new Date(`${this.newTaskEndDate}T${this.newTaskEndTime}`);

    if (endDateTime <= startDateTime) {
      this.newTaskDateError = 'La fecha de fin debe ser posterior a la fecha de inicio';
      return false;
    }

    return true;
  }

  validateEditTaskDates(): boolean {
    this.editTaskDateError = '';
    
    if (!this.editTaskStartDate || !this.editTaskStartTime || !this.editTaskEndDate || !this.editTaskEndTime) {
      return true; // No validar si no están completas las fechas
    }

    const startDateTime = new Date(`${this.editTaskStartDate}T${this.editTaskStartTime}`);
    const endDateTime = new Date(`${this.editTaskEndDate}T${this.editTaskEndTime}`);

    if (endDateTime <= startDateTime) {
      this.editTaskDateError = 'La fecha de fin debe ser posterior a la fecha de inicio';
      return false;
    }

    return true;
  }

  isNewTaskFormValid(): boolean {
    return this.validateNewTaskDates() && this.validateNewTaskReminders();
  }

  isEditTaskFormValid(): boolean {
    return this.validateEditTaskDates() && this.validateEditTaskReminders();
  }

  private validateNewTaskReminders(): boolean {
    if (!this.newTask.reminders || this.newTask.reminders.length === 0) {
      return true; // Los recordatorios son opcionales
    }

    for (let i = 0; i < this.newTask.reminders.length; i++) {
      if (!this.validateNewTaskReminder(i)) {
        return false;
      }
    }
    return true;
  }

  private validateEditTaskReminders(): boolean {
    if (!this.selectedTask?.reminders || this.selectedTask.reminders.length === 0) {
      return true; // Los recordatorios son opcionales
    }

    for (let i = 0; i < this.selectedTask.reminders.length; i++) {
      if (!this.validateEditTaskReminder(i)) {
        return false;
      }
    }
    return true;
  }

  // Métodos para el cálculo de tiempo
  openTimeCalculator(type: 'start' | 'end', context: 'new' | 'edit') {
    this.calculatorType = type;
    this.calculatorContext = context;
    this.calculatorInput = '';
    this.calculatorError = '';
    this.calculatorIsValid = false;
    this.showTimeCalculatorModal = true;
    
    // Bloquear scroll del body
    document.body.style.overflow = 'hidden';
  }

  closeTimeCalculator() {
    this.showTimeCalculatorModal = false;
    this.calculatorInput = '';
    this.calculatorError = '';
    this.calculatorIsValid = false;
    this.calculatorBackdropMouseDownPos = null;
    
    // Restaurar scroll del body
    document.body.style.overflow = '';
  }

  // Detectar Escape key para cerrar modales
  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.showTimeCalculatorModal) {
      this.closeTimeCalculator();
    }
  }

  onCalculatorBackdropMouseDown(event: MouseEvent) {
    // Guardar la posición del mousedown para comparar con mouseup
    this.calculatorBackdropMouseDownPos = { x: event.clientX, y: event.clientY };
  }

  onCalculatorBackdropMouseUp(event: MouseEvent) {
    // Solo cerrar si el mouseup está cerca del mousedown (es un click, no un drag)
    if (this.calculatorBackdropMouseDownPos) {
      const deltaX = Math.abs(event.clientX - this.calculatorBackdropMouseDownPos.x);
      const deltaY = Math.abs(event.clientY - this.calculatorBackdropMouseDownPos.y);
      const threshold = 5; // Píxeles de tolerancia para considerar que es un click
      
      if (deltaX <= threshold && deltaY <= threshold) {
        this.closeTimeCalculator();
      }
    }
    
    this.calculatorBackdropMouseDownPos = null;
  }

  validateCalculatorInput() {
    if (!this.calculatorInput.trim()) {
      this.calculatorError = '';
      this.calculatorIsValid = false;
      return;
    }

    try {
      const result = this.parseCalculatorInput(this.calculatorInput);
      if (result > 0) {
        this.calculatorError = '';
        this.calculatorIsValid = true;
      } else {
        this.calculatorError = 'El resultado debe ser mayor que 0';
        this.calculatorIsValid = false;
      }
    } catch (error: any) {
      this.calculatorError = error.message || 'Formato inválido';
      this.calculatorIsValid = false;
    }
  }

  parseCalculatorInput(input: string): number {
    // Limpiar espacios y normalizar
    let cleanInput = input.trim().toLowerCase();
    
    // Verificar si termina en 'h' (horas) - puede tener espacios antes
    const isHours = /\s*h\s*$/.test(cleanInput);
    let expression = isHours ? cleanInput.replace(/\s*h\s*$/, '').trim() : cleanInput;
    
    // Validar caracteres permitidos (números, operadores, puntos decimales, espacios, paréntesis)
    if (!/^[\d+\-*\/\.\s\(\)]+$/.test(expression)) {
      throw new Error('Solo se permiten números y operadores matemáticos (+, -, *, /, paréntesis)');
    }
    
    // Evaluar la expresión matemática de forma segura
    let result: number;
    try {
      // Reemplazar espacios múltiples y normalizar espacios alrededor de operadores
      expression = expression.replace(/\s+/g, '');
      
      // Validar que no hay operadores consecutivos o mal formados
      if (/[\+\-\*\/]{2,}/.test(expression) || /^[\+\*\/]/.test(expression) || /[\+\-\*\/]$/.test(expression)) {
        throw new Error('Operadores mal formados');
      }
      
      // Usar Function constructor para evaluar de forma más segura que eval()
      result = new Function('return ' + expression)();
      
      if (isNaN(result) || !isFinite(result)) {
        throw new Error('Resultado inválido');
      }
    } catch (error) {
      throw new Error('Expresión matemática inválida');
    }
    
    // Redondear a 2 decimales
    result = Math.round(result * 100) / 100;
    
    // Si es en horas, convertir a minutos
    if (isHours) {
      result = result * 60; // Convertir horas a minutos
    }
    
    return result;
  }

  getCalculatorPreview(): string {
    if (!this.calculatorIsValid || !this.calculatorInput) return '';
    
    try {
      const minutes = this.parseCalculatorInput(this.calculatorInput);
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      
      let timeStr = '';
      if (hours > 0) {
        timeStr = `${hours}h ${mins}m`;
      } else {
        timeStr = `${mins}m`;
      }
      
      const action = this.calculatorType === 'start' ? 'Restar' : 'Sumar';
      return `${action} ${timeStr} (${minutes} minutos)`;
    } catch (error) {
      return '';
    }
  }

  applyTimeCalculation() {
    if (!this.calculatorIsValid || !this.calculatorInput) return;
    
    try {
      const minutes = this.parseCalculatorInput(this.calculatorInput);
      
      if (this.calculatorContext === 'new') {
        this.applyNewTaskTimeCalculation(minutes);
      } else {
        this.applyEditTaskTimeCalculation(minutes);
      }
      
      this.closeTimeCalculator();
    } catch (error) {
      console.error('Error aplicando cálculo:', error);
    }
  }

  applyNewTaskTimeCalculation(minutes: number) {
    if (this.calculatorType === 'start') {
      // Calcular hora de inicio restando minutos de la hora de fin
      if (this.newTaskEndDate && this.newTaskEndTime) {
        const endDateTime = new Date(`${this.newTaskEndDate}T${this.newTaskEndTime}`);
        const startDateTime = new Date(endDateTime.getTime() - (minutes * 60 * 1000));
        
        this.newTaskStartDate = startDateTime.toISOString().split('T')[0];
        this.newTaskStartTime = startDateTime.toTimeString().slice(0, 5);
        
        this.onNewTaskDateChange('start', this.newTaskStartDate);
        this.onNewTaskStartTimeChange(this.newTaskStartTime);
      }
    } else {
      // Calcular hora de fin sumando minutos a la hora de inicio
      if (this.newTaskStartDate && this.newTaskStartTime) {
        const startDateTime = new Date(`${this.newTaskStartDate}T${this.newTaskStartTime}`);
        const endDateTime = new Date(startDateTime.getTime() + (minutes * 60 * 1000));
        
        this.newTaskEndDate = endDateTime.toISOString().split('T')[0];
        this.newTaskEndTime = endDateTime.toTimeString().slice(0, 5);
        
        this.onNewTaskDateChange('end', this.newTaskEndDate);
        this.onNewTaskEndTimeChange(this.newTaskEndTime);
      }
    }
  }

  applyEditTaskTimeCalculation(minutes: number) {
    if (this.calculatorType === 'start') {
      // Calcular hora de inicio restando minutos de la hora de fin
      if (this.editTaskEndDate && this.editTaskEndTime) {
        const endDateTime = new Date(`${this.editTaskEndDate}T${this.editTaskEndTime}`);
        const startDateTime = new Date(endDateTime.getTime() - (minutes * 60 * 1000));
        
        this.editTaskStartDate = startDateTime.toISOString().split('T')[0];
        this.editTaskStartTime = startDateTime.toTimeString().slice(0, 5);
        
        this.onEditTaskDateChange('start', this.editTaskStartDate);
        this.onEditTaskStartTimeChange(this.editTaskStartTime);
      }
    } else {
      // Calcular hora de fin sumando minutos a la hora de inicio
      if (this.editTaskStartDate && this.editTaskStartTime) {
        const startDateTime = new Date(`${this.editTaskStartDate}T${this.editTaskStartTime}`);
        const endDateTime = new Date(startDateTime.getTime() + (minutes * 60 * 1000));
        
        this.editTaskEndDate = endDateTime.toISOString().split('T')[0];
        this.editTaskEndTime = endDateTime.toTimeString().slice(0, 5);
        
        this.onEditTaskDateChange('end', this.editTaskEndDate);
        this.onEditTaskEndTimeChange(this.editTaskEndTime);
      }
    }
  }

  isTaskOverdue(task: Task): boolean {
    // Solo marcar como vencida si no está completada
    if (task.status === 'completed' || task.completed) {
      return false;
    }
    
    const endDate = new Date(task.end + (task.end.includes('Z') ? '' : 'Z'));
    const now = new Date();
    return endDate < now;
  }

  isTaskRunning(task: Task): boolean {
    // Verificar si la tarea está en progreso (no completada y en horario actual)
    if (task.status === 'completed' || task.completed) {
      return false;
    }
    
    const startDate = new Date(task.start + (task.start.includes('Z') ? '' : 'Z'));
    const endDate = new Date(task.end + (task.end.includes('Z') ? '' : 'Z'));
    const now = new Date();
    
    return startDate <= now && now <= endDate;
  }

  // Nuevo: Métodos para manejar environments
  get orderedEnvironments(): Environment[] {
    return [...this.environments].sort((a, b) => {
      const aHasTasks = this.environmentHasTasks(a.id);
      const bHasTasks = this.environmentHasTasks(b.id);
      
      // Environments con tareas van primero
      if (aHasTasks && !bHasTasks) return -1;
      if (!aHasTasks && bHasTasks) return 1;
      
      // Dentro del mismo grupo, ordenar alfabéticamente
      return a.name.localeCompare(b.name);
    });
  }

  environmentHasTasks(environmentId: string): boolean {
    return this.getTasksByEnvironment(environmentId).length > 0 ||
           this.getProjectsWithTasksInEnvironment(environmentId).length > 0;
  }

  getProjectsWithTasksInEnvironment(environmentId: string): Project[] {
    return this.projects.filter(project =>
      project.environment === environmentId &&
      this.getTasksByProject(project.id).length > 0
    );
  }

  isEnvironmentCollapsed(environmentId: string): boolean {
    // Si el environment tiene tareas, nunca está colapsado
    if (this.environmentHasTasks(environmentId)) {
      return false;
    }
    
    // Para environments vacíos, verificar el estado global o individual
    if (this.collapsedEnvironments.hasOwnProperty(environmentId)) {
      return this.collapsedEnvironments[environmentId];
    }
    
    return this.collapsedEmptyEnvironments;
  }

  toggleEnvironmentCollapse(environmentId: string): void {
    // Solo permitir colapsar environments vacíos
    if (!this.environmentHasTasks(environmentId)) {
      this.collapsedEnvironments[environmentId] = !this.isEnvironmentCollapsed(environmentId);
    }
  }

  toggleAllEmptyEnvironments(): void {
    this.collapsedEmptyEnvironments = !this.collapsedEmptyEnvironments;
    // Limpiar estados individuales para que se use el estado global
    this.collapsedEnvironments = {};
  }

  get emptyEnvironmentsCount(): number {
    return this.environments.filter(env => !this.environmentHasTasks(env.id)).length;
  }

  getEnvironmentHiddenVisibility(envId: string): 'show-all' | 'show-24h' | 'hidden' {
    // Si el filtro global está activado, siempre mostrar todas las tareas ocultas
    if (this.showHidden) {
      return 'show-all';
    }
    
    // Si hay una configuración específica para este environment, usarla
    if (this.environmentHiddenVisibility[envId]) {
      return this.environmentHiddenVisibility[envId];
    }
    // Por defecto, ocultar las tareas ocultas (no mostrarlas)
    return 'hidden';
  }

  setEnvironmentHiddenVisibility(envId: string, visibility: 'show-all' | 'show-24h' | 'hidden'): void {
    this.environmentHiddenVisibility[envId] = visibility;
    this.closeEnvironmentContextMenu();
    // Refrescar la vista aplicando los filtros
    this.processTasks();
  }

  // Métodos para el modal de confirmación de cambio de estado
  closeStatusChangeModal() {
    this.showStatusChangeModal = false;
    this.pendingStatusChange = null;
  }

  async confirmStatusChangeWithVisibility(changeVisibility: boolean) {
    if (this.pendingStatusChange) {
      await this.applyStatusChange(
        this.pendingStatusChange.task, 
        this.pendingStatusChange.status, 
        changeVisibility
      );
      this.closeStatusChangeModal();
    }
  }

  getStatusChangeModalTitle(): string {
    if (!this.pendingStatusChange) return '';
    
    const statusNames = {
      'pending': 'Pendiente',
      'in-progress': 'En Progreso', 
      'completed': 'Completada'
    };
    
    return `Cambiar estado a ${statusNames[this.pendingStatusChange.status]}`;
  }

  getStatusChangeModalMessage(): string {
    if (!this.pendingStatusChange) return '';
    
    if (this.statusChangeWillHide) {
      return '¿Deseas ocultar la tarea después de marcarla como completada?';
    } else {
      return '¿Deseas mostrar la tarea después de cambiar su estado? (en caso de que esté oculta)';
    }
  }

  // Métodos para manejar recordatorios en nueva tarea
  onNewTaskReminderDateChange(index: number, date: string) {
    this.newTaskReminderDates[index] = date;
    this.updateNewTaskReminderDateTime(index);
  }

  onNewTaskReminderTimeChange(index: number, time: string) {
    this.newTaskReminderTimes[index] = time;
    this.updateNewTaskReminderDateTime(index);
  }

  // Métodos para manejar recordatorios en edición de tarea
  onEditTaskReminderDateChange(index: number, date: string) {
    this.editTaskReminderDates[index] = date;
    this.updateEditTaskReminderDateTime(index);
  }

  onEditTaskReminderTimeChange(index: number, time: string) {
    this.editTaskReminderTimes[index] = time;
    this.updateEditTaskReminderDateTime(index);
  }

  private updateNewTaskReminderDateTime(index: number) {
    const date = this.newTaskReminderDates[index];
    const time = this.newTaskReminderTimes[index];
    
    if (date && time) {
      const combinedDateTime = this.combineDateTime(date, time);
      if (this.newTask.reminders) {
        this.newTask.reminders[index] = combinedDateTime;
      }
      this.validateNewTaskReminder(index);
    }
  }

  private updateEditTaskReminderDateTime(index: number) {
    const date = this.editTaskReminderDates[index];
    const time = this.editTaskReminderTimes[index];
    
    if (date && time && this.selectedTask?.reminders) {
      const combinedDateTime = this.combineDateTime(date, time);
      this.selectedTask.reminders[index] = combinedDateTime;
      this.validateEditTaskReminder(index);
    }
  }

  private validateNewTaskReminder(index: number): boolean {
    const reminderDateTime = this.newTask.reminders?.[index];
    if (!reminderDateTime) {
      this.newTaskReminderErrors[index] = '';
      return true;
    }

    const reminderDate = new Date(reminderDateTime);
    const now = new Date();

    // Opcional: validar que el recordatorio no sea en el pasado
    if (reminderDate < now) {
      this.newTaskReminderErrors[index] = 'El recordatorio no puede ser en el pasado';
      return false;
    }

    this.newTaskReminderErrors[index] = '';
    return true;
  }

  private validateEditTaskReminder(index: number): boolean {
    const reminderDateTime = this.selectedTask?.reminders?.[index];
    if (!reminderDateTime) {
      this.editTaskReminderErrors[index] = '';
      return true;
    }

    const reminderDate = new Date(reminderDateTime);
    const now = new Date();

    // Opcional: validar que el recordatorio no sea en el pasado
    if (reminderDate < now) {
      this.editTaskReminderErrors[index] = 'El recordatorio no puede ser en el pasado';
      return false;
    }

    this.editTaskReminderErrors[index] = '';
    return true;
  }

  // Métodos para modal de recordatorios
  openRemindersModal(context: 'new' | 'edit') {
    this.remindersModalContext = context;
    this.showRemindersModal = true;
    this.resetReminderInputs();
  }

  closeRemindersModal() {
    this.showRemindersModal = false;
    this.resetReminderInputs();
  }

  setRemindersTab(tab: 'relative' | 'now' | 'ai' | 'manual') {
    this.remindersActiveTab = tab;
    this.resetReminderInputs();
  }

  private resetReminderInputs() {
    this.reminderRelativeTime = '';
    this.reminderFromNowTime = '';
    this.reminderAiInput = '';
    this.reminderManualDate = '';
    this.reminderManualTime = '';
    this.reminderRelativeError = '';
    this.reminderFromNowError = '';
    this.reminderAiError = '';
    this.reminderManualError = '';
  }

  // Obtener fechas de referencia para el modal
  getTaskReferenceDates() {
    if (this.remindersModalContext === 'new') {
      return {
        start: this.newTask.start,
        end: this.newTask.end,
        deadline: this.newTask.deadline
      };
    } else {
      return {
        start: this.selectedTask?.start,
        end: this.selectedTask?.end,
        deadline: this.selectedTask?.deadline
      };
    }
  }

  // Categorizar recordatorios
  getCategorizedReminders() {
    const reminders = this.remindersModalContext === 'new' 
      ? this.newTask.reminders || []
      : this.selectedTask?.reminders || [];
    
    const dates = this.getTaskReferenceDates();
    // Asegurar que todas las fechas se interpreten como UTC
    const startDate = dates.start ? new Date(dates.start + (dates.start.includes('Z') ? '' : 'Z')) : null;
    const endDate = dates.end ? new Date(dates.end + (dates.end.includes('Z') ? '' : 'Z')) : null;
    const deadlineDate = dates.deadline ? new Date(dates.deadline + (dates.deadline.includes('Z') ? '' : 'Z')) : null;

    const categorized = {
      beforeStart: [] as Array<{reminder: string, index: number, description: string}>,
      duringEvent: [] as Array<{reminder: string, index: number, description: string}>,
      beforeDeadline: [] as Array<{reminder: string, index: number, description: string}>,
      afterDeadline: [] as Array<{reminder: string, index: number, description: string}>
    };

    reminders.forEach((reminder, index) => {
      // Asegurar que el recordatorio se interprete como UTC
      const reminderDate = new Date(reminder + (reminder.includes('Z') ? '' : 'Z'));
      const description = this.generateReminderDescription(reminderDate, dates);
      
      if (startDate && reminderDate < startDate) {
        // Antes del inicio del evento
        categorized.beforeStart.push({reminder, index, description});
      } else if (endDate && reminderDate <= endDate) {
        // Durante el evento (entre inicio y fin)
        categorized.duringEvent.push({reminder, index, description});
      } else if (deadlineDate && endDate && reminderDate > endDate && reminderDate <= deadlineDate) {
        // Entre el fin del evento y la fecha límite
        categorized.beforeDeadline.push({reminder, index, description});
      } else if (deadlineDate && reminderDate > deadlineDate) {
        // Después de la fecha límite
        categorized.afterDeadline.push({reminder, index, description});
      } else {
        // Si no hay fecha límite pero está después del fin, va a "durante el evento"
        categorized.duringEvent.push({reminder, index, description});
      }
    });

    return categorized;
  }

  // Getter para vista de recordatorios - maneja contexto actual automáticamente
  get currentCategorizedReminders() {
    if (this.showRemindersModal) {
      return this.getCategorizedReminders();
    }
    
    // Para las vistas principales, determinar contexto según modal activo
    if (this.showEditTaskModal && this.selectedTask?.reminders) {
      this.remindersModalContext = 'edit';
      return this.getCategorizedReminders();
    } else if (this.showNewTaskModal && this.newTask.reminders) {
      this.remindersModalContext = 'new';
      return this.getCategorizedReminders();
    }
    
    // Valor por defecto si no hay contexto válido
    return {
      beforeStart: [],
      duringEvent: [],
      beforeDeadline: [],
      afterDeadline: []
    };
  }

  private generateReminderDescription(reminderDate: Date, dates: any): string {
    // Asegurar que todas las fechas se interpreten como UTC
    const startDate = dates.start ? new Date(dates.start + (dates.start.includes('Z') ? '' : 'Z')) : null;
    const endDate = dates.end ? new Date(dates.end + (dates.end.includes('Z') ? '' : 'Z')) : null;
    const deadlineDate = dates.deadline ? new Date(dates.deadline + (dates.deadline.includes('Z') ? '' : 'Z')) : null;

    // Si hay fecha límite y el recordatorio está después del fin del evento, 
    // calcular en relación a la fecha límite
    if (deadlineDate && endDate && reminderDate > endDate) {
      if (reminderDate <= deadlineDate) {
        const diffMinutes = Math.floor((deadlineDate.getTime() - reminderDate.getTime()) / (1000 * 60));
        return this.formatTimeDifference(diffMinutes, 'antes del límite');
      } else {
        const diffMinutes = Math.floor((reminderDate.getTime() - deadlineDate.getTime()) / (1000 * 60));
        return this.formatTimeDifference(diffMinutes, 'después del límite');
      }
    }
    
    // Lógica original para otros casos
    if (startDate && reminderDate < startDate) {
      const diffMinutes = Math.floor((startDate.getTime() - reminderDate.getTime()) / (1000 * 60));
      return this.formatTimeDifference(diffMinutes, 'antes del inicio');
    } else if (endDate && reminderDate > endDate && !deadlineDate) {
      // Solo usar "después del final" si NO hay fecha límite
      const diffMinutes = Math.floor((reminderDate.getTime() - endDate.getTime()) / (1000 * 60));
      return this.formatTimeDifference(diffMinutes, 'después del final');
    } else if (startDate) {
      const diffMinutes = Math.floor((reminderDate.getTime() - startDate.getTime()) / (1000 * 60));
      return this.formatTimeDifference(Math.abs(diffMinutes), diffMinutes >= 0 ? 'después del inicio' : 'antes del inicio');
    }
    
    return 'Recordatorio personalizado';
  }

  private formatTimeDifference(minutes: number, context: string): string {
    if (minutes < 60) {
      return `${minutes} minutos ${context}`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hora${hours > 1 ? 's' : ''} ${context}`;
      } else {
        return `${hours}h ${remainingMinutes}m ${context}`;
      }
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      if (remainingHours === 0) {
        return `${days} día${days > 1 ? 's' : ''} ${context}`;
      } else {
        return `${days}d ${remainingHours}h ${context}`;
      }
    }
  }

  // Métodos para agregar recordatorios desde el modal especializado
  addRelativeReminder() {
    try {
      const dates = this.getTaskReferenceDates();
      const referenceDate = dates[this.reminderRelativeReference];
      
      if (!referenceDate) {
        this.reminderRelativeError = 'Fecha de referencia no disponible';
        return;
      }

      const minutes = this.parseTimeExpression(this.reminderRelativeTime);
      if (minutes === null) {
        this.reminderRelativeError = 'Formato de tiempo inválido';
        return;
      }

      // Asegurar que la fecha de referencia se interprete como UTC
      const baseDate = new Date(referenceDate + (referenceDate.includes('Z') ? '' : 'Z'));
      const reminderDate = new Date(baseDate.getTime() + 
        (this.reminderRelativeDirection === 'before' ? -minutes : minutes) * 60 * 1000);

      // Validar que el recordatorio no sea en el pasado
      const now = new Date();
      if (reminderDate < now) {
        this.reminderRelativeError = 'El recordatorio calculado está en el pasado. Por favor, ajusta el tiempo para que sea en el futuro.';
        return;
      }

      this.addReminderToCurrentContext(reminderDate);
      this.reminderRelativeTime = '';
      this.reminderRelativeError = '';
    } catch (error) {
      this.reminderRelativeError = 'Error al calcular el recordatorio';
    }
  }

  addFromNowReminder() {
    try {
      const minutes = this.parseTimeExpression(this.reminderFromNowTime);
      if (minutes === null) {
        this.reminderFromNowError = 'Formato de tiempo inválido';
        return;
      }

      const now = new Date();
      let reminderDate: Date;

      switch (this.reminderFromNowDirection) {
        case 'in':
          reminderDate = new Date(now.getTime() + minutes * 60 * 1000);
          break;
        case 'before':
          reminderDate = new Date(now.getTime() - minutes * 60 * 1000);
          break;
        case 'after':
          reminderDate = new Date(now.getTime() + minutes * 60 * 1000);
          break;
        default:
          reminderDate = new Date(now.getTime() + minutes * 60 * 1000);
      }

      // Validar que el recordatorio no sea en el pasado
      if (reminderDate < now) {
        this.reminderFromNowError = 'El recordatorio no puede ser en el pasado. Por favor, usa "En" con un tiempo positivo.';
        return;
      }

      this.addReminderToCurrentContext(reminderDate);
      this.reminderFromNowTime = '';
      this.reminderFromNowError = '';
    } catch (error) {
      this.reminderFromNowError = 'Error al calcular el recordatorio';
    }
  }

  addManualReminder() {
    try {
      if (!this.reminderManualDate || !this.reminderManualTime) {
        this.reminderManualError = 'Fecha y hora son requeridos';
        return;
      }

      // Crear fecha directamente en zona horaria local sin conversión
      const [hours, minutes] = this.reminderManualTime.split(':');
      const year = parseInt(this.reminderManualDate.substring(0, 4));
      const month = parseInt(this.reminderManualDate.substring(5, 7)) - 1; // Meses en JS son 0-11
      const day = parseInt(this.reminderManualDate.substring(8, 10));
      
      const reminderDate = new Date(year, month, day, parseInt(hours), parseInt(minutes), 0, 0);
      
      // Validar que el recordatorio no sea en el pasado
      const now = new Date();
      if (reminderDate < now) {
        this.reminderManualError = 'El recordatorio no puede ser en el pasado. Por favor, selecciona una fecha y hora futura.';
        return;
      }
      
      this.addReminderToCurrentContext(reminderDate);
      this.reminderManualDate = '';
      this.reminderManualTime = '';
      this.reminderManualError = '';
    } catch (error) {
      this.reminderManualError = 'Fecha u hora inválidas';
    }
  }

  processAiReminder() {
    // Por ahora, implementaremos un parsing básico de lenguaje natural
    try {
      const input = this.reminderAiInput.toLowerCase().trim();
      const dates = this.getTaskReferenceDates();
      
      // Patrones básicos de reconocimiento
      const patterns = [
        {
          regex: /(\d+)\s*(minuto|minutos|min|m)\s*(antes|después)\s*del?\s*(inicio|final|límite)/,
          handler: (matches: RegExpMatchArray) => {
            const minutes = parseInt(matches[1]);
            const direction = matches[3] === 'antes' ? 'before' : 'after';
            const reference = matches[4] === 'inicio' ? 'start' : 
                            matches[4] === 'final' ? 'end' : 'deadline';
            
            const refDate = dates[reference as keyof typeof dates];
            if (!refDate) throw new Error('Fecha de referencia no encontrada');
            
            // Asegurar que la fecha se interprete como UTC
            const baseDate = new Date(refDate + (refDate.includes('Z') ? '' : 'Z'));
            return new Date(baseDate.getTime() + 
              (direction === 'before' ? -minutes : minutes) * 60 * 1000);
          }
        },
        {
          regex: /(\d+)\s*(hora|horas|h)\s*(antes|después)\s*del?\s*(inicio|final|límite)/,
          handler: (matches: RegExpMatchArray) => {
            const hours = parseInt(matches[1]);
            const direction = matches[3] === 'antes' ? 'before' : 'after';
            const reference = matches[4] === 'inicio' ? 'start' : 
                            matches[4] === 'final' ? 'end' : 'deadline';
            
            const refDate = dates[reference as keyof typeof dates];
            if (!refDate) throw new Error('Fecha de referencia no encontrada');
            
            // Asegurar que la fecha se interprete como UTC
            const baseDate = new Date(refDate + (refDate.includes('Z') ? '' : 'Z'));
            return new Date(baseDate.getTime() + 
              (direction === 'before' ? -hours : hours) * 60 * 60 * 1000);
          }
        }
      ];

      let reminderDate: Date | null = null;
      
      for (const pattern of patterns) {
        const matches = input.match(pattern.regex);
        if (matches) {
          reminderDate = pattern.handler(matches);
          break;
        }
      }

      if (!reminderDate) {
        this.reminderAiError = 'No se pudo interpretar el recordatorio. Intenta con: "15 minutos antes del inicio"';
        return;
      }

      // Validar que el recordatorio no sea en el pasado
      const now = new Date();
      if (reminderDate < now) {
        this.reminderAiError = 'El recordatorio interpretado está en el pasado. Por favor, especifica un recordatorio futuro.';
        return;
      }

      this.addReminderToCurrentContext(reminderDate);
      this.reminderAiInput = '';
      this.reminderAiError = '';
    } catch (error) {
      this.reminderAiError = 'Error al interpretar el recordatorio';
    }
  }

  private addReminderToCurrentContext(reminderDate: Date) {
    const reminderString = reminderDate.toISOString();
    
    if (this.remindersModalContext === 'new') {
      if (!this.newTask.reminders) this.newTask.reminders = [];
      this.newTask.reminders.push(reminderString);
      this.newTask.reminders.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    } else {
      if (!this.selectedTask!.reminders) this.selectedTask!.reminders = [];
      this.selectedTask!.reminders.push(reminderString);
      this.selectedTask!.reminders.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    }
  }

  // Parser de expresiones de tiempo con soporte para matemáticas
  private parseTimeExpression(input: string): number | null {
    try {
      let expression = input.trim().toLowerCase();
      
      // Reemplazar unidades de tiempo
      expression = expression.replace(/\s*h\s*/g, '*60');
      expression = expression.replace(/\s*m\s*/g, '');
      expression = expression.replace(/\s*min\s*/g, '');
      expression = expression.replace(/\s*minuto[s]?\s*/g, '');
      expression = expression.replace(/\s*hora[s]?\s*/g, '*60');
      
      // Limpiar espacios
      expression = expression.replace(/\s+/g, '');
      
      // Validar que solo contenga números, operadores y paréntesis
      if (!/^[\d+\-*/().]+$/.test(expression)) {
        return null;
      }
      
      // Evaluar la expresión matemática de forma segura
      const result = this.safeEval(expression);
      return typeof result === 'number' && !isNaN(result) ? Math.round(result) : null;
    } catch {
      return null;
    }
  }

  private safeEval(expression: string): number {
    // Implementación segura de evaluación matemática
    const allowedChars = /^[\d+\-*/().]+$/;
    if (!allowedChars.test(expression)) {
      throw new Error('Invalid expression');
    }
    
    try {
      return Function(`"use strict"; return (${expression})`)();
    } catch {
      throw new Error('Evaluation failed');
    }
  }

  // Métodos para gestionar recordatorios individuales
  editReminder(index: number) {
    const reminders = this.remindersModalContext === 'new' 
      ? this.newTask.reminders || []
      : this.selectedTask?.reminders || [];
    
    const reminder = reminders[index];
    if (reminder) {
      const reminderDate = new Date(reminder);
      const { date, time } = this.splitDateTime(reminder);
      
      this.reminderManualDate = date;
      this.reminderManualTime = time;
      this.setRemindersTab('manual');
      
      // Eliminar el recordatorio actual para reemplazarlo
      this.deleteReminder(index);
    }
  }

  cloneReminder(index: number) {
    const reminders = this.remindersModalContext === 'new' 
      ? this.newTask.reminders || []
      : this.selectedTask?.reminders || [];
    
    const reminder = reminders[index];
    if (reminder) {
      // Clonar el recordatorio agregando 5 minutos
      // Asegurar que la fecha se interprete como UTC
      const originalDate = new Date(reminder + (reminder.includes('Z') ? '' : 'Z'));
      const clonedDate = new Date(originalDate.getTime() + 5 * 60 * 1000);
      this.addReminderToCurrentContext(clonedDate);
    }
  }

  deleteReminder(index: number) {
    if (this.remindersModalContext === 'new') {
      if (this.newTask.reminders) {
        this.newTask.reminders.splice(index, 1);
      }
    } else {
      if (this.selectedTask?.reminders) {
        this.selectedTask.reminders.splice(index, 1);
      }
    }
  }

  formatReminderDateTime(dateTimeString: string): string {
    // Asegurar que el string se interprete como UTC si no tiene indicador de zona horaria
    const utcString = dateTimeString.includes('Z') || dateTimeString.includes('+') 
      ? dateTimeString 
      : dateTimeString + 'Z';
    
    // Crear fecha desde el string UTC
    const date = new Date(utcString);
    
    // Verificar si la fecha es válida
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    // Formatear usando la zona horaria de México con formato de 12 horas
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',  // Cambiado de '2-digit' a 'numeric' para formato 12h
      minute: '2-digit',
      hour12: true,     // Especificar formato de 12 horas
      timeZone: 'America/Mexico_City'
    });
  }
} 
