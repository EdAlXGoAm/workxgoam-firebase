import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, deleteDoc, getDoc } from '@angular/fire/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { Observable } from 'rxjs';

export interface Ingredient {
  id?: string;
  name: string;
  unit: string; // 'L', 'KG', 'PZ'
  packageSize: number; // Tamaño del empaque en unidades de 'unit'
  unitValue: number; // Valor monetario por paquete
  createdAt?: any;
  updatedAt?: any;
}

/** Historial de cambios de un ingrediente */
export interface IngredientHistory {
  id?: string;
  ingredientId: string;
  name: string;
  unit: string;
  packageSize: number;
  unitValue: number;
  changedAt: any;
}

@Injectable({
  providedIn: 'root'
})
export class IngredientService {
  private collPath = 'ingredients';

  constructor(private firestore: Firestore) {}

  // Obtener todos los ingredientes
  getIngredients(): Observable<Ingredient[]> {
    const collRef = collection(this.firestore, this.collPath);
    return collectionData(collRef, { idField: 'id' }) as Observable<Ingredient[]>;
  }

  // Añadir un ingrediente
  async addIngredient(ingredient: Omit<Ingredient, 'id'>): Promise<string | null> {
    try {
      const data = { ...ingredient, createdAt: serverTimestamp() };
      const docRef = await addDoc(collection(this.firestore, this.collPath), data);
      return docRef.id;
    } catch (error) {
      console.error('Error al añadir ingrediente:', error);
      return null;
    }
  }

  // Actualizar un ingrediente existente
  async updateIngredient(id: string, data: Partial<Omit<Ingredient, 'id'>>): Promise<boolean> {
    try {
      const docRef = doc(this.firestore, this.collPath, id);
      // Respaldo de datos anteriores en historial
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const old = snapshot.data();
        const historyRef = collection(this.firestore, `${this.collPath}/${id}/history`);
        await addDoc(historyRef, { ...old, changedAt: serverTimestamp(), ingredientId: id });
      }
      // Aplico actualización y guardo timestamp
      await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
      return true;
    } catch (error) {
      console.error('Error al actualizar ingrediente:', error);
      return false;
    }
  }

  // Eliminar un ingrediente
  async deleteIngredient(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.firestore, this.collPath, id));
      return true;
    } catch (error) {
      console.error('Error al eliminar ingrediente:', error);
      return false;
    }
  }

  /** Obtiene el historial de cambios de un ingrediente */
  getIngredientHistory(id: string): Observable<IngredientHistory[]> {
    const historyColl = collection(this.firestore, `${this.collPath}/${id}/history`);
    return collectionData(historyColl, { idField: 'id' }) as Observable<IngredientHistory[]>;
  }
} 