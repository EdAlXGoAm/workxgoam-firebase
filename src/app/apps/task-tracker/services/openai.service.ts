import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';

export interface GeneratedImage {
  url: string;
  revised_prompt?: string | null;
}

export interface IconGeneratorResponse {
  ok: boolean;
  data: {
    images: GeneratedImage[];
    prompt: string;
    original_prompt: string;
    model: string;
    size: string;
    created: number;
  };
}

export interface IconGeneratorRequest {
  prompt: string;
  size?: string;
  n?: number;
  style?: string;
  quality?: 'standard' | 'hd';
}

@Injectable({
  providedIn: 'root'
})
export class OpenAIService {
  
  private get apiUrl(): string {
    return environment.zonayummyFunctionsUrl;
  }

  /**
   * Genera iconos usando OpenAI GPT Image 1 API
   */
  async generateIcon(request: IconGeneratorRequest): Promise<IconGeneratorResponse> {
    if (!request.prompt || !request.prompt.trim()) {
      throw new Error('El prompt es requerido');
    }

    const response = await fetch(`${this.apiUrl}/openai/icon-generator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt.trim(),
        size: request.size || '1024x1024',
        n: request.n || 2,
        style: request.style || '',
        quality: request.quality || 'standard',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || errorData.message || `Error ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Error al generar icono');
    }

    return data;
  }

  /**
   * Quita el fondo de una imagen usando IA
   */
  async removeBackground(imageBase64: string): Promise<{ processedImage: string; contentType: string }> {
    const response = await fetch(`${this.apiUrl}/remove-bg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        bgColor: null,
      }),
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(txt || `Error del servidor (${response.status})`);
    }

    const data = await response.json();
    
    if (!data?.ok || !data?.processedImage) {
      throw new Error(data?.error || 'Respuesta inválida de remove-bg');
    }

    return {
      processedImage: data.processedImage,
      contentType: data.contentType || 'image/png'
    };
  }
}

