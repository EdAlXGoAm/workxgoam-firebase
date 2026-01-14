import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AndroidDatePickerComponent } from '../android-date-picker/android-date-picker.component';

@Component({
  selector: 'app-date-range-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AndroidDatePickerComponent],
  templateUrl: './date-range-modal.component.html',
  styleUrls: ['./date-range-modal.component.css']
})
export class DateRangeModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() showModal = false;
  @Input() initialStartDate: string = '';
  @Input() initialEndDate: string = '';
  @Input() initialDate: string = '';
  @Input() initialMode: 'day' | 'range' = 'day';
  
  @Output() closeModalEvent = new EventEmitter<void>();
  @Output() dateRangeSelected = new EventEmitter<{ mode: 'day' | 'range', startDate?: string, endDate?: string, singleDate?: string }>();
  
  mode: 'day' | 'range' = 'day';
  singleDate: string = '';
  startDate: string = '';
  endDate: string = '';
  
  ngOnInit() {
    this.initializeValues();
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }
  
  ngOnChanges(changes: SimpleChanges) {
    // Cuando se abre el modal o cambian los valores iniciales, actualizar los campos
    if (changes['showModal'] && changes['showModal'].currentValue) {
      this.initializeValues();
    }
    if (changes['initialMode'] || changes['initialDate'] || changes['initialStartDate'] || changes['initialEndDate']) {
      this.initializeValues();
    }
  }
  
  private initializeValues() {
    this.mode = this.initialMode || 'day';
    this.singleDate = this.initialDate || '';
    this.startDate = this.initialStartDate || '';
    this.endDate = this.initialEndDate || '';
  }
  
  closeModal() {
    this.closeModalEvent.emit();
  }
  
  applyFilter() {
    if (this.mode === 'day') {
      if (!this.singleDate) {
        alert('Por favor selecciona una fecha');
        return;
      }
      this.dateRangeSelected.emit({
        mode: 'day',
        singleDate: this.singleDate
      });
    } else {
      if (!this.startDate || !this.endDate) {
        alert('Por favor selecciona ambas fechas del rango');
        return;
      }
      
      // Validar que la fecha de inicio sea anterior a la fecha de fin
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      if (end < start) {
        alert('La fecha de fin debe ser posterior a la fecha de inicio');
        return;
      }
      
      this.dateRangeSelected.emit({
        mode: 'range',
        startDate: this.startDate,
        endDate: this.endDate
      });
    }
    this.closeModal();
  }
  
  clearFilter() {
    this.singleDate = '';
    this.startDate = '';
    this.endDate = '';
    this.dateRangeSelected.emit({
      mode: 'day',
      singleDate: ''
    });
    this.closeModal();
  }
  
  onModeChange() {
    // Limpiar fechas al cambiar de modo
    this.singleDate = '';
    this.startDate = '';
    this.endDate = '';
  }
}

