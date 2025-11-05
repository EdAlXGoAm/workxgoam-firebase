import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../services/task.service';
import { ProjectService } from '../../services/project.service';
import { EnvironmentService } from '../../services/environment.service';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';
import { CustomSelectComponent, SelectOption } from '../custom-select/custom-select.component';

@Component({
  selector: 'app-management-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './management-modal.component.html',
  styleUrls: ['./management-modal.component.css']
})
export class ManagementModalComponent implements OnInit {
  @Input() showModal: boolean = false;
  @Input() environments: Environment[] = [];
  @Input() projects: Project[] = [];
  @Output() closeModal = new EventEmitter<void>();

  activeTab: string = 'environments';
  tasks: Task[] = [];

  currentEnvironment: Partial<Environment> = { color: '#3B82F6' };
  isEditingEnvironment: boolean = false;
  showAddEnvironmentModal: boolean = false;
  showEditEnvironmentModal: boolean = false;

  currentProject: Partial<Project> = {};
  isEditingProject: boolean = false;
  showAddProjectModal: boolean = false;
  showEditProjectModal: boolean = false;
  
  // Opciones para selectores personalizados
  environmentOptions: SelectOption[] = [];

  // Colores sugeridos para entornos
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

  // Propiedades para el color picker personalizado
  colorPickerHue: number = 220; // Hue para el azul por defecto
  colorPickerSaturation: number = 76; // Saturación por defecto
  colorPickerLightness: number = 60; // Luminosidad por defecto

  constructor(
    private environmentService: EnvironmentService,
    private projectService: ProjectService,
    private taskService: TaskService
  ) {}

  ngOnInit(): void {
    this.loadTasksForDeletionLogic();
  }

  async loadTasksForDeletionLogic(): Promise<void> {
    try {
      this.tasks = await this.taskService.getTasks();
      console.log('[_managementModal] Tasks loaded for deletion logic:', this.tasks.length);
    } catch (error) {
      console.error('Error loading tasks in ManagementModal:', error);
    }
  }

  selectTab(tabName: string): void {
    this.activeTab = tabName;
  }

  // Métodos para manejar modales de entornos
  openAddEnvironmentModal(): void {
    this.currentEnvironment = { color: '#3B82F6' };
    this.isEditingEnvironment = false;
    this.showAddEnvironmentModal = true;
    this.initializeColorPicker();
  }

  openEditEnvironmentModal(env: Environment): void {
    this.currentEnvironment = { ...env };
    this.isEditingEnvironment = true;
    this.showEditEnvironmentModal = true;
    this.initializeColorPicker();
  }

  closeEnvironmentModal(): void {
    this.showAddEnvironmentModal = false;
    this.showEditEnvironmentModal = false;
    this.resetEnvironmentForm();
  }

  // Métodos para manejar modales de proyectos
  openAddProjectModal(): void {
    this.currentProject = {};
    this.isEditingProject = false;
    this.showAddProjectModal = true;
    this.buildEnvironmentOptions();
  }

  openEditProjectModal(proj: Project): void {
    this.currentProject = { ...proj };
    this.isEditingProject = true;
    this.showEditProjectModal = true;
    this.buildEnvironmentOptions();
  }

  closeProjectModal(): void {
    this.showAddProjectModal = false;
    this.showEditProjectModal = false;
    this.resetProjectForm();
  }

  getEnvironmentName(envId: string): string | undefined {
    const env = this.environments.find(e => e.id === envId);
    return env?.name;
  }

  getProjectCountByEnvironment(environmentId: string): number {
    return this.projects.filter(p => p.environment === environmentId).length;
  }

  getEnvironmentColor(environmentId: string): string {
    const env = this.environments.find(e => e.id === environmentId);
    return env?.color || '#6B7280';
  }
  
  // Métodos para selector personalizado
  buildEnvironmentOptions(): void {
    this.environmentOptions = this.environments.map(env => ({
      value: env.id || '',
      label: env.name
    }));
  }
  
  onEnvironmentSelectCustom(option: SelectOption): void {
    this.currentProject.environment = String(option.value);
  }

  selectSuggestedColor(color: string): void {
    this.currentEnvironment.color = color;
    // Convertir hex a HSL para sincronizar el color picker
    const hsl = this.hexToHsl(color);
    this.colorPickerHue = hsl.h;
    this.colorPickerSaturation = hsl.s;
    this.colorPickerLightness = hsl.l;
  }

  // Convertir HSL a HEX
  hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  // Convertir HEX a HSL
  hexToHsl(hex: string): {h: number, s: number, l: number} {
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

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  // Actualizar color basado en HSL
  updateColorFromHsl(): void {
    const hexColor = this.hslToHex(this.colorPickerHue, this.colorPickerSaturation, this.colorPickerLightness);
    this.currentEnvironment.color = hexColor;
  }

  // Manejar click en el área de saturación/luminosidad
  onColorAreaClick(event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    this.colorPickerSaturation = Math.round((x / rect.width) * 100);
    this.colorPickerLightness = Math.round(100 - (y / rect.height) * 100);
    this.updateColorFromHsl();
  }

  // Manejar click en la barra de matiz
  onHueBarClick(event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const y = event.clientY - rect.top;
    
    this.colorPickerHue = Math.round((y / rect.height) * 360);
    this.updateColorFromHsl();
  }

  // Inicializar color picker al abrir modal
  initializeColorPicker(): void {
    const currentColor = this.currentEnvironment.color || '#3B82F6';
    const hsl = this.hexToHsl(currentColor);
    this.colorPickerHue = hsl.h;
    this.colorPickerSaturation = hsl.s;
    this.colorPickerLightness = hsl.l;
  }

  editEnvironment(env: Environment): void {
    this.openEditEnvironmentModal(env);
  }

  resetEnvironmentForm(): void {
    this.currentEnvironment = { color: '#3B82F6' };
    this.isEditingEnvironment = false;
  }

  async saveEnvironment(): Promise<void> {
    if (!this.currentEnvironment.name) {
      alert('El nombre del entorno es obligatorio.');
      return;
    }
    try {
      if (this.isEditingEnvironment && this.currentEnvironment.id) {
        // Excluir campos del sistema que no deben actualizarse
        const { id, userId, createdAt, ...updates } = this.currentEnvironment;
        await this.environmentService.updateEnvironment(this.currentEnvironment.id, updates);
      } else {
        await this.environmentService.createEnvironment(this.currentEnvironment as Omit<Environment, 'id'>);
      }
      this.closeEnvironmentModal();
      this.closeModal.emit();
    } catch (error) {
      console.error('Error saving environment:', error);
      alert(`Error al guardar el entorno: ${error}`);
    }
  }

  async deleteEnvironment(envId: string): Promise<void> {
    const environmentToDelete = this.environments.find(e => e.id === envId);
    if (!environmentToDelete) {
      alert("Entorno no encontrado.");
      return;
    }

    const confirmation = confirm(`¿Estás seguro de que quieres eliminar el entorno "${environmentToDelete.name}"? Esto eliminará también todos los proyectos dentro de este entorno y desvinculará las tareas asociadas a dichos proyectos.`);
    if (!confirmation) return;

    try {
      const projectsInEnv = this.projects.filter(p => p.environment === envId);

      for (const project of projectsInEnv) {
        await this._deleteProjectLogic(project.id, true);
      }
      console.log('[_deleteEnvironment] Todas las llamadas a _deleteProjectLogic completadas.');

      await this.environmentService.deleteEnvironment(envId);
      console.log('[_deleteEnvironment] Entorno eliminado de la base de datos.');
      
      alert(`Entorno "${environmentToDelete.name}" y sus proyectos asociados eliminados.`);
      await this.loadTasksForDeletionLogic();
      this.closeModal.emit();
    } catch (error) {
      console.error('Error deleting environment and its projects:', error);
      alert(`Error al eliminar el entorno: ${error}`);
    }
  }

  editProject(proj: Project): void {
    this.openEditProjectModal(proj);
  }

  resetProjectForm(): void {
    this.currentProject = {};
    this.isEditingProject = false;
  }

  async saveProject(): Promise<void> {
    if (!this.currentProject.name || !this.currentProject.environment) {
      alert('El nombre del proyecto y el entorno son obligatorios.');
      return;
    }
    try {
      if (this.isEditingProject && this.currentProject.id) {
        const { id, userId, createdAt, ...updates } = this.currentProject;
        await this.projectService.updateProject(this.currentProject.id, updates);
      } else {
        const projectData = { ...this.currentProject, environment: this.currentProject.environment || '' };
        await this.projectService.createProject(projectData as Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>);
      }
      this.closeProjectModal();
      this.closeModal.emit();
    } catch (error) {
      console.error('Error saving project:', error);
      alert(`Error al guardar el proyecto: ${error}`);
    }
  }

  async deleteProject(projId: string): Promise<void> {
    const projectToDelete = this.projects.find(p => p.id === projId);
    if (!projectToDelete) {
      alert("Proyecto no encontrado.");
      return;
    }
    const confirmation = confirm(`¿Estás seguro de que quieres eliminar el proyecto "${projectToDelete.name}"? Esto desvinculará las tareas asociadas (quedarán sin proyecto y sin entorno).`);
    if (!confirmation) return;

    try {
      await this._deleteProjectLogic(projId, false);
      alert(`Proyecto "${projectToDelete.name}" eliminado y tareas desvinculadas.`);
      await this.loadTasksForDeletionLogic();
      this.closeModal.emit();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(`Error al eliminar el proyecto: ${error}`);
    }
  }

  private async _deleteProjectLogic(projId: string, isCascading: boolean): Promise<void> {
    console.log(`[_deleteProjectLogic] Iniciando para proyecto ID: ${projId}, Cascada: ${isCascading}`);
    console.log('[_deleteProjectLogic] Estado actual de this.tasks en el modal:', JSON.parse(JSON.stringify(this.tasks)));

    const tasksInProject = this.tasks.filter(task => task.project === projId);
    console.log(`[_deleteProjectLogic] Tareas encontradas en proyecto ${projId}:`, JSON.parse(JSON.stringify(tasksInProject)));

    if (tasksInProject.length === 0) {
      console.log(`[_deleteProjectLogic] No se encontraron tareas para el proyecto ${projId}. Saltando actualización de tareas.`);
    } else {
      console.log(`[_deleteProjectLogic] Intentando desvincular ${tasksInProject.length} tareas del proyecto ${projId}.`);
      const updatePromises = tasksInProject.map(task => {
        console.log(`[_deleteProjectLogic] Preparando actualización para tarea ID: ${task.id}, Nombre: ${task.name}. Nuevos valores: { project: '', environment: '' }`);
        return this.taskService.updateTask(task.id, { project: '', environment: '' });
      });
      try {
        await Promise.all(updatePromises);
        console.log(`[_deleteProjectLogic] ${tasksInProject.length} tareas desvinculadas exitosamente para proyecto ${projId}.`);
      } catch (error) {
        console.error(`[_deleteProjectLogic] Error al actualizar tareas para el proyecto ${projId}:`, error);
        throw new Error(`Fallo al desvincular tareas del proyecto ${projId}: ${error}`);
      }
    }

    console.log(`[_deleteProjectLogic] Intentando eliminar proyecto ID: ${projId} de la base de datos.`);
    await this.projectService.deleteProject(projId);
    console.log(`[_deleteProjectLogic] Proyecto ID: ${projId} eliminado de la base de datos.`);

    if (!isCascading) {
    }
  }

  close(): void {
    this.closeModal.emit();
  }
} 