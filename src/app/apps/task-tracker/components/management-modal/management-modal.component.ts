import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../services/task.service';
import { ProjectService } from '../../services/project.service';
import { EnvironmentService } from '../../services/environment.service';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';

@Component({
  selector: 'app-management-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  currentProject: Partial<Project> = {};
  isEditingProject: boolean = false;

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

  getEnvironmentName(envId: string): string | undefined {
    const env = this.environments.find(e => e.id === envId);
    return env?.name;
  }

  editEnvironment(env: Environment): void {
    this.currentEnvironment = { ...env };
    this.isEditingEnvironment = true;
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
        await this.environmentService.updateEnvironment(this.currentEnvironment.id, this.currentEnvironment);
      } else {
        await this.environmentService.createEnvironment(this.currentEnvironment as Omit<Environment, 'id'>);
      }
      this.resetEnvironmentForm();
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
    this.currentProject = { ...proj };
    this.isEditingProject = true;
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
        await this.projectService.updateProject(this.currentProject.id, this.currentProject);
      } else {
        const projectData = { ...this.currentProject, environment: this.currentProject.environment || '' };
        await this.projectService.createProject(projectData as Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>);
      }
      this.resetProjectForm();
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