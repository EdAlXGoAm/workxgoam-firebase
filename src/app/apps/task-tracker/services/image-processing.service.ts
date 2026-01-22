import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageProcessingService {
  
  /**
   * Convierte un Blob a base64
   */
  blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        resolve(dataUrl.split(',')[1] || '');
      };
      reader.onerror = () => reject(reader.error || new Error('Error leyendo blob'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Redimensiona un archivo de imagen a un tamaño máximo y retorna base64
   */
  async resizeFileToMaxBase64(
    file: File,
    maxDimension: number = 200
  ): Promise<{ base64: string; contentType: string; dataUrl: string }> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = objectUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      });

      return this.resizeImageToBase64(img, maxDimension);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * Redimensiona una imagen (HTMLImageElement) a un tamaño máximo y retorna base64
   */
  resizeImageToBase64(
    img: HTMLImageElement,
    maxDimension: number = 200
  ): { base64: string; contentType: string; dataUrl: string } {
    const w0 = img.width || 1;
    const h0 = img.height || 1;
    const scale = Math.min(1, maxDimension / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo inicializar canvas');

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1] || '';
    
    return { base64, contentType: 'image/png', dataUrl };
  }

  /**
   * Procesa una imagen desde una URL y la redimensiona
   * Intenta múltiples métodos incluyendo proxy CORS si falla la carga directa
   */
  async processImageFromUrl(
    imageUrl: string,
    maxDimension: number = 200
  ): Promise<{ base64: string; contentType: string; dataUrl: string }> {
    // Si es un data URL, procesarlo directamente
    if (imageUrl.startsWith('data:')) {
      return this.loadImageAndProcess(imageUrl, maxDimension);
    }

    // Intentar carga directa primero
    try {
      return await this.loadImageAndProcess(imageUrl, maxDimension);
    } catch (directError) {
      console.log('Carga directa falló, intentando con proxy CORS...');
    }

    // Intentar con proxy CORS (corsproxy.io)
    const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`;
    try {
      return await this.loadImageAndProcess(corsProxyUrl, maxDimension);
    } catch (proxyError) {
      console.log('Proxy CORS falló, intentando con fetch y blob...');
    }

    // Último intento: usar fetch con blob
    try {
      return await this.fetchImageAsBlob(imageUrl, maxDimension);
    } catch (fetchError) {
      throw new Error('No se pudo cargar la imagen. Intenta con otra imagen o usa "Pegar" para copiar la imagen manualmente.');
    }
  }

  /**
   * Carga una imagen desde URL y la procesa
   */
  private loadImageAndProcess(
    imageUrl: string,
    maxDimension: number
  ): Promise<{ base64: string; contentType: string; dataUrl: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Timeout de 10 segundos
      const timeout = setTimeout(() => {
        reject(new Error('Timeout al cargar la imagen'));
      }, 10000);
      
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const result = this.resizeImageToBase64(img, maxDimension);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('No se pudo cargar la imagen desde la URL'));
      };
      
      img.src = imageUrl;
    });
  }

  /**
   * Intenta descargar la imagen usando fetch y convertirla a blob
   */
  private async fetchImageAsBlob(
    imageUrl: string,
    maxDimension: number
  ): Promise<{ base64: string; contentType: string; dataUrl: string }> {
    // Intentar con un proxy alternativo
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error('No se pudo descargar la imagen');
    }
    
    const blob = await response.blob();
    const dataUrl = await this.blobToDataUrl(blob);
    
    return this.loadImageAndProcess(dataUrl, maxDimension);
  }

  /**
   * Convierte un Blob a data URL completo
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(String(reader.result || ''));
      };
      reader.onerror = () => reject(reader.error || new Error('Error leyendo blob'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Procesa una imagen desde un dataUrl (base64) y la redimensiona
   */
  async processImageFromDataUrl(
    dataUrl: string,
    maxDimension: number = 200
  ): Promise<{ base64: string; contentType: string; dataUrl: string }> {
    return this.processImageFromUrl(dataUrl, maxDimension);
  }

  /**
   * Crea una imagen cuadrada con fondo blanco, centrando la imagen original
   */
  async createSquareImage(
    img: HTMLImageElement,
    size: number = 200
  ): Promise<{ base64: string; contentType: string; dataUrl: string }> {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo inicializar canvas');

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Escalar y centrar la imagen
    const scale = Math.min(size / img.width, size / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const x = Math.floor((size - w) / 2);
    const y = Math.floor((size - h) / 2);

    ctx.drawImage(img, x, y, w, h);

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1] || '';
    
    return { base64, contentType: 'image/png', dataUrl };
  }

  /**
   * Valida que el dataUrl no exceda un tamaño máximo (en bytes)
   */
  validateSize(dataUrl: string, maxSizeBytes: number = 100000): boolean {
    // El base64 tiene aproximadamente 4/3 del tamaño original
    const base64 = dataUrl.split(',')[1] || '';
    const sizeInBytes = Math.ceil((base64.length * 3) / 4);
    return sizeInBytes <= maxSizeBytes;
  }

  /**
   * Obtiene el tamaño aproximado en KB de un dataUrl
   */
  getSizeInKB(dataUrl: string): number {
    const base64 = dataUrl.split(',')[1] || '';
    const sizeInBytes = Math.ceil((base64.length * 3) / 4);
    return Math.round(sizeInBytes / 1024);
  }
}

