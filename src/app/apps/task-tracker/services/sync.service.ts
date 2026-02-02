import { Injectable } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { CacheService } from './cache.service';
import { TaskService } from './task.service';
import { EnvironmentService } from './environment.service';
import { ProjectService } from './project.service';
import { TaskTypeService } from './task-type.service';
import { TaskGroupService } from './task-group.service';
import { TaskSumTemplateService } from './task-sum-template.service';
import { Task } from '../models/task.model';
import { Environment } from '../models/environment.model';
import { Project } from '../models/project.model';
import { TaskType } from '../models/task-type.model';
import { TaskGroup } from '../models/task-group.model';
import { TaskSumTemplate } from '../models/task-sum-template.model';

export interface SyncResult {
  fromCache: boolean;
  tasks: Task[];
  environments: Environment[];
  projects: Project[];
  taskTypes: TaskType[];
  taskGroups: TaskGroup[];
  taskSumTemplates: TaskSumTemplate[];
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private isSyncing = false;
  private lastSyncTime: string | null = null;

  constructor(
    private cacheService: CacheService,
    private authService: AuthService,
    private taskService: TaskService,
    private environmentService: EnvironmentService,
    private projectService: ProjectService,
    private taskTypeService: TaskTypeService,
    private taskGroupService: TaskGroupService,
    private taskSumTemplateService: TaskSumTemplateService
  ) {}

  /**
   * Carga datos con caché: primero intenta desde caché, luego sincroniza en background
   */
  async loadWithCache(): Promise<SyncResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    // Verificar si IndexedDB está disponible
    if (!this.cacheService.isAvailable()) {
      console.log('IndexedDB no disponible, cargando desde Firestore...');
      return await this.loadFromFirestore(false);
    }

    try {
      // Intentar cargar desde caché
      const [
        cachedTasks,
        cachedEnvironments,
        cachedProjects,
        cachedTaskTypes,
        cachedTaskGroups,
        cachedTaskSumTemplates
      ] = await Promise.all([
        this.cacheService.getFromCache<Task>('tasks'),
        this.cacheService.getFromCache<Environment>('environments'),
        this.cacheService.getFromCache<Project>('projects'),
        this.cacheService.getFromCache<TaskType>('task-types'),
        this.cacheService.getFromCache<TaskGroup>('task-groups'),
        this.cacheService.getFromCache<TaskSumTemplate>('task-sum-templates')
      ]);

      // Si tenemos caché completo, retornar desde caché
      if (cachedTasks && cachedEnvironments && cachedProjects && 
          cachedTaskTypes && cachedTaskGroups && cachedTaskSumTemplates) {
        console.log('Datos cargados desde caché local');
        this.lastSyncTime = cachedTasks.metadata.lastSync;
        
        return {
          fromCache: true,
          tasks: cachedTasks.data,
          environments: cachedEnvironments.data,
          projects: cachedProjects.data,
          taskTypes: cachedTaskTypes.data,
          taskGroups: cachedTaskGroups.data,
          taskSumTemplates: cachedTaskSumTemplates.data
        };
      }

      // Si no hay caché completo, cargar desde Firestore
      console.log('Caché incompleto o inexistente, cargando desde Firestore...');
      return await this.loadFromFirestore(false);
    } catch (error) {
      console.error('Error al cargar desde caché:', error);
      // Fallback a Firestore
      return await this.loadFromFirestore(false);
    }
  }

  /**
   * Carga datos directamente desde Firestore y los guarda en caché
   */
  private async loadFromFirestore(fromCache: boolean): Promise<SyncResult> {
    try {
      const [
        tasks,
        environments,
        projects,
        taskTypes,
        taskGroups,
        taskSumTemplates
      ] = await Promise.all([
        this.taskService.getTasks(),
        this.environmentService.getEnvironments(),
        this.projectService.getProjects(),
        this.taskTypeService.getTaskTypes(),
        this.taskGroupService.getTaskGroups(),
        this.taskSumTemplateService.getTemplates()
      ]);

      // Guardar en caché en background (no esperar)
      if (this.cacheService.isAvailable()) {
        Promise.all([
          this.cacheService.saveToCache('tasks', tasks),
          this.cacheService.saveToCache('environments', environments),
          this.cacheService.saveToCache('projects', projects),
          this.cacheService.saveToCache('task-types', taskTypes),
          this.cacheService.saveToCache('task-groups', taskGroups),
          this.cacheService.saveToCache('task-sum-templates', taskSumTemplates)
        ]).catch(error => {
          console.error('Error al guardar en caché:', error);
        });
      }

      this.lastSyncTime = new Date().toISOString();

      return {
        fromCache,
        tasks,
        environments,
        projects,
        taskTypes,
        taskGroups,
        taskSumTemplates
      };
    } catch (error) {
      console.error('Error al cargar desde Firestore:', error);
      throw error;
    }
  }

  /**
   * Sincroniza datos en segundo plano desde Firestore
   */
  async syncInBackground(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sincronización ya en progreso...');
      return;
    }

    this.isSyncing = true;
    console.log('Iniciando sincronización en background...');

    try {
      const result = await this.loadFromFirestore(false);
      
      // Emitir evento para que el componente pueda actualizar la UI si hay cambios
      // (Esto se puede mejorar con un Subject/Observable en el futuro)
      this.lastSyncTime = new Date().toISOString();
      
      console.log('Sincronización completada');
    } catch (error) {
      console.error('Error durante sincronización:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fuerza una sincronización completa (útil para botón manual)
   */
  async forceFullSync(): Promise<SyncResult> {
    console.log('Forzando sincronización completa...');
    this.isSyncing = true;
    
    try {
      const result = await this.loadFromFirestore(false);
      this.lastSyncTime = new Date().toISOString();
      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Obtiene el tiempo de la última sincronización
   */
  getLastSyncTime(): string | null {
    return this.lastSyncTime;
  }

  /**
   * Verifica si hay una sincronización en progreso
   */
  isSyncingInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Actualiza el caché después de una operación de escritura
   */
  async updateCacheAfterWrite(
    tasks?: Task[],
    environments?: Environment[],
    projects?: Project[],
    taskTypes?: TaskType[],
    taskGroups?: TaskGroup[],
    taskSumTemplates?: TaskSumTemplate[]
  ): Promise<void> {
    if (!this.cacheService.isAvailable()) {
      return;
    }

    const promises: Promise<void>[] = [];

    if (tasks) {
      promises.push(this.cacheService.saveToCache('tasks', tasks));
    }
    if (environments) {
      promises.push(this.cacheService.saveToCache('environments', environments));
    }
    if (projects) {
      promises.push(this.cacheService.saveToCache('projects', projects));
    }
    if (taskTypes) {
      promises.push(this.cacheService.saveToCache('task-types', taskTypes));
    }
    if (taskGroups) {
      promises.push(this.cacheService.saveToCache('task-groups', taskGroups));
    }
    if (taskSumTemplates) {
      promises.push(this.cacheService.saveToCache('task-sum-templates', taskSumTemplates));
    }

    await Promise.all(promises).catch(error => {
      console.error('Error al actualizar caché después de escritura:', error);
    });
  }
}
