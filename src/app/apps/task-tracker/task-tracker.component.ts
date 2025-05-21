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

@Component({
  selector: 'app-task-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ManagementModalComponent, TimelineSvgComponent],
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
              <h3 class="text-lg font-semibold mb-2">Línea del Tiempo (Hoy)</h3>
              <app-timeline-svg [tasks]="getTodayTasks()" [environments]="environments"></app-timeline-svg>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div *ngFor="let env of environments" class="board-column p-4">
                <h3 class="font-semibold mb-4 p-2 rounded-md text-black"
                    [style.background-color]="env.color + 'aa'" 
                    [style.color]="'black'">{{env.name}}</h3>
                <div class="space-y-3">
                  <div *ngFor="let task of getTasksByEnvironment(env.id)"
                       class="task-card bg-white p-3 rounded-lg shadow-sm border border-gray-200 relative"
                       [class.status-completed]="task.status === 'completed'"
                       [class.status-in-progress]="task.status === 'in-progress'"
                       [class.status-pending]="task.status === 'pending'">
                    <button (click)="onTaskContextMenu($event, task)" class="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700">
                      <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-lg">{{task.emoji}}</span>
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
            </div>
          </div>

          <!-- Timeline View -->
          <div *ngIf="currentView === 'timeline'" class="w-full bg-white rounded-lg shadow-md p-4">
            <h2 class="text-xl font-bold mb-4">Línea del Tiempo (Hoy)</h2>
            <app-timeline-svg [tasks]="getTodayTasks()" [environments]="environments"></app-timeline-svg>
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
                    <div class="text-sm font-medium text-gray-900">{{ task.emoji }} {{ task.name }}</div>
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
                  <input type="datetime-local" [(ngModel)]="newTask.start" name="start" class="w-full px-3 py-2 border rounded-lg" required>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de fin</label>
                  <input type="datetime-local" [(ngModel)]="newTask.end" name="end" class="w-full px-3 py-2 border rounded-lg" required>
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
                  <select [(ngModel)]="newTask.priority" name="priority" class="w-full px-3 py-2 border rounded-lg">
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Duración estimada (horas)</label>
                  <input type="number" [(ngModel)]="newTask.duration" name="duration" min="0" step="0.5" class="w-full px-3 py-2 border rounded-lg">
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fecha límite de fin</label>
                <input type="datetime-local" [(ngModel)]="newTask.deadline" name="deadline" class="w-full px-3 py-2 border rounded-lg">
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
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">Nuevo Ambiente</h3>
              <button (click)="closeNewEnvironmentModal()" class="text-gray-500 hover:text-gray-700">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <form (ngSubmit)="saveNewEnvironment()" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del ambiente</label>
                <input type="text" [(ngModel)]="newEnvironment.name" name="environmentName" class="w-full px-3 py-2 border rounded-lg" required>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea [(ngModel)]="newEnvironment.description" name="environmentDescription" rows="3" class="w-full px-3 py-2 border rounded-lg"></textarea>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input type="color" [(ngModel)]="newEnvironment.color" name="environmentColor" class="w-full h-10 px-3 py-2 border rounded-lg">
              </div>
              
              <div class="flex justify-end space-x-3 pt-4">
                <button type="button" (click)="closeNewEnvironmentModal()" class="px-4 py-2 border rounded-lg font-medium">
                  Cancelar
                </button>
                <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  Guardar Ambiente
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
        <div class="context-menu-item" (click)="changeStatus(selectedTask!, 'completed')" *ngIf="selectedTask?.status !== 'completed'">
          <i class="fas fa-check"></i>
          <span>Marcar completada</span>
        </div>
        <div class="context-menu-item" (click)="changeStatus(selectedTask!, 'in-progress')" *ngIf="selectedTask?.status !== 'in-progress'">
          <i class="fas fa-spinner"></i>
          <span>Marcar en progreso</span>
        </div>
        <div class="context-menu-item" (click)="changeStatus(selectedTask!, 'pending')" *ngIf="selectedTask?.status !== 'pending'">
          <i class="fas fa-play"></i>
          <span>Marcar pendiente</span>
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
                  <input type="datetime-local" [(ngModel)]="selectedTask!.start" name="start" class="w-full px-3 py-2 border rounded-lg" required>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de fin</label>
                  <input type="datetime-local" [(ngModel)]="selectedTask!.end" name="end" class="w-full px-3 py-2 border rounded-lg" required>
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
                  <select [(ngModel)]="selectedTask!.priority" name="priority" class="w-full px-3 py-2 border rounded-lg">
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Duración estimada (horas)</label>
                  <input type="number" [(ngModel)]="selectedTask!.duration" name="duration" min="0" step="0.5" class="w-full px-3 py-2 border rounded-lg">
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fecha límite de fin</label>
                <input type="datetime-local" [(ngModel)]="selectedTask!.deadline" name="deadline" class="w-full px-3 py-2 border rounded-lg">
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
    .priority-low { background-color: #4ade80; }
    .priority-medium { background-color: #60a5fa; }
    .priority-high { background-color: #f87171; }
    .priority-critical { background-color: #f472b6; }
    
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
    description: '',
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

  // Propiedades para tareas huérfanas
  orphanedTasks: Task[] = [];
  selectedOrphanedTasks: { [taskId: string]: boolean } = {};
  showAssignOrphanedTasksModal: boolean = false;
  projectForAssigningOrphans: string = '';
  isAssigningOrphanedTasks: boolean = false;
  selectableProjectsForEditTask: Project[] = [];

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
    this.setDefaultTimes();
    this.onNewTaskEnvironmentChange();
  }

  private setDefaultTimes() {
    const now = new Date();
    const msQuarter = 15 * 60 * 1000;
    const startTime = new Date(Math.ceil(now.getTime() / msQuarter) * msQuarter);
    const endTime = new Date(startTime.getTime() + 4 * msQuarter);
    this.newTask.start = this.formatDateTimeLocal(startTime);
    this.newTask.end = this.formatDateTimeLocal(endTime);
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
  }

  closeNewEnvironmentModal() {
    this.showNewEnvironmentModal = false;
  }

  openNewProjectModal() {
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
    this.setDefaultTimes();
    this.onNewTaskEnvironmentChange();
  }

  async saveNewEnvironment() {
    try {
      await this.environmentService.createEnvironment(this.newEnvironment as Omit<Environment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>);
      await this.loadEnvironments();
      this.closeNewEnvironmentModal();
      this.resetNewEnvironment();
    } catch (error) {
      console.error('Error al guardar el ambiente:', error);
    }
  }

  async saveNewProject() {
    try {
      await this.projectService.createProject(this.newProject as Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>);
      await this.loadProjects();
      this.closeNewProjectModal();
      this.resetNewProject();
    } catch (error) {
      console.error('Error al guardar el proyecto:', error);
    }
  }

  private resetNewEnvironment() {
    this.newEnvironment = {
      name: '',
      description: '',
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
    const start = new Date(task.start);
    const end = new Date(task.end);
    const now = new Date();
    const total = end.getTime() - start.getTime();
    const current = now.getTime() - start.getTime();
    return Math.min(100, Math.max(0, (current / total) * 100));
  }

  getTasksByEnvironment(environmentId: string): Task[] {
    return this.filteredTasks
      .filter(task => task.environment === environmentId)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
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
    this.contextMenuPosition = { x: event.clientX, y: event.clientY };
    this.showContextMenu = true;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.showContextMenu) {
      this.closeContextMenu();
    }
  }

  closeContextMenu() {
    this.showContextMenu = false;
  }

  async editTask(task: Task) {
    this.selectedTask = JSON.parse(JSON.stringify(task));
    this.onEditTaskEnvironmentChange();
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
      await this.taskService.updateTask(this.selectedTask.id, this.selectedTask);
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

  getTodayTasks(): Task[] {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return this.tasks.filter(task => {
      if (!task.start) return false;
      const taskDate = new Date(task.start);
      return (
        taskDate.getFullYear() === yyyy &&
        String(taskDate.getMonth() + 1).padStart(2, '0') === mm &&
        String(taskDate.getDate()).padStart(2, '0') === dd
      );
    });
  }
} 