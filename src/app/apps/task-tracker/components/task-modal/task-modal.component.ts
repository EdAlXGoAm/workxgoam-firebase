import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';
import { MuiTimePickerComponent } from '../mui-time-picker/mui-time-picker.component';
import { PrioritySelectorComponent } from '../priority-selector/priority-selector.component';
import { AndroidDatePickerComponent } from '../android-date-picker/android-date-picker.component';

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MuiTimePickerComponent, PrioritySelectorComponent, AndroidDatePickerComponent],
  template: `
    <div *ngIf="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] md:max-h-[95vh] overflow-hidden flex flex-col">
        <div class="p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
          <div class="flex justify-between items-center">
            <h3 class="text-xl font-bold">{{ isEditing ? 'Editar Tarea' : 'Nueva Tarea' }}</h3>
            <button (click)="closeModal()" class="text-gray-500 hover:text-gray-700">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        <div class="flex-1 overflow-y-auto">
          <div class="p-4 md:p-6">
            
            <form [id]="formId" (ngSubmit)="saveTask()" class="space-y-4">
              
            <div class="grid grid-cols-2 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
                  <div class="flex">
                    <select [(ngModel)]="task.environment" (ngModelChange)="onEnvironmentChange()" name="environment" class="w-full px-3 py-2 border rounded-lg rounded-r-none bg-white">
                      <option value="">Seleccionar ambiente</option>
                      <option *ngFor="let env of environments" [value]="env.id">{{env.name}}</option>
                    </select>
                    <button type="button" (click)="openEnvironmentModal.emit()" class="px-3 py-2 bg-gray-200 border border-l-0 rounded-r-lg">
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                  <div class="flex">
                    <select [(ngModel)]="task.project" name="project" class="w-full px-3 py-2 border rounded-lg rounded-r-none bg-white" [disabled]="!task.environment || selectableProjects.length === 0">
                      <option value="">Seleccionar proyecto</option>
                      <option *ngFor="let proj of selectableProjects" [value]="proj.id">{{proj.name}}</option>
                    </select>
                    <button type="button" (click)="openProjectModal.emit()" class="px-3 py-2 bg-gray-200 border border-l-0 rounded-r-lg">
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                </div>
              </div>
              <!-- Nombre de la tarea con selector de emoji integrado -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nombre de la tarea</label>
                <div class="flex gap-2">
                  <!-- Selector de emoji compacto -->
                  <div class="relative">
                    <button 
                      type="button" 
                      (click)="toggleEmojiPicker()" 
                      class="w-12 h-11 flex items-center justify-center bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                      <span class="text-xl">{{task.emoji || '📝'}}</span>
                    </button>
                    
                    <!-- Picker de emojis mejorado -->
                    <div *ngIf="showEmojiPicker" class="emoji-picker">
                      <div class="emoji-header">
                        <span class="text-sm font-medium text-gray-600">Selecciona un emoji:</span>
                        <button 
                          type="button" 
                          (click)="showEmojiPicker = false" 
                          class="text-gray-400 hover:text-gray-600">
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                      <div class="emoji-grid">
                        <span *ngFor="let emoji of emojis" 
                              (click)="selectEmoji(emoji)" 
                              class="emoji-option"
                              [class.selected]="task.emoji === emoji">
                          {{emoji}}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Input del nombre -->
                  <div class="flex-1">
                    <input 
                      type="text" 
                      [(ngModel)]="task.name" 
                      name="name" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                      placeholder="Escribe el nombre de tu tarea..."
                      required>
                  </div>
                </div>
              </div>
              
              <div class="grid grid-cols-2 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea [(ngModel)]="task.description" name="description" rows="3" class="w-full px-3 py-2 border rounded-lg"></textarea>
              </div>
              
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <app-priority-selector
                    [(ngModel)]="task.priority"
                    name="priority">
                  </app-priority-selector>
                </div>
                
              </div>
              <!-- Sección de fechas y horas con agrupación visual -->
              <div class="grid grid-cols-2 md:grid-cols-2 gap-4">
                <!-- Fecha y hora de inicio -->
                <div class="bg-blue-50 rounded-lg border border-blue-200 p-4">
                  <div class="flex items-center mb-2">
                    <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                      <i class="fas fa-play text-white"></i>
                    </div>
                    <label class="text-sm font-medium text-gray-700">Fecha y hora de inicio</label>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pl-13">
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">FECHA</label>
                      <app-android-date-picker
                        [(ngModel)]="startDate"
                        (dateChange)="onDateChange('start', $event)"
                        name="startDate"
                        label="Fecha de inicio"
                        placeholder="Seleccionar fecha"
                        [required]="true">
                      </app-android-date-picker>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">HORA</label>
                      <app-mui-time-picker
                        [(ngModel)]="startTime"
                        (timeChange)="onStartTimeChange($event)"
                        name="startTime"
                        label="Hora de inicio"
                        placeholder="HH:MM"
                        [referenceTime]="getCurrentTime()"
                        referenceLabel="Hora actual">
                      </app-mui-time-picker>
                      <button type="button" 
                              (click)="openTimeCalculator('start')" 
                              class="mt-1 w-full px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center justify-center">
                        <i class="fas fa-calculator mr-1"></i>CALCULAR DESDE HORA DE FIN
                      </button>
                    </div>
                  </div>
                </div>
                
                <!-- Fecha y hora de fin -->
                <div class="bg-green-50 rounded-lg border border-green-200 p-4">
                  <div class="flex items-center mb-2">
                    <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-3">
                      <i class="fas fa-stop text-white"></i>
                    </div>
                    <label class="text-sm font-medium text-gray-700">Fecha y hora de fin</label>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pl-13">
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">FECHA</label>
                      <app-android-date-picker
                        [(ngModel)]="endDate"
                        (dateChange)="onDateChange('end', $event)"
                        name="endDate"
                        label="Fecha de fin"
                        placeholder="Seleccionar fecha"
                        [required]="true">
                      </app-android-date-picker>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">HORA</label>
                      <app-mui-time-picker
                        [(ngModel)]="endTime"
                        (timeChange)="onEndTimeChange($event)"
                        name="endTime"
                        label="Hora de fin"
                        placeholder="HH:MM"
                        [referenceTimes]="[
                          { time: startTime, label: 'Hora de inicio' },
                          { time: getCurrentTime(), label: 'Hora actual' }
                        ]">
                      </app-mui-time-picker>
                      <button type="button" 
                              (click)="openTimeCalculator('end')" 
                              class="mt-1 w-full px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors flex items-center justify-center">
                        <i class="fas fa-calculator mr-1"></i>CALCULAR DESDE HORA DE INICIO
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                     
                <div>
                  <!-- Botón para mostrar/ocultar fecha límite -->
                  <div class="flex justify-center">
                    <button type="button" 
                            (click)="toggleDeadlineSection()" 
                            class="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center"
                            [class]="showDeadlineSection ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'">
                      <i class="fas mr-2" [class]="showDeadlineSection ? 'fa-calendar-times' : 'fa-calendar-plus'"></i>
                      {{ showDeadlineSection ? 'Ocultar fecha límite' : 'Agregar fecha límite' }}
                    </button>
                  </div>
                  
                  <!-- Fecha límite de fin -->
                  <div *ngIf="showDeadlineSection" class="bg-orange-50 rounded-lg border border-orange-200 p-4">
                    <div class="flex items-center mb-2">
                      <div class="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mr-3">
                        <i class="fas fa-flag-checkered text-white"></i>
                      </div>
                      <label class="text-sm font-medium text-gray-700">Fecha límite de fin</label>
                    </div>
                    <div class="grid grid-cols-2 gap-2 pl-13">
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">FECHA</label>
                        <app-android-date-picker
                          [(ngModel)]="deadlineDate"
                          (dateChange)="onDateChange('deadline', $event)"
                          name="deadlineDate"
                          label="Fecha límite"
                          placeholder="Seleccionar fecha límite">
                        </app-android-date-picker>
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">HORA</label>
                        <app-mui-time-picker
                          [(ngModel)]="deadlineTime"
                          (timeChange)="onDeadlineTimeChange($event)"
                          name="deadlineTime"
                          label="Hora límite"
                          placeholder="HH:MM">
                        </app-mui-time-picker>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Duración estimada (horas)</label>
                    <input type="number" [(ngModel)]="task.duration" name="duration" min="0" step="0.5" class="w-full px-3 py-2 border rounded-lg">
                  </div>
              </div>
              
              
              <div class="grid grid-cols-1 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Recordatorios</label>
                  
                  <!-- Vista no editable de recordatorios -->
                  <div class="bg-gray-50 rounded-lg p-4 mb-3">
                    <div *ngIf="!task.reminders || task.reminders.length === 0" class="text-center text-gray-500 py-4">
                      <i class="fas fa-bell-slash text-2xl mb-2"></i>
                      <p>No hay recordatorios configurados</p>
                    </div>
                    
                    <div *ngIf="task.reminders && task.reminders.length > 0" class="space-y-4">
                      <!-- Tabla de recordatorios categorizados -->
                      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        
                        <!-- Antes del inicio -->
                        <div class="bg-white rounded-lg p-3 border">
                          <h4 class="font-medium text-indigo-600 mb-2 text-center">
                            <i class="fas fa-clock mr-1"></i>
                            Antes del Inicio
                          </h4>
                          <div class="space-y-1">
                            <div *ngFor="let item of currentCategorizedReminders.beforeStart" 
                                 class="text-xs p-2 bg-indigo-50 rounded border-l-2 border-indigo-300">
                              <div class="font-medium">{{ item.description }}</div>
                              <div class="text-gray-600">{{ formatReminderDateTime(item.reminder) }}</div>
                            </div>
                            <div *ngIf="currentCategorizedReminders.beforeStart.length === 0" 
                                 class="text-center text-gray-400 py-2">
                              No hay recordatorios antes del inicio
                            </div>
                          </div>
                        </div>
                        
                        <!-- Durante el evento -->
                        <div class="bg-white rounded-lg p-3 border">
                          <h4 class="font-medium text-green-600 mb-2 text-center">
                            <i class="fas fa-play-circle mr-1"></i>
                            Durante el Evento
                          </h4>
                          <div class="space-y-1">
                            <div *ngFor="let item of currentCategorizedReminders.duringEvent" 
                                 class="text-xs p-2 bg-green-50 rounded border-l-2 border-green-300">
                              <div class="font-medium">{{ item.description }}</div>
                              <div class="text-gray-600">{{ formatReminderDateTime(item.reminder) }}</div>
                            </div>
                            <div *ngIf="currentCategorizedReminders.duringEvent.length === 0" 
                                 class="text-center text-gray-400 py-2">
                              No hay recordatorios durante el evento
                            </div>
                          </div>
                        </div>
                        
                        <!-- Antes/Después del límite -->
                        <div class="bg-white rounded-lg p-3 border" *ngIf="getTaskReferenceDates().deadline">
                          <h4 class="font-medium text-amber-600 mb-2 text-center">
                            <i class="fas fa-flag-checkered mr-1"></i>
                            Antes/Después del Límite
                          </h4>
                          <div class="space-y-1">
                            <!-- Recordatorios antes del límite -->
                            <div *ngFor="let item of currentCategorizedReminders.beforeDeadline" 
                                 class="text-xs p-2 bg-amber-50 rounded border-l-2 border-amber-300">
                              <div class="font-medium">{{ item.description }}</div>
                              <div class="text-gray-600">{{ formatReminderDateTime(item.reminder) }}</div>
                            </div>
                            <!-- Recordatorios después del límite -->
                            <div *ngFor="let item of currentCategorizedReminders.afterDeadline" 
                                 class="text-xs p-2 bg-red-50 rounded border-l-2 border-red-300">
                              <div class="font-medium">{{ item.description }}</div>
                              <div class="text-gray-600">{{ formatReminderDateTime(item.reminder) }}</div>
                            </div>
                            <div *ngIf="currentCategorizedReminders.beforeDeadline.length === 0 && currentCategorizedReminders.afterDeadline.length === 0" 
                                 class="text-center text-gray-400 py-2">
                              No hay recordatorios relacionados con la fecha límite
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Resumen -->
                      <div class="text-center text-gray-600 text-sm">
                        Total: {{ task.reminders.length }} recordatorio{{ task.reminders.length !== 1 ? 's' : '' }}
                      </div>
                    </div>
                  <!-- Botón para editar recordatorios -->
                  <div class="flex justify-end">
                    <button type="button" 
                            (click)="prepareTaskDatesForReminders(); openRemindersModal.emit()" 
                            class="w-1/3 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                      <i class="fas fa-edit mr-2"></i>Editar Recordatorios
                    </button>
                  </div>
                  </div>
                  
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Fragmentos (Pausas)</label>
                  <div #fragmentsContainer class="space-y-2">
                    <div *ngFor="let fragment of task.fragments; let i = index" class="fragment-item bg-gray-100 p-3 rounded-lg">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                        <div>
                          <label class="block text-xs font-medium text-gray-500 mb-1">Inicio</label>
                          <input type="datetime-local" [(ngModel)]="task.fragments![i].start" class="w-full px-3 py-2 border rounded-lg text-sm">
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-gray-500 mb-1">Fin</label>
                          <input type="datetime-local" [(ngModel)]="task.fragments![i].end" class="w-full px-3 py-2 border rounded-lg text-sm">
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
              </div>
              
              <!-- Mensaje de error para validación de fechas -->
              <div *ngIf="dateError" class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div class="flex items-center">
                  <i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>
                  <span class="text-red-600 text-sm font-medium">{{ dateError }}</span>
                </div>
              </div>
            </form>
          </div>
        </div>
        
        <!-- Botones fijos al final -->
        <div class="p-4 md:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div class="flex justify-end space-x-3">
            <button type="button" (click)="closeModal()" class="px-4 py-2 border rounded-lg font-medium">
              Cancelar
            </button>
            <button type="submit" 
                    [attr.form]="formId"
                    [disabled]="!isFormValid()" 
                    [class.opacity-50]="!isFormValid()"
                    [class.cursor-not-allowed]="!isFormValid()"
                    class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:hover:bg-indigo-600">
              {{ isEditing ? 'Guardar Cambios' : 'Guardar Tarea' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Modal de confirmación para mantener duración -->
    <div *ngIf="showDurationConfirmModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
            <i class="fas fa-clock text-blue-600 text-xl"></i>
          </div>
          <h3 class="text-lg font-bold text-gray-900">¿Mantener duración de la tarea?</h3>
        </div>
        
        <div class="mb-6">
          <p class="text-gray-600 mb-3">
            Has modificado la fecha/hora de inicio. La duración actual de la tarea es de 
            <span class="font-semibold text-indigo-600">{{ formatDuration(task.duration || 0) }}</span>.
          </p>
          <p class="text-gray-600">
            ¿Deseas ajustar automáticamente la fecha/hora de fin para mantener esta duración?
          </p>
          <div *ngIf="task.reminders && task.reminders.length > 0" class="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p class="text-amber-800 text-sm">
              <i class="fas fa-bell mr-1"></i>
              <strong>Nota:</strong> Los {{ task.reminders.length }} recordatorio{{ task.reminders.length !== 1 ? 's' : '' }} 
              configurados se ajustarán automáticamente con el cambio de fecha/hora de inicio.
            </p>
          </div>
        </div>
        
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Nueva fecha/hora de inicio:</span>
              <span class="font-medium">{{ formatDateTime(pendingStartDate, pendingStartTime) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Fecha/hora de fin actual:</span>
              <span class="font-medium">{{ formatDateTime(endDate, endTime) }}</span>
            </div>
            <div class="flex justify-between text-indigo-600">
              <span>Nueva fecha/hora de fin (si mantiene duración):</span>
              <span class="font-medium">{{ formatDateTime(calculatedEndDate, calculatedEndTime) }}</span>
            </div>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3">
          <button type="button" 
                  (click)="cancelDurationAdjustment()" 
                  class="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            No, mantener fecha de fin actual
          </button>
          <button type="button" 
                  (click)="confirmDurationAdjustment()" 
                  class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            Sí, ajustar fecha de fin
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .emoji-picker {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 8px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 0;
      width: 288px;
      max-height: 320px;
      overflow: hidden;
      z-index: 1000;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
    }
    
    .emoji-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
      background: #f9fafb;
      border-radius: 12px 12px 0 0;
      flex-shrink: 0;
    }
    
    .emoji-grid {
      padding: 16px;
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      max-height: 240px;
      overflow-y: auto;
      overflow-x: hidden;
    }
    
    .emoji-option {
      font-size: 24px;
      padding: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all 0.2s ease;
      aspect-ratio: 1;
      min-width: 0;
    }
    
    .emoji-option:hover {
      background-color: #f3f4f6;
      transform: scale(1.1);
    }
    
    .emoji-option.selected {
      background-color: #dbeafe;
      border: 2px solid #3b82f6;
    }
    
    /* Responsive para móviles */
    @media (max-width: 768px) {
      .emoji-picker {
        width: 252px;
        left: -20px;
        max-height: 280px;
      }
      
      .emoji-grid {
        grid-template-columns: repeat(5, 1fr);
        padding: 12px;
        gap: 6px;
        max-height: 200px;
      }
      
      .emoji-option {
        font-size: 20px;
        padding: 6px;
      }
      
      .emoji-header {
        padding: 10px 12px;
      }
    }
    
    /* Para pantallas muy pequeñas */
    @media (max-width: 360px) {
      .emoji-picker {
        left: 0;
        width: 240px;
      }
      
      .emoji-grid {
        grid-template-columns: repeat(5, 1fr);
        padding: 10px;
        gap: 4px;
      }
      
      .emoji-option {
        font-size: 18px;
        padding: 4px;
      }
    }
  `]
})
export class TaskModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() showModal = false;
  @Input() task: Partial<Task> = {};
  @Input() isEditing = false;
  @Input() environments: Environment[] = [];
  @Input() projects: Project[] = [];
  
  @Output() closeModalEvent = new EventEmitter<void>();
  @Output() saveTaskEvent = new EventEmitter<Partial<Task>>();
  @Output() openEnvironmentModal = new EventEmitter<void>();
  @Output() openProjectModal = new EventEmitter<void>();
  @Output() openRemindersModal = new EventEmitter<void>();
  @Output() openCalculatorModal = new EventEmitter<{type: 'start' | 'end'}>();
  
  // Date/time fields
  startDate = '';
  startTime = '';
  endDate = '';
  endTime = '';
  deadlineDate = '';
  deadlineTime = '';
  
  // UI state
  showEmojiPicker = false;
  showDeadlineSection = false;
  dateError = '';
  selectableProjects: Project[] = [];
  
  // Modal de confirmación de duración
  showDurationConfirmModal = false;
  pendingStartDate = '';
  pendingStartTime = '';
  calculatedEndDate = '';
  calculatedEndTime = '';
  previousStartDate = '';
  previousStartTime = '';
  
  // Fechas originales para calcular el desplazamiento de recordatorios
  originalStartDateTime: Date | null = null;
  originalEndDateTime: Date | null = null;
  
  emojis = ['📝', '⏰', '✅', '🛏️', '🍔', 
            '😀', '😊', '😎', '🤩', '😍', '🤔', '😴', '🥳', '😇', '🤯', 
            '📅', '📌', '🔑', '📚', '💻', '📱', '🔋',
            '🏋️', '🚴', '🚗', '🍎', '🍕', '🛒', '☕', '🍷', '🎵', '🎮', '🎨', '✈️'];

  constructor(private cdr: ChangeDetectorRef) {}

  get formId(): string {
    return this.isEditing ? 'editTaskForm' : 'newTaskForm';
  }
  
  ngOnInit() {
    this.initializeDateTimeFields();
    this.onEnvironmentChange();
    this.checkIfDeadlineExists();
    // Guardar los valores iniciales de fecha/hora de inicio
    this.previousStartDate = this.startDate;
    this.previousStartTime = this.startTime;
    
    // Guardar las fechas originales para el desplazamiento de recordatorios
    if (this.task.start) {
      this.originalStartDateTime = new Date(this.task.start + (this.task.start.includes('Z') ? '' : 'Z'));
    }
    if (this.task.end) {
      this.originalEndDateTime = new Date(this.task.end + (this.task.end.includes('Z') ? '' : 'Z'));
    }
  }
  
  ngOnDestroy() {
    // Asegurar que el scroll se desbloquee al destruir el componente
    this.enableBodyScroll();
  }
  
  ngOnChanges() {
    if (this.showModal) {
      this.disableBodyScroll();
    } else {
      this.enableBodyScroll();
    }
  }
  
  private disableBodyScroll() {
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = this.getScrollbarWidth() + 'px';
  }
  
  private enableBodyScroll() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
  
  private getScrollbarWidth(): number {
    // Crear un div invisible para medir el ancho del scrollbar
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    (outer.style as any).msOverflowStyle = 'scrollbar';
    document.body.appendChild(outer);

    const inner = document.createElement('div');
    outer.appendChild(inner);

    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    outer.parentNode?.removeChild(outer);

    return scrollbarWidth;
  }
  
  private initializeDateTimeFields() {
    if (this.task.start) {
      const startDateTime = this.splitDateTime(this.task.start);
      this.startDate = startDateTime.date;
      this.startTime = startDateTime.time;
    }
    
    if (this.task.end) {
      const endDateTime = this.splitDateTime(this.task.end);
      this.endDate = endDateTime.date;
      this.endTime = endDateTime.time;
    }
    
    if (this.task.deadline) {
      const deadlineDateTime = this.splitDateTime(this.task.deadline);
      this.deadlineDate = deadlineDateTime.date;
      this.deadlineTime = deadlineDateTime.time;
    }
  }
  
  closeModal() {
    this.enableBodyScroll();
    this.closeModalEvent.emit();
  }
  
  saveTask() {
    if (!this.isFormValid()) return;
    
    // Update task with combined date/time values
    this.task.start = this.combineDateTime(this.startDate, this.startTime);
    this.task.end = this.combineDateTime(this.endDate, this.endTime);
    this.task.deadline = this.deadlineDate && this.deadlineTime 
      ? this.combineDateTime(this.deadlineDate, this.deadlineTime) 
      : null;
    
    this.saveTaskEvent.emit(this.task);
  }
  
  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }
  
  selectEmoji(emoji: string) {
    this.task.emoji = emoji;
    this.showEmojiPicker = false;
  }
  
  onEnvironmentChange() {
    if (this.task.environment) {
      this.selectableProjects = this.projects.filter(p => p.environment === this.task.environment);
    } else {
      this.selectableProjects = [];
    }
    if (!this.selectableProjects.find(p => p.id === this.task.project)) {
      this.task.project = '';
    }
  }
  
  onDateChange(field: 'start' | 'end' | 'deadline', date: string) {
    if (field === 'start' && this.shouldShowDurationConfirmModal()) {
      // Guardar los valores pendientes
      this.pendingStartDate = date;
      this.pendingStartTime = this.startTime;
      
      // Calcular la nueva fecha/hora de fin manteniendo la duración
      const newEndDateTime = this.calculateNewEndDateTime(date, this.startTime, this.task.duration || 0);
      this.calculatedEndDate = newEndDateTime.date;
      this.calculatedEndTime = newEndDateTime.time;
      
      // Mostrar el modal
      this.showDurationConfirmModal = true;
    } else {
      // Comportamiento normal para otros campos
      if (field === 'start') {
        this.startDate = date;
        // Si no se muestra el modal, ajustar recordatorios directamente
        if (!this.shouldShowDurationConfirmModal() && this.task.reminders && this.task.reminders.length > 0) {
          this.adjustReminders(date, this.startTime, this.endDate, this.endTime);
        }
      } else if (field === 'end') {
        this.endDate = date;
      }
      this.updateDuration();
      this.validateDates();
    }
  }
  
  onStartTimeChange(time: string) {
    if (this.shouldShowDurationConfirmModal()) {
      // Guardar los valores pendientes
      this.pendingStartDate = this.startDate;
      this.pendingStartTime = time;
      
      // Calcular la nueva fecha/hora de fin manteniendo la duración
      const newEndDateTime = this.calculateNewEndDateTime(this.startDate, time, this.task.duration || 0);
      this.calculatedEndDate = newEndDateTime.date;
      this.calculatedEndTime = newEndDateTime.time;
      
      // Mostrar el modal
      this.showDurationConfirmModal = true;
    } else {
      // Comportamiento normal
      this.startTime = time;
      // Si no se muestra el modal, ajustar recordatorios directamente
      if (!this.shouldShowDurationConfirmModal() && this.task.reminders && this.task.reminders.length > 0 && this.startDate) {
        this.adjustReminders(this.startDate, time, this.endDate, this.endTime);
      }
      this.updateDuration();
      this.validateDates();
    }
  }
  
  onEndTimeChange(time: string) {
    this.endTime = time;
    this.updateDuration();
    this.validateDates();
  }
  
  onDeadlineTimeChange(time: string) {
    this.deadlineTime = time;
  }
  
  private updateDuration() {
    const duration = this.calculateDuration(this.startDate, this.startTime, this.endDate, this.endTime);
    this.task.duration = duration;
  }
  
  private validateDates(): boolean {
    this.dateError = '';
    
    if (!this.startDate || !this.startTime || !this.endDate || !this.endTime) {
      return true;
    }
    
    const startDateTime = new Date(`${this.startDate}T${this.startTime}`);
    const endDateTime = new Date(`${this.endDate}T${this.endTime}`);
    
    if (endDateTime <= startDateTime) {
      this.dateError = 'La fecha de fin debe ser posterior a la fecha de inicio';
      return false;
    }
    
    return true;
  }
  
  isFormValid(): boolean {
    return this.validateDates() && 
           !!this.task.name && 
           !!this.startDate && 
           !!this.startTime && 
           !!this.endDate && 
           !!this.endTime;
  }
  
  getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  addFragment() {
    if (!this.task.fragments) {
      this.task.fragments = [];
    }
    const now = new Date();
    const startTime = new Date(now.getTime() + 30 * 60000);
    const endTime = new Date(startTime.getTime() + 60 * 60000);
    
    this.task.fragments.push({
      start: this.formatDateTimeLocal(startTime),
      end: this.formatDateTimeLocal(endTime)
    });
  }
  
  removeFragment(index: number) {
    if (this.task.fragments) {
      this.task.fragments.splice(index, 1);
    }
  }
  
  openTimeCalculator(type: 'start' | 'end') {
    this.openCalculatorModal.emit({ type });
  }
  
  // Métodos de utilidad
  private combineDateTime(date: string, time: string): string {
    if (!date || !time) return '';
    const [hours, minutes] = time.split(':');
    
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(5, 7)) - 1;
    const day = parseInt(date.substring(8, 10));
    
    const dateTime = new Date(year, month, day, parseInt(hours), parseInt(minutes), 0, 0);
    
    return dateTime.toISOString().slice(0, 16);
  }
  
  private splitDateTime(dateTimeString: string): { date: string, time: string } {
    if (!dateTimeString) return { date: '', time: '' };
    
    const dateTime = new Date(dateTimeString + (dateTimeString.includes('Z') ? '' : 'Z'));
    
    const year = dateTime.getFullYear();
    const month = String(dateTime.getMonth() + 1).padStart(2, '0');
    const day = String(dateTime.getDate()).padStart(2, '0');
    const hours = String(dateTime.getHours()).padStart(2, '0');
    const minutes = String(dateTime.getMinutes()).padStart(2, '0');
    
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`
    };
  }
  
  private formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  
  private calculateDuration(startDate: string, startTime: string, endDate: string, endTime: string): number {
    if (!startDate || !startTime || !endDate || !endTime) {
      return 0;
    }
    
    try {
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      const startDateTime = new Date(startDate);
      startDateTime.setHours(startHours, startMinutes, 0, 0);
      
      const endDateTime = new Date(endDate);
      endDateTime.setHours(endHours, endMinutes, 0, 0);
      
      const diffMs = endDateTime.getTime() - startDateTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      return Math.max(0, Math.round(diffHours * 100) / 100);
    } catch (error) {
      console.error('Error calculating duration:', error);
      return 0;
    }
  }
  
  getTaskReferenceDates() {
    // Usar las fechas actuales del formulario, no las originales de la tarea
    return {
      start: this.combineDateTime(this.startDate, this.startTime),
      end: this.combineDateTime(this.endDate, this.endTime),
      deadline: this.deadlineDate && this.deadlineTime 
        ? this.combineDateTime(this.deadlineDate, this.deadlineTime) 
        : null
    };
  }
  
  get currentCategorizedReminders(): {
    beforeStart: Array<{ reminder: string; index: number; description: string }>;
    duringEvent: Array<{ reminder: string; index: number; description: string }>;
    beforeDeadline: Array<{ reminder: string; index: number; description: string }>;
    afterDeadline: Array<{ reminder: string; index: number; description: string }>;
  } {
    const reminders = this.task.reminders || [];
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

  private generateReminderDescription(reminderDate: Date, dates: any): string {
    // Asegurar que todas las fechas se interpreten como UTC
    const startDate = dates.start ? new Date(dates.start + (dates.start.includes('Z') ? '' : 'Z')) : null;
    const endDate = dates.end ? new Date(dates.end + (dates.end.includes('Z') ? '' : 'Z')) : null;
    const deadlineDate = dates.deadline ? new Date(dates.deadline + (dates.deadline.includes('Z') ? '' : 'Z')) : null;

    // Función helper para comparar fechas (considerando diferencias menores a 1 minuto como iguales)
    const isSameTime = (date1: Date, date2: Date): boolean => {
      return Math.abs(date1.getTime() - date2.getTime()) < 60000; // Menos de 1 minuto
    };

    // Verificar si coincide exactamente con alguna fecha del evento
    if (startDate && isSameTime(reminderDate, startDate)) {
      return '🎯 Al inicio';
    }
    
    if (endDate && isSameTime(reminderDate, endDate)) {
      return '🏁 Al final';
    }
    
    if (deadlineDate && isSameTime(reminderDate, deadlineDate)) {
      return '⏰ Al límite';
    }

    // Lógica existente para recordatorios que no coinciden exactamente
    if (deadlineDate && endDate && reminderDate > endDate) {
      if (reminderDate <= deadlineDate) {
        const diffMinutes = Math.floor((deadlineDate.getTime() - reminderDate.getTime()) / (1000 * 60));
        return this.formatTimeDifference(diffMinutes, 'antes del límite');
      } else {
        const diffMinutes = Math.floor((reminderDate.getTime() - deadlineDate.getTime()) / (1000 * 60));
        return this.formatTimeDifference(diffMinutes, 'después del límite');
      }
    }
    
    if (startDate && reminderDate < startDate) {
      const diffMinutes = Math.floor((startDate.getTime() - reminderDate.getTime()) / (1000 * 60));
      return this.formatTimeDifference(diffMinutes, 'antes del inicio');
    } else if (endDate && reminderDate > endDate && !deadlineDate) {
      const diffMinutes = Math.floor((reminderDate.getTime() - endDate.getTime()) / (1000 * 60));
      return this.formatTimeDifference(diffMinutes, 'después del final');
    } else if (startDate && endDate && reminderDate >= startDate && reminderDate <= endDate) {
      // Recordatorio durante el evento (entre inicio y final)
      const diffMinutes = Math.floor((reminderDate.getTime() - startDate.getTime()) / (1000 * 60));
      if (diffMinutes === 0) {
        return '🎯 Al inicio';
      } else {
        return this.formatTimeDifference(diffMinutes, 'después del inicio');
      }
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
  
  formatReminderDateTime(dateTimeString: string): string {
    const utcString = dateTimeString.includes('Z') || dateTimeString.includes('+') 
      ? dateTimeString 
      : dateTimeString + 'Z';
    
    const date = new Date(utcString);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Mexico_City'
    });
  }
  
  toggleDeadlineSection() {
    this.showDeadlineSection = !this.showDeadlineSection;
    // Si se oculta la sección, limpiar los valores de fecha límite
    if (!this.showDeadlineSection) {
      this.deadlineDate = '';
      this.deadlineTime = '';
      this.task.deadline = null;
    }
  }
  
  private checkIfDeadlineExists() {
    // Si la tarea ya tiene una fecha límite, mostrar la sección
    if (this.task.deadline) {
      this.showDeadlineSection = true;
    }
  }
  
  // Métodos para el modal de confirmación de duración
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
  
  formatDateTime(date: string, time: string): string {
    if (!date || !time) return 'No definida';
    
    const dateTime = new Date(`${date}T${time}`);
    return dateTime.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
  
  cancelDurationAdjustment() {
    // Cerrar el modal sin hacer cambios
    this.showDurationConfirmModal = false;
    // Aplicar los cambios de fecha/hora de inicio sin ajustar el fin
    this.startDate = this.pendingStartDate;
    this.startTime = this.pendingStartTime;
    // Ajustar los recordatorios con el nuevo inicio
    this.adjustReminders(this.pendingStartDate, this.pendingStartTime, this.endDate, this.endTime);
    // Recalcular la duración con las nuevas fechas
    this.updateDuration();
    this.validateDates();
  }
  
  confirmDurationAdjustment() {
    // Aplicar los cambios manteniendo la duración
    this.showDurationConfirmModal = false;
    this.startDate = this.pendingStartDate;
    this.startTime = this.pendingStartTime;
    this.endDate = this.calculatedEndDate;
    this.endTime = this.calculatedEndTime;
    // Ajustar los recordatorios con el nuevo inicio
    this.adjustReminders(this.pendingStartDate, this.pendingStartTime, this.calculatedEndDate, this.calculatedEndTime);
    // La duración se mantiene igual
    this.validateDates();
  }
  
  private calculateNewEndDateTime(newStartDate: string, newStartTime: string, duration: number): { date: string, time: string } {
    if (!newStartDate || !newStartTime || !duration) {
      return { date: '', time: '' };
    }
    
    const startDateTime = new Date(`${newStartDate}T${newStartTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);
    
    return this.splitDateTime(endDateTime.toISOString());
  }
  
  private shouldShowDurationConfirmModal(): boolean {
    // Mostrar el modal solo si:
    // 1. Ya hay una duración definida mayor a 0
    // 2. Ya hay fecha/hora de inicio y fin definidas
    // 3. No es la primera vez que se está configurando (es decir, estamos editando)
    return (this.task.duration || 0) > 0 && 
           !!this.startDate && !!this.startTime && 
           !!this.endDate && !!this.endTime &&
           (this.isEditing || (!!this.previousStartDate && !!this.previousStartTime));
  }
  
  private adjustReminders(newStartDate: string, newStartTime: string, newEndDate: string, newEndTime: string) {
    if (!this.task.reminders || this.task.reminders.length === 0) return;
    if (!this.originalStartDateTime) return;
    
    // Calcular el desplazamiento en milisegundos basado en el cambio de fecha de inicio
    const newStart = new Date(`${newStartDate}T${newStartTime}`);
    const offset = newStart.getTime() - this.originalStartDateTime.getTime();
    
    // Ajustar cada recordatorio con el mismo desplazamiento
    this.task.reminders = this.task.reminders.map(reminderStr => {
      const reminderDate = new Date(reminderStr + (reminderStr.includes('Z') ? '' : 'Z'));
      const adjustedDate = new Date(reminderDate.getTime() + offset);
      return adjustedDate.toISOString().slice(0, 16);
    });
    
    // Actualizar la fecha de inicio original para futuros ajustes
    this.originalStartDateTime = newStart;
    
    // Forzar la actualización de la vista para recalcular las descripciones
    this.cdr.detectChanges();
  }
  
  // Preparo los campos de fecha/hora antes de abrir el modal de recordatorios
  prepareTaskDatesForReminders() {
    this.task.start = this.combineDateTime(this.startDate, this.startTime);
    this.task.end = this.combineDateTime(this.endDate, this.endTime);
    this.task.deadline = this.deadlineDate && this.deadlineTime ? this.combineDateTime(this.deadlineDate, this.deadlineTime) : null;
  }
} 