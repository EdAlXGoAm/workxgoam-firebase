import { Component, Input, Output, EventEmitter, forwardRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string | number;
  label: string;
  subtitle?: string; // Para mostrar información adicional como fecha
  image?: string; // URL o base64 de imagen (para proyectos con imagen)
}

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="custom-select-container" [class.disabled]="disabled">
      <!-- Input clickeable que muestra la opción seleccionada -->
      <div 
        class="custom-select-input"
        [class.open]="isOpen"
        [class.disabled]="disabled"
        [class.rounded-r-none]="!roundedRight"
        (click)="toggleDropdown($event)">
        <div class="flex-1 truncate flex items-center gap-2">
          <img *ngIf="selectedOption?.image" 
               [src]="selectedOption?.image" 
               class="w-6 h-6 rounded-md object-cover flex-shrink-0"
               alt="">
          <span *ngIf="selectedOption" class="selected-text">{{ selectedOption.label }}</span>
          <span *ngIf="!selectedOption" class="placeholder-text">{{ placeholder }}</span>
        </div>
        <i class="fas transition-transform duration-200" 
           [class.fa-chevron-down]="!isOpen"
           [class.fa-chevron-up]="isOpen"></i>
      </div>
      
      <!-- Dropdown con las opciones - position fixed para salir del contenedor -->
      <div 
        *ngIf="isOpen" 
        class="custom-select-dropdown"
        [style.top.px]="dropdownTop"
        [style.left.px]="dropdownLeft"
        [style.width.px]="dropdownWidth"
        [class.max-h-60]="!maxHeightClass"
        [class]="maxHeightClass">
        <div class="options-list">
          <div 
            *ngFor="let option of options"
            class="option-item"
            [class.selected]="value === option.value"
            (click)="selectOption(option, $event)">
            <img *ngIf="option.image" 
                 [src]="option.image" 
                 class="w-8 h-8 rounded-md object-cover flex-shrink-0"
                 alt="">
            <div class="option-content">
              <span class="option-label">{{ option.label }}</span>
              <span *ngIf="option.subtitle" class="option-subtitle">{{ option.subtitle }}</span>
            </div>
            <i *ngIf="value === option.value" class="fas fa-check text-indigo-600"></i>
          </div>
          
          <div *ngIf="options.length === 0" class="option-item text-center text-gray-400">
            {{ emptyMessage }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .custom-select-container {
      position: relative;
      width: 100%;
    }
    
    .custom-select-container.disabled {
      opacity: 0.6;
      pointer-events: none;
    }
    
    .custom-select-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
      min-height: 42px;
    }
    
    .custom-select-input:hover:not(.disabled) {
      border-color: #9ca3af;
    }
    
    .custom-select-input.open {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
    
    .custom-select-input.disabled {
      background: #f3f4f6;
      cursor: not-allowed;
    }
    
    .selected-text {
      font-size: 0.875rem;
      color: #111827;
    }
    
    .placeholder-text {
      font-size: 0.875rem;
      color: #9ca3af;
    }
    
    .custom-select-dropdown {
      position: fixed;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      z-index: 99999;
      overflow: hidden;
    }
    
    .options-list {
      overflow-y: auto;
      max-height: inherit;
    }
    
    .option-item {
      padding: 0.625rem 0.75rem;
      cursor: pointer;
      transition: background-color 0.15s;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      border-bottom: 1px solid #f3f4f6;
    }
    
    .option-item:last-child {
      border-bottom: none;
    }
    
    .option-item:hover {
      background-color: #f9fafb;
    }
    
    .option-item.selected {
      background-color: #eef2ff;
    }
    
    .option-content {
      flex: 1;
      min-width: 0;
    }
    
    .option-label {
      display: block;
      font-size: 0.875rem;
      color: #111827;
      font-weight: 500;
    }
    
    .option-subtitle {
      display: block;
      font-size: 0.75rem;
      color: #6b7280;
      margin-top: 0.125rem;
    }
    
    /* Estilos responsive para móviles */
    @media (max-width: 768px) {
      .custom-select-input {
        font-size: 0.75rem;
        padding: 0.5rem 0.75rem;
        min-height: 38px;
      }
      
      .selected-text,
      .placeholder-text {
        font-size: 0.75rem;
      }
      
      .option-item {
        padding: 0.5rem 0.75rem;
      }
      
      .option-label {
        font-size: 0.75rem;
      }
      
      .option-subtitle {
        font-size: 0.7rem;
      }
    }
    
    @media (max-width: 480px) {
      .custom-select-input {
        font-size: 0.7rem;
        padding: 0.4rem 0.6rem;
        min-height: 36px;
      }
      
      .selected-text,
      .placeholder-text {
        font-size: 0.7rem;
      }
      
      .option-item {
        padding: 0.4rem 0.6rem;
      }
      
      .option-label {
        font-size: 0.7rem;
      }
      
      .option-subtitle {
        font-size: 0.65rem;
      }
    }
    
    /* Scrollbar personalizado */
    .options-list::-webkit-scrollbar {
      width: 6px;
    }
    
    .options-list::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    
    .options-list::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }
    
    .options-list::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true
    }
  ]
})
export class CustomSelectComponent implements ControlValueAccessor {
  @Input() options: SelectOption[] = [];
  @Input() placeholder: string = 'Seleccionar...';
  @Input() emptyMessage: string = 'No hay opciones disponibles';
  @Input() disabled: boolean = false;
  @Input() maxHeightClass: string = 'max-h-60'; // Permite personalizar la altura máxima
  @Input() roundedRight: boolean = true; // Si false, quita el border-radius derecho (para botones adyacentes)
  
  @Output() optionSelected = new EventEmitter<SelectOption>();
  
  isOpen = false;
  value: string | number | null = null;
  selectedOption: SelectOption | null = null;
  dropdownTop = 0;
  dropdownLeft = 0;
  dropdownWidth = 0;
  
  // ControlValueAccessor
  onChange: any = () => {};
  onTouched: any = () => {};
  
  constructor(private elementRef: ElementRef) {}
  
  toggleDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (!this.disabled) {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.calculateDropdownPosition();
      }
    }
  }
  
  private calculateDropdownPosition(): void {
    // Calcular posición del input en la pantalla
    setTimeout(() => {
      const inputElement = this.elementRef.nativeElement.querySelector('.custom-select-input');
      if (inputElement) {
        const rect = inputElement.getBoundingClientRect();
        
        // Con position: fixed, usamos directamente las coordenadas del viewport
        // SIN ajustar por scroll, ya que fixed se posiciona relativo a la ventana
        this.dropdownTop = rect.bottom + 4; // 4px de gap
        this.dropdownLeft = rect.left;
        this.dropdownWidth = rect.width;
      }
    }, 0);
  }
  
  selectOption(option: SelectOption, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.value = option.value;
    this.selectedOption = option;
    this.isOpen = false;
    this.onChange(this.value);
    this.onTouched();
    this.optionSelected.emit(option);
  }
  
  // Cerrar dropdown al hacer clic fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const clickedElement = event.target as HTMLElement;
    const isInsideComponent = this.elementRef.nativeElement.contains(clickedElement);
    const isInsideDropdown = clickedElement.closest('.custom-select-dropdown');
    
    if (!isInsideComponent && !isInsideDropdown) {
      this.isOpen = false;
    }
  }
  
  // Recalcular posición al hacer scroll
  @HostListener('window:scroll', ['$event'])
  onWindowScroll(): void {
    if (this.isOpen) {
      this.calculateDropdownPosition();
    }
  }
  
  // Recalcular posición al cambiar tamaño de ventana
  @HostListener('window:resize', ['$event'])
  onWindowResize(): void {
    if (this.isOpen) {
      this.calculateDropdownPosition();
    }
  }
  
  // ControlValueAccessor methods
  writeValue(value: string | number | null): void {
    this.value = value;
    this.selectedOption = this.options.find(opt => opt.value === value) || null;
  }
  
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}

