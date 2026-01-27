import { Component, Input, Output, EventEmitter, forwardRef, HostListener, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string | number;
  label: string;
  subtitle?: string; // Para mostrar información adicional como fecha
  image?: string; // URL o base64 de imagen (para proyectos con imagen)
}

// Lista estática de todas las instancias de CustomSelectComponent para cerrar otros dropdowns
const allCustomSelects: CustomSelectComponent[] = [];

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './custom-select.component.html',
  styleUrl: './custom-select.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true
    }
  ]
})
export class CustomSelectComponent implements ControlValueAccessor, OnDestroy, OnInit {
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
  
  // Flag interno para evitar clicks rápidos consecutivos
  private isProcessingClick = false;
  
  // ControlValueAccessor
  onChange: any = () => {};
  onTouched: any = () => {};
  
  // Referencia al handler para poder removerlo después
  private documentClickHandler = this.handleDocumentClick.bind(this);
  
  constructor(private elementRef: ElementRef) {
    // Registrar esta instancia en la lista global
    allCustomSelects.push(this);
  }
  
  ngOnInit(): void {
    // Usar addEventListener con capture: true para capturar clicks ANTES de que stopPropagation los detenga
    document.addEventListener('click', this.documentClickHandler, true);
  }
  
  ngOnDestroy(): void {
    // Eliminar el event listener
    document.removeEventListener('click', this.documentClickHandler, true);
    
    // Eliminar esta instancia de la lista global cuando se destruye el componente
    const index = allCustomSelects.indexOf(this);
    if (index > -1) {
      allCustomSelects.splice(index, 1);
    }
  }
  
  // Handler para clicks en el documento (fase de captura)
  private handleDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    
    const clickedElement = event.target as HTMLElement;
    
    // Verificar si el click fue dentro del componente (incluye el input y el dropdown)
    const isInsideComponent = this.elementRef.nativeElement.contains(clickedElement);
    
    if (!isInsideComponent) {
      this.isOpen = false;
    }
  }
  
  // Cerrar todos los otros dropdowns abiertos
  private closeOtherDropdowns(): void {
    allCustomSelects.forEach(select => {
      if (select !== this && select.isOpen) {
        select.isOpen = false;
      }
    });
  }
  
  toggleDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    
    // Ignorar clicks si está deshabilitado o si ya se está procesando un click
    if (this.disabled || this.isProcessingClick) {
      return;
    }
    
    // Bloquear clicks rápidos consecutivos
    this.isProcessingClick = true;
    
    // Cerrar todos los otros dropdowns abiertos ANTES de abrir este
    this.closeOtherDropdowns();
    
    if (!this.isOpen) {
      // Calcular posición ANTES de abrir (síncrono) para apertura instantánea
      this.calculateDropdownPositionSync();
    }
    
    this.isOpen = !this.isOpen;
    
    // Liberar el bloqueo después de un breve delay
    setTimeout(() => {
      this.isProcessingClick = false;
    }, 200);
  }
  
  /**
   * Calcula la posición del dropdown de forma síncrona.
   * Usa getBoundingClientRect() del input que ya está en el DOM.
   */
  private calculateDropdownPositionSync(): void {
    const inputElement = this.elementRef.nativeElement.querySelector('.custom-select-input');
    if (inputElement) {
      const rect = inputElement.getBoundingClientRect();
      
      // Con position: fixed, usamos directamente las coordenadas del viewport
      // SIN ajustar por scroll, ya que fixed se posiciona relativo a la ventana
      this.dropdownTop = rect.bottom + 4; // 4px de gap
      this.dropdownLeft = rect.left;
      this.dropdownWidth = rect.width;
    }
  }
  
  /**
   * @deprecated Usar calculateDropdownPositionSync() en su lugar
   * Mantenido para compatibilidad con los listeners de scroll/resize
   */
  private calculateDropdownPosition(): void {
    this.calculateDropdownPositionSync();
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
  
  /**
   * Abre el dropdown programáticamente.
   * Útil para abrir el selector desde el componente padre.
   */
  open(): void {
    if (this.disabled || this.isOpen) {
      return;
    }
    
    // Cerrar todos los otros dropdowns abiertos ANTES de abrir este
    this.closeOtherDropdowns();
    
    // Calcular posición ANTES de abrir
    this.calculateDropdownPositionSync();
    
    this.isOpen = true;
  }
  
  /**
   * Cierra el dropdown programáticamente.
   */
  close(): void {
    this.isOpen = false;
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
