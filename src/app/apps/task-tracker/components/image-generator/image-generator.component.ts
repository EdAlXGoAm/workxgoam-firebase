import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpenAIService, GeneratedImage } from '../../services/openai.service';

@Component({
  selector: 'app-image-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4" (click)="onClose()">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span>🎨</span> Generar con IA
          </h3>
          <button (click)="onClose()" class="text-gray-400 hover:text-gray-600 transition p-1">
            <i class="fas fa-times fa-lg"></i>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Input form -->
          <div class="space-y-3 mb-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Descripción del icono</label>
              <input
                #promptInput
                type="text"
                [(ngModel)]="prompt"
                (keyup.enter)="handleGenerate()"
                [disabled]="isLoading || isUploading"
                placeholder="Ej: blue cloud icon with silver outline"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Estilo (opcional)</label>
              <input
                type="text"
                [(ngModel)]="style"
                [disabled]="isLoading || isUploading"
                placeholder="Ej: flat, 3d, outlined, gradient"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100">
            </div>
            <button
              (click)="handleGenerate()"
              [disabled]="isLoading || isUploading || !prompt.trim()"
              class="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {{ isLoading ? 'Generando...' : 'Generar Icono' }}
            </button>
          </div>

          <!-- Error -->
          <div *ngIf="error" class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
            {{ error }}
          </div>

          <!-- Loading -->
          <div *ngIf="isLoading || isUploading" class="flex flex-col items-center justify-center py-8 text-gray-500">
            <div class="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="text-sm">{{ isUploading ? 'Procesando imagen...' : 'Generando icono con IA...' }}</p>
          </div>

          <!-- Results -->
          <div *ngIf="!isLoading && !isUploading && results.length > 0" class="grid grid-cols-2 gap-3">
            <div
              *ngFor="let result of results; let i = index"
              (click)="handleSelectImage(result)"
              class="relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition aspect-square"
              [class.opacity-50]="uploadingImageUrl && uploadingImageUrl !== result.url"
              [class.ring-2]="uploadingImageUrl === result.url"
              [class.ring-indigo-500]="uploadingImageUrl === result.url">
              <img
                [src]="result.url"
                [alt]="result.revised_prompt || 'Icono generado'"
                class="w-full h-full object-cover"
                loading="lazy">
              <div *ngIf="uploadingImageUrl === result.url" class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div *ngIf="!isLoading && !error && hasGenerated && results.length === 0" class="text-center py-8 text-gray-500">
            <p class="mb-2">No se generaron iconos para tu descripción.</p>
            <p class="text-sm">Intenta con una descripción más específica.</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ImageGeneratorComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen: boolean = false;
  @Input() initialPrompt: string = '';
  @Output() closeModal = new EventEmitter<void>();
  @Output() selectImage = new EventEmitter<string>();

  @ViewChild('promptInput') promptInputRef!: ElementRef<HTMLInputElement>;

  prompt: string = '';
  style: string = '';
  results: GeneratedImage[] = [];
  isLoading: boolean = false;
  isUploading: boolean = false;
  error: string | null = null;
  hasGenerated: boolean = false;
  uploadingImageUrl: string | null = null;

  constructor(private openAIService: OpenAIService) {}

  ngOnInit(): void {
    if (this.isOpen) {
      document.body.style.overflow = 'hidden';
      this.prompt = this.initialPrompt;
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        document.body.style.overflow = 'hidden';
        this.prompt = this.initialPrompt;
        setTimeout(() => this.promptInputRef?.nativeElement?.focus(), 100);
      } else {
        document.body.style.overflow = '';
        this.resetState();
      }
    }
    if (changes['initialPrompt'] && this.isOpen) {
      this.prompt = this.initialPrompt;
    }
  }

  private resetState(): void {
    this.prompt = this.initialPrompt;
    this.style = '';
    this.results = [];
    this.error = null;
    this.hasGenerated = false;
  }

  async handleGenerate(): Promise<void> {
    if (!this.prompt.trim()) {
      this.error = 'Por favor ingresa una descripción del icono';
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.hasGenerated = true;

    try {
      const data = await this.openAIService.generateIcon({
        prompt: this.prompt.trim(),
        size: '1024x1024',
        n: 2,
        style: this.style.trim() || undefined,
        quality: 'standard',
      });
      
      this.results = data.data.images || [];
      if (this.results.length === 0) {
        this.error = 'No se generaron iconos. Intenta con otra descripción.';
      }
    } catch (err) {
      console.error('Error generando icono:', err);
      this.error = err instanceof Error ? err.message : 'Error al generar icono. Intenta nuevamente.';
      this.results = [];
    } finally {
      this.isLoading = false;
    }
  }

  handleSelectImage(image: GeneratedImage): void {
    if (this.isUploading) return;
    this.selectImage.emit(image.url);
    this.onClose();
  }

  onClose(): void {
    if (!this.isLoading && !this.isUploading) {
      document.body.style.overflow = '';
      this.closeModal.emit();
    }
  }
}

