import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';
import { CustomSelectComponent, SelectOption } from '../custom-select/custom-select.component';
import { ProjectImageQuickEditComponent } from '../project-image-quick-edit/project-image-quick-edit.component';

@Component({
  selector: 'app-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent, ProjectImageQuickEditComponent],
  template: `
    <div *ngIf="showModal" class="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md transition-all" (click)="$event.stopPropagation()">
        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h3 class="text-xl font-semibold text-gray-800">{{ isEditing ? 'Editar Proyecto' : 'Agregar Nuevo Proyecto' }}</h3>
          <button (click)="close()" class="text-gray-400 hover:text-gray-600 transition">
            <i class="fas fa-times fa-lg"></i>
          </button>
        </div>
        <div class="p-6">
          <form (ngSubmit)="onSubmit()" class="space-y-4">
            <!-- Imagen del proyecto -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Imagen (Opcional)</label>
              <div class="flex items-center gap-3">
                <button 
                  type="button"
                  (click)="openImageModal()"
                  class="w-16 h-16 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden hover:border-indigo-500 hover:bg-gray-50 transition">
                  <img *ngIf="currentProject.image" [src]="currentProject.image" alt="" class="w-full h-full object-cover">
                  <i *ngIf="!currentProject.image" class="fas fa-plus text-gray-400"></i>
                </button>
                <span class="text-sm text-gray-500">{{ currentProject.image ? 'Clic para cambiar' : 'Agregar imagen' }}</span>
              </div>
            </div>
            
            <div>
              <label for="projectName" class="block text-sm font-medium text-gray-700 mb-1">Nombre del Proyecto</label>
              <input type="text" id="projectName" name="projectName" [(ngModel)]="currentProject.name" required
                     class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                     placeholder="Ingresa el nombre del proyecto">
            </div>
            
            <div>
              <label for="projectDescription" class="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
              <textarea id="projectDescription" name="projectDescription" [(ngModel)]="currentProject.description" rows="3"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Describe brevemente el proyecto"></textarea>
            </div>
            
            <div>
              <label for="projectEnvironment" class="block text-sm font-medium text-gray-700 mb-1">Entorno</label>
              
              <!-- Selector nativo para desktop (≥768px) -->
              <select id="projectEnvironment" name="projectEnvironment" [(ngModel)]="currentProject.environment" required
                      class="hidden md:block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white">
                <option [ngValue]="null" disabled>Selecciona un entorno</option>
                <option *ngFor="let env of environments" [value]="env.id">{{ env.emoji ? env.emoji + ' ' + env.name : env.name }}</option>
              </select>
              
              <!-- Selector personalizado para móvil (<768px) -->
              <div class="block md:hidden">
                <app-custom-select
                  [options]="environmentOptions"
                  [(ngModel)]="currentProject.environment"
                  (optionSelected)="onEnvironmentSelectCustom($event)"
                  name="projectEnvironmentCustom"
                  placeholder="Selecciona un entorno"
                  maxHeightClass="max-h-32">
                </app-custom-select>
              </div>
            </div>
            
            <div class="flex justify-end space-x-3 pt-4">
              <button type="button" (click)="close()"
                      class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">
                Cancelar
              </button>
              <button type="submit"
                      class="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                {{ isEditing ? 'Guardar Cambios' : 'Crear Proyecto' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
    <!-- Modal de Imagen del Proyecto -->
    <app-project-image-quick-edit
      *ngIf="showImageModal"
      [isOpen]="showImageModal"
      [projectId]="currentProject.id || 'temp'"
      [projectName]="currentProject.name || 'Nuevo proyecto'"
      [currentImage]="currentProject.image"
      (closeModal)="closeImageModal()"
      (imageUpdated)="onImageUpdated($event)">
    </app-project-image-quick-edit>
  `
})
export class ProjectModalComponent implements OnInit, OnChanges {
  @Input() showModal: boolean = false;
  @Input() isEditing: boolean = false;
  @Input() project: Partial<Project> | null = null;
  @Input() environments: Environment[] = [];
  
  @Output() closeModal = new EventEmitter<void>();
  @Output() saveProject = new EventEmitter<Partial<Project>>();
  
  currentProject: Partial<Project> = {};
  environmentOptions: SelectOption[] = [];
  showImageModal: boolean = false;
  
  ngOnInit(): void {
    this.initializeProject();
    this.buildEnvironmentOptions();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['project'] || changes['showModal']) {
      this.initializeProject();
    }
    if (changes['environments']) {
      this.buildEnvironmentOptions();
    }
  }
  
  private initializeProject(): void {
    if (this.project) {
      this.currentProject = { ...this.project };
    } else {
      this.currentProject = {};
    }
  }
  
  buildEnvironmentOptions(): void {
    this.environmentOptions = this.environments.map(env => ({
      value: env.id || '',
      label: env.emoji ? `${env.emoji} ${env.name}` : env.name
    }));
  }
  
  onEnvironmentSelectCustom(option: SelectOption): void {
    this.currentProject.environment = String(option.value);
  }
  
  openImageModal(): void {
    this.showImageModal = true;
  }
  
  closeImageModal(): void {
    this.showImageModal = false;
  }
  
  onImageUpdated(imageDataUrl: string): void {
    this.currentProject.image = imageDataUrl;
    this.closeImageModal();
  }
  
  close(): void {
    this.closeModal.emit();
  }
  
  onSubmit(): void {
    if (!this.currentProject.name || !this.currentProject.environment) {
      return;
    }
    this.saveProject.emit(this.currentProject);
  }
}

