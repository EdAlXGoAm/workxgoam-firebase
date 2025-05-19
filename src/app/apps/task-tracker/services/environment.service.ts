import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { Environment } from '../models/environment.model';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  public static readonly COLLECTION_PREFIX = 'task-tracker_';

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  async createEnvironment(environment: Omit<Environment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const environmentsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}environments`);
    const now = new Date().toISOString();

    const newEnvironment = {
      ...environment,
      userId: user.uid,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(environmentsRef, newEnvironment);
    return docRef.id;
  }

  async updateEnvironment(environmentId: string, updates: Partial<Environment>): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const environmentRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}environments`, environmentId);
    const now = new Date().toISOString();

    await updateDoc(environmentRef, {
      ...updates,
      updatedAt: now
    });
  }

  async deleteEnvironment(environmentId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const environmentRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}environments`, environmentId);
    await deleteDoc(environmentRef);
  }

  async getEnvironments(): Promise<Environment[]> {
    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('Usuario no autenticado');

    const environmentsRef = collection(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}environments`);
    const q = query(environmentsRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Environment));
  }
} 