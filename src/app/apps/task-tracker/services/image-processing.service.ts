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
   */
  async processImageFromUrl(
    imageUrl: string,
    maxDimension: number = 200
  ): Promise<{ base64: string; contentType: string; dataUrl: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const result = this.resizeImageToBase64(img, maxDimension);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = () => reject(new Error('No se pudo cargar la imagen desde la URL'));
      img.src = imageUrl;
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

