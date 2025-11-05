import { Injectable } from '@angular/core';
import { Firestore, collection, setDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { Task } from '../models/task.model';
import { EnvironmentService } from './environment.service';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  async createTask(task: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt'>): Promise<string> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const tasksRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}tasks`);
    const nowDate = new Date();
    const now = nowDate.toISOString();

    const newTask = {
      ...task,
      userId: user.uid,
      createdAt: now,
      updatedAt: now,
      completed: false,
      completedAt: null,
      status: 'pending',
      hidden: false
    };

    // Construir ID personalizado: YYYYMMDD-HHmmss+<autoId>
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = nowDate.getFullYear();
    const MM = pad(nowDate.getMonth() + 1);
    const dd = pad(nowDate.getDate());
    const HH = pad(nowDate.getHours());
    const mm = pad(nowDate.getMinutes());
    const ss = pad(nowDate.getSeconds());
    const ts = `${yyyy}${MM}${dd}-${HH}${mm}${ss}`;
    const autoId = doc(tasksRef).id; // genera un id único como el de addDoc
    const customId = `${ts}+${autoId}`;

    await setDoc(doc(tasksRef, customId), newTask);
    return customId;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}tasks`, taskId);
    const now = new Date().toISOString();

    await updateDoc(taskRef, {
      ...updates,
      updatedAt: now
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}tasks`, taskId);
    await deleteDoc(taskRef);
  }

  async getTasks(): Promise<Task[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const tasksRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}tasks`);
    const q = query(tasksRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));
  }

  async completeTask(taskId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}tasks`, taskId);
    const now = new Date().toISOString();

    await updateDoc(taskRef, {
      completed: true,
      completedAt: now,
      updatedAt: now
    });
  }

  async uncompleteTask(taskId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}tasks`, taskId);
    const now = new Date().toISOString();

    await updateDoc(taskRef, {
      completed: false,
      completedAt: null,
      updatedAt: now
    });
  }

  async getTasksByName(taskName: string): Promise<Task[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');
    if (!taskName || taskName.trim() === '') return [];

    const tasksRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}tasks`);
    const q = query(
      tasksRef, 
      where('userId', '==', user.uid),
      where('name', '==', taskName.trim())
    );
    const querySnapshot = await getDocs(q);
    
    const tasks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));

    // Ordenar por fecha más reciente (usando updatedAt o createdAt)
    return tasks.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA; // Más reciente primero
    });
  }

  async getTasksByNameAndProject(taskName: string, projectId: string): Promise<Task[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');
    if (!taskName || taskName.trim() === '') return [];
    if (!projectId) return [];

    const tasksRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}tasks`);
    const q = query(
      tasksRef, 
      where('userId', '==', user.uid),
      where('name', '==', taskName.trim()),
      where('project', '==', projectId)
    );
    const querySnapshot = await getDocs(q);
    
    const tasks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));

    // Ordenar por fecha más reciente (usando updatedAt o createdAt)
    return tasks.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA; // Más reciente primero
    });
  }

  async getRecentTasksByProject(projectId: string, limit: number = 20): Promise<Task[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');
    if (!projectId) return [];

    const tasksRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}tasks`);
    const q = query(
      tasksRef, 
      where('userId', '==', user.uid),
      where('project', '==', projectId)
    );
    const querySnapshot = await getDocs(q);
    
    const tasks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));

    // Ordenar por fecha más reciente (usando updatedAt o createdAt) y limitar
    return tasks
      .sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA; // Más reciente primero
      })
      .slice(0, limit);
  }
} 