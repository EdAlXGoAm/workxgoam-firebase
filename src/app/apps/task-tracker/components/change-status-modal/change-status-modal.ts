import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/task.model';

@Component({
  selector: 'app-change-status-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
   <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style="overflow: hidden;">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md" (click)="$event.stopPropagation()">
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">{{ getStatusChangeModalTitle() }}</h3>
          <button (click)="close()" class="text-gray-500 hover:text-gray-700">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="mb-6">
          <p class="text-gray-700 mb-4">{{ getStatusChangeModalMessage() }}</p>
          
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div class="flex items-center">
              <i class="fas fa-info-circle text-blue-600 mr-2"></i>
              <span class="text-blue-700 text-sm">
                <span *ngIf="statusChangeWillHide">Las tareas ocultas no aparecerán en la vista normal, pero puedes verlas activando el filtro de tareas ocultas.</span>
                <span *ngIf="!statusChangeWillHide">Si la tarea estaba oculta, volverá a ser visible en la vista normal.</span>
              </span>
            </div>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3">
          <button 
            type="button" 
            (click)="close()"
            [disabled]="isSaving"
            [class.opacity-50]="isSaving"
            [class.cursor-not-allowed]="isSaving"
            class="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:hover:bg-white">
            Cancelar
          </button>
          <button 
            type="button" 
            (click)="confirm(false)"
            [disabled]="isSaving"
            [class.opacity-50]="isSaving"
            [class.cursor-not-allowed]="isSaving"
            class="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:hover:bg-white">
            <span *ngIf="statusChangeWillHide">No ocultar</span>
            <span *ngIf="!statusChangeWillHide">No mostrar</span>
          </button>
          <button 
            type="button" 
            (click)="confirm(true)"
            [disabled]="isSaving"
            [class.opacity-50]="isSaving"
            [class.cursor-not-allowed]="isSaving"
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:hover:bg-indigo-600 flex items-center justify-center gap-2">
            <span *ngIf="isSaving" class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            <ng-container *ngIf="!isSaving">
              <i class="fas" [ngClass]="statusChangeWillHide ? 'fa-eye-slash' : 'fa-eye'"></i>
            </ng-container>
            <span *ngIf="isSaving">{{ statusChangeWillHide ? 'Ocultando...' : 'Mostrando...' }}</span>
            <span *ngIf="!isSaving">
              <ng-container *ngIf="statusChangeWillHide">Sí, ocultar</ng-container>
              <ng-container *ngIf="!statusChangeWillHide">Sí, mostrar</ng-container>
            </span>
          </button>
        </div>
      </div>
    </div>
   </div>
  `
})
export class ChangeStatusModalComponent implements OnInit, OnDestroy {
  @Input() statusChangeWillHide: boolean = false;
  @Input() pendingStatusChange: { task: Task; status: 'pending' | 'in-progress' | 'completed' } | null = null;

  @Output() closeModal = new EventEmitter<void>();
  @Output() confirmChangeVisibility = new EventEmitter<boolean>();
  
  isSaving = false;

  ngOnInit() {
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    (document.body as any).__scrollY = scrollY;
  }

  ngOnDestroy() {
    const scrollY = (document.body as any).__scrollY || 0;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
    delete (document.body as any).__scrollY;
  }

  close() {
    this.closeModal.emit();
  }

  confirm(changeVisibility: boolean) {
    this.isSaving = true;
    this.confirmChangeVisibility.emit(changeVisibility);
  }

  getStatusChangeModalTitle(): string {
    const status = this.pendingStatusChange?.status;
    const statusNames: Record<'pending' | 'in-progress' | 'completed', string> = {
      'pending': 'Pendiente',
      'in-progress': 'En Progreso',
      'completed': 'Completada'
    };
    return status ? `Cambiar estado a ${statusNames[status]}` : '';
  }

  getStatusChangeModalMessage(): string {
    if (this.statusChangeWillHide) {
      return '¿Deseas ocultar la tarea después de marcarla como completada?';
    } else {
      return '¿Deseas mostrar la tarea después de cambiar su estado? (en caso de que esté oculta)';
    }
  }
}


