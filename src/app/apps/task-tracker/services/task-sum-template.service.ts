import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, doc, query, where, getDocs } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { TaskSumTemplate } from '../models/task-sum-template.model';
import { EnvironmentService } from './environment.service';

@Injectable({
  providedIn: 'root'
})
export class TaskSumTemplateService {
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  async createTemplate(template: Omit<TaskSumTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const templatesRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-sum-templates`);
    const now = new Date().toISOString();

    const newTemplate = {
      ...template,
      userId: user.uid,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(templatesRef, newTemplate);
    return docRef.id;
  }

  async getTemplates(): Promise<TaskSumTemplate[]> {
    const user = this.authService.getCurrentUser();
    if (!user) return [];

    const templatesRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-sum-templates`);
    const q = query(templatesRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TaskSumTemplate));
  }

  async getTemplateById(id: string): Promise<TaskSumTemplate | null> {
    const user = this.authService.getCurrentUser();
    if (!user) return null;

    const templatesRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-sum-templates`);
    const q = query(templatesRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);

    const doc = querySnapshot.docs.find(d => d.id === id);
    if (!doc) return null;

    return {
      id: doc.id,
      ...doc.data()
    } as TaskSumTemplate;
  }

  async deleteTemplate(id: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const templateRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}task-sum-templates`, id);
    await deleteDoc(templateRef);
  }
}

