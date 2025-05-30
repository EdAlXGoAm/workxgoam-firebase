import { Component, OnInit, HostListener } from '@angular/core';
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
import { MuiTimePickerComponent } from './components/mui-time-picker/mui-time-picker.component';
import { PrioritySelectorComponent } from './components/priority-selector/priority-selector.component';

@Component({
  selector: 'app-task-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ManagementModalComponent, TimelineSvgComponent, MuiTimePickerComponent, PrioritySelectorComponent],
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
            <h2 class="text-xl font-bold mb-4">Vista de Tablero</h2>
            <!-- Timeline View integrada -->
            <div class="mb-6">
              <h3 class="text-lg font-semibold mb-2">Línea del Tiempo</h3>
              <app-timeline-svg [tasks]="tasks" [environments]="environments"></app-timeline-svg>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div *ngFor="let env of environments" class="board-column p-4">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="font-semibold p-2 rounded-md text-black flex-1"
                      [style.background-color]="env.color + 'aa'" 
                      [style.color]="'black'">{{env.name}}</h3>
                  <button (click)="onEnvironmentContextMenu($event, env)" class="p-1 text-gray-500 hover:text-gray-700 ml-2">
                    <i class="fas fa-ellipsis-v"></i>
                  </button>
                </div>
                
                <!-- Proyectos dentro del ambiente -->
                <div class="space-y-4">
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
                           [class.status-pending]="task.status === 'pending'">
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
                           class="task-card bg-white p-3 rounded-lg shadow-sm border border-yellow-200 relative">
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

          <!-- Timeline View -->
          <div *ngIf="currentView === 'timeline'" class="w-full bg-white rounded-lg shadow-md p-4">
            <h2 class="text-xl font-bold mb-4">Línea del Tiempo</h2>
            <app-timeline-svg [tasks]="tasks" [environments]="environments"></app-timeline-svg>
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
      <div *ngIf="showNewTaskModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-screen overflow-y-auto">
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">Nueva Tarea</h3>
              <button (click)="closeNewTaskModal()" class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <form (ngSubmit)="saveTask()" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Nombre de la tarea</label>
                  <input type="text" [(ngModel)]="newTask.name" name="name" class="w-full px-3 py-2 border rounded-lg" required>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
                  <div class="relative">
                    <input type="text" [(ngModel)]="newTask.emoji" name="emoji" class="w-full px-3 py-2 border rounded-lg" readonly>
                    <button type="button" (click)="toggleEmojiPicker()" class="absolute right-2 top-2 text-xl">{{newTask.emoji || '😊'}}</button>
                    <div *ngIf="showEmojiPicker" class="emoji-picker">
                      <span *ngFor="let emoji of emojis" (click)="selectEmoji(emoji)" class="emoji-option">{{emoji}}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea [(ngModel)]="newTask.description" name="description" rows="3" class="w-full px-3 py-2 border rounded-lg"></textarea>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de inicio</label>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">Fecha</label>
                      <input 
                        type="date" 
                        [(ngModel)]="newTaskStartDate"
                        (ngModelChange)="onNewTaskDateChange('start', $event)"
                        name="newTaskStartDate"
                        class="w-full px-3 py-2 border rounded-lg text-sm" 
                        required>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">Hora</label>
                      <app-mui-time-picker
                        [(ngModel)]="newTaskStartTime"
                        (timeChange)="onNewTaskStartTimeChange($event)"
                        name="newTaskStartTime"
                        label="Hora de inicio"
                        placeholder="HH:MM"
                        referenceTime="{{ getCurrentTime() }}"
                        referenceLabel="Hora actual">
                      </app-mui-time-picker>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de fin</label>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">Fecha</label>
                      <input 
                        type="date" 
                        [(ngModel)]="newTaskEndDate"
                        (ngModelChange)="onNewTaskDateChange('end', $event)"
                        name="newTaskEndDate"
                        class="w-full px-3 py-2 border rounded-lg text-sm" 
                        required>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">Hora</label>
                      <app-mui-time-picker
                        [(ngModel)]="newTaskEndTime"
                        (timeChange)="onNewTaskEndTimeChange($event)"
                        name="newTaskEndTime"
                        label="Hora de fin"
                        placeholder="HH:MM"
                        [referenceTime]="newTaskStartTime"
                        referenceLabel="Hora de inicio">
                      </app-mui-time-picker>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
                  <div class="flex">
                    <select [(ngModel)]="newTask.environment" (ngModelChange)="onNewTaskEnvironmentChange()" name="environment" class="w-full px-3 py-2 border rounded-lg rounded-r-none bg-white">
                      <option value="">Seleccionar ambiente</option>
                      <option *ngFor="let env of environments" [value]="env.id">{{env.name}}</option>
                    </select>
                    <button type="button" (click)="openNewEnvironmentModal()" class="px-3 py-2 bg-gray-200 border border-l-0 rounded-r-lg">
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                  <div class="flex">
                    <select [(ngModel)]="newTask.project" name="project" class="w-full px-3 py-2 border rounded-lg rounded-r-none bg-white" [disabled]="!newTask.environment || selectableProjectsForNewTask.length === 0">
                      <option value="">Seleccionar proyecto</option>
                      <option *ngFor="let proj of selectableProjectsForNewTask" [value]="proj.id">{{proj.name}}</option>
                    </select>
                    <button type="button" (click)="openNewProjectModal()" class="px-3 py-2 bg-gray-200 border border-l-0 rounded-r-lg">
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <app-priority-selector
                    [(ngModel)]="newTask.priority"
                    name="priority">
                  </app-priority-selector>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Duración estimada (horas)</label>
                  <input type="number" [(ngModel)]="newTask.duration" name="duration" min="0" step="0.5" class="w-full px-3 py-2 border rounded-lg">
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fecha límite de fin</label>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">Fecha</label>
                    <input 
                      type="date" 
                      [(ngModel)]="newTaskDeadlineDate"
                      (ngModelChange)="onNewTaskDateChange('deadline', $event)"
                      name="newTaskDeadlineDate"
                      class="w-full px-3 py-2 border rounded-lg text-sm">
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">Hora</label>
                    <app-mui-time-picker
                      [(ngModel)]="newTaskDeadlineTime"
                      (timeChange)="onNewTaskDeadlineTimeChange($event)"
                      name="newTaskDeadlineTime"
                      label="Hora límite"
                      placeholder="HH:MM">
                    </app-mui-time-picker>
                  </div>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Recordatorios</label>
                <div #remindersContainer class="space-y-2">
                  <div *ngFor="let reminder of newTask.reminders; let i = index" class="flex items-center space-x-2">
                    <input type="datetime-local" [(ngModel)]="newTask.reminders![i]" class="flex-1 px-3 py-2 border rounded-lg">
                    <button type="button" (click)="removeReminder(i)" class="text-red-500 hover:text-red-700">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                <button type="button" (click)="addReminder()" class="mt-2 px-3 py-1 bg-gray-200 rounded-lg text-sm">
                  <i class="fas fa-plus mr-1"></i> Agregar recordatorio
                </button>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fragmentos (Pausas)</label>
                <div #fragmentsContainer class="space-y-2">
                  <div *ngFor="let fragment of newTask.fragments; let i = index" class="fragment-item bg-gray-100 p-3 rounded-lg">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                      <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Inicio</label>
                        <input type="datetime-local" [(ngModel)]="newTask.fragments![i].start" class="w-full px-3 py-2 border rounded-lg text-sm">
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Fin</label>
                        <input type="datetime-local" [(ngModel)]="newTask.fragments![i].end" class="w-full px-3 py-2 border rounded-lg text-sm">
                      </div>
                    </div>
                    <button type="button" (click)="removeFragment(i)" class="text-red-500 hover:text-red-700 text-sm">
                      <i class="fas fa-trash mr-1"></i>Eliminar fragmento
                    </button>
                  </div>
                </div>
                <button type="button" (click)="addFragment()" class="mt-2 px-3 py-1 bg-gray-200 rounded-lg text-sm">
                  <i class="fas fa-plus mr-1"></i> Agregar fragmento
                </button>
              </div>
              
              <div class="flex justify-end space-x-3 pt-4">
                <button type="button" (click)="closeNewTaskModal()" class="px-4 py-2 border rounded-lg font-medium">
                  Cancelar
                </button>
                <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  Guardar Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

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
                  <option *ngFor="let env of environments" [value]="env.id">{{env.name}}</option>
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
      <div *ngIf="showEditTaskModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-screen overflow-y-auto">
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">Editar Tarea</h3>
              <button (click)="showEditTaskModal = false" class="text-gray-500 hover:text-gray-700">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <form (ngSubmit)="saveEditedTask()" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Nombre de la tarea</label>
                  <input type="text" [(ngModel)]="selectedTask!.name" name="name" class="w-full px-3 py-2 border rounded-lg" required>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
                  <div class="relative">
                    <input type="text" [(ngModel)]="selectedTask!.emoji" name="emoji" class="w-full px-3 py-2 border rounded-lg" readonly>
                    <button type="button" (click)="toggleEmojiPicker()" class="absolute right-2 top-2 text-xl">{{selectedTask!.emoji || '😊'}}</button>
                    <div *ngIf="showEmojiPicker" class="emoji-picker">
                      <span *ngFor="let emoji of emojis" (click)="selectEmoji(emoji)" class="emoji-option">{{emoji}}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea [(ngModel)]="selectedTask!.description" name="description" rows="3" class="w-full px-3 py-2 border rounded-lg"></textarea>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de inicio</label>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">Fecha</label>
                      <input 
                        type="date" 
                        [(ngModel)]="editTaskStartDate"
                        (ngModelChange)="onEditTaskDateChange('start', $event)"
                        name="editTaskStartDate"
                        class="w-full px-3 py-2 border rounded-lg text-sm" 
                        required>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">Hora</label>
                      <app-mui-time-picker
                        [(ngModel)]="editTaskStartTime"
                        (timeChange)="onEditTaskStartTimeChange($event)"
                        name="editTaskStartTime"
                        label="Hora de inicio"
                        placeholder="HH:MM"
                        [referenceTime]="getCurrentTime()"
                        referenceLabel="Hora actual">
                      </app-mui-time-picker>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de fin</label>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">Fecha</label>
                      <input 
                        type="date" 
                        [(ngModel)]="editTaskEndDate"
                        (ngModelChange)="onEditTaskDateChange('end', $event)"
                        name="editTaskEndDate"
                        class="w-full px-3 py-2 border rounded-lg text-sm" 
                        required>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">Hora</label>
                      <app-mui-time-picker
                        [(ngModel)]="editTaskEndTime"
                        (timeChange)="onEditTaskEndTimeChange($event)"
                        name="editTaskEndTime"
                        label="Hora de fin"
                        placeholder="HH:MM"
                        [referenceTime]="editTaskStartTime"
                        referenceLabel="Hora de inicio">
                      </app-mui-time-picker>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
                  <div class="flex">
                    <select [(ngModel)]="selectedTask!.environment" (ngModelChange)="onEditTaskEnvironmentChange()" name="environment" class="w-full px-3 py-2 border rounded-lg rounded-r-none bg-white">
                      <option value="">Seleccionar ambiente</option>
                      <option *ngFor="let env of environments" [value]="env.id">{{env.name}}</option>
                    </select>
                    <button type="button" (click)="openNewEnvironmentModal()" class="px-3 py-2 bg-gray-200 border border-l-0 rounded-r-lg">
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                  <div class="flex">
                    <select [(ngModel)]="selectedTask!.project" name="project" class="w-full px-3 py-2 border rounded-lg rounded-r-none bg-white" [disabled]="!selectedTask!.environment || selectableProjectsForEditTask.length === 0">
                      <option value="">Seleccionar proyecto</option>
                      <option *ngFor="let proj of selectableProjectsForEditTask" [value]="proj.id">{{proj.name}}</option>
                    </select>
                    <button type="button" (click)="openNewProjectModal()" class="px-3 py-2 bg-gray-200 border border-l-0 rounded-r-lg">
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <app-priority-selector
                    [(ngModel)]="selectedTask!.priority"
                    name="priority">
                  </app-priority-selector>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Duración estimada (horas)</label>
                  <input type="number" [(ngModel)]="selectedTask!.duration" name="duration" min="0" step="0.5" class="w-full px-3 py-2 border rounded-lg">
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fecha límite de fin</label>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">Fecha</label>
                    <input 
                      type="date" 
                      [(ngModel)]="editTaskDeadlineDate"
                      (ngModelChange)="onEditTaskDateChange('deadline', $event)"
                      name="editTaskDeadlineDate"
                      class="w-full px-3 py-2 border rounded-lg text-sm">
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">Hora</label>
                    <app-mui-time-picker
                      [(ngModel)]="editTaskDeadlineTime"
                      (timeChange)="onEditTaskDeadlineTimeChange($event)"
                      name="editTaskDeadlineTime"
                      label="Hora límite"
                      placeholder="HH:MM">
                    </app-mui-time-picker>
                  </div>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Recordatorios</label>
                <div #remindersContainer class="space-y-2">
                  <div *ngFor="let reminder of selectedTask!.reminders; let i = index" class="flex items-center space-x-2">
                    <input type="datetime-local" [(ngModel)]="selectedTask!.reminders![i]" class="flex-1 px-3 py-2 border rounded-lg">
                    <button type="button" (click)="removeReminder(i)" class="text-red-500 hover:text-red-700">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                <button type="button" (click)="addReminder()" class="mt-2 px-3 py-1 bg-gray-200 rounded-lg text-sm">
                  <i class="fas fa-plus mr-1"></i> Agregar recordatorio
                </button>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fragmentos (Pausas)</label>
                <div #fragmentsContainer class="space-y-2">
                  <div *ngFor="let fragment of selectedTask!.fragments; let i = index" class="fragment-item bg-gray-100 p-3 rounded-lg">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                      <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Inicio</label>
                        <input type="datetime-local" [(ngModel)]="selectedTask!.fragments![i].start" class="w-full px-3 py-2 border rounded-lg text-sm">
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Fin</label>
                        <input type="datetime-local" [(ngModel)]="selectedTask!.fragments![i].end" class="w-full px-3 py-2 border rounded-lg text-sm">
                      </div>
                    </div>
                    <button type="button" (click)="removeFragment(i)" class="text-red-500 hover:text-red-700 text-sm">
                      <i class="fas fa-trash mr-1"></i>Eliminar fragmento
                    </button>
                  </div>
                </div>
                <button type="button" (click)="addFragment()" class="mt-2 px-3 py-1 bg-gray-200 rounded-lg text-sm">
                  <i class="fas fa-plus mr-1"></i> Agregar fragmento
                </button>
              </div>
              
              <div class="flex justify-end space-x-3 pt-4">
                <button type="button" (click)="showEditTaskModal = false" class="px-4 py-2 border rounded-lg font-medium">
                  Cancelar
                </button>
                <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .priority-low { background-color: #4caf50; }
    .priority-medium { background-color: #ff9800; }
    .priority-high { background-color: #f44336; }
    .priority-critical { background-color: #9c27b0; }
    
    .board-column {
      min-height: 500px;
      background-color: #f3f4f6;
      border-radius: 8px;
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
            '🏋️', '🚴', '🍎', '🍕', '☕', '🍷', '🎵', '🎮', '🎨', '✈️'];
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

  constructor(
    private authService: AuthService,
    private firestore: Firestore,
    private taskService: TaskService,
    private projectService: ProjectService,
    private environmentService: EnvironmentService
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
    
    if (!this.showHidden) {
      tasksToFilter = tasksToFilter.filter(t => !t.hidden);
    }
    
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
  }

  async saveTask() {
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
    
    // Inicializar fechas y horas separadas directamente desde los Date objects para evitar conversiones
    this.newTaskStartDate = startTime.toISOString().split('T')[0];
    this.newTaskStartTime = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
    this.newTaskEndDate = endTime.toISOString().split('T')[0];
    this.newTaskEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Deadline por defecto vacío
    this.newTaskDeadlineDate = '';
    this.newTaskDeadlineTime = '';
    
    this.onNewTaskEnvironmentChange();
    
    // Calcular duración inicial automáticamente
    this.updateNewTaskDuration();
  }

  private formatDateTimeLocalForDefaults(date: Date): string {
    // Crear el formato datetime-local directamente en hora local
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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
    if (!this.newTask.reminders) {
      this.newTask.reminders = [];
    }
    this.newTask.reminders.push(this.formatDateTimeLocal(new Date()));
  }

  removeReminder(index: number) {
    if (this.newTask.reminders) {
      this.newTask.reminders.splice(index, 1);
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
    
    // Inicializar fechas y horas separadas directamente desde los Date objects para evitar conversiones
    this.newTaskStartDate = startTime.toISOString().split('T')[0];
    this.newTaskStartTime = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
    this.newTaskEndDate = endTime.toISOString().split('T')[0];
    this.newTaskEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Deadline por defecto vacío
    this.newTaskDeadlineDate = '';
    this.newTaskDeadlineTime = '';
    
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
    return this.filteredTasks
      .filter(task => task.environment === environmentId)
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
    return this.filteredTasks
      .filter(task => task.project === projectId)
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
    // Solo cerrar los context menus, no otros modales
    if (this.showContextMenu) {
      this.closeContextMenu();
    }
    if (this.showEnvironmentContextMenu) {
      this.closeEnvironmentContextMenu();
    }
    if (this.showProjectContextMenu) {
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
    try {
      const updates: Partial<Task> = { status };
      if (status === 'completed') {
        updates.completed = true;
        updates.completedAt = new Date().toISOString();
      } else {
        updates.completed = false;
        updates.completedAt = null;
      }
      await this.taskService.updateTask(task.id, updates);
      await this.loadTasks();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
    }
    this.closeContextMenu();
  }

  async saveEditedTask() {
    if (!this.selectedTask) return;
    
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
    return this.filteredTasks.filter(task => 
      task.environment === environmentId && (!task.project || task.project === '')
    );
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
} 