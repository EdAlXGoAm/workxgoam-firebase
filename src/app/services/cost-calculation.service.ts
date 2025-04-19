import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  orderBy
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

export interface CostItem {
  description: string;
  value: string; // Expresión o numero en string para mantener consistencia con la UI
}

export interface LaborInfo {
  hours: string; // Texto porque en la UI se permite expresiones
  minutes: string;
}

export interface CostCalculation {
  id?: string;
  title: string;
  links: string[];
  costsWithoutProfit: CostItem[];
  costsWithProfit: CostItem[];
  labor: LaborInfo;
  forceBaseCost: string;
  forceMerchantFactor: string;
  forcePublicFactor: string;
  merchantRounding: string;
  publicRounding: string;
  images: string[]; // dataURL base64 de máximo 3 imágenes
  selectedIngredients: { ingredientId: string; quantity: number }[];
  userId: string; // uid del usuario
  createdAt: number; // timestamp en milisegundos
}

@Injectable({
  providedIn: 'root'
})
export class CostCalculationService {
  constructor(private firestore: Firestore, private authService: AuthService) {}

  // Agregar cálculo
  async addCalculation(calculation: Omit<CostCalculation, 'id' | 'userId' | 'createdAt'>): Promise<string | null> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      console.error('No hay usuario autenticado');
      return null;
    }

    const calcWithMeta: Omit<CostCalculation, 'id'> = {
      ...calculation,
      userId: user.uid,
      createdAt: Date.now()
    } as CostCalculation;

    try {
      const docRef = await addDoc(collection(this.firestore, 'costCalculations'), calcWithMeta);
      return docRef.id;
    } catch (error) {
      console.error('Error al guardar cálculo:', error);
      return null;
    }
  }

  // Obtener todos los cálculos (visibles para todos)
  getCalculations(): Observable<CostCalculation[]> {
    // Recuperar todos los cálculos sin filtrar, ordenados por createdAt descendente
    const collRef = collection(this.firestore, 'costCalculations');
    const q = query(collRef, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<CostCalculation[]>;
  }

  // Actualizar cálculo
  async updateCalculation(id: string, data: Partial<Omit<CostCalculation, 'id' | 'userId'>>): Promise<boolean> {
    try {
      await updateDoc(doc(this.firestore, 'costCalculations', id), { ...data });
      return true;
    } catch (error) {
      console.error('Error al actualizar cálculo:', error);
      return false;
    }
  }

  // Eliminar cálculo
  async deleteCalculation(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.firestore, 'costCalculations', id));
      return true;
    } catch (error) {
      console.error('Error al eliminar cálculo:', error);
      return false;
    }
  }
} 