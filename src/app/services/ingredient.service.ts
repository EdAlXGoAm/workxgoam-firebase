import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Ingredient {
  id?: string;
  name: string;
  unit: string; // 'L', 'KG', 'PZ'
  packageSize: number; // Tamaño del empaque en unidades de 'unit'
  unitValue: number; // Valor monetario por paquete
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
      const docRef = await addDoc(collection(this.firestore, this.collPath), ingredient);
      return docRef.id;
    } catch (error) {
      console.error('Error al añadir ingrediente:', error);
      return null;
    }
  }

  // Actualizar un ingrediente existente
  async updateIngredient(id: string, data: Partial<Omit<Ingredient, 'id'>>): Promise<boolean> {
    try {
      await updateDoc(doc(this.firestore, this.collPath, id), data);
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
} 