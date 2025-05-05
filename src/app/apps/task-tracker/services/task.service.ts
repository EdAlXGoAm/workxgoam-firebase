import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { Task } from '../models/task.model';

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

    const tasksRef = collection(this.firestore, 'tasks');
    const now = new Date().toISOString();

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

    const docRef = await addDoc(tasksRef, newTask);
    return docRef.id;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskRef = doc(this.firestore, 'tasks', taskId);
    const now = new Date().toISOString();

    await updateDoc(taskRef, {
      ...updates,
      updatedAt: now
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const taskRef = doc(this.firestore, 'tasks', taskId);
    await deleteDoc(taskRef);
  }

  async getTasks(): Promise<Task[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const tasksRef = collection(this.firestore, 'tasks');
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

    const taskRef = doc(this.firestore, 'tasks', taskId);
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

    const taskRef = doc(this.firestore, 'tasks', taskId);
    const now = new Date().toISOString();

    await updateDoc(taskRef, {
      completed: false,
      completedAt: null,
      updatedAt: now
    });
  }
} 