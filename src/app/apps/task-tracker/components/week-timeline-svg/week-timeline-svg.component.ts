import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, HostListener, ViewChild, ElementRef, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../../models/task.model';
import { Environment } from '../../models/environment.model';
import { TaskType } from '../../models/task-type.model';
import { Project } from '../../models/project.model';
import { TimelineFocusService } from '../../services/timeline-focus.service';
import { ProjectService } from '../../services/project.service';
import { AndroidDatePickerComponent } from '../android-date-picker/android-date-picker.component';
import { Subscription } from 'rxjs';

// Interfaz para elementos renderizables (tareas o fragmentos)
interface RenderableItem {
  type: 'task' | 'fragment';
  task: Task;
  fragmentIndex?: number;
  start: string;
  end: string;
}

// Interfaz para representar un día de la semana
interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthDay: number;
}

@Component({
  selector: 'app-week-timeline-svg',
  standalone: true,
  imports: [CommonModule, FormsModule, AndroidDatePickerComponent],
  template: `
    <div #containerRef class="week-timeline-container w-full overflow-x-auto relative">
      <!-- Toggle de modo de coloreado (solo visible cuando hay ambiente enfocado) -->
      <div *ngIf="focusedEnvironmentId" class="color-mode-toggle mb-3 flex items-center justify-center gap-2 bg-white rounded-lg p-2 shadow-sm border">
        <button 
          (click)="toggleColorMode()"
          class="toggle-button flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200"
          [class.active-environment]="colorMode === 'environment'"
          [class.active-tasktype]="colorMode === 'taskType'"
          title="Cambiar modo de coloreado">
          <i class="fas" [class.fa-layer-group]="colorMode === 'environment'" [class.fa-tag]="colorMode === 'taskType'"></i>
          <span class="text-sm font-medium">
            {{ colorMode === 'environment' ? 'Color por Ambiente' : 'Color por Tipo de Tarea' }}
          </span>
        </button>
      </div>
      
      <!-- Controles de Navegación de Semana -->
      <div class="week-navigation mb-4 flex flex-col md:flex-row items-center justify-between bg-white rounded-lg p-3 shadow-sm border gap-3">
        <!-- Primera fila: Navegador de semanas -->
        <div class="flex items-center space-x-2 w-full md:w-auto justify-center md:justify-start">
          <button (click)="goToPreviousWeek()" 
                  class="nav-btn flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  title="Semana anterior">
            <i class="fas fa-chevron-left text-sm text-gray-600"></i>
          </button>
          
          <div class="week-display text-sm font-semibold text-gray-700 px-2 text-center">
            {{ formatWeekRange() }}
          </div>
          
          <button (click)="goToNextWeek()" 
                  class="nav-btn flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  title="Semana siguiente">
            <i class="fas fa-chevron-right text-sm text-gray-600"></i>
          </button>
        </div>
        
        <!-- Segunda fila: Selector y botón Esta Semana -->
        <div class="flex items-center space-x-3 w-full md:w-auto justify-center md:justify-end">
          <div class="w-48 flex-shrink-0">
            <app-android-date-picker
              [ngModel]="getWeekInputValue()"
              (dateChange)="onWeekDateChange($event)"
              label="Seleccionar semana"
              placeholder="Seleccionar semana"
              class="date-picker">
            </app-android-date-picker>
          </div>
          
          <button (click)="goToCurrentWeek()" 
                  [class.bg-indigo-100]="isCurrentWeek()"
                  [class.text-indigo-700]="isCurrentWeek()"
                  [class.bg-gray-100]="!isCurrentWeek()"
                  [class.text-gray-700]="!isCurrentWeek()"
                  class="nav-btn px-3 py-1 rounded-md text-sm font-medium hover:bg-indigo-50 transition-colors flex-shrink-0"
                  title="Ir a esta semana">
            Esta Semana
          </button>
        </div>
      </div>

      <!-- Tooltip para mostrar información completa de la tarea -->
      <div *ngIf="showTooltip && tooltipTask" 
           class="tooltip-container absolute top-[150px] left-1/2 transform -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-5 rounded-xl shadow-2xl max-w-2xl min-w-[400px]">
        <div class="flex items-start space-x-4">
          <span class="text-3xl flex-shrink-0">{{ tooltipTask.emoji }}</span>
          <div *ngIf="getTaskTypeColor(tooltipTask)" 
               class="w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0 mt-1" 
               [style.background-color]="getTaskTypeColor(tooltipTask)"></div>
          <div class="flex-1">
            <div class="font-bold text-lg mb-2">{{ getTaskDisplayName(tooltipTask) }}</div>
            <div *ngIf="tooltipTask.description" class="text-sm text-gray-200 mt-2 mb-3 leading-relaxed">{{ tooltipTask.description }}</div>
            <div class="flex flex-wrap gap-4 mt-3">
              <div class="text-sm text-gray-300 flex items-center space-x-2">
                <i class="fas fa-clock text-xs"></i>
                <span>{{ formatTaskTime(tooltipTask.start) }} - {{ formatTaskTime(tooltipTask.end) }}</span>
              </div>
              <div *ngIf="getTaskDuration(tooltipTask)" class="text-sm text-purple-300 flex items-center space-x-2">
                <i class="fas fa-hourglass-half text-xs"></i>
                <span>Duración: {{ formatTaskDuration(getTaskDuration(tooltipTask)) }}</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Flecha del tooltip apuntando hacia arriba -->
        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-12 border-r-12 border-b-12 border-l-transparent border-r-transparent border-b-gray-900"></div>
      </div>

      <!-- Contenedor centrado para el SVG -->
      <div class="svg-container">
        <svg [attr.width]="svgWidth" [attr.height]="svgHeight" [attr.viewBox]="'0 0 ' + svgWidth + ' ' + svgHeight" 
             class="week-timeline-svg" [style.min-width.px]="svgWidth">
          
          <!-- Encabezado con nombres de días -->
          <g transform="translate(0, 0)">
            <rect x="0" y="0" [attr.width]="svgWidth" height="60" fill="#f9fafb" rx="6" ry="6"/>
            <line x1="0" y1="60" [attr.x2]="svgWidth" y2="60" stroke="#888" stroke-width="2" />
            
            <!-- Nombres de los días -->
            <g *ngFor="let day of weekDays; let i = index">
              <rect [attr.x]="getDayColumnX(i)" y="0" [attr.width]="dayColumnWidth" height="60" 
                    [attr.fill]="isTodayColumn(i) ? '#e0e7ff' : '#f9fafb'" 
                    rx="4" ry="4"/>
              <text [attr.x]="getDayColumnX(i) + dayColumnWidth / 2" y="20" 
                    [attr.font-size]="dayNameFontSize" 
                    fill="#333" 
                    font-weight="bold" 
                    text-anchor="middle">
                {{ day.dayName }}
              </text>
              <text [attr.x]="getDayColumnX(i) + dayColumnWidth / 2" y="40" 
                    [attr.font-size]="dayNumberFontSize" 
                    fill="#666" 
                    text-anchor="middle">
                {{ day.monthDay }}
              </text>
            </g>
          </g>

          <!-- Columnas de días con divisiones de horas -->
          <g *ngFor="let day of weekDays; let dayIndex = index" [attr.transform]="'translate(' + getDayColumnX(dayIndex) + ', 60)'">
            <!-- Fondo de la columna -->
            <rect x="0" y="0" [attr.width]="dayColumnWidth" [attr.height]="hoursAreaHeight" 
                  [attr.fill]="isTodayColumn(dayIndex) ? '#f0f4ff' : '#ffffff'" 
                  rx="4" ry="4" 
                  stroke="#e5e7eb" 
                  stroke-width="1"/>
            
            <!-- Líneas de horas y etiquetas -->
            <g *ngFor="let hour of hours">
              <!-- Línea más gruesa y oscura para horas completas, más delgada y clara para medias horas -->
              <line x1="0" y1="0" 
                    [attr.x2]="dayColumnWidth" 
                    [attr.y2]="0" 
                    [attr.stroke]="'#e5e7eb'" 
                    [attr.stroke-width]="hour % 2 === 0 ? '2' : '1'"
                    [attr.transform]="'translate(0, ' + getHourY(hour) + ')'"/>
              
              <!-- Etiqueta de hora solo en la primera columna -->
              <!-- Muestra las 24 horas en formato 12 horas (12:00 AM - 11:00 PM) -->
              <!-- Aunque hay divisiones cada media hora, las etiquetas muestran solo las horas completas -->
              <text *ngIf="dayIndex === 0"
                    x="4" 
                    [attr.y]="getHourY(hour) - 1" 
                    [attr.font-size]="hourFontSize" 
                    fill="#666" 
                    text-anchor="start"
                    [attr.transform]="'translate(0, ' + getHourY(hour) + ')'">
                {{ formatHour(hour) }}
              </text>
            </g>
            
            <!-- Tareas para este día -->
            <g *ngFor="let item of getRenderableItemsForDay(dayIndex)"
               [class.task-overdue]="isTaskOverdue(item.task)"
               [class.task-running]="isTaskRunning(item.task)"
               [class.task-hidden]="shouldShowAsHidden(item)">
              <!-- Borde negro exterior -->
              <rect [attr.x]="getTaskX(item, dayIndex)" 
                    [attr.y]="getTaskY(item, dayIndex)" 
                    [attr.width]="getTaskWidth(item, dayIndex)" 
                    [attr.height]="getTaskHeight(item, dayIndex)"
                    [attr.fill]="getTaskColor(item.task)" 
                    rx="4" ry="4" 
                    [attr.fill-opacity]="shouldShowAsHidden(item) ? '0.4' : '0.8'" 
                    stroke="rgba(0,0,0,0.6)" 
                    stroke-width="1.5" 
                    (click)="onTaskClick(item.task, $event)" 
                    (dblclick)="onTaskDoubleClick(item.task, $event)"
                    (contextmenu)="onTaskContextMenu(item.task, $event)"
                    (touchstart)="onTaskTouchStart(item.task, $event)"
                    (touchmove)="onTaskTouchMove($event)"
                    (touchend)="onTaskTouchEnd($event)"
                    class="cursor-pointer" />
              
              <!-- Borde blanco interior -->
              <rect [attr.x]="getTaskX(item, dayIndex)" 
                    [attr.y]="getTaskY(item, dayIndex)" 
                    [attr.width]="getTaskWidth(item, dayIndex)" 
                    [attr.height]="getTaskHeight(item, dayIndex)"
                    fill="none" 
                    rx="4" ry="4" 
                    stroke="rgba(255,255,255,0.8)" 
                    stroke-width="1" 
                    (click)="onTaskClick(item.task, $event)" 
                    (dblclick)="onTaskDoubleClick(item.task, $event)"
                    (contextmenu)="onTaskContextMenu(item.task, $event)"
                    (touchstart)="onTaskTouchStart(item.task, $event)"
                    (touchmove)="onTaskTouchMove($event)"
                    (touchend)="onTaskTouchEnd($event)"
                    class="cursor-pointer" />
              
              <!-- Indicador de tipo de tarea -->
              <circle *ngIf="getTaskTypeColor(item.task)" 
                      [attr.cx]="getTaskX(item, dayIndex) + 6" 
                      [attr.cy]="getTaskY(item, dayIndex) + 6" 
                      r="4" 
                      [attr.fill]="getTaskTypeColor(item.task)"
                      stroke="white" 
                      stroke-width="1"
                      (click)="onTaskClick(item.task, $event)" 
                      (dblclick)="onTaskDoubleClick(item.task, $event)"
                      (contextmenu)="onTaskContextMenu(item.task, $event)"
                      (touchstart)="onTaskTouchStart(item.task, $event)"
                      (touchmove)="onTaskTouchMove($event)"
                      (touchend)="onTaskTouchEnd($event)"
                      class="cursor-pointer" />
              
              <!-- Texto de la tarea -->
              <text [attr.x]="getTaskX(item, dayIndex) + (getTaskTypeColor(item.task) ? 12 : 6)" 
                    [attr.y]="getTaskY(item, dayIndex) + 12" 
                    [attr.font-size]="taskFontSize" 
                    [attr.fill]="shouldShowAsHidden(item) ? '#888' : '#111'" 
                    alignment-baseline="middle"
                    (click)="onTaskClick(item.task, $event)" 
                    (dblclick)="onTaskDoubleClick(item.task, $event)"
                    (contextmenu)="onTaskContextMenu(item.task, $event)"
                    (touchstart)="onTaskTouchStart(item.task, $event)"
                    (touchmove)="onTaskTouchMove($event)"
                    (touchend)="onTaskTouchEnd($event)"
                    class="cursor-pointer">
                {{ getTaskText(item, dayIndex) }}
              </text>
            </g>
            
            <!-- Línea de tiempo actual (si es el día de hoy) -->
            <line *ngIf="isTodayColumn(dayIndex) && isCurrentHour()" 
                  x1="0" 
                  [attr.x2]="dayColumnWidth" 
                  [attr.y1]="getCurrentHourY()" 
                  [attr.y2]="getCurrentHourY()" 
                  stroke="#f87171" 
                  stroke-width="2" 
                  stroke-dasharray="4 2" />
          </g>
        </svg>
      </div>

      <!-- Menú contextual -->
      <div *ngIf="showContextMenu && contextMenuTask" 
           class="context-menu"
           [style.left.px]="contextMenuX"
           [style.top.px]="contextMenuY"
           (click)="$event.stopPropagation()">
        <div class="context-menu-header">
          <span class="text-lg mr-2">{{ contextMenuTask.emoji }}</span>
          <span class="font-semibold text-sm truncate">{{ contextMenuTask.name }}</span>
        </div>
        <div class="context-menu-divider"></div>
        <button *ngIf="contextMenuTask.hidden" class="context-menu-item" (click)="toggleHiddenFromContextMenu()">
          <i class="fas fa-eye mr-2"></i>
          Mostrar
        </button>
        <button *ngIf="!contextMenuTask.hidden" class="context-menu-item" (click)="toggleHiddenFromContextMenu()">
          <i class="fas fa-eye-slash mr-2"></i>
          Ocultar
        </button>
        <div *ngIf="isTaskOverdue(contextMenuTask) || isTaskRunning(contextMenuTask)" class="context-menu-divider"></div>
        <button *ngIf="(isTaskOverdue(contextMenuTask) || isTaskRunning(contextMenuTask)) && contextMenuTask.status !== 'completed'" 
                class="context-menu-item context-menu-item-completed" 
                (click)="changeStatusFromContextMenu('completed')">
          <i class="fas fa-check mr-2"></i>
          Marcar completada
        </button>
        <button *ngIf="(isTaskOverdue(contextMenuTask) || isTaskRunning(contextMenuTask)) && contextMenuTask.status !== 'in-progress'" 
                class="context-menu-item context-menu-item-progress" 
                (click)="changeStatusFromContextMenu('in-progress')">
          <i class="fas fa-spinner mr-2"></i>
          Marcar en progreso
        </button>
        <button *ngIf="(isTaskOverdue(contextMenuTask) || isTaskRunning(contextMenuTask)) && contextMenuTask.status !== 'pending'" 
                class="context-menu-item context-menu-item-pending" 
                (click)="changeStatusFromContextMenu('pending')">
          <i class="fas fa-play mr-2"></i>
          Marcar pendiente
        </button>
        <div class="context-menu-divider"></div>
        <button class="context-menu-item delete" (click)="deleteTaskFromContextMenu()">
          <i class="fas fa-trash-alt mr-2"></i>
          Eliminar tarea
        </button>
      </div>
    </div>
  `,
  styles: [`
    .week-timeline-container {
      padding: 8px;
      background: #f9fafb;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      position: relative;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      overflow-x: auto;
      overflow-y: visible;
      -webkit-overflow-scrolling: touch;
    }
    
    /* Estilos para el toggle de modo de coloreado */
    .color-mode-toggle {
      backdrop-filter: blur(10px);
    }
    
    .toggle-button {
      background: linear-gradient(135deg, #e5e7eb 0%, #f3f4f6 100%);
      color: #6b7280;
      border: 2px solid transparent;
      cursor: pointer;
      user-select: none;
    }
    
    .toggle-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .toggle-button:active {
      transform: translateY(0);
    }
    
    .toggle-button.active-environment {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      color: #1e40af;
      border-color: #3b82f6;
    }
    
    .toggle-button.active-tasktype {
      background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);
      color: #5b21b6;
      border-color: #8b5cf6;
    }
    
    .toggle-button i {
      font-size: 14px;
    }
    
    @media (max-width: 640px) {
      .toggle-button {
        padding: 8px 12px;
        font-size: 12px;
      }
      
      .toggle-button span {
        font-size: 11px;
      }
      
      .toggle-button i {
        font-size: 12px;
      }
    }
    
    .week-timeline-svg {
      display: block;
      background: #f9fafb;
      border-radius: 12px;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }
    
    .week-timeline-svg text,
    .week-timeline-svg rect,
    .week-timeline-svg circle {
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }

    .week-navigation {
      backdrop-filter: blur(10px);
    }
    
    .nav-btn {
      user-select: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .nav-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .nav-btn:active {
      transform: translateY(0);
    }
    
    .week-display {
      min-width: 200px;
      text-align: center;
      user-select: text !important;
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
    }
    
    .date-picker {
      min-width: 120px;
      user-select: text !important;
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
    }
    
    .week-timeline-container::-webkit-scrollbar {
      height: 6px;
    }
    
    .week-timeline-container::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    
    .week-timeline-container::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }
    
    .week-timeline-container::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
    
    .week-timeline-container {
      scrollbar-width: thin;
      scrollbar-color: #c1c1c1 #f1f1f1;
    }

    .tooltip-container {
      animation: fadeIn 0.3s ease-in-out;
      pointer-events: none;
      z-index: 1000;
      border: 2px solid rgba(255, 255, 255, 0.1);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .cursor-pointer {
      cursor: pointer;
    }

    .cursor-pointer:hover {
      opacity: 0.9;
      filter: brightness(1.1);
    }

    .svg-container {
      width: 100%;
      display: flex;
      justify-content: flex-start;
      min-width: fit-content;
    }
    
    .week-timeline-svg {
      flex-shrink: 0;
      display: block;
    }
    
    @media (min-width: 1280px) {
      .svg-container {
        justify-content: center;
      }
    }
    
    /* Asegurar que en pantallas pequeñas el scroll funcione desde el inicio */
    @media (max-width: 1279px) {
      .svg-container {
        justify-content: flex-start;
      }
    }

    .context-menu {
      position: fixed;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      min-width: 200px;
      max-width: 280px;
      overflow: hidden;
      animation: contextMenuFadeIn 0.15s ease-out;
    }

    @keyframes contextMenuFadeIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .context-menu-header {
      padding: 12px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      font-size: 14px;
      max-width: 100%;
    }

    .context-menu-header .truncate {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .context-menu-divider {
      height: 1px;
      background: #e5e7eb;
    }

    .context-menu-item {
      width: 100%;
      padding: 12px 16px;
      text-align: left;
      border: none;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      font-size: 14px;
      color: #374151;
      transition: background-color 0.15s ease;
    }

    .context-menu-item:hover {
      background: #f3f4f6;
    }

    .context-menu-item.delete {
      color: #ef4444;
    }

    .context-menu-item.delete:hover {
      background: #fef2f2;
    }

    .context-menu-item.completed,
    .context-menu-item-completed {
      color: #10b981;
    }

    .context-menu-item.completed:hover,
    .context-menu-item-completed:hover {
      background: #ecfdf5;
      color: #059669;
    }

    .context-menu-item.progress,
    .context-menu-item-progress {
      color: #f59e0b;
    }

    .context-menu-item.progress:hover,
    .context-menu-item-progress:hover {
      background: #fffbeb;
      color: #d97706;
    }

    .context-menu-item.pending,
    .context-menu-item-pending {
      color: #3b82f6;
    }

    .context-menu-item.pending:hover,
    .context-menu-item-pending:hover {
      background: #eff6ff;
      color: #2563eb;
    }

    .context-menu-item i {
      width: 20px;
      text-align: center;
    }

    /* Estilos para tareas ocultas */
    .task-hidden {
      opacity: 0.5;
    }

    .task-hidden text {
      fill: #888 !important;
    }

    /* Estilos para resplandor de tareas overdue */
    .task-overdue {
      filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.6)) drop-shadow(0 0 4px rgba(239, 68, 68, 0.5)) drop-shadow(0 0 6px rgba(239, 68, 68, 0.4));
      animation: overdue-pulse 1.5s infinite;
    }

    @keyframes overdue-pulse {
      0%, 100% {
        filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.6)) drop-shadow(0 0 4px rgba(239, 68, 68, 0.5)) drop-shadow(0 0 6px rgba(239, 68, 68, 0.4));
      }
      50% {
        filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 5px rgba(255, 255, 255, 0.7)) drop-shadow(0 0 8px rgba(255, 255, 255, 0.5));
      }
    }

    /* Estilos para resplandor de tareas running */
    .task-running {
      filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.6)) drop-shadow(0 0 4px rgba(16, 185, 129, 0.5)) drop-shadow(0 0 6px rgba(16, 185, 129, 0.4));
      animation: running-pulse 1.5s infinite;
    }

    @keyframes running-pulse {
      0%, 100% {
        filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.6)) drop-shadow(0 0 4px rgba(16, 185, 129, 0.5)) drop-shadow(0 0 6px rgba(16, 185, 129, 0.4));
      }
      50% {
        filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 5px rgba(255, 255, 255, 0.7)) drop-shadow(0 0 8px rgba(255, 255, 255, 0.5));
      }
    }

    @media (max-width: 640px) {
      .context-menu {
        min-width: 180px;
        max-width: calc(100vw - 32px);
      }
    }
  `]
})
export class WeekTimelineSvgComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() tasks: Task[] = [];
  @Input() environments: Environment[] = [];
  @Input() taskTypes: TaskType[] = [];
  @Input() projects: Project[] = [];
  
  private loadedProjects: Project[] = [];
  
  focusedEnvironmentId: string | null = null;
  private focusSubscription?: Subscription;
  
  // Modo de coloreado: 'environment' por defecto, 'taskType' cuando se enfoca un ambiente
  colorMode: 'environment' | 'taskType' = 'environment';

  constructor(
    private cdr: ChangeDetectorRef,
    private timelineFocusService: TimelineFocusService,
    private projectService: ProjectService
  ) {}

  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<Task>();
  @Output() toggleHidden = new EventEmitter<Task>();
  @Output() changeStatus = new EventEmitter<{ task: Task; status: 'pending' | 'in-progress' | 'completed' }>();

  @ViewChild('containerRef') containerRef!: ElementRef<HTMLDivElement>;

  // 📅 NAVEGACIÓN DE SEMANA
  currentWeekStart: Date = this.getWeekStart(new Date()); // Domingo de la semana actual
  
  // 💡 SISTEMA DE TOOLTIP
  showTooltip: boolean = false;
  tooltipTask: Task | null = null;
  tooltipTimeout: any = null;

  // 📱 SISTEMA DE MENÚ CONTEXTUAL
  showContextMenu: boolean = false;
  contextMenuTask: Task | null = null;
  contextMenuX: number = 0;
  contextMenuY: number = 0;
  private longPressTimeout: any = null;
  private longPressStartX: number = 0;
  private longPressStartY: number = 0;
  private longPressTask: Task | null = null; // Tarea asociada al long press actual
  private isTouchActive: boolean = false; // Bandera para rastrear si el toque está activo
  private longPressCompleted: boolean = false; // Indica si el long press se completó antes del touchend
  private readonly LONG_PRESS_DURATION = 500;
  private readonly LONG_PRESS_MOVE_THRESHOLD = 10;

  // Propiedades de dimensiones
  svgWidth = 1400;
  minSvgWidth = 800;
  hoursAreaHeight = 900; // 24 horas * 37.5px = 900px (37.5px por hora, 125% del tamaño original)
  svgHeight = 60 + this.hoursAreaHeight; // Encabezado + área de horas
  
  // Ancho de cada columna de día
  dayColumnWidth = 180;
  dayColumnPadding = 4;
  
  // Espaciado entre columnas
  columnGap = 2;
  
  // Fuentes
  dayNameFontSize = 14;
  dayNumberFontSize = 12;
  hourFontSize = 10;
  taskFontSize = 11;
  
  // Array de índices para crear divisiones cada media hora (0-47)
  // Cada índice representa una división de media hora, creando 48 divisiones en total
  // Las etiquetas muestran las 24 horas completas en formato 12 horas (12:00 AM - 11:00 PM)
  hours: number[] = Array.from({length: 48}, (_, i) => i);
  
  // Días de la semana
  weekDays: WeekDay[] = [];
  
  private resizeObserver?: ResizeObserver;
  private containerPadding = 16;

  // Obtener el domingo de la semana para una fecha dada
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 = domingo, 1 = lunes, etc.
    const diff = d.getDate() - day; // Diferencia hasta el domingo
    const sunday = new Date(d.setDate(diff));
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  }

  // Actualizar los días de la semana
  private updateWeekDays(): void {
    this.weekDays = [];
    const weekStart = new Date(this.currentWeekStart);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      
      this.weekDays.push({
        date: new Date(day),
        dayName: dayNames[i],
        dayNumber: day.getDate(),
        monthDay: day.getDate()
      });
    }
  }

  // Obtener posición X de una columna de día
  getDayColumnX(dayIndex: number): number {
    return dayIndex * (this.dayColumnWidth + this.columnGap);
  }

  // Obtener posición Y de una división (índice de media hora)
  // Cada hora completa ocupa 37.5px, cada media hora ocupa 18.75px
  // 48 divisiones × 18.75px = 900px (24 horas × 37.5px)
  getHourY(hourIndex: number): number {
    return hourIndex * 18.75;
  }

  // Verificar si una columna es el día de hoy
  isTodayColumn(dayIndex: number): boolean {
    const today = new Date();
    const day = this.weekDays[dayIndex];
    if (!day) return false;
    
    return day.date.toDateString() === today.toDateString();
  }

  // Verificar si es la hora actual
  isCurrentHour(): boolean {
    const today = new Date();
    const currentWeekStart = this.getWeekStart(today);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 7);
    
    return today >= currentWeekStart && today < currentWeekEnd;
  }

  // Obtener posición Y de la hora actual
  getCurrentHourY(): number {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    // Convertir a píxeles: cada hora son 37.5px, cada minuto son 37.5/60 = 0.625px
    return (hour * 37.5) + (minutes * 0.625);
  }

  // Formatear hora en formato 12 horas
  // Recibe un índice (0-47) que representa divisiones de media hora
  // Muestra las 24 horas completas en formato 12 horas: 12:00 AM, 1:00 AM, ..., 11:00 AM, 12:00 PM, 1:00 PM, ..., 11:00 PM
  // Aunque las divisiones son cada media hora, las etiquetas muestran solo las horas completas (:00)
  formatHour(hourIndex: number): string {
    const hour12 = hourIndex; // Índice usado directamente como hora (0-47 se convierte a 0-23 para display)
    
    // Convertir a formato 12 horas
    let displayHour = hour12;
    let period = 'AM';
    
    if (hour12 === 0) {
      displayHour = 12; // 12:00 AM (medianoche)
    } else if (hour12 === 12) {
      displayHour = 12; // 12:00 PM (mediodía)
      period = 'PM';
    } else if (hour12 > 12) {
      displayHour = hour12 - 12; // 1:00 PM - 11:00 PM
      period = 'PM';
    }
    
    const minutes = '00'; // Siempre muestra horas completas (:00)
    return `${displayHour}:${minutes} ${period}`;
  }

  // Método utilitario para convertir fechas UTC a hora local
  private parseUTCToLocal(dateTimeString: string): Date {
    const utcString = dateTimeString + (dateTimeString.includes('Z') ? '' : 'Z');
    return new Date(utcString);
  }

  async ngOnInit() {
    try {
      this.loadedProjects = await this.projectService.getProjects();
    } catch (error) {
      console.error('Error al cargar proyectos:', error);
      this.loadedProjects = [];
    }
    
    if (this.projects.length > 0) {
      this.loadedProjects = this.projects;
    }
    
    this.focusedEnvironmentId = this.timelineFocusService.getCurrentFocusedEnvironmentId();
    this.focusSubscription = this.timelineFocusService.getFocusedEnvironmentId().subscribe(envId => {
      const changed = this.focusedEnvironmentId !== envId;
      this.focusedEnvironmentId = envId;
      if (changed) {
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        this.updateSvgDimensions();
      }
    });
    
    this.updateWeekDays();
    this.updateSvgDimensions();
  }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['projects'] && this.projects.length > 0) {
      this.loadedProjects = this.projects;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      this.updateSvgDimensions();
    }
  }

  ngAfterViewInit() {
    this.initializeResizeObserver();
    setTimeout(() => {
      this.updateSvgDimensions();
    }, 100);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.updateSvgDimensions();
  }

  private initializeResizeObserver() {
    if (typeof ResizeObserver !== 'undefined' && this.containerRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateSvgDimensions();
      });
      this.resizeObserver.observe(this.containerRef.nativeElement);
    }
  }

  private updateSvgDimensions() {
    if (typeof window === 'undefined') {
      this.svgWidth = Math.floor(1400);
      return;
    }

    const screenWidth = window.innerWidth;
    let containerWidth = screenWidth;

    if (this.containerRef?.nativeElement) {
      const rect = this.containerRef.nativeElement.getBoundingClientRect();
      containerWidth = rect.width;
    }

    const availableWidth = Math.max(containerWidth - this.containerPadding, this.minSvgWidth);

    // Calcular ancho mínimo necesario para 7 columnas
    const minRequiredWidth = 7 * (this.dayColumnWidth + this.columnGap) - this.columnGap;
    
    if (screenWidth <= 640) {
      // Móviles: columnas más estrechas
      this.dayColumnWidth = Math.max(120, (availableWidth - 6 * this.columnGap) / 7);
      this.dayNameFontSize = 11;
      this.dayNumberFontSize = 10;
      this.hourFontSize = 8;
      this.taskFontSize = 9;
    } else if (screenWidth <= 1024) {
      // Tablets
      this.dayColumnWidth = Math.max(140, (availableWidth - 6 * this.columnGap) / 7);
      this.dayNameFontSize = 12;
      this.dayNumberFontSize = 11;
      this.hourFontSize = 9;
      this.taskFontSize = 10;
    } else {
      // Desktop
      this.dayColumnWidth = Math.max(180, Math.min(200, (availableWidth - 6 * this.columnGap) / 7));
      this.dayNameFontSize = 14;
      this.dayNumberFontSize = 12;
      this.hourFontSize = 10;
      this.taskFontSize = 11;
    }

    this.svgWidth = Math.max(minRequiredWidth, 7 * (this.dayColumnWidth + this.columnGap) - this.columnGap);
  }

  // Obtener elementos renderizables para un día específico
  getRenderableItemsForDay(dayIndex: number): RenderableItem[] {
    const day = this.weekDays[dayIndex];
    if (!day) return [];

    const dayStart = new Date(day.date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(day.date);
    dayEnd.setHours(23, 59, 59, 999);

    // Filtrar por ambiente enfocado si hay uno
    let filteredTasks = this.tasks;
    if (this.focusedEnvironmentId) {
      filteredTasks = this.tasks.filter(task => task.environment === this.focusedEnvironmentId);
    }

    const items: RenderableItem[] = [];

    for (const task of filteredTasks) {
      // Si tiene fragmentos, procesarlos individualmente sin verificar la tarea principal
      if (task.fragments && task.fragments.length > 0) {
        for (let i = 0; i < task.fragments.length; i++) {
          const fragment = task.fragments[i];
          if (fragment.start && fragment.end) {
            const fragmentStart = this.parseUTCToLocal(fragment.start);
            const fragmentEnd = this.parseUTCToLocal(fragment.end);
            
            // Verificar si este fragmento específico se superpone con este día
            if (fragmentStart <= dayEnd && fragmentEnd >= dayStart) {
              items.push({
                type: 'fragment',
                task: task,
                fragmentIndex: i,
                start: fragment.start,
                end: fragment.end
              });
            }
          }
        }
      } else {
        // Si no tiene fragmentos, verificar la tarea principal
        const taskStart = this.parseUTCToLocal(task.start);
        const taskEnd = this.parseUTCToLocal(task.end);
        
        if (taskStart <= dayEnd && taskEnd >= dayStart) {
          items.push({
            type: 'task',
            task: task,
            start: task.start,
            end: task.end
          });
        }
      }
    }

    return items;
  }

  // Obtener posición X de una tarea dentro de su columna
  getTaskX(item: RenderableItem, dayIndex: number): number {
    return this.dayColumnPadding;
  }

  // Obtener posición Y de una tarea
  getTaskY(item: RenderableItem, dayIndex: number): number {
    const itemStart = this.parseUTCToLocal(item.start);
    const day = this.weekDays[dayIndex];
    if (!day) return 0;

    const dayStart = new Date(day.date);
    dayStart.setHours(0, 0, 0, 0);

    // Si la tarea comienza antes del día, empezar desde el inicio del día
    let effectiveStart: Date;
    if (itemStart < dayStart) {
      effectiveStart = new Date(dayStart);
    } else {
      effectiveStart = new Date(itemStart);
    }

    // Calcular píxeles desde el inicio del día: cada hora son 37.5px, cada minuto son 0.625px
    const minutesFromDayStart = (effectiveStart.getHours() * 60) + effectiveStart.getMinutes();
    const pixelsFromDayStart = minutesFromDayStart * 0.625; // 0.625px por minuto (37.5px por hora)
    
    return pixelsFromDayStart;
  }

  // Obtener ancho de una tarea
  getTaskWidth(item: RenderableItem, dayIndex: number): number {
    return this.dayColumnWidth - (this.dayColumnPadding * 2);
  }

  // Obtener altura de una tarea
  getTaskHeight(item: RenderableItem, dayIndex: number): number {
    const itemStart = this.parseUTCToLocal(item.start);
    const itemEnd = this.parseUTCToLocal(item.end);
    const day = this.weekDays[dayIndex];
    if (!day) return 0;

    const dayStart = new Date(day.date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(day.date);
    dayEnd.setHours(23, 59, 59, 999);

    // Ajustar inicio y fin para que estén dentro del día
    let effectiveStart: Date;
    let effectiveEnd: Date;

    if (itemStart < dayStart) {
      effectiveStart = new Date(dayStart);
    } else {
      effectiveStart = new Date(itemStart);
    }

    if (itemEnd > dayEnd) {
      effectiveEnd = new Date(dayEnd);
    } else {
      effectiveEnd = new Date(itemEnd);
    }

    // Calcular diferencia en minutos
    const startMinutes = (effectiveStart.getHours() * 60) + effectiveStart.getMinutes();
    const endMinutes = (effectiveEnd.getHours() * 60) + effectiveEnd.getMinutes();
    
    const durationMinutes = Math.max(endMinutes - startMinutes, 15); // Mínimo 15 minutos
    const durationPixels = durationMinutes * 0.625; // 0.625px por minuto (37.5px por hora)
    
    return durationPixels;
  }

  // Obtener texto de una tarea
  getTaskText(item: RenderableItem, dayIndex: number): string {
    const emoji = item.task.emoji || '📋';
    let name = item.task.name || 'Sin título';
    
    if (this.focusedEnvironmentId && item.task.project) {
      const projectsToUse = this.loadedProjects.length > 0 ? this.loadedProjects : this.projects;
      const project = projectsToUse.find(p => p.id === item.task.project);
      if (project) {
        const projectInitials = this.getProjectInitials(project.name);
        name = `${projectInitials}: ${name}`;
      }
    }
    
    if (item.type === 'fragment' && item.fragmentIndex !== undefined) {
      name = `${name} [F${item.fragmentIndex + 1}]`;
    }
    
    const taskWidth = this.getTaskWidth(item, dayIndex);
    const availableChars = Math.floor(taskWidth / (this.taskFontSize * 0.5));
    
    if (availableChars >= name.length) {
      return `${emoji} ${name}`;
    } else if (availableChars >= 3) {
      return `${emoji} ${name.substring(0, availableChars - 3)}...`;
    } else {
      return emoji;
    }
  }

  getTaskColor(task: Task): string {
    // Si NO hay ambiente enfocado, usar color de ambiente siempre
    if (!this.focusedEnvironmentId) {
      if (task.environment && this.environments.length > 0) {
        const environment = this.environments.find(env => env.id === task.environment);
        if (environment && environment.color) {
          return environment.color;
        }
      }
    } else {
      // Si HAY ambiente enfocado, respetar el modo de coloreado seleccionado
      if (this.colorMode === 'taskType') {
        // Modo: colorear por tipo de tarea
        const typeColor = this.getTaskTypeColor(task);
        if (typeColor) {
          return typeColor;
        }
      } else {
        // Modo: colorear por ambiente (por defecto cuando hay enfoque)
        if (task.environment && this.environments.length > 0) {
          const environment = this.environments.find(env => env.id === task.environment);
          if (environment && environment.color) {
            return environment.color;
          }
        }
      }
    }
    
    // Fallback a colores por prioridad
    switch (task.priority) {
      case 'low': return '#4ade80';
      case 'medium': return '#60a5fa';
      case 'high': return '#f87171';
      case 'critical': return '#f472b6';
      default: return '#a3a3a3';
    }
  }

  isTaskOverdue(task: Task): boolean {
    if (task.status === 'completed' || task.completed) return false;
    const endDate = this.parseUTCToLocal(task.end);
    const now = new Date();
    return endDate < now;
  }

  isTaskRunning(task: Task): boolean {
    if (task.status === 'completed' || task.completed) return false;
    const startDate = this.parseUTCToLocal(task.start);
    const endDate = this.parseUTCToLocal(task.end);
    const now = new Date();
    return startDate <= now && now <= endDate;
  }

  // Determina si una tarea es futura (aún no ha comenzado)
  isFutureTask(task: Task): boolean {
    const startDate = this.parseUTCToLocal(task.start);
    const now = new Date();
    return startDate > now;
  }

  // Determina si un item (tarea o fragmento) es futuro
  isFutureItem(item: RenderableItem): boolean {
    const startDate = this.parseUTCToLocal(item.start);
    const now = new Date();
    return startDate > now;
  }

  // Determina si se debe mostrar como oculta (solo si es futura Y está marcada como hidden)
  shouldShowAsHidden(item: RenderableItem): boolean {
    return item.task.hidden === true && this.isFutureItem(item);
  }
  
  toggleColorMode(): void {
    this.colorMode = this.colorMode === 'environment' ? 'taskType' : 'environment';
    this.cdr.detectChanges();
  }

  getTaskTypeColor(task: Task): string | null {
    if (!task.type || !this.taskTypes.length) return null;
    const taskType = this.taskTypes.find(t => t.id === task.type);
    return taskType?.color || null;
  }

  getProjectInitials(projectName: string): string {
    if (!projectName) return '';
    const withoutSpaces = projectName.replace(/\s+/g, '');
    return withoutSpaces.substring(0, 3).toUpperCase();
  }

  getTaskDisplayName(task: Task): string {
    let name = task.name || 'Sin título';
    
    if (this.focusedEnvironmentId && task.project) {
      const projectsToUse = this.loadedProjects.length > 0 ? this.loadedProjects : this.projects;
      const project = projectsToUse.find(p => p.id === task.project);
      if (project) {
        const projectInitials = this.getProjectInitials(project.name);
        name = `${projectInitials}: ${name}`;
      }
    }
    
    return name;
  }

  getTaskDuration(task: Task): number | null {
    if (task.fragments && task.fragments.length > 0) {
      let totalDuration = 0;
      for (const fragment of task.fragments) {
        if (fragment.start && fragment.end) {
          const start = this.parseUTCToLocal(fragment.start);
          const end = this.parseUTCToLocal(fragment.end);
          const diffMs = end.getTime() - start.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          totalDuration += Math.max(0, diffHours);
        }
      }
      return totalDuration > 0 ? totalDuration : null;
    }
    
    if (task.duration && task.duration > 0) {
      return task.duration;
    }
    
    if (task.start && task.end) {
      const start = this.parseUTCToLocal(task.start);
      const end = this.parseUTCToLocal(task.end);
      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return Math.max(0, diffHours);
    }
    
    return null;
  }

  formatTaskDuration(hours: number | null): string {
    if (!hours || hours === 0) return '0 horas';
    
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

  formatTaskTime(dateTimeString: string): string {
    if (!dateTimeString) return '';
    const date = this.parseUTCToLocal(dateTimeString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  // Navegación de semana
  goToPreviousWeek() {
    const newDate = new Date(this.currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    this.currentWeekStart = new Date(newDate);
    this.updateWeekDays();
    this.updateSvgDimensions();
  }

  goToNextWeek() {
    const newDate = new Date(this.currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    this.currentWeekStart = new Date(newDate);
    this.updateWeekDays();
    this.updateSvgDimensions();
  }

  goToCurrentWeek() {
    this.currentWeekStart = this.getWeekStart(new Date());
    this.updateWeekDays();
    this.updateSvgDimensions();
  }

  formatWeekRange(): string {
    const weekStart = new Date(this.currentWeekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const startStr = weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    const endStr = weekEnd.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    
    return `${startStr} - ${endStr}`;
  }

  getWeekInputValue(): string {
    const year = this.currentWeekStart.getFullYear();
    const month = String(this.currentWeekStart.getMonth() + 1).padStart(2, '0');
    const day = String(this.currentWeekStart.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onWeekDateChange(dateString: string) {
    if (dateString) {
      const [year, month, day] = dateString.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);
      this.currentWeekStart = this.getWeekStart(selectedDate);
      this.updateWeekDays();
      this.updateSvgDimensions();
    }
  }

  isCurrentWeek(): boolean {
    const today = new Date();
    const currentWeekStart = this.getWeekStart(today);
    return this.currentWeekStart.toDateString() === currentWeekStart.toDateString();
  }

  // Sistema de tooltip
  onTaskClick(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    
    // Cancelar cualquier long press pendiente cuando se hace click (toque normal)
    // Esto evita que el menú contextual aparezca después de mostrar el tooltip
    this.cancelLongPress();
    
    // Cerrar el menú contextual si está abierto
    if (this.showContextMenu) {
      this.closeContextMenu();
    }
    
    if (this.showTooltip && this.tooltipTask && this.tooltipTask.id === task.id) {
      this.hideTooltip();
      return;
    }
    
    this.showTaskTooltip(task);
  }

  showTaskTooltip(task: Task): void {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }

    this.tooltipTask = task;
    this.showTooltip = true;

    this.tooltipTimeout = setTimeout(() => {
      this.hideTooltip();
    }, 4000);
  }

  hideTooltip(): void {
    this.showTooltip = false;
    this.tooltipTask = null;
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
  }

  onTaskDoubleClick(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    this.hideTooltip();
    this.editTask.emit(task);
  }

  // Menú contextual
  onTaskContextMenu(task: Task, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.showTaskContextMenu(task, event.clientX, event.clientY);
  }

  onTaskTouchStart(task: Task, event: TouchEvent): void {
    // EVENTO: touchstart - Se dispara cuando el usuario comienza a tocar un bloque/tarea
    if (event.touches.length !== 1) return;
    
    // Cancelar cualquier long press previo que pueda estar pendiente
    this.cancelLongPress();
    
    // Resetear banderas
    this.longPressCompleted = false;
    
    // Marcar que el toque está activo
    this.isTouchActive = true;
    
    // Guardar la posición inicial del toque
    const touch = event.touches[0];
    this.longPressStartX = touch.clientX;
    this.longPressStartY = touch.clientY;
    
    // Guardar referencia a la tarea para el long press
    this.longPressTask = task;
    
    // Iniciar el timeout para detectar pulsación larga
    this.longPressTimeout = setTimeout(() => {
      // Solo marcar como completado si el toque aún está activo (el dedo sigue presionado)
      // NO mostramos el menú aquí, esperamos a touchend para verificar el movimiento
      if (this.longPressTimeout && this.isTouchActive) {
        this.longPressCompleted = true;
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    }, this.LONG_PRESS_DURATION);
  }

  onTaskTouchMove(event: TouchEvent): void {
    // EVENTO: touchmove - Se dispara durante el desplazamiento/scroll mientras el dedo está sobre el bloque
    // Si hay movimiento significativo durante el desplazamiento, cancelamos el long press
    if (!this.longPressTimeout) return;
    
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = Math.abs(touch.clientX - this.longPressStartX);
      const deltaY = Math.abs(touch.clientY - this.longPressStartY);
      
      // Si el movimiento supera el umbral, es un scroll y cancelamos el long press
      if (deltaX > this.LONG_PRESS_MOVE_THRESHOLD || deltaY > this.LONG_PRESS_MOVE_THRESHOLD) {
        this.cancelLongPress();
      }
    }
  }

  onTaskTouchEnd(event: TouchEvent): void {
    // EVENTO: touchend - Se dispara cuando el usuario suelta el dedo del bloque
    // Aquí verificamos la distancia total recorrida para diferenciar entre scroll y pulsación larga
    
    // Marcar que el toque ya no está activo
    this.isTouchActive = false;
    
    // Si el long press se completó (el usuario mantuvo el dedo sin mover por 500ms)
    // verificamos si realmente no hubo movimiento significativo
    if (this.longPressCompleted && this.longPressTask && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      const touchEndX = touch.clientX;
      const touchEndY = touch.clientY;
      
      // Calcular la distancia total recorrida desde el inicio del toque
      const deltaX = Math.abs(touchEndX - this.longPressStartX);
      const deltaY = Math.abs(touchEndY - this.longPressStartY);
      
      // Solo mostrar el menú si el movimiento fue menor que el umbral
      // Esto significa que fue una pulsación larga, no un scroll
      if (deltaX < this.LONG_PRESS_MOVE_THRESHOLD && deltaY < this.LONG_PRESS_MOVE_THRESHOLD) {
        // El dedo permaneció prácticamente quieto, es un long press válido
        this.showTaskContextMenu(this.longPressTask, this.longPressStartX, this.longPressStartY);
      }
      // Si el movimiento fue mayor, fue un scroll y no mostramos el menú
    }
    
    // Limpiar todo
    this.longPressCompleted = false;
    this.longPressTask = null;
    this.cancelLongPress();
  }

  private cancelLongPress(): void {
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
    // También marcar que el toque ya no está activo cuando se cancela
    this.isTouchActive = false;
    this.longPressCompleted = false;
    this.longPressTask = null;
  }

  showTaskContextMenu(task: Task, x: number, y: number): void {
    this.hideTooltip();
    
    this.contextMenuTask = task;
    this.contextMenuX = x;
    this.contextMenuY = y;
    this.showContextMenu = true;
  }

  closeContextMenu(): void {
    this.showContextMenu = false;
    this.contextMenuTask = null;
  }

  deleteTaskFromContextMenu(): void {
    if (this.contextMenuTask) {
      this.deleteTask.emit(this.contextMenuTask);
      this.closeContextMenu();
    }
  }

  toggleHiddenFromContextMenu(): void {
    if (this.contextMenuTask) {
      console.log('👁️ Cambiando visibilidad de tarea:', this.contextMenuTask.name);
      this.toggleHidden.emit(this.contextMenuTask);
      this.closeContextMenu();
    }
  }

  changeStatusFromContextMenu(status: 'pending' | 'in-progress' | 'completed'): void {
    if (this.contextMenuTask) {
      console.log('🔄 Cambiando estado de tarea:', this.contextMenuTask.name, 'a', status);
      this.changeStatus.emit({ task: this.contextMenuTask, status });
      this.closeContextMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showContextMenu) {
      this.closeContextMenu();
    }
    if (this.showTooltip) {
      this.hideTooltip();
    }
  }

  ngOnDestroy(): void {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
    }
    if (this.focusSubscription) {
      this.focusSubscription.unsubscribe();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}

