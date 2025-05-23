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
import { Storage, ref, uploadString, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

export interface Print3DCostItem {
  description: string;
  value: string; // Expresión o numero en string para mantener consistencia con la UI
}

export interface Print3DPrintInfo {
  weightGrams: string; // Peso en gramos
  printHours: string; // Horas de impresión
  printMinutes: string; // Minutos de impresión
  pieces: string; // Número de piezas
}

export interface Print3DLaborInfo {
  hours: string; // Horas de mano de obra
  minutes: string; // Minutos de mano de obra
}

export interface Print3DAdvancedOptions {
  filamentCostPerKg: string; // Costo del filamento por kg
  electricityRatePerHour: string; // Tarifa de electricidad por hora
  printerDepreciationPerMinute: string; // Depreciación de impresora por minuto
  laborRatePerHour: string; // Tarifa de mano de obra por hora
  forcedCostForFactors: string; // Costo forzado para cálculo de factores
  forcedPublicPrice: string; // Precio al público forzado (opcional)
  additionalCosts: string; // Costos adicionales
}

export interface Print3DCalculation {
  id?: string;
  title: string;
  links: string[];
  printInfo: Print3DPrintInfo;
  laborInfo: Print3DLaborInfo;
  advancedOptions: Print3DAdvancedOptions;
  additionalCosts: Print3DCostItem[];
  images: string[]; // URLs de Firebase Storage
  userId: string; // uid del usuario
  createdAt: number; // timestamp en milisegundos
}

@Injectable({
  providedIn: 'root'
})
export class Print3DCalculationService {
  constructor(
    private firestore: Firestore, 
    private authService: AuthService,
    private storage: Storage
  ) {}

  // Subir imágenes a Storage y obtener URLs
  private async uploadImages(calculationId: string, imageDataUrls: (string | null)[]): Promise<string[]> {
    const imageUrls: string[] = [];
    
    for (let i = 0; i < imageDataUrls.length; i++) {
      const dataUrl = imageDataUrls[i];
      if (!dataUrl) continue;
      
      try {
        const storageRef = ref(this.storage, `calculations_3d/${calculationId}/${i}`);
        await uploadString(storageRef, dataUrl, 'data_url');
        const url = await getDownloadURL(storageRef);
        imageUrls.push(url);
      } catch (e) {
        console.error('Error subiendo imagen', e);
      }
    }
    
    return imageUrls;
  }

  // Eliminar imágenes de Storage
  private async deleteImages(calculationId: string): Promise<void> {
    try {
      // Intentar eliminar hasta 3 imágenes (índices 0, 1, 2)
      for (let i = 0; i < 3; i++) {
        try {
          const storageRef = ref(this.storage, `calculations_3d/${calculationId}/${i}`);
          await deleteObject(storageRef);
        } catch (e) {
          // Ignorar errores si la imagen no existe
        }
      }
    } catch (e) {
      console.error('Error eliminando imágenes:', e);
    }
  }

  // Agregar cálculo de impresión 3D
  async addCalculation(
    calculation: Omit<Print3DCalculation, 'id' | 'userId' | 'createdAt'>,
    imageDataUrls: (string | null)[] = []
  ): Promise<string | null> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      console.error('No hay usuario autenticado');
      return null;
    }

    try {
      // Crear documento primero para obtener ID
      const calcWithMeta: Omit<Print3DCalculation, 'id'> = {
        ...calculation,
        images: [], // Temporalmente vacío
        userId: user.uid,
        createdAt: Date.now()
      } as Print3DCalculation;

      const docRef = await addDoc(collection(this.firestore, 'print3DCalculations'), calcWithMeta);
      const id = docRef.id;

      // Subir imágenes a Storage si existen
      const imageUrls = await this.uploadImages(id, imageDataUrls);

      // Actualizar documento con URLs de imágenes
      if (imageUrls.length > 0) {
        await updateDoc(docRef, { images: imageUrls });
      }

      return id;
    } catch (error) {
      console.error('Error al guardar cálculo de impresión 3D:', error);
      return null;
    }
  }

  // Obtener todos los cálculos de impresión 3D
  getCalculations(): Observable<Print3DCalculation[]> {
    const collRef = collection(this.firestore, 'print3DCalculations');
    const q = query(collRef, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Print3DCalculation[]>;
  }

  // Actualizar cálculo de impresión 3D
  async updateCalculation(
    id: string, 
    data: Partial<Omit<Print3DCalculation, 'id' | 'userId'>>,
    imageDataUrls?: (string | null)[],
    existingImageUrls?: string[],
    originalImageUrls?: string[]
  ): Promise<boolean> {
    try {
      // Si hay nuevas imágenes, procesarlas de manera inteligente
      if (imageDataUrls && (imageDataUrls.some(img => img !== null) || originalImageUrls)) {
        const finalImageUrls: string[] = [];
        
        for (let i = 0; i < 3; i++) {
          const newImage = imageDataUrls[i];
          const currentUrl = existingImageUrls?.[i];
          const originalUrl = originalImageUrls?.[i];
          
          if (newImage !== null && newImage !== undefined) {
            // Hay una nueva imagen para esta posición
            // Eliminar la imagen anterior si existe
            if (originalUrl) {
              try {
                const oldRef = ref(this.storage, `calculations_3d/${id}/${i}`);
                await deleteObject(oldRef);
              } catch (e) {
                // Ignorar errores si la imagen no existe
              }
            }
            
            // Subir la nueva imagen
            try {
              const storageRef = ref(this.storage, `calculations_3d/${id}/${i}`);
              await uploadString(storageRef, newImage, 'data_url');
              const url = await getDownloadURL(storageRef);
              finalImageUrls.push(url);
            } catch (e) {
              console.error('Error subiendo imagen en posición', i, e);
              // Si hay una imagen original, mantenerla
              if (originalUrl) {
                finalImageUrls.push(originalUrl);
              }
            }
          } else if (currentUrl && currentUrl.trim() !== '') {
            // No hay nueva imagen, pero hay una imagen actual (no eliminada)
            finalImageUrls.push(currentUrl);
          } else if (originalUrl && (!currentUrl || currentUrl.trim() === '')) {
            // La imagen fue eliminada (había original pero ya no hay actual)
            try {
              const oldRef = ref(this.storage, `calculations_3d/${id}/${i}`);
              await deleteObject(oldRef);
            } catch (e) {
              // Ignorar errores si la imagen no existe
            }
          }
        }
        
        data.images = finalImageUrls;
      }
      // Si no se pasan imageDataUrls, no tocar el campo images (preservar las existentes)

      await updateDoc(doc(this.firestore, 'print3DCalculations', id), { ...data });
      return true;
    } catch (error) {
      console.error('Error al actualizar cálculo de impresión 3D:', error);
      return false;
    }
  }

  // Eliminar cálculo de impresión 3D
  async deleteCalculation(id: string): Promise<boolean> {
    try {
      // Eliminar imágenes de Storage primero
      await this.deleteImages(id);
      
      // Eliminar documento de Firestore
      await deleteDoc(doc(this.firestore, 'print3DCalculations', id));
      return true;
    } catch (error) {
      console.error('Error al eliminar cálculo de impresión 3D:', error);
      return false;
    }
  }

  // Métodos de cálculo basados en el script de Python
  calculateFilamentCost(weightGrams: number, costPerKg: number): number {
    return (weightGrams / 1000) * costPerKg;
  }

  calculateElectricityCost(timeHours: number, ratePerHour: number = 3.80): number {
    return timeHours * 0.3 * ratePerHour; // 0.3 kW consumo estimado
  }

  calculateDepreciationCost(timeHours: number, depreciationPerMinute: number = 0.02): number {
    return timeHours * 60 * depreciationPerMinute;
  }

  calculateLaborCost(laborHours: number, ratePerHour: number = 50): number {
    return (laborHours * 9/8) * ratePerHour; // Factor 9/8 como en el script
  }

  calculateMerchantFactor(costTotal: number): number {
    if (costTotal < 77) {
      return 3 - Math.atan(0.06316 * (costTotal - 52.5));
    } else {
      return 2;
    }
  }

  calculatePublicFactor(merchantPrice: number, costTotal: number): number {
    if (merchantPrice < 100) {
      return 0.3 - 0.2 * Math.atan(0.01157 * (costTotal - 52.5));
    } else {
      return 0.2;
    }
  }

  roundMerchantPrice(price: number): number {
    return Math.round(price);
  }

  roundPublicPrice(price: number): number {
    return Math.round(price / 5) * 5;
  }
} 