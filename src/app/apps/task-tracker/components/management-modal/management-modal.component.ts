import { Component, OnInit, OnDestroy, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../services/task.service';
import { ProjectService } from '../../services/project.service';
import { EnvironmentService } from '../../services/environment.service';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';
import { CustomSelectComponent, SelectOption } from '../custom-select/custom-select.component';
import { EnvironmentModalComponent } from '../environment-modal/environment-modal.component';
import { ProjectImageQuickEditComponent } from '../project-image-quick-edit/project-image-quick-edit.component';
import { ProjectModalComponent } from '../project-modal/project-modal.component';

@Component({
  selector: 'app-management-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent, EnvironmentModalComponent, ProjectImageQuickEditComponent, ProjectModalComponent],
  templateUrl: './management-modal.component.html',
  styleUrls: ['./management-modal.component.css']
})
export class ManagementModalComponent implements OnInit, OnDestroy {
  @Input() showModal: boolean = false;
  @Input() environments: Environment[] = [];
  @Input() projects: Project[] = [];
  @Output() closeModal = new EventEmitter<void>();
  @Output() dataChanged = new EventEmitter<void>();

  activeTab: string = 'environments';
  tasks: Task[] = [];

  // Estado para el modal de entorno (usando el componente compartido)
  showEnvironmentModal: boolean = false;
  environmentToEdit: Environment | null = null;

  currentProject: Partial<Project> = {};
  isEditingProject: boolean = false;
  showAddProjectModal: boolean = false;
  showEditProjectModal: boolean = false;
  
  // Estado para el modal de imagen del proyecto
  showProjectImageModal: boolean = false;
  projectForImageEdit: Project | null = null;
  
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

  constructor(
    private environmentService: EnvironmentService,
    private projectService: ProjectService,
    private taskService: TaskService
  ) {}

  ngOnInit(): void {
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    (document.body as any).__scrollY = scrollY;
    this.loadTasksForDeletionLogic();
  }

  ngOnDestroy(): void {
    const scrollY = (document.body as any).__scrollY || 0;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
    delete (document.body as any).__scrollY;
  }

  async loadTasksForDeletionLogic(): Promise<void> {
    try {
      this.tasks = await this.taskService.getTasks();
    } catch (error) {
      console.error('Error loading tasks in ManagementModal:', error);
    }
  }

  selectTab(tabName: string): void {
    this.activeTab = tabName;
  }

  // Métodos para manejar el modal de entorno
  openAddEnvironmentModal(): void {
    this.environmentToEdit = null;
    this.showEnvironmentModal = true;
  }

  editEnvironment(env: Environment): void {
    this.environmentToEdit = env;
    this.showEnvironmentModal = true;
  }

  closeEnvironmentModal(): void {
    this.showEnvironmentModal = false;
    this.environmentToEdit = null;
  }

  async onSaveEnvironment(data: { id?: string; name: string; color: string; emoji?: string }): Promise<void> {
    try {
      if (data.id) {
        // Editar entorno existente
        await this.environmentService.updateEnvironment(data.id, {
          name: data.name,
          color: data.color,
          emoji: data.emoji
        });
      } else {
        // Crear nuevo entorno
        await this.environmentService.createEnvironment({
          name: data.name,
          color: data.color,
          emoji: data.emoji
        } as Omit<Environment, 'id'>);
      }
      this.closeEnvironmentModal();
      // Emitir dataChanged para que el padre recargue los datos sin cerrar el management-modal
      this.dataChanged.emit();
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

      await this.environmentService.deleteEnvironment(envId);
      
      alert(`Entorno "${environmentToDelete.name}" y sus proyectos asociados eliminados.`);
      await this.loadTasksForDeletionLogic();
      this.closeModal.emit();
    } catch (error) {
      console.error('Error deleting environment and its projects:', error);
      alert(`Error al eliminar el entorno: ${error}`);
    }
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
    return env ? (env.emoji ? `${env.emoji} ${env.name}` : env.name) : undefined;
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
      label: env.emoji ? `${env.emoji} ${env.name}` : env.name
    }));
  }
  
  onEnvironmentSelectCustom(option: SelectOption): void {
    this.currentProject.environment = String(option.value);
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
      // Emitir dataChanged para que el padre recargue los datos sin cerrar el management-modal
      this.dataChanged.emit();
    } catch (error) {
      console.error('Error saving project:', error);
      alert(`Error al guardar el proyecto: ${error}`);
    }
  }

  async onProjectModalSave(projectData: Partial<Project>): Promise<void> {
    this.currentProject = projectData;
    await this.saveProject();
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
    const tasksInProject = this.tasks.filter(task => task.project === projId);

    if (tasksInProject.length > 0) {
      const updatePromises = tasksInProject.map(task => {
        return this.taskService.updateTask(task.id, { project: '', environment: '' });
      });
      await Promise.all(updatePromises);
    }

    await this.projectService.deleteProject(projId);
  }

  close(): void {
    this.closeModal.emit();
  }

  // Métodos para el modal de imagen del proyecto
  openProjectImageModal(project: Project): void {
    this.projectForImageEdit = project;
    this.showProjectImageModal = true;
  }

  closeProjectImageModal(): void {
    this.showProjectImageModal = false;
    this.projectForImageEdit = null;
  }

  async onProjectImageUpdated(imageDataUrl: string): Promise<void> {
    if (!this.projectForImageEdit) return;
    
    try {
      await this.projectService.updateProject(this.projectForImageEdit.id, { image: imageDataUrl });
      this.closeProjectImageModal();
      this.dataChanged.emit();
    } catch (error) {
      console.error('Error updating project image:', error);
      alert(`Error al actualizar la imagen: ${error}`);
    }
  }

  // Manejar imagen seleccionada en el formulario de proyecto (sin guardar aún)
  openProjectImageModalForForm(): void {
    // Crear un proyecto temporal para el modal
    this.projectForImageEdit = {
      id: 'temp',
      userId: '',
      name: this.currentProject.name || 'Nuevo proyecto',
      environment: this.currentProject.environment || '',
      description: this.currentProject.description || '',
      color: this.currentProject.color || '',
      image: this.currentProject.image,
      createdAt: '',
      updatedAt: ''
    };
    this.showProjectImageModal = true;
  }

  onProjectFormImageUpdated(imageDataUrl: string): void {
    this.currentProject.image = imageDataUrl;
    this.closeProjectImageModal();
  }
}
