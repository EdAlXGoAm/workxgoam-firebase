import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { Project } from '../models/project.model';
import { EnvironmentService } from './environment.service';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  async createProject(project: Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const projectsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}projects`);
    const now = new Date().toISOString();

    const newProject = {
      ...project,
      userId: user.uid,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(projectsRef, newProject);
    return docRef.id;
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const projectRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}projects`, projectId);
    const now = new Date().toISOString();

    await updateDoc(projectRef, {
      ...updates,
      updatedAt: now
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const projectRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}projects`, projectId);
    await deleteDoc(projectRef);
  }

  async getProjects(): Promise<Project[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const projectsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}projects`);
    const q = query(projectsRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Project));
  }

  async getProjectsByEnvironment(environment: string): Promise<Project[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const projectsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}projects`);
    const q = query(
      projectsRef,
      where('userId', '==', user.uid),
      where('environment', '==', environment)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Project));
  }
} 