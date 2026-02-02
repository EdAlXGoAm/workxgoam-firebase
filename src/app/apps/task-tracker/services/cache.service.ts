import { Injectable } from '@angular/core';
import { AuthService } from '../../../services/auth.service';

export interface CacheMetadata {
  lastSync: string;      // ISO timestamp
  version: number;       // Para migraciones futuras
  userId: string;
}

export interface CachedData<T> {
  data: T[];
  metadata: CacheMetadata;
}

const DB_NAME = 'TaskTrackerCache';
const DB_VERSION = 1;
const CACHE_VERSION = 1; // Incrementar cuando cambie el esquema

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private authService: AuthService) {}

  /**
   * Inicializa la base de datos IndexedDB
   */
  async initDatabase(): Promise<void> {
    if (this.db) {
      return Promise.resolve();
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error al abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Crear object stores para cada tipo de dato
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks');
        }
        if (!db.objectStoreNames.contains('environments')) {
          db.createObjectStore('environments');
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects');
        }
        if (!db.objectStoreNames.contains('task-types')) {
          db.createObjectStore('task-types');
        }
        if (!db.objectStoreNames.contains('task-groups')) {
          db.createObjectStore('task-groups');
        }
        if (!db.objectStoreNames.contains('task-sum-templates')) {
          db.createObjectStore('task-sum-templates');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Obtiene datos desde el caché
   */
  async getFromCache<T>(storeName: string): Promise<CachedData<T> | null> {
    try {
      await this.initDatabase();
      if (!this.db) {
        return null;
      }

      const user = this.authService.getCurrentUser();
      if (!user) {
        return null;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(user.uid);

        request.onsuccess = () => {
          const cachedData = request.result as CachedData<T> | undefined;
          
          if (!cachedData) {
            resolve(null);
            return;
          }

          // Validar versión del caché
          if (cachedData.metadata.version !== CACHE_VERSION) {
            console.log(`Versión de caché desactualizada para ${storeName}, limpiando...`);
            this.clearStore(storeName).then(() => resolve(null));
            return;
          }

          // Validar que el caché pertenece al usuario actual
          if (cachedData.metadata.userId !== user.uid) {
            console.log(`Caché de otro usuario para ${storeName}, limpiando...`);
            this.clearStore(storeName).then(() => resolve(null));
            return;
          }

          resolve(cachedData);
        };

        request.onerror = () => {
          console.error(`Error al leer caché para ${storeName}:`, request.error);
          resolve(null); // Fallback: retornar null en caso de error
        };
      });
    } catch (error) {
      console.error(`Error al obtener caché para ${storeName}:`, error);
      return null;
    }
  }

  /**
   * Guarda datos en el caché
   */
  async saveToCache<T>(storeName: string, data: T[]): Promise<void> {
    try {
      await this.initDatabase();
      if (!this.db) {
        throw new Error('Base de datos no inicializada');
      }

      const user = this.authService.getCurrentUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const cachedData: CachedData<T> = {
        data,
        metadata: {
          lastSync: new Date().toISOString(),
          version: CACHE_VERSION,
          userId: user.uid
        }
      };

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(cachedData, user.uid);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error(`Error al guardar caché para ${storeName}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error al guardar caché para ${storeName}:`, error);
      // No lanzar error para no romper el flujo principal
    }
  }

  /**
   * Obtiene el timestamp de la última sincronización
   */
  async getCacheTimestamp(storeName: string): Promise<string | null> {
    try {
      const cachedData = await this.getFromCache(storeName);
      return cachedData?.metadata.lastSync || null;
    } catch (error) {
      console.error(`Error al obtener timestamp para ${storeName}:`, error);
      return null;
    }
  }

  /**
   * Limpia un store específico
   */
  async clearStore(storeName: string): Promise<void> {
    try {
      await this.initDatabase();
      if (!this.db) {
        return;
      }

      const user = this.authService.getCurrentUser();
      if (!user) {
        return;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(user.uid);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error(`Error al limpiar caché para ${storeName}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error al limpiar caché para ${storeName}:`, error);
    }
  }

  /**
   * Limpia todo el caché del usuario actual
   */
  async clearCache(): Promise<void> {
    try {
      await this.initDatabase();
      if (!this.db) {
        return;
      }

      const stores = ['tasks', 'environments', 'projects', 'task-types', 'task-groups', 'task-sum-templates'];
      await Promise.all(stores.map(store => this.clearStore(store)));
    } catch (error) {
      console.error('Error al limpiar caché completo:', error);
    }
  }

  /**
   * Verifica si IndexedDB está disponible
   */
  isAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }
}
