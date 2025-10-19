import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-task-tracker-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Nota: Header sticky. Usa Tailwind 'sticky top-0 z-50' para fijarse al hacer scroll y quedar sobre el contenido -->
    <header class="bg-indigo-600 text-white shadow-lg sticky top-0 z-50">

    <!-- Contenedor para el contenido del header -->
      <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">

        <!-- Contenedor para el logo y el título -->
        <div class="flex items-center space-x-3">
          <i class="fas fa-tasks text-2xl"></i>
          <h1 class="text-2xl font-bold select-none">TaskFlow</h1>
        </div>

        <!-- Botón de nueva tarea -->
        <div class="flex items-center">
          <button (click)="createTask.emit()" class="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition">
            <i class="fas fa-plus mr-2"></i>Nueva Tarea
          </button>
        </div>

      </div>
    </header>
  `
})
export class TaskTrackerHeaderComponent {
  @Input() userName: string = '';
  @Input() userPhotoUrl: string = '';
  @Output() createTask = new EventEmitter<void>();
}