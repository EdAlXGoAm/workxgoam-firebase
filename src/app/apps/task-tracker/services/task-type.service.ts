import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { TaskType } from '../models/task-type.model';
import { EnvironmentService } from './environment.service';

@Injectable({
  providedIn: 'root'
})
export class TaskTypeService {
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  async createTaskType(taskType: Omit<TaskType, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskTypesRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-types`);
    const now = new Date().toISOString();

    const newTaskType = {
      ...taskType,
      userId: user.uid,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(taskTypesRef, newTaskType);
    return docRef.id;
  }

  async updateTaskType(taskTypeId: string, updates: Partial<TaskType>): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskTypeRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-types`, taskTypeId);
    const now = new Date().toISOString();

    await updateDoc(taskTypeRef, {
      ...updates,
      updatedAt: now
    });
  }

  async deleteTaskType(taskTypeId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskTypeRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-types`, taskTypeId);
    await deleteDoc(taskTypeRef);
  }

  async getTaskTypes(): Promise<TaskType[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskTypesRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-types`);
    const q = query(taskTypesRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TaskType));
  }

  async getTaskTypesByProject(projectId: string): Promise<TaskType[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskTypesRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-types`);
    const q = query(
      taskTypesRef,
      where('userId', '==', user.uid),
      where('projectId', '==', projectId)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TaskType));
  }
}

