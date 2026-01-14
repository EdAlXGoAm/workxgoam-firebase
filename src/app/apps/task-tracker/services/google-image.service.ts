import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';

export interface ImageSearchResult {
  title: string;
  link: string;
  displayLink: string;
  snippet: string;
  mime: string;
  image: {
    contextLink: string;
    height: number;
    width: number;
    byteSize: number;
    thumbnailLink: string;
    thumbnailHeight: number;
    thumbnailWidth: number;
  };
}

export interface ImageSearchResponse {
  items: ImageSearchResult[];
  query: string;
  totalResults?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleImageService {
  
  private get apiUrl(): string {
    return environment.zonayummyFunctionsUrl;
  }

  /**
   * Busca imágenes usando Google Custom Search API
   * @param query Término de búsqueda
   * @param num Número de resultados (1-10, default: 10)
   */
  async searchImages(query: string, num: number = 10): Promise<ImageSearchResponse> {
    if (!query || !query.trim()) {
      throw new Error('El término de búsqueda es requerido');
    }

    if (num < 1 || num > 10) {
      throw new Error('El número de resultados debe estar entre 1 y 10');
    }

    const response = await fetch(
      `${this.apiUrl}/google/imagesearch?q=${encodeURIComponent(query.trim())}&num=${num}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Error ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Error al buscar imágenes');
    }

    return data.data;
  }
}

