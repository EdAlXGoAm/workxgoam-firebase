import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { AndroidDatePickerComponent } from '../android-date-picker/android-date-picker.component';
import { MuiTimePickerComponent } from '../mui-time-picker/mui-time-picker.component';

@Component({
  selector: 'app-reminders-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AndroidDatePickerComponent, MuiTimePickerComponent],
  template: `
    <div *ngIf="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="bg-indigo-600 text-white p-6 flex-shrink-0">
          <div class="flex justify-between items-center">
            <div class="flex-1">
              <h2 class="text-2xl font-bold mb-3">Gestión de Recordatorios</h2>
              <!-- Fechas del evento en el header -->
              <div class="space-y-2">
                <div class="flex justify-between items-center py-1.5 px-3 bg-indigo-500 bg-opacity-60 rounded border border-indigo-400">
                  <span class="text-sm font-medium text-indigo-100">📅 Inicio:</span>
                  <span class="font-medium text-white">{{ taskDates.start ? formatReminderDateTime(taskDates.start) : 'No establecido' }}</span>
                </div>
                <div class="flex justify-between items-center py-1.5 px-3 bg-indigo-500 bg-opacity-60 rounded border border-indigo-400">
                  <span class="text-sm font-medium text-indigo-100">🏁 Final:</span>
                  <span class="font-medium text-white">{{ taskDates.end ? formatReminderDateTime(taskDates.end) : 'No establecido' }}</span>
                </div>
                <div class="flex justify-between items-center py-1.5 px-3 bg-indigo-500 bg-opacity-60 rounded border border-indigo-400">
                  <span class="text-sm font-medium text-indigo-100">⏰ Límite:</span>
                  <span class="font-medium text-white">{{ taskDates.deadline ? formatReminderDateTime(taskDates.deadline) : 'Sin límite' }}</span>
                </div>
              </div>
            </div>
            <button (click)="closeModal()" class="text-white hover:text-indigo-200 transition ml-4">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>
        
        <!-- Modal Body -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- Opciones para agregar recordatorios -->
          <div class="mb-6">
            <h3 class="font-medium text-gray-700 mb-4">Agregar nuevo recordatorio:</h3>
            
            <!-- Layout con sidebar -->
            <div class="flex gap-3 md:gap-6">
              <!-- Sidebar con opciones -->
              <div [class]="'flex-shrink-0 transition-all duration-300 ' + 
                          (sidebarExpanded ? 'w-64' : 'w-16') + ' md:w-64'">
                <!-- Botón toggle solo visible en móviles -->
                <div class="mb-3 md:hidden">
                  <button 
                    (click)="toggleSidebar()"
                    class="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors">
                    <i class="fas" [class.fa-chevron-right]="!sidebarExpanded" [class.fa-chevron-left]="sidebarExpanded"></i>
                    <span *ngIf="sidebarExpanded" class="ml-2">Contraer</span>
                  </button>
                </div>
                
                <nav class="space-y-2">
                  <button 
                    (click)="setActiveTab('relative')"
                    [class]="'w-full flex items-center text-sm font-medium rounded-lg transition-colors ' + 
                             (sidebarExpanded ? 'px-4 py-3' : 'px-3 py-3 justify-center md:px-4 md:justify-start') + ' ' +
                             (activeTab === 'relative' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 border' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent')"
                    [title]="!sidebarExpanded ? 'Relativo a fechas del evento' : ''">
                    <span class="text-lg" [class.mr-3]="sidebarExpanded">📅</span>
                    <span *ngIf="sidebarExpanded" class="md:inline">Relativo a fechas del evento</span>
                    <span class="hidden md:inline" *ngIf="!sidebarExpanded">Relativo a fechas del evento</span>
                  </button>
                  
                  <button 
                    (click)="setActiveTab('now')"
                    [class]="'w-full flex items-center text-sm font-medium rounded-lg transition-colors ' + 
                             (sidebarExpanded ? 'px-4 py-3' : 'px-3 py-3 justify-center md:px-4 md:justify-start') + ' ' +
                             (activeTab === 'now' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 border' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent')"
                    [title]="!sidebarExpanded ? 'Desde ahora' : ''">
                    <span class="text-lg" [class.mr-3]="sidebarExpanded">⏰</span>
                    <span *ngIf="sidebarExpanded" class="md:inline">Desde ahora</span>
                    <span class="hidden md:inline" *ngIf="!sidebarExpanded">Desde ahora</span>
                  </button>
                  
                  <button 
                    (click)="setActiveTab('ai')"
                    [class]="'w-full flex items-center text-sm font-medium rounded-lg transition-colors ' + 
                             (sidebarExpanded ? 'px-4 py-3' : 'px-3 py-3 justify-center md:px-4 md:justify-start') + ' ' +
                             (activeTab === 'ai' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 border' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent')"
                    [title]="!sidebarExpanded ? 'Con IA (lenguaje natural)' : ''">
                    <span class="text-lg" [class.mr-3]="sidebarExpanded">🤖</span>
                    <span *ngIf="sidebarExpanded" class="md:inline">Con IA (lenguaje natural)</span>
                    <span class="hidden md:inline" *ngIf="!sidebarExpanded">Con IA (lenguaje natural)</span>
                  </button>
                  
                  <button 
                    (click)="setActiveTab('manual')"
                    [class]="'w-full flex items-center text-sm font-medium rounded-lg transition-colors ' + 
                             (sidebarExpanded ? 'px-4 py-3' : 'px-3 py-3 justify-center md:px-4 md:justify-start') + ' ' +
                             (activeTab === 'manual' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 border' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent')"
                    [title]="!sidebarExpanded ? 'Fecha y hora manual' : ''">
                    <span class="text-lg" [class.mr-3]="sidebarExpanded">✏️</span>
                    <span *ngIf="sidebarExpanded" class="md:inline">Fecha y hora manual</span>
                    <span class="hidden md:inline" *ngIf="!sidebarExpanded">Fecha y hora manual</span>
                  </button>
                </nav>
              </div>
              
              <!-- Contenido principal -->
              <div class="flex-1 min-w-0">
                <div class="bg-white border rounded-lg p-4 md:p-6 shadow-sm">
                  
                  <!-- Tab: Relativo a fechas -->
                  <div *ngIf="activeTab === 'relative'">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                      <span class="text-lg mr-2">📅</span>
                      Recordatorio relativo a fechas del evento
                    </h4>
                    
                    <!-- Selector de referencia mejorado -->
                    <div class="mb-4">
                      <label class="block text-sm font-medium text-gray-700 mb-2">Fecha de referencia:</label>
                      <select [(ngModel)]="relativeReference" 
                              class="w-full px-4 py-3 text-base rounded-lg border-2 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 bg-white transition-colors appearance-none cursor-pointer">
                        <option value="start">📅 Hora de inicio</option>
                        <option value="end">🏁 Hora de finalización</option>
                        <option value="deadline" *ngIf="taskDates.deadline">⏰ Hora límite</option>
                      </select>
                    </div>
                    
                    <!-- Selector de dirección como botones toggle -->
                    <div class="mb-4">
                      <label class="block text-sm font-medium text-gray-700 mb-2">Momento del recordatorio:</label>
                      <div class="flex rounded-lg border-2 border-gray-300 overflow-hidden">
                        <button 
                          type="button"
                          (click)="relativeDirection = 'before'"
                          [class]="'flex-1 px-4 py-3 text-base font-medium transition-colors ' + 
                                   (relativeDirection === 'before' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')">
                          ⬅️ Antes
                        </button>
                        <button 
                          type="button"
                          (click)="relativeDirection = 'during'"
                          [class]="'flex-1 px-4 py-3 text-base font-medium transition-colors border-l-2 border-r-2 border-gray-300 ' + 
                                   (relativeDirection === 'during' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')">
                          🎯 Durante
                        </button>
                        <button 
                          type="button"
                          (click)="relativeDirection = 'after'"
                          [class]="'flex-1 px-4 py-3 text-base font-medium transition-colors ' + 
                                   (relativeDirection === 'after' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')">
                          ➡️ Después
                        </button>
                      </div>
                    </div>
                    
                    <!-- Input de tiempo mejorado - solo visible si no es "durante" -->
                    <div class="mb-4" *ngIf="relativeDirection !== 'during'">
                      <label class="block text-sm font-medium text-gray-700 mb-2">Cantidad de tiempo:</label>
                      <input 
                        type="text" 
                        [(ngModel)]="relativeTime"
                        class="w-full px-4 py-3 text-base rounded-lg border-2 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors" 
                        placeholder="Ej: 15, 2h, 30m, 1h30m">
                    </div>
                    
                    <div *ngIf="relativeError" class="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                      <i class="fas fa-exclamation-triangle mr-2"></i>{{ relativeError }}
                    </div>
                    <button (click)="addRelativeReminder()" 
                            class="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition text-base font-medium shadow-sm">
                      <i class="fas fa-plus mr-2"></i>Agregar Recordatorio
                    </button>
                  </div>
                  
                  <!-- Tab: Desde ahora -->
                  <div *ngIf="activeTab === 'now'">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                      <span class="text-lg mr-2">⏰</span>
                      Recordatorio desde ahora
                    </h4>
                    
                    <!-- Tiempo desde ahora mejorado -->
                    <div class="mb-4">
                      <label class="block text-sm font-medium text-gray-700 mb-2">En cuánto tiempo:</label>
                      <div class="flex rounded-lg border-2 border-gray-300 overflow-hidden">
                        <div class="flex items-center px-4 py-3 bg-indigo-50 border-r-2 border-gray-300">
                          <span class="text-base font-medium text-indigo-700">⏰ En</span>
                        </div>
                        <input 
                          type="text" 
                          [(ngModel)]="fromNowTime"
                          class="flex-1 px-4 py-3 text-base border-none focus:outline-none focus:ring-0" 
                          placeholder="Ej: 30, 1h, 2h30m">
                      </div>
                    </div>
                    
                    <div *ngIf="fromNowError" class="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                      <i class="fas fa-exclamation-triangle mr-2"></i>{{ fromNowError }}
                    </div>
                    <button (click)="addFromNowReminder()" 
                            class="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition text-base font-medium shadow-sm">
                      <i class="fas fa-plus mr-2"></i>Agregar Recordatorio
                    </button>
                  </div>
                  
                  <!-- Tab: IA -->
                  <div *ngIf="activeTab === 'ai'">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                      <span class="text-lg mr-2">🤖</span>
                      Recordatorio con IA (lenguaje natural)
                    </h4>
                    
                    <div class="mb-4">
                      <label class="block text-sm font-medium text-gray-700 mb-2">Describe tu recordatorio:</label>
                      <textarea 
                        [(ngModel)]="aiInput"
                        class="w-full px-4 py-3 text-base rounded-lg border-2 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors resize-none" 
                        rows="3" 
                        placeholder="Ej: 15 minutos antes del inicio y 1 hora después"></textarea>
                    </div>
                    
                    <div *ngIf="aiError" class="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                      <i class="fas fa-exclamation-triangle mr-2"></i>{{ aiError }}
                    </div>
                    <button (click)="processAiReminder()" 
                            class="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition text-base font-medium shadow-sm">
                      <i class="fas fa-magic mr-2"></i>Interpretar y Agregar
                    </button>
                  </div>
                  
                  <!-- Tab: Manual -->
                  <div *ngIf="activeTab === 'manual'">
                    <h4 class="font-semibold text-gray-800 mb-4 flex items-center">
                      <span class="text-lg mr-2">✏️</span>
                      Fecha y hora manual
                    </h4>
                    
                    <div class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">📅 Fecha del recordatorio:</label>
                        <app-android-date-picker
                          [(ngModel)]="manualDate"
                          name="manualDate"
                          label="Fecha del recordatorio"
                          placeholder="Seleccionar fecha"
                          [required]="true">
                        </app-android-date-picker>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">🕐 Hora del recordatorio:</label>
                        <app-mui-time-picker
                          [(ngModel)]="manualTime"
                          name="manualTime"
                          label="Hora del recordatorio"
                          placeholder="HH:MM"
                          [referenceTime]="getCurrentTime()"
                          referenceLabel="Hora actual">
                        </app-mui-time-picker>
                      </div>
                    </div>
                    
                    <div *ngIf="manualError" class="text-red-600 text-sm mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                      <i class="fas fa-exclamation-triangle mr-2"></i>{{ manualError }}
                    </div>
                    <button (click)="addManualReminder()" 
                            class="w-full mt-4 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition text-base font-medium shadow-sm">
                      <i class="fas fa-plus mr-2"></i>Agregar Recordatorio
                    </button>
                  </div>
                  
                  <!-- Ayuda contextual (colapsible) -->
                  <div class="mt-6 pt-4 border-t border-gray-200">
                    <button (click)="showHelp = !showHelp" 
                            class="text-xs text-gray-500 hover:text-gray-700 flex items-center">
                      <i class="fas" [class.fa-chevron-down]="!showHelp" [class.fa-chevron-up]="showHelp"></i>
                      <span class="ml-1">{{ showHelp ? 'Ocultar' : 'Ver' }} ayuda</span>
                    </button>
                    <div *ngIf="showHelp" class="mt-3 text-xs text-gray-600 bg-gray-50 p-3 rounded-md">
                      <div *ngIf="activeTab === 'relative'">
                        <p class="mb-1"><strong>Ejemplos:</strong> "15" (minutos), "2h" (horas), "30m" (minutos), "1h30m"</p>
                        <p><strong>Operaciones:</strong> "5*3" (15 min), "(2+1)h" (3 horas)</p>
                      </div>
                      <div *ngIf="activeTab === 'now'">
                        <p><strong>Ejemplos:</strong> "30" para 30 minutos, "2h" para 2 horas</p>
                      </div>
                      <div *ngIf="activeTab === 'ai'">
                        <p><strong>Ejemplos:</strong> "15 minutos antes del inicio", "1 hora después del final"</p>
                      </div>
                      <div *ngIf="activeTab === 'manual'">
                        <p>Selecciona la fecha y hora exacta para tu recordatorio</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Lista de recordatorios -->
          <div>
            <h3 class="font-medium text-gray-700 mb-3">Tus recordatorios:</h3>
            
            <!-- Mensaje cuando no hay recordatorios -->
            <div *ngIf="reminders.length === 0" 
                 class="bg-gray-50 rounded-lg p-8 text-center">
              <i class="fas fa-bell-slash text-4xl text-gray-300 mb-3"></i>
              <p class="text-gray-500 mb-2">No tienes recordatorios configurados</p>
              <p class="text-sm text-gray-400">Usa las opciones de arriba para agregar tu primer recordatorio</p>
            </div>
            
            <!-- Recordatorios antes del inicio -->
            <ng-container *ngIf="categorizedReminders.beforeStart.length > 0">
              <div class="section-divider mb-4">
                <div class="relative">
                  <div class="absolute inset-0 flex items-center" aria-hidden="true">
                    <div class="w-full border-t border-gray-300"></div>
                  </div>
                  <div class="relative flex justify-center">
                    <span class="bg-white px-3 text-sm font-medium text-gray-500">ANTES DEL INICIO</span>
                  </div>
                </div>
              </div>
              
              <!-- Desktop: Tabla -->
              <div class="hidden md:block bg-white border rounded-lg shadow-sm mb-6 overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Día</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr *ngFor="let item of categorizedReminders.beforeStart; let i = index" class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {{ formatReminderDate(item.reminder) }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{ formatReminderTime(item.reminder) }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        {{ item.description }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div class="flex space-x-2">
                          <button 
                            (click)="editReminder(item.index)" 
                            class="text-indigo-600 hover:text-indigo-900 transition" 
                            title="Editar">
                            <i class="fas fa-edit"></i>
                          </button>
                          <button 
                            (click)="cloneReminder(item.index)" 
                            class="text-indigo-600 hover:text-indigo-900 transition" 
                            title="Clonar">
                            <i class="fas fa-copy"></i>
                          </button>
                          <button 
                            (click)="deleteReminder(item.index)" 
                            class="text-red-600 hover:text-red-900 transition" 
                            title="Eliminar">
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <!-- Móviles: Cards -->
              <div class="md:hidden space-y-3 mb-6">
                <div *ngFor="let item of categorizedReminders.beforeStart; let i = index" 
                     class="bg-white border rounded-lg shadow-sm p-4">
                  <!-- Header de la card -->
                  <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-900 mb-1">
                        {{ formatReminderDate(item.reminder) }}
                      </div>
                      <div class="text-lg font-semibold text-indigo-600">
                        {{ formatReminderTime(item.reminder) }}
                      </div>
                    </div>
                    <!-- Botones de acción -->
                    <div class="flex space-x-1 ml-3">
                      <button 
                        (click)="editReminder(item.index)" 
                        class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" 
                        title="Editar">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button 
                        (click)="cloneReminder(item.index)" 
                        class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" 
                        title="Clonar">
                        <i class="fas fa-copy"></i>
                      </button>
                      <button 
                        (click)="deleteReminder(item.index)" 
                        class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" 
                        title="Eliminar">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <!-- Descripción -->
                  <div class="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    {{ item.description }}
                  </div>
                </div>
              </div>
            </ng-container>
            
            <!-- Recordatorios durante el evento -->
            <ng-container *ngIf="categorizedReminders.duringEvent.length > 0">
              <div class="section-divider mb-4">
                <div class="relative">
                  <div class="absolute inset-0 flex items-center" aria-hidden="true">
                    <div class="w-full border-t border-gray-300"></div>
                  </div>
                  <div class="relative flex justify-center">
                    <span class="bg-white px-3 text-sm font-medium text-gray-500">
                      DURANTE EL EVENTO
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Desktop: Tabla -->
              <div class="hidden md:block bg-white border rounded-lg shadow-sm mb-6 overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Día</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr *ngFor="let item of categorizedReminders.duringEvent; let i = index" class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {{ formatReminderDate(item.reminder) }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{ formatReminderTime(item.reminder) }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        {{ item.description }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div class="flex space-x-2">
                          <button 
                            (click)="editReminder(item.index)" 
                            class="text-indigo-600 hover:text-indigo-900 transition" 
                            title="Editar">
                            <i class="fas fa-edit"></i>
                          </button>
                          <button 
                            (click)="cloneReminder(item.index)" 
                            class="text-indigo-600 hover:text-indigo-900 transition" 
                            title="Clonar">
                            <i class="fas fa-copy"></i>
                          </button>
                          <button 
                            (click)="deleteReminder(item.index)" 
                            class="text-red-600 hover:text-red-900 transition" 
                            title="Eliminar">
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <!-- Móviles: Cards -->
              <div class="md:hidden space-y-3 mb-6">
                <div *ngFor="let item of categorizedReminders.duringEvent; let i = index" 
                     class="bg-white border rounded-lg shadow-sm p-4">
                  <!-- Header de la card -->
                  <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-900 mb-1">
                        {{ formatReminderDate(item.reminder) }}
                      </div>
                      <div class="text-lg font-semibold text-indigo-600">
                        {{ formatReminderTime(item.reminder) }}
                      </div>
                    </div>
                    <!-- Botones de acción -->
                    <div class="flex space-x-1 ml-3">
                      <button 
                        (click)="editReminder(item.index)" 
                        class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" 
                        title="Editar">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button 
                        (click)="cloneReminder(item.index)" 
                        class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" 
                        title="Clonar">
                        <i class="fas fa-copy"></i>
                      </button>
                      <button 
                        (click)="deleteReminder(item.index)" 
                        class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" 
                        title="Eliminar">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <!-- Descripción -->
                  <div class="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    {{ item.description }}
                  </div>
                </div>
              </div>
            </ng-container>
            
            <!-- Recordatorios relacionados con la fecha límite -->
            <ng-container *ngIf="taskDates.deadline && (categorizedReminders.beforeDeadline.length > 0 || categorizedReminders.afterDeadline.length > 0)">
              <div class="section-divider mb-4">
                <div class="relative">
                  <div class="absolute inset-0 flex items-center" aria-hidden="true">
                    <div class="w-full border-t border-gray-300"></div>
                  </div>
                  <div class="relative flex justify-center">
                    <span class="bg-white px-3 text-sm font-medium text-gray-500">ANTES DEL LÍMITE / DESPUÉS DEL LÍMITE</span>
                  </div>
                </div>
              </div>
              
              <!-- Desktop: Tabla -->
              <div class="hidden md:block bg-white border rounded-lg shadow-sm overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Día</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <!-- Recordatorios antes del límite -->
                    <tr *ngFor="let item of categorizedReminders.beforeDeadline; let i = index" class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {{ formatReminderDate(item.reminder) }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{ formatReminderTime(item.reminder) }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        {{ item.description }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div class="flex space-x-2">
                          <button 
                            (click)="editReminder(item.index)" 
                            class="text-indigo-600 hover:text-indigo-900 transition" 
                            title="Editar">
                            <i class="fas fa-edit"></i>
                          </button>
                          <button 
                            (click)="cloneReminder(item.index)" 
                            class="text-indigo-600 hover:text-indigo-900 transition" 
                            title="Clonar">
                            <i class="fas fa-copy"></i>
                          </button>
                          <button 
                            (click)="deleteReminder(item.index)" 
                            class="text-red-600 hover:text-red-900 transition" 
                            title="Eliminar">
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <!-- Recordatorios después del límite -->
                    <tr *ngFor="let item of categorizedReminders.afterDeadline; let i = index" class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {{ formatReminderDate(item.reminder) }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {{ formatReminderTime(item.reminder) }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        {{ item.description }}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div class="flex space-x-2">
                          <button 
                            (click)="editReminder(item.index)" 
                            class="text-indigo-600 hover:text-indigo-900 transition" 
                            title="Editar">
                            <i class="fas fa-edit"></i>
                          </button>
                          <button 
                            (click)="cloneReminder(item.index)" 
                            class="text-indigo-600 hover:text-indigo-900 transition" 
                            title="Clonar">
                            <i class="fas fa-copy"></i>
                          </button>
                          <button 
                            (click)="deleteReminder(item.index)" 
                            class="text-red-600 hover:text-red-900 transition" 
                            title="Eliminar">
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <!-- Móviles: Cards -->
              <div class="md:hidden space-y-3">
                <!-- Recordatorios antes del límite -->
                <div *ngFor="let item of categorizedReminders.beforeDeadline; let i = index" 
                     class="bg-white border rounded-lg shadow-sm p-4">
                  <!-- Header de la card -->
                  <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-900 mb-1">
                        {{ formatReminderDate(item.reminder) }}
                      </div>
                      <div class="text-lg font-semibold text-indigo-600">
                        {{ formatReminderTime(item.reminder) }}
                      </div>
                    </div>
                    <!-- Botones de acción -->
                    <div class="flex space-x-1 ml-3">
                      <button 
                        (click)="editReminder(item.index)" 
                        class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" 
                        title="Editar">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button 
                        (click)="cloneReminder(item.index)" 
                        class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" 
                        title="Clonar">
                        <i class="fas fa-copy"></i>
                      </button>
                      <button 
                        (click)="deleteReminder(item.index)" 
                        class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" 
                        title="Eliminar">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <!-- Descripción -->
                  <div class="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    {{ item.description }}
                  </div>
                </div>
                
                <!-- Recordatorios después del límite -->
                <div *ngFor="let item of categorizedReminders.afterDeadline; let i = index" 
                     class="bg-white border rounded-lg shadow-sm p-4">
                  <!-- Header de la card -->
                  <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-900 mb-1">
                        {{ formatReminderDate(item.reminder) }}
                      </div>
                      <div class="text-lg font-semibold text-indigo-600">
                        {{ formatReminderTime(item.reminder) }}
                      </div>
                    </div>
                    <!-- Botones de acción -->
                    <div class="flex space-x-1 ml-3">
                      <button 
                        (click)="editReminder(item.index)" 
                        class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" 
                        title="Editar">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button 
                        (click)="cloneReminder(item.index)" 
                        class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" 
                        title="Clonar">
                        <i class="fas fa-copy"></i>
                      </button>
                      <button 
                        (click)="deleteReminder(item.index)" 
                        class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" 
                        title="Eliminar">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <!-- Descripción -->
                  <div class="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    {{ item.description }}
                  </div>
                </div>
              </div>
            </ng-container>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reminder-item {
      transition: all 0.2s ease;
    }
    
    .reminder-item:hover {
      background-color: #f3f4f6;
      border: 1px solid #e5e7eb;
    }
  `]
})
export class RemindersModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() showModal = false;
  @Input() reminders: string[] = [];
  @Input() taskDates: { start?: string; end?: string; deadline?: string | null } = {};
  
  @Output() closeModalEvent = new EventEmitter<void>();
  @Output() remindersChanged = new EventEmitter<string[]>();
  
  // Tab state
  activeTab: 'relative' | 'now' | 'ai' | 'manual' = 'relative';
  
  // Relative reminder fields
  relativeReference: 'start' | 'end' | 'deadline' = 'start';
  relativeDirection: 'before' | 'during' | 'after' = 'during';
  relativeTime = '';
  relativeError = '';
  
  // From now reminder fields
  fromNowDirection: 'in' | 'before' | 'after' = 'in';
  fromNowTime = '';
  fromNowError = '';
  
  // AI reminder fields
  aiInput = '';
  aiError = '';
  
  // Manual reminder fields
  manualDate = '';
  manualTime = '';
  manualError = '';
  
  // UI state
  showHelp = false;
  sidebarExpanded = false; // Estado del sidebar en móviles
  isEditing = false; // Flag para indicar si estamos en modo edición
  
  ngOnInit() {
    this.resetInputs();
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
  
  closeModal() {
    this.enableBodyScroll();
    this.closeModalEvent.emit();
  }
  
  setActiveTab(tab: 'relative' | 'now' | 'ai' | 'manual') {
    this.activeTab = tab;
    // Solo resetear inputs si no estamos en modo edición
    if (!this.isEditing) {
      this.resetInputs();
    }
    this.isEditing = false; // Resetear el flag después de cambiar de tab
  }
  
  private resetInputs() {
    this.relativeTime = '';
    this.relativeDirection = 'during';
    this.fromNowTime = '';
    this.aiInput = '';
    this.manualDate = '';
    this.manualTime = '';
    this.relativeError = '';
    this.fromNowError = '';
    this.aiError = '';
    this.manualError = '';
  }
  
  getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  get categorizedReminders() {
    const dates = this.taskDates;
    const startDate = dates.start ? new Date(dates.start + (dates.start.includes('Z') ? '' : 'Z')) : null;
    const endDate = dates.end ? new Date(dates.end + (dates.end.includes('Z') ? '' : 'Z')) : null;
    const deadlineDate = dates.deadline ? new Date(dates.deadline + (dates.deadline.includes('Z') ? '' : 'Z')) : null;

    const categorized = {
      beforeStart: [] as Array<{reminder: string, index: number, description: string}>,
      duringEvent: [] as Array<{reminder: string, index: number, description: string}>,
      beforeDeadline: [] as Array<{reminder: string, index: number, description: string}>,
      afterDeadline: [] as Array<{reminder: string, index: number, description: string}>
    };

    this.reminders.forEach((reminder, index) => {
      const reminderDate = new Date(reminder + (reminder.includes('Z') ? '' : 'Z'));
      const description = this.generateReminderDescription(reminderDate, dates);
      
      if (startDate && reminderDate < startDate) {
        categorized.beforeStart.push({reminder, index, description});
      } else if (endDate && reminderDate <= endDate) {
        categorized.duringEvent.push({reminder, index, description});
      } else if (deadlineDate && endDate && reminderDate > endDate && reminderDate <= deadlineDate) {
        categorized.beforeDeadline.push({reminder, index, description});
      } else if (deadlineDate && reminderDate > deadlineDate) {
        categorized.afterDeadline.push({reminder, index, description});
      } else {
        categorized.duringEvent.push({reminder, index, description});
      }
    });

    return categorized;
  }
  
  private generateReminderDescription(reminderDate: Date, dates: any): string {
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
  
  formatReminderDate(dateTimeString: string): string {
    const utcString = dateTimeString.includes('Z') || dateTimeString.includes('+') 
      ? dateTimeString 
      : dateTimeString + 'Z';
    
    const date = new Date(utcString);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    return date.toLocaleDateString('es-MX', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Mexico_City'
    });
  }
  
  formatReminderTime(dateTimeString: string): string {
    const utcString = dateTimeString.includes('Z') || dateTimeString.includes('+') 
      ? dateTimeString 
      : dateTimeString + 'Z';
    
    const date = new Date(utcString);
    
    if (isNaN(date.getTime())) {
      return 'Hora inválida';
    }
    
    return date.toLocaleTimeString('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Mexico_City'
    });
  }
  
  // Add reminder methods
  addRelativeReminder() {
    try {
      const dates = this.taskDates;
      const referenceDate = dates[this.relativeReference];
      
      if (!referenceDate) {
        this.relativeError = 'Fecha de referencia no disponible';
        return;
      }

      let reminderDate: Date;
      const baseDate = new Date(referenceDate);

      if (this.relativeDirection === 'during') {
        // Para "durante", usar directamente la fecha de referencia
        reminderDate = new Date(baseDate.getTime());
      } else {
        // Para "antes" y "después", necesitamos el tiempo especificado
        const minutes = this.parseTimeExpression(this.relativeTime);
        if (minutes === null) {
          this.relativeError = 'Formato de tiempo inválido';
          return;
        }

        reminderDate = new Date(baseDate.getTime() + 
          (this.relativeDirection === 'before' ? -minutes : minutes) * 60 * 1000);
      }

      const now = new Date();
      if (reminderDate < now) {
        this.relativeError = 'El recordatorio calculado está en el pasado. Por favor, ajusta el tiempo para que sea en el futuro.';
        return;
      }

      this.addReminder(reminderDate);
      if (this.relativeDirection !== 'during') {
        this.relativeTime = '';
      }
      this.relativeError = '';
    } catch (error) {
      this.relativeError = 'Error al calcular el recordatorio';
    }
  }
  
  addFromNowReminder() {
    try {
      const minutes = this.parseTimeExpression(this.fromNowTime);
      if (minutes === null) {
        this.fromNowError = 'Formato de tiempo inválido';
        return;
      }

      const now = new Date();
      let reminderDate: Date;

      switch (this.fromNowDirection) {
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

      if (reminderDate < now) {
        this.fromNowError = 'El recordatorio no puede ser en el pasado. Por favor, usa "En" con un tiempo positivo.';
        return;
      }

      // Convertir a UTC antes de guardar para evitar offset de zona
      const utcDate = new Date(reminderDate.getTime() + reminderDate.getTimezoneOffset() * 60000);
      this.addReminder(utcDate);
      this.fromNowTime = '';
      this.fromNowError = '';
    } catch (error) {
      this.fromNowError = 'Error al calcular el recordatorio';
    }
  }
  
  addManualReminder() {
    try {
      if (!this.manualDate || !this.manualTime) {
        this.manualError = 'Fecha y hora son requeridos';
        return;
      }

      const [hours, minutes] = this.manualTime.split(':');
      const year = parseInt(this.manualDate.substring(0, 4));
      const month = parseInt(this.manualDate.substring(5, 7)) - 1;
      const day = parseInt(this.manualDate.substring(8, 10));
      
      // Crear la fecha en hora local
      const localDate = new Date(year, month, day, parseInt(hours), parseInt(minutes), 0, 0);
      
      // Convertir a UTC para mantener consistencia con el formato de guardado
      // Ya que los recordatorios se interpretan como UTC al mostrar
      const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
      
      const now = new Date();
      if (localDate < now) {
        this.manualError = 'El recordatorio no puede ser en el pasado. Por favor, selecciona una fecha y hora futura.';
        return;
      }
      
      this.addReminder(utcDate);
      this.manualDate = '';
      this.manualTime = '';
      this.manualError = '';
    } catch (error) {
      this.manualError = 'Fecha u hora inválidas';
    }
  }
  
  processAiReminder() {
    try {
      const input = this.aiInput.toLowerCase().trim();
      const dates = this.taskDates;
      
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
        this.aiError = 'No se pudo interpretar el recordatorio. Intenta con: "15 minutos antes del inicio"';
        return;
      }

      const now = new Date();
      if (reminderDate < now) {
        this.aiError = 'El recordatorio interpretado está en el pasado. Por favor, especifica un recordatorio futuro.';
        return;
      }

      // Convertir a UTC antes de guardar para evitar offset de zona
      const utcDate = new Date(reminderDate.getTime() + reminderDate.getTimezoneOffset() * 60000);
      this.addReminder(utcDate);

      this.aiInput = '';
      this.aiError = '';
    } catch (error) {
      this.aiError = 'Error al interpretar el recordatorio';
    }
  }
  
  private addReminder(reminderDate: Date) {
    // Guardar en formato ISO local (sin zona horaria) para consistencia
    const year = reminderDate.getFullYear();
    const month = String(reminderDate.getMonth() + 1).padStart(2, '0');
    const day = String(reminderDate.getDate()).padStart(2, '0');
    const hours = String(reminderDate.getHours()).padStart(2, '0');
    const minutes = String(reminderDate.getMinutes()).padStart(2, '0');
    
    const reminderString = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    const updatedReminders = [...this.reminders, reminderString];
    updatedReminders.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    this.remindersChanged.emit(updatedReminders);
  }
  
  editReminder(index: number) {
    const reminder = this.reminders[index];
    if (reminder) {
      // Usar splitDateTime que ahora maneja correctamente el formato ISO
      const { date, time } = this.splitDateTime(reminder);
      
      this.manualDate = date;
      this.manualTime = time;
      this.isEditing = true; // Marcar que estamos editando
      this.setActiveTab('manual');
      
      // Eliminar el recordatorio después de cargar los valores
      this.deleteReminder(index);
    }
  }
  
  cloneReminder(index: number) {
    const reminder = this.reminders[index];
    if (reminder) {
      const originalDate = new Date(reminder + (reminder.includes('Z') ? '' : 'Z'));
      const clonedDate = new Date(originalDate.getTime() + 5 * 60 * 1000);
      this.addReminder(clonedDate);
    }
  }
  
  deleteReminder(index: number) {
    const updatedReminders = [...this.reminders];
    updatedReminders.splice(index, 1);
    this.remindersChanged.emit(updatedReminders);
  }
  
  private parseTimeExpression(input: string): number | null {
    try {
      let expression = input.trim().toLowerCase();
      
      expression = expression.replace(/\s*h\s*/g, '*60');
      expression = expression.replace(/\s*m\s*/g, '');
      expression = expression.replace(/\s*min\s*/g, '');
      expression = expression.replace(/\s*minuto[s]?\s*/g, '');
      expression = expression.replace(/\s*hora[s]?\s*/g, '*60');
      
      expression = expression.replace(/\s+/g, '');
      
      if (!/^[\d+\-*/().]+$/.test(expression)) {
        return null;
      }
      
      const result = this.safeEval(expression);
      return typeof result === 'number' && !isNaN(result) ? Math.round(result) : null;
    } catch {
      return null;
    }
  }
  
  private safeEval(expression: string): number {
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
  
  private splitDateTime(dateTimeString: string): { date: string, time: string } {
    if (!dateTimeString) return { date: '', time: '' };
    
    // Los recordatorios se guardan en formato ISO local (YYYY-MM-DDTHH:mm)
    // Pero cuando se muestran en la lista, se interpretan como UTC
    // Por lo tanto, al editar, necesitamos hacer la conversión inversa
    
    let dateTime: Date;
    
    if (dateTimeString.includes('T') && dateTimeString.length === 16) {
      // Formato ISO sin zona horaria (YYYY-MM-DDTHH:mm)
      // Este formato se interpreta como UTC cuando se muestra en la lista
      // Así que necesitamos convertirlo de vuelta a hora local
      const utcDate = new Date(dateTimeString + 'Z'); // Interpretar como UTC
      
      // Convertir a hora local (la fecha ya está en la zona horaria local del navegador)
      dateTime = new Date(utcDate.getTime());
    } else {
      // Intentar parsear como fecha normal
      dateTime = new Date(dateTimeString);
    }
    
    // Verificar si la fecha es válida
    if (isNaN(dateTime.getTime())) {
      console.error('Fecha inválida:', dateTimeString);
      return { date: '', time: '' };
    }
    
    // Extraer los componentes en hora local
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
  
  toggleSidebar() {
    this.sidebarExpanded = !this.sidebarExpanded;
  }
} 
