import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageGeneratorComponent } from '../image-generator/image-generator.component';
import { ImageSearchComponent } from '../image-search/image-search.component';
import { ImageEditorComponent } from '../image-editor/image-editor.component';
import { CameraCaptureComponent } from '../camera-capture/camera-capture.component';
import { ImageProcessingService } from '../../services/image-processing.service';

@Component({
  selector: 'app-project-image-quick-edit',
  standalone: true,
  imports: [
    CommonModule,
    ImageGeneratorComponent,
    ImageSearchComponent,
    ImageEditorComponent,
    CameraCaptureComponent
  ],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4" style="overflow: hidden;">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 class="text-lg font-semibold text-gray-800">
            {{ currentImage ? 'Cambiar imagen' : 'Agregar imagen' }}
          </h3>
          <button 
            (click)="handleClose()" 
            [disabled]="isProcessing"
            class="text-gray-400 hover:text-gray-600 transition p-1 disabled:opacity-50">
            <i class="fas fa-times fa-lg"></i>
          </button>
        </div>

        <!-- Subtitle -->
        <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <p class="text-sm text-gray-600 truncate">{{ projectName }}</p>
        </div>

        <!-- Error -->
        <div *ngIf="error" class="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {{ error }}
        </div>

        <!-- Processing -->
        <div *ngIf="isProcessing" class="flex items-center justify-center gap-3 py-4 text-gray-600">
          <div class="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm">Procesando...</span>
        </div>

        <!-- Options -->
        <div class="p-4 space-y-2">
          <input
            #fileInput
            type="file"
            accept="image/*"
            class="hidden"
            (change)="handleFileSelect($event)">

          <button
            (click)="openImageGenerator()"
            [disabled]="isProcessing || isRemoving"
            class="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-left disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="text-2xl">🎨</span>
            <span class="text-sm font-medium text-gray-700">Generar con IA</span>
          </button>

          <button
            (click)="openImageSearch()"
            [disabled]="isProcessing || isRemoving"
            class="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-left disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="text-2xl">🔍</span>
            <span class="text-sm font-medium text-gray-700">Buscar en Google</span>
          </button>

          <button
            (click)="handlePasteFromClipboard()"
            [disabled]="isProcessing || isPastingFromClipboard || isRemoving"
            class="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-left disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="text-2xl">📋</span>
            <span class="text-sm font-medium text-gray-700">
              {{ isPastingFromClipboard ? 'Pegando...' : 'Pegar' }}
            </span>
          </button>

          <button
            (click)="openCameraCapture()"
            [disabled]="isProcessing || isRemoving"
            class="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-left disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="text-2xl">📷</span>
            <span class="text-sm font-medium text-gray-700">Tomar foto</span>
          </button>

          <button
            (click)="fileInput.click()"
            [disabled]="isProcessing || isRemoving"
            class="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-left disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="text-2xl">🖼️</span>
            <span class="text-sm font-medium text-gray-700">Galería</span>
          </button>
        </div>

        <!-- Remove button -->
        <div *ngIf="currentImage" class="px-4 pb-4">
          <button
            (click)="handleRemoveImage()"
            [disabled]="isProcessing || isRemoving"
            class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            <ng-container *ngIf="isRemoving">
              <div class="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              Eliminando...
            </ng-container>
            <ng-container *ngIf="!isRemoving">
              <span>🗑️</span>
              Eliminar imagen
            </ng-container>
          </button>
        </div>
      </div>
    </div>

    <!-- Sub-modals -->
    <app-image-generator
      [isOpen]="isImageGeneratorOpen"
      [initialPrompt]="projectName"
      (closeModal)="closeImageGenerator()"
      (selectImage)="handleImageFromGenerator($event)">
    </app-image-generator>

    <app-image-search
      [isOpen]="isImageSearchOpen"
      [initialQuery]="projectName"
      (closeModal)="closeImageSearch()"
      (selectImage)="handleImageFromSearch($event)">
    </app-image-search>

    <app-image-editor
      [isOpen]="isImageEditorOpen"
      [imageUrl]="imageToEdit"
      (closeModal)="closeImageEditor()"
      (confirm)="handleImageEditorConfirm($event)">
    </app-image-editor>

    <app-camera-capture
      [isOpen]="isCameraCaptureOpen"
      (closeModal)="closeCameraCapture()"
      (capture)="handleCameraCapture($event)">
    </app-camera-capture>
  `
})
export class ProjectImageQuickEditComponent implements OnInit, OnDestroy {
  @Input() isOpen: boolean = false;
  @Input() projectId?: string;
  @Input() projectName: string = '';
  @Input() currentImage?: string;
  @Output() closeModal = new EventEmitter<void>();
  @Output() imageUpdated = new EventEmitter<string>();

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  isImageGeneratorOpen: boolean = false;
  isImageSearchOpen: boolean = false;
  isImageEditorOpen: boolean = false;
  isCameraCaptureOpen: boolean = false;
  imageToEdit: string = '';
  isProcessing: boolean = false;
  isPastingFromClipboard: boolean = false;
  isRemoving: boolean = false;
  error: string | null = null;

  constructor(private imageProcessingService: ImageProcessingService) {}

  private disableBodyScroll(): void {
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    (document.body as any).__scrollY = scrollY;
  }

  private enableBodyScroll(): void {
    const scrollY = (document.body as any).__scrollY || 0;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
    delete (document.body as any).__scrollY;
  }

  ngOnInit(): void {
    if (this.isOpen) {
      this.disableBodyScroll();
    }
  }

  ngOnDestroy(): void {
    this.enableBodyScroll();
  }

  // Open sub-modals
  openImageGenerator(): void {
    this.isImageGeneratorOpen = true;
  }

  closeImageGenerator(): void {
    this.isImageGeneratorOpen = false;
  }

  openImageSearch(): void {
    this.isImageSearchOpen = true;
  }

  closeImageSearch(): void {
    this.isImageSearchOpen = false;
  }

  openCameraCapture(): void {
    this.isCameraCaptureOpen = true;
  }

  closeCameraCapture(): void {
    this.isCameraCaptureOpen = false;
  }

  closeImageEditor(): void {
    this.isImageEditorOpen = false;
    this.imageToEdit = '';
  }

  // Handle image from various sources
  async handleImageFromGenerator(imageUrl: string): Promise<void> {
    await this.openImageEditor(imageUrl);
  }

  async handleImageFromSearch(imageUrl: string): Promise<void> {
    await this.openImageEditor(imageUrl);
  }

  handleCameraCapture(imageDataUrl: string): void {
    this.isCameraCaptureOpen = false;
    this.imageToEdit = imageDataUrl;
    this.isImageEditorOpen = true;
  }

  async handleFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    
    if (!file) return;

    try {
      this.isProcessing = true;
      this.error = null;
      
      const result = await this.imageProcessingService.resizeFileToMaxBase64(file, 512);
      this.imageToEdit = result.dataUrl;
      
      setTimeout(() => {
        this.isImageEditorOpen = true;
        this.isProcessing = false;
      }, 100);
    } catch (err) {
      console.error('Error preparando imagen:', err);
      this.error = err instanceof Error ? err.message : 'Error al preparar la imagen';
      this.isProcessing = false;
    }
  }

  async handlePasteFromClipboard(): Promise<void> {
    try {
      this.error = null;
      this.isPastingFromClipboard = true;

      // Try to read image from clipboard
      if (navigator.clipboard && 'read' in navigator.clipboard) {
        try {
          const clipboardItems = await navigator.clipboard.read();
          for (const item of clipboardItems) {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                const blob = await item.getType(type);
                const ext = type.split('/')[1] || 'png';
                const file = new File([blob], `clipboard.${ext}`, { type });
                const result = await this.imageProcessingService.resizeFileToMaxBase64(file, 1024);
                await this.openImageEditor(result.dataUrl);
                return;
              }
            }
          }
        } catch (e) {
          // Clipboard API might not be available
        }
      }

      // Try to read text (URL or data URL)
      if (navigator.clipboard && 'readText' in navigator.clipboard) {
        const text = (await navigator.clipboard.readText()).trim();
        if (!text) {
          throw new Error('El portapapeles está vacío.');
        }
        if (text.startsWith('data:image/')) {
          await this.openImageEditor(text);
          return;
        }
        if (/^https?:\/\//i.test(text)) {
          await this.openImageEditor(text);
          return;
        }
        throw new Error('No hay una imagen en el portapapeles.');
      }

      throw new Error('Tu navegador no permite leer el portapapeles.');
    } catch (err) {
      console.error('Error pegando desde portapapeles:', err);
      this.error = err instanceof Error ? err.message : 'Error al pegar desde portapapeles';
    } finally {
      this.isPastingFromClipboard = false;
    }
  }

  async openImageEditor(imageUrl: string): Promise<void> {
    if (!imageUrl?.trim()) return;

    try {
      this.isProcessing = true;
      
      // If it's a URL, we need to process it first
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        const result = await this.imageProcessingService.processImageFromUrl(imageUrl, 1024);
        this.imageToEdit = result.dataUrl;
      } else {
        this.imageToEdit = imageUrl;
      }
      
      this.isProcessing = false;
      setTimeout(() => {
        this.isImageEditorOpen = true;
      }, 100);
    } catch (err) {
      console.error('Error preparando imagen para editar:', err);
      this.isProcessing = false;
      this.error = err instanceof Error ? err.message : 'Error al preparar la imagen';
    }
  }

  handleImageEditorConfirm(result: { base64: string; contentType: string }): void {
    // Create the full data URL to save in Firestore
    const dataUrl = `data:${result.contentType};base64,${result.base64}`;
    
    this.isImageEditorOpen = false;
    this.imageToEdit = '';
    this.imageUpdated.emit(dataUrl);
    this.handleClose();
  }

  handleRemoveImage(): void {
    this.isRemoving = true;
    // Emit empty string to indicate image removal
    this.imageUpdated.emit('');
    this.isRemoving = false;
    this.handleClose();
  }

  handleClose(): void {
    if (!this.isProcessing && !this.isRemoving) {
      this.error = null;
      this.enableBodyScroll();
      this.closeModal.emit();
    }
  }
}

