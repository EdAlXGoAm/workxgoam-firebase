import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { TaskGroup } from '../models/task-group.model';
import { EnvironmentService } from './environment.service';
import { TaskService } from './task.service';
import { Task } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskGroupService {
  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private taskService: TaskService
  ) {}

  async createTaskGroup(taskGroup: Omit<TaskGroup, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskGroupsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-groups`);
    const now = new Date().toISOString();

    const newTaskGroup = {
      ...taskGroup,
      userId: user.uid,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(taskGroupsRef, newTaskGroup);
    return docRef.id;
  }

  async updateTaskGroup(taskGroupId: string, updates: Partial<TaskGroup>): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskGroupRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-groups`, taskGroupId);
    const now = new Date().toISOString();

    await updateDoc(taskGroupRef, {
      ...updates,
      updatedAt: now
    });
  }

  async deleteTaskGroup(taskGroupId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Verificar que no haya tareas usando este grupo
    const usageCount = await this.getTaskGroupUsageCount(taskGroupId);
    if (usageCount > 0) {
      throw new Error('No se puede eliminar el grupo porque tiene tareas asociadas');
    }

    const taskGroupRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-groups`, taskGroupId);
    await deleteDoc(taskGroupRef);
  }

  async getTaskGroups(): Promise<TaskGroup[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskGroupsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-groups`);
    const q = query(taskGroupsRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TaskGroup));
  }

  async getTaskGroupsByProject(projectId: string): Promise<TaskGroup[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskGroupsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-groups`);
    const q = query(
      taskGroupsRef,
      where('userId', '==', user.uid),
      where('projectId', '==', projectId)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TaskGroup));
  }

  async getTaskGroupUsageCount(taskGroupId: string): Promise<number> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    try {
      const tasks = await this.taskService.getTasks();
      return tasks.filter(task => task.taskGroupId === taskGroupId).length;
    } catch (error) {
      console.error('Error al contar uso del grupo:', error);
      return 0;
    }
  }
}
