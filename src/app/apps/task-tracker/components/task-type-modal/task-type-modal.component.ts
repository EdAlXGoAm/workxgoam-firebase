import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskTypeService } from '../../services/task-type.service';
import { TaskType } from '../../models/task-type.model';

@Component({
  selector: 'app-task-type-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" (click)="$event.stopPropagation()">
        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 class="text-xl font-semibold text-gray-800">Gestionar Tipos de Tarea</h3>
          <button (click)="onClose()" class="text-gray-400 hover:text-gray-600 transition">
            <i class="fas fa-times fa-lg"></i>
          </button>
        </div>
        
        <div class="flex-1 overflow-y-auto p-6">
          <!-- Formulario para crear nuevo tipo -->
          <div class="mb-6 pb-6 border-b border-gray-200">
            <h4 class="text-lg font-medium text-gray-700 mb-4">Nuevo Tipo de Tarea</h4>
            <form (ngSubmit)="onCreateSubmit()" class="space-y-4">
              <div>
                <label for="typeName" class="block text-sm font-medium text-gray-700 mb-1">Nombre del Tipo</label>
                <input 
                  type="text" 
                  id="typeName" 
                  name="typeName" 
                  [(ngModel)]="newTypeName" 
                  required 
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Ej: Reunión, Análisis, Ejecución...">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">Color</label>
                <div class="mb-6">
                  <p class="text-xs text-gray-500 mb-3">Colores sugeridos:</p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      *ngFor="let colorOpt of suggestedColors"
                      type="button"
                      (click)="selectSuggestedColor(colorOpt)"
                      class="w-8 h-8 rounded-full border-2 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      [style.background-color]="colorOpt"
                      [class.border-gray-800]="newTypeColor === colorOpt"
                      [class.border-gray-300]="newTypeColor !== colorOpt"
                      [title]="colorOpt">
                    </button>
                  </div>
                </div>

                <div class="mb-4">
                  <p class="text-xs text-gray-500 mb-3">O elige un color personalizado:</p>
                  <div class="flex gap-4">
                    <div class="relative">
                      <div 
                        class="w-48 h-32 border border-gray-300 rounded-lg cursor-crosshair relative overflow-hidden"
                        [style.background]="'linear-gradient(to right, white, hsl(' + colorPickerHue + ', 100%, 50%)), linear-gradient(to top, black, transparent)'"
                        (click)="onColorAreaClick($event)">
                        <div 
                          class="absolute w-3 h-3 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                          [style.left]="colorPickerSaturation + '%'"
                          [style.top]="(100 - colorPickerLightness) + '%'"
                          style="box-shadow: 0 0 0 1px rgba(0,0,0,0.3);">
                        </div>
                      </div>
                    </div>

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
                        <div 
                          class="absolute w-full h-0.5 bg-white border border-gray-400 transform -translate-y-1/2 pointer-events-none"
                          [style.top]="(colorPickerHue / 360) * 100 + '%'">
                        </div>
                      </div>
                    </div>

                    <div class="flex flex-col items-center gap-2">
                      <p class="text-xs text-gray-500">Vista previa:</p>
                      <div 
                        class="w-16 h-16 border border-gray-300 rounded-lg"
                        [style.background-color]="newTypeColor || '#3B82F6'">
                      </div>
                      <p class="text-xs font-mono text-gray-600">{{ newTypeColor || '#3B82F6' }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex justify-end space-x-3">
                <button type="button" (click)="resetNewTypeForm()"
                        class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">
                  Limpiar
                </button>
                <button type="submit"
                        class="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  Crear Tipo
                </button>
              </div>
            </form>
          </div>

          <!-- Lista de tipos existentes -->
          <div>
            <h4 class="text-lg font-medium text-gray-700 mb-4">Tipos Existentes</h4>
            <div *ngIf="taskTypes.length === 0" class="text-center text-gray-500 py-8">
              <i class="fas fa-tags text-3xl mb-2"></i>
              <p>No hay tipos de tarea creados aún</p>
            </div>
            <div *ngIf="taskTypes.length > 0" class="space-y-2">
              <div *ngFor="let type of taskTypes" 
                   class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                <div class="flex items-center gap-3">
                  <div class="w-6 h-6 rounded-full border-2 border-white shadow-sm" 
                       [style.background-color]="type.color"></div>
                  <span class="font-medium text-gray-700">{{ type.name }}</span>
                </div>
                <button 
                  type="button"
                  (click)="onDelete(type.id)"
                  class="text-red-500 hover:text-red-700 transition-colors"
                  title="Eliminar tipo">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div class="flex justify-end">
            <button type="button" (click)="onClose()"
                    class="px-4 py-2 bg-gray-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class TaskTypeModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() showModal: boolean = false;
  @Input() projectId: string = '';
  @Output() closeModal = new EventEmitter<void>();
  @Output() taskTypeCreated = new EventEmitter<void>();

  taskTypes: TaskType[] = [];
  newTypeName: string = '';
  newTypeColor: string = '#3B82F6';

  // Color picker state
  colorPickerHue: number = 220;
  colorPickerSaturation: number = 76;
  colorPickerLightness: number = 60;

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

  constructor(private taskTypeService: TaskTypeService) {}

  ngOnInit() {
    this.loadTaskTypes();
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showModal'] && this.showModal) {
      this.loadTaskTypes();
    }
    if (changes['projectId']) {
      this.loadTaskTypes();
    }
  }

  async loadTaskTypes() {
    if (!this.projectId) {
      this.taskTypes = [];
      return;
    }
    try {
      this.taskTypes = await this.taskTypeService.getTaskTypesByProject(this.projectId);
    } catch (error) {
      console.error('Error cargando tipos de tarea:', error);
      this.taskTypes = [];
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  async onCreateSubmit(): Promise<void> {
    const trimmedName = (this.newTypeName || '').trim();
    if (!trimmedName || !this.projectId) return;

    try {
      await this.taskTypeService.createTaskType({
        projectId: this.projectId,
        name: trimmedName,
        color: this.newTypeColor || '#3B82F6'
      });
      this.resetNewTypeForm();
      await this.loadTaskTypes();
      this.taskTypeCreated.emit();
    } catch (error) {
      console.error('Error creando tipo de tarea:', error);
      alert('Error al crear el tipo de tarea. Por favor, intenta de nuevo.');
    }
  }

  async onDelete(taskTypeId: string): Promise<void> {
    if (!confirm('¿Estás seguro de que deseas eliminar este tipo de tarea?')) {
      return;
    }

    try {
      await this.taskTypeService.deleteTaskType(taskTypeId);
      await this.loadTaskTypes();
      this.taskTypeCreated.emit();
    } catch (error) {
      console.error('Error eliminando tipo de tarea:', error);
      alert('Error al eliminar el tipo de tarea. Por favor, intenta de nuevo.');
    }
  }

  resetNewTypeForm(): void {
    this.newTypeName = '';
    this.newTypeColor = '#3B82F6';
    const hsl = this.hexToHsl('#3B82F6');
    this.colorPickerHue = hsl.h;
    this.colorPickerSaturation = hsl.s;
    this.colorPickerLightness = hsl.l;
  }

  selectSuggestedColor(color: string): void {
    this.newTypeColor = color;
    const hsl = this.hexToHsl(color);
    this.colorPickerHue = hsl.h;
    this.colorPickerSaturation = hsl.s;
    this.colorPickerLightness = hsl.l;
  }

  onColorAreaClick(event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.colorPickerSaturation = Math.round((x / rect.width) * 100);
    this.colorPickerLightness = Math.round(100 - (y / rect.height) * 100);
    this.updateColorFromHsl();
  }

  onHueBarClick(event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const y = event.clientY - rect.top;
    this.colorPickerHue = Math.round((y / rect.height) * 360);
    this.updateColorFromHsl();
  }

  private updateColorFromHsl(): void {
    this.newTypeColor = this.hslToHex(this.colorPickerHue, this.colorPickerSaturation, this.colorPickerLightness);
  }

  private hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  private hexToHsl(hex: string): { h: number, s: number, l: number } {
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
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
}

