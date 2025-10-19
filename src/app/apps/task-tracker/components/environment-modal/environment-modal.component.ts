import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-environment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all">
        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h3 class="text-xl font-semibold text-gray-800">Nuevo Ambiente</h3>
          <button (click)="onClose()" class="text-gray-400 hover:text-gray-600 transition">
            <i class="fas fa-times fa-lg"></i>
          </button>
        </div>
        <div class="p-6">
          <form (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label for="envName" class="block text-sm font-medium text-gray-700 mb-1">Nombre del Ambiente</label>
              <input type="text" id="envName" name="envName" [(ngModel)]="name" required 
                     class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                     placeholder="Ingresa el nombre del ambiente">
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
                    [class.border-gray-800]="color === colorOpt"
                    [class.border-gray-300]="color !== colorOpt"
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
                      [style.background-color]="color || '#3B82F6'">
                    </div>
                    <p class="text-xs font-mono text-gray-600">{{ color || '#3B82F6' }}</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex justify-end space-x-3 pt-4">
              <button type="button" (click)="onClose()"
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
  `
})
export class EnvironmentModalComponent implements OnChanges {
  @Input() showModal: boolean = false;
  @Input() suggestedColors: string[] = [];
  @Input() initialEnvironment: { name?: string; color?: string } | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() saveEnvironment = new EventEmitter<{ name: string; color: string }>();

  name: string = '';
  color: string = '#3B82F6';

  // Color picker state
  colorPickerHue: number = 220;
  colorPickerSaturation: number = 76;
  colorPickerLightness: number = 60;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialEnvironment']) {
      this.initializeFromInput();
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onSubmit(): void {
    const trimmedName = (this.name || '').trim();
    if (!trimmedName) return;
    this.saveEnvironment.emit({ name: trimmedName, color: this.color || '#3B82F6' });
  }

  selectSuggestedColor(color: string): void {
    this.color = color;
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

  private initializeFromInput(): void {
    const inputName = this.initialEnvironment?.name || '';
    const inputColor = this.initialEnvironment?.color || '#3B82F6';
    this.name = inputName;
    this.color = inputColor;
    const hsl = this.hexToHsl(inputColor);
    this.colorPickerHue = hsl.h;
    this.colorPickerSaturation = hsl.s;
    this.colorPickerLightness = hsl.l;
  }

  private updateColorFromHsl(): void {
    this.color = this.hslToHex(this.colorPickerHue, this.colorPickerSaturation, this.colorPickerLightness);
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


