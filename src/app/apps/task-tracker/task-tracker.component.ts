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

@Component({
  selector: 'app-task-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <header class="bg-indigo-600 text-white shadow-lg">
        <div class="container mx-auto px-4 py-4 flex justify-between items-center">
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
      <main class="container mx-auto px-4 py-6">
        <!-- View Selector -->
        <div class="bg-white rounded-lg shadow-md p-4 mb-6">
          <div class="flex flex-wrap justify-between items-center">
            <div class="flex space-x-2 mb-4 md:mb-0">
              <button (click)="switchView('day')" [class.bg-indigo-600]="currentView === 'day'" [class.text-white]="currentView === 'day'" [class.bg-white]="currentView !== 'day'" [class.text-gray-700]="currentView !== 'day'" class="px-4 py-2 rounded-lg font-medium hover:bg-gray-100">
                <i class="fas fa-clock mr-2"></i>Día
              </button>
              <button (click)="switchView('week')" [class.bg-indigo-600]="currentView === 'week'" [class.text-white]="currentView === 'week'" [class.bg-white]="currentView !== 'week'" [class.text-gray-700]="currentView !== 'week'" class="px-4 py-2 rounded-lg font-medium hover:bg-gray-100">
                <i class="fas fa-chart-gantt mr-2"></i>Semana
              </button>
              <button (click)="switchView('month')" [class.bg-indigo-600]="currentView === 'month'" [class.text-white]="currentView === 'month'" [class.bg-white]="currentView !== 'month'" [class.text-gray-700]="currentView !== 'month'" class="px-4 py-2 rounded-lg font-medium hover:bg-gray-100">
                <i class="fas fa-calendar-alt mr-2"></i>Mes
              </button>
              <button (click)="switchView('board')" [class.bg-indigo-600]="currentView === 'board'" [class.text-white]="currentView === 'board'" [class.bg-white]="currentView !== 'board'" [class.text-gray-700]="currentView !== 'board'" class="px-4 py-2 rounded-lg font-medium hover:bg-gray-100">
                <i class="fas fa-columns mr-2"></i>Tablero
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
          <!-- Day View -->
          <div *ngIf="currentView === 'day'" class="bg-white rounded-lg shadow-md p-4">
            <h2 class="text-xl font-bold mb-4">Próximas 20 horas</h2>
            <div class="relative h-96 overflow-hidden">
              <div class="timeline-hours absolute top-0 left-0 right-0 h-full flex">
                <div *ngFor="let hour of getNext24Hours()" class="hour-marker flex-1 border-r border-gray-200">
                  <div class="text-xs text-gray-500 px-2">{{hour}}</div>
                </div>
              </div>
              <div class="timeline-tasks absolute top-12 left-0 right-0 bottom-0">
                <div *ngFor="let task of filteredTasks"
                     class="timeline-item"
                     [class.priority-low]="task.priority === 'low'"
                     [class.priority-medium]="task.priority === 'medium'"
                     [class.priority-high]="task.priority === 'high'"
                     [class.priority-critical]="task.priority === 'critical'"
                     [class.status-completed]="task.status === 'completed'"
                     [class.status-in-progress]="task.status === 'in-progress'"
                     [class.status-pending]="task.status === 'pending'"
                     [style.left]="getTaskPosition(task)"
                     [style.width]="getTaskWidth(task)"
                     [style.top]="'20px'">
                  <div class="relative">
                    <button (click)="onTaskContextMenu($event, task)" class="absolute top-1 right-1 p-1 text-white hover:text-gray-200">
                      <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="flex items-center">
                      <span class="mr-2">{{task.emoji}}</span>
                      <span class="truncate">{{task.name}}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Week View -->
          <div *ngIf="currentView === 'week'" class="bg-white rounded-lg shadow-md p-4">
            <h2 class="text-xl font-bold mb-4">Vista Semanal (Gantt)</h2>
            <div class="overflow-x-auto">
              <table class="min-w-full">
                <thead>
                  <tr class="border-b">
                    <th class="text-left py-2 px-4">Tarea</th>
                    <th class="text-left py-2 px-4 w-full">
                      <div class="flex">
                        <div *ngFor="let day of getWeekDays()" class="flex-1 text-center">
                          {{day}}
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let task of filteredTasks" class="border-b"
                      [class.status-completed]="task.status === 'completed'"
                      [class.status-in-progress]="task.status === 'in-progress'"
                      [class.status-pending]="task.status === 'pending'">
                    <td class="py-2 px-4 relative">
                      <button (click)="onTaskContextMenu($event, task)" class="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700">
                        <i class="fas fa-ellipsis-v"></i>
                      </button>
                      <div class="flex items-center">
                        <span class="mr-2">{{task.emoji}}</span>
                        <span>{{task.name}}</span>
                      </div>
                    </td>
                    <td class="py-2 px-4">
                      <div class="gantt-bar bg-gray-200">
                        <div class="gantt-bar-progress" [class]="'priority-' + task.priority"
                             [style.width]="getWeekBarWidth(task)"
                             [style.marginLeft]="getWeekBarPosition(task)">
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Month View -->
          <div *ngIf="currentView === 'month'" class="bg-white rounded-lg shadow-md p-4">
            <h2 class="text-xl font-bold mb-4">Vista Mensual (Gantt)</h2>
            <div class="flex justify-between mb-4">
              <button (click)="previousMonth()" class="px-3 py-1 bg-gray-200 rounded-lg">
                <i class="fas fa-chevron-left"></i>
              </button>
              <h3 class="text-lg font-semibold">{{currentMonth}}</h3>
              <button (click)="nextMonth()" class="px-3 py-1 bg-gray-200 rounded-lg">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full">
                <thead>
                  <tr class="border-b">
                    <th class="text-left py-2 px-4">Tarea</th>
                    <th class="text-left py-2 px-4 w-full">
                      <div class="flex">
                        <div *ngFor="let week of getMonthWeeks()" class="flex-1 text-center">
                          Semana {{week}}
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let task of filteredTasks" class="border-b"
                      [class.status-completed]="task.status === 'completed'"
                      [class.status-in-progress]="task.status === 'in-progress'"
                      [class.status-pending]="task.status === 'pending'">
                    <td class="py-2 px-4 relative">
                      <button (click)="onTaskContextMenu($event, task)" class="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700">
                        <i class="fas fa-ellipsis-v"></i>
                      </button>
                      <div class="flex items-center">
                        <span class="mr-2">{{task.emoji}}</span>
                        <span>{{task.name}}</span>
                      </div>
                    </td>
                    <td class="py-2 px-4">
                      <div class="gantt-bar bg-gray-200">
                        <div class="gantt-bar-progress" [class]="'priority-' + task.priority"
                             [style.width]="getMonthBarWidth(task)"
                             [style.marginLeft]="getMonthBarPosition(task)">
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Board View -->
          <div *ngIf="currentView === 'board'" class="bg-white rounded-lg shadow-md p-4">
            <h2 class="text-xl font-bold mb-4">Vista de Tablero</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div *ngFor="let env of environments" class="board-column p-4">
                <h3 class="font-semibold mb-4" [style.color]="env.color">{{env.name}}</h3>
                <div class="space-y-3">
                  <div *ngFor="let task of getTasksByEnvironment(env.name)"
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
        </div>
      </main>
    </div>

    <!-- New Task Modal -->
    <div *ngIf="showNewTaskModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-screen overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold">Nueva Tarea</h3>
            <button (click)="closeNewTaskModal()" class="text-gray-500 hover:text-gray-700">
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
                  <select [(ngModel)]="newTask.environment" name="environment" class="w-full px-3 py-2 border rounded-lg rounded-r-none">
                    <option value="">Seleccionar ambiente</option>
                    <option *ngFor="let env of environments" [value]="env.name">{{env.name}}</option>
                  </select>
                  <button type="button" (click)="openNewEnvironmentModal()" class="px-3 py-2 bg-gray-200 border border-l-0 rounded-r-lg">
                    <i class="fas fa-plus"></i>
                  </button>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                <div class="flex">
                  <select [(ngModel)]="newTask.project" name="project" class="w-full px-3 py-2 border rounded-lg rounded-r-none">
                    <option value="">Seleccionar proyecto</option>
                    <option *ngFor="let proj of filteredProjects" [value]="proj.name">{{proj.name}}</option>
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
              <select [(ngModel)]="newProject.environment" name="projectEnvironment" class="w-full px-3 py-2 border rounded-lg">
                <option value="">Seleccionar ambiente</option>
                <option *ngFor="let env of environments" [value]="env.name">{{env.name}}</option>
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
                  <select [(ngModel)]="selectedTask!.environment" name="environment" class="w-full px-3 py-2 border rounded-lg rounded-r-none">
                    <option value="">Seleccionar ambiente</option>
                    <option *ngFor="let env of environments" [value]="env.name">{{env.name}}</option>
                  </select>
                  <button type="button" (click)="openNewEnvironmentModal()" class="px-3 py-2 bg-gray-200 border border-l-0 rounded-r-lg">
                    <i class="fas fa-plus"></i>
                  </button>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                <div class="flex">
                  <select [(ngModel)]="selectedTask!.project" name="project" class="w-full px-3 py-2 border rounded-lg rounded-r-none">
                    <option value="">Seleccionar proyecto</option>
                    <option *ngFor="let proj of filteredProjects" [value]="proj.name">{{proj.name}}</option>
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
  `,
  styles: [`
    .timeline-item {
      position: absolute;
      border-radius: 6px;
      padding: 8px;
      color: white;
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .timeline-item:hover {
      z-index: 100;
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .gantt-bar {
      height: 20px;
      border-radius: 4px;
      margin-top: 5px;
      position: relative;
      overflow: hidden;
    }
    
    .gantt-bar-progress {
      height: 100%;
      border-radius: 4px;
      background: rgba(255,255,255,0.3);
    }
    
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
  currentView: 'day' | 'week' | 'month' | 'board' = 'day';
  showNewTaskModal = false;
  searchQuery = '';
  userName = '';
  userPhotoUrl = '';
  tasks: Task[] = [];
  projects: Project[] = [];
  environments: Environment[] = [];
  filteredTasks: Task[] = [];
  currentMonth: string = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  showNewEnvironmentModal = false;
  showNewProjectModal = false;
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

  constructor(
    private authService: AuthService,
    private firestore: Firestore,
    private taskService: TaskService,
    private projectService: ProjectService,
    private environmentService: EnvironmentService
  ) {}

  async ngOnInit() {
    await this.loadUserData();
    await this.loadTasks();
    await this.loadProjects();
    await this.loadEnvironments();
    this.setDefaultTimes();
    this.initializeNewTask();
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
      this.filterTasks();
      console.log('Tareas cargadas:', this.tasks); // Para debugging
    } catch (error) {
      console.error('Error al cargar tareas:', error);
    }
  }

  private async loadProjects() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const projectsRef = collection(this.firestore, 'projects');
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

    const environmentsRef = collection(this.firestore, 'environments');
    const q = query(environmentsRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    this.environments = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Environment));
  }

  switchView(view: 'day' | 'week' | 'month' | 'board') {
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
    let tasks = [...this.tasks];
    // Quitar ocultas si no se muestran
    if (!this.showHidden) {
      tasks = tasks.filter(t => !t.hidden);
    }
    // Filtrar por búsqueda
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      tasks = tasks.filter(task =>
        task.name.toLowerCase().includes(q) ||
        task.description.toLowerCase().includes(q) ||
        task.project.toLowerCase().includes(q)
      );
    }
    this.filteredTasks = tasks;
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
      // Aquí podrías mostrar un mensaje de error al usuario
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
  }

  private setDefaultTimes() {
    const now = new Date();
    const msQuarter = 15 * 60 * 1000;
    const startTime = new Date(Math.ceil(now.getTime() / msQuarter) * msQuarter);
    const endTime = new Date(startTime.getTime() + 4 * msQuarter); // +1 hour
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
    this.newTask.emoji = emoji;
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

  previousMonth() {
    const currentDate = new Date(this.currentMonth);
    currentDate.setMonth(currentDate.getMonth() - 1);
    this.currentMonth = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  }

  nextMonth() {
    const currentDate = new Date(this.currentMonth);
    currentDate.setMonth(currentDate.getMonth() + 1);
    this.currentMonth = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
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

  getNext24Hours(): string[] {
    const hours = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now.getTime() + i * 60 * 60 * 1000);
      hours.push(hour.getHours() + ':00');
    }
    return hours;
  }

  getTaskPosition(task: Task): string {
    const start = new Date(task.start);
    const now = new Date();
    const diffHours = (start.getTime() - now.getTime()) / (60 * 60 * 1000);
    return `${(diffHours / 24) * 100}%`;
  }

  getTaskWidth(task: Task): string {
    const start = new Date(task.start);
    const end = new Date(task.end);
    const durationHours = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
    return `${(durationHours / 24) * 100}%`;
  }

  getWeekDays(): string[] {
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    return days;
  }

  getMonthWeeks(): number[] {
    return [1, 2, 3, 4, 5];
  }

  getTaskProgress(task: Task): number {
    const start = new Date(task.start);
    const end = new Date(task.end);
    const now = new Date();
    const total = end.getTime() - start.getTime();
    const current = now.getTime() - start.getTime();
    return Math.min(100, Math.max(0, (current / total) * 100));
  }

  getTasksByEnvironment(environment: string): Task[] {
    return this.filteredTasks.filter(task => task.environment === environment);
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
    this.selectedTask = task;
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

  private getStartOfWeek(): Date {
    const today = new Date();
    const day = today.getDay() === 0 ? 7 : today.getDay(); // Domingo como 7
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  getWeekBarPosition(task: Task): string {
    const startOfWeek = this.getStartOfWeek();
    const start = new Date(task.start);
    const diff = start.getTime() - startOfWeek.getTime();
    const percent = (diff / (7 * 24 * 60 * 60 * 1000)) * 100;
    return `${Math.max(0, percent)}%`;
  }

  getWeekBarWidth(task: Task): string {
    const start = new Date(task.start);
    const end = new Date(task.end);
    const diff = end.getTime() - start.getTime();
    const percent = (diff / (7 * 24 * 60 * 60 * 1000)) * 100;
    return `${Math.max(0, percent)}%`;
  }

  private getStartOfMonth(): Date {
    const [monthName, year] = this.currentMonth.split(' ');
    const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
    const firstDay = new Date(parseInt(year, 10), monthIndex, 1);
    firstDay.setHours(0, 0, 0, 0);
    return firstDay;
  }

  getMonthBarPosition(task: Task): string {
    const startOfMonth = this.getStartOfMonth();
    const start = new Date(task.start);
    const diffDays = (start.getTime() - startOfMonth.getTime()) / (24 * 60 * 60 * 1000);
    const totalDays = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate();
    const percent = (diffDays / totalDays) * 100;
    return `${Math.max(0, percent)}%`;
  }

  getMonthBarWidth(task: Task): string {
    const start = new Date(task.start);
    const end = new Date(task.end);
    const diffDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    const totalDays = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const percent = (diffDays / totalDays) * 100;
    return `${Math.max(0, percent)}%`;
  }
} 