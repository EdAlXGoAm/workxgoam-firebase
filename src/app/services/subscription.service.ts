import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  doc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs 
} from '@angular/fire/firestore';
import { Observable, from, map, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

export interface Subscription {
  id?: string;
  name: string;
  cost: number;
  costMXN: number;
  costUSD: number;
  currency: string;
  startDate: string;
  endDate: string | null;
  isRecurring: boolean;
  category: string;
  color: string;
  userId: string;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  
  // Tasa de cambio fija (misma que se usa en el componente)
  readonly EXCHANGE_RATE: number = 17.5;

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  // Obtener todas las suscripciones del usuario actual
  getSubscriptions(): Observable<Subscription[]> {
    return this.authService.user$.pipe(
      switchMap(user => {
        if (!user) {
          return of([]);
        }
        
        const subscriptionsRef = collection(this.firestore, 'subscriptions');
        const userSubscriptionsQuery = query(subscriptionsRef, where('userId', '==', user.uid));
        
        return collectionData(userSubscriptionsQuery, { idField: 'id' }) as Observable<Subscription[]>;
      })
    );
  }

  // Añadir una nueva suscripción
  async addSubscription(subscription: Omit<Subscription, 'id' | 'userId'>): Promise<string | null> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      console.error('No hay usuario autenticado');
      return null;
    }

    // Convertir a MXN si es necesario
    const costMXN = subscription.currency === 'USD' 
      ? subscription.cost * this.EXCHANGE_RATE 
      : subscription.cost;
      
    const costUSD = subscription.currency === 'MXN' 
      ? subscription.cost / this.EXCHANGE_RATE 
      : subscription.cost;

    // Preparar el objeto a guardar
    const subscriptionWithUser: Omit<Subscription, 'id'> = {
      ...subscription,
      costMXN,
      costUSD,
      userId: user.uid
    };
    
    try {
      const docRef = await addDoc(collection(this.firestore, 'subscriptions'), subscriptionWithUser);
      return docRef.id;
    } catch (error) {
      console.error('Error al añadir suscripción:', error);
      return null;
    }
  }

  // Actualizar una suscripción existente
  async updateSubscription(id: string, subscription: Partial<Omit<Subscription, 'id' | 'userId'>>): Promise<boolean> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      console.error('No hay usuario autenticado');
      return false;
    }

    const updateData: Partial<Subscription> = { ...subscription };
    
    // Si se actualiza el costo o la moneda, recalcular los valores
    if (subscription.cost !== undefined || subscription.currency !== undefined) {
      // Obtener la suscripción actual para tener todos los datos
      const subscriptionRef = doc(this.firestore, 'subscriptions', id);
      const subscriptionSnap = await getDocs(query(
        collection(this.firestore, 'subscriptions'),
        where('id', '==', id),
        where('userId', '==', user.uid)
      ));
      
      if (subscriptionSnap.empty) {
        console.error('No se encontró la suscripción o no pertenece al usuario');
        return false;
      }
      
      const currentSub = subscriptionSnap.docs[0].data() as Subscription;
      const cost = subscription.cost !== undefined ? subscription.cost : currentSub.cost;
      const currency = subscription.currency !== undefined ? subscription.currency : currentSub.currency;
      
      // Calcular los valores en ambas monedas
      updateData.costMXN = currency === 'USD' ? cost * this.EXCHANGE_RATE : cost;
      updateData.costUSD = currency === 'MXN' ? cost / this.EXCHANGE_RATE : cost;
    }
    
    try {
      await updateDoc(doc(this.firestore, 'subscriptions', id), updateData);
      return true;
    } catch (error) {
      console.error('Error al actualizar suscripción:', error);
      return false;
    }
  }

  // Eliminar una suscripción
  async deleteSubscription(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.firestore, 'subscriptions', id));
      return true;
    } catch (error) {
      console.error('Error al eliminar suscripción:', error);
      return false;
    }
  }

  // Eliminar todas las suscripciones del usuario
  async deleteAllSubscriptions(): Promise<boolean> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      console.error('No hay usuario autenticado');
      return false;
    }

    try {
      const subscriptionsRef = collection(this.firestore, 'subscriptions');
      const userSubscriptionsQuery = query(subscriptionsRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(userSubscriptionsQuery);
      
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      return true;
    } catch (error) {
      console.error('Error al eliminar todas las suscripciones:', error);
      return false;
    }
  }

  // Obtener color para una categoría
  getCategoryColor(category: string): string {
    switch (category) {
      case 'entertainment':
        return 'bg-gradient-to-r from-red-500 to-amber-500';
      case 'productivity':
        return 'bg-gradient-to-r from-indigo-500 to-cyan-400';
      case 'education':
        return 'bg-gradient-to-r from-emerald-500 to-lime-600';
      case 'tools':
        return 'bg-gradient-to-r from-gray-600 to-gray-800';
      default:
        return 'bg-gradient-to-r from-purple-500 to-pink-500';
    }
  }
} 