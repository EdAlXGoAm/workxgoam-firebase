import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleImageService, ImageSearchResult } from '../../services/google-image.service';

@Component({
  selector: 'app-image-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4" style="overflow: hidden;">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span>🔍</span> Buscar en Google
          </h3>
          <button (click)="onClose()" class="text-gray-400 hover:text-gray-600 transition p-1">
            <i class="fas fa-times fa-lg"></i>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Search form -->
          <div class="flex gap-2 mb-4">
            <input
              #searchInput
              type="text"
              [(ngModel)]="searchQuery"
              (keyup.enter)="handleSearch()"
              [disabled]="isLoading"
              placeholder="Buscar imágenes..."
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100">
            <select
              [(ngModel)]="resultCount"
              [disabled]="isLoading"
              title="Cantidad de resultados"
              class="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100 bg-white">
              <option *ngFor="let count of resultCountOptions" [value]="count">{{ count }}</option>
            </select>
            <button
              (click)="handleSearch()"
              [disabled]="isLoading || !searchQuery.trim()"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
              {{ isLoading ? 'Buscando...' : 'Buscar' }}
            </button>
          </div>

          <!-- Error -->
          <div *ngIf="error" class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
            {{ error }}
          </div>

          <!-- Loading -->
          <div *ngIf="isLoading || isUploading" class="flex flex-col items-center justify-center py-8 text-gray-500">
            <div class="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="text-sm">{{ isUploading ? 'Procesando imagen...' : 'Buscando imágenes...' }}</p>
          </div>

          <!-- Results -->
          <div *ngIf="!isLoading && !isUploading && results.length > 0" class="grid grid-cols-2 gap-3">
            <div
              *ngFor="let result of results"
              (click)="handleSelectImage(result)"
              class="relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition"
              [class.opacity-50]="uploadingImageUrl && uploadingImageUrl !== result.link"
              [class.ring-2]="uploadingImageUrl === result.link"
              [class.ring-indigo-500]="uploadingImageUrl === result.link">
              <div class="aspect-square">
                <img
                  [src]="result.image.thumbnailLink || result.link"
                  [alt]="result.title"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  (error)="handleImageError($event, result)">
              </div>
              <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                <p class="text-white text-xs truncate">{{ result.title }}</p>
              </div>
              <div *ngIf="uploadingImageUrl === result.link" class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div *ngIf="!isLoading && !error && hasSearched && results.length === 0" class="text-center py-8 text-gray-500">
            <p class="mb-2">No se encontraron imágenes para tu búsqueda.</p>
            <p class="text-sm">Intenta con términos más específicos.</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ImageSearchComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen: boolean = false;
  @Input() initialQuery: string = '';
  @Input() defaultResultCount: number = 10;
  @Output() closeModal = new EventEmitter<void>();
  @Output() selectImage = new EventEmitter<string>();

  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  searchQuery: string = '';
  results: ImageSearchResult[] = [];
  isLoading: boolean = false;
  isUploading: boolean = false;
  error: string | null = null;
  hasSearched: boolean = false;
  uploadingImageUrl: string | null = null;
  resultCount: number = 10;
  resultCountOptions: number[] = [6, 10, 20, 30, 40, 50];

  constructor(private googleImageService: GoogleImageService) {}

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
      this.searchQuery = this.initialQuery;
      this.resultCount = this.defaultResultCount;
    }
  }

  ngOnDestroy(): void {
    this.enableBodyScroll();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.disableBodyScroll();
        this.searchQuery = this.initialQuery;
        setTimeout(() => this.searchInputRef?.nativeElement?.focus(), 100);
      } else {
        this.enableBodyScroll();
        this.resetState();
      }
    }
    if (changes['initialQuery'] && this.isOpen) {
      this.searchQuery = this.initialQuery;
    }
  }

  private resetState(): void {
    this.searchQuery = this.initialQuery;
    this.results = [];
    this.error = null;
    this.hasSearched = false;
  }

  async handleSearch(): Promise<void> {
    if (!this.searchQuery.trim()) {
      this.error = 'Por favor ingresa un término de búsqueda';
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.hasSearched = true;

    try {
      const data = await this.googleImageService.searchImages(this.searchQuery.trim(), this.resultCount);
      this.results = data.items || [];
      if (this.results.length === 0) {
        this.error = 'No se encontraron imágenes. Intenta con otro término.';
      }
    } catch (err) {
      console.error('Error buscando imágenes:', err);
      this.error = err instanceof Error ? err.message : 'Error al buscar imágenes. Intenta nuevamente.';
      this.results = [];
    } finally {
      this.isLoading = false;
    }
  }

  handleSelectImage(result: ImageSearchResult): void {
    if (this.isUploading) return;
    // Preferir el thumbnail para mejor compatibilidad CORS, si no existe usar link principal
    const imageUrl = result.image?.thumbnailLink || result.link;
    this.selectImage.emit(imageUrl);
    this.onClose();
  }

  handleImageError(event: Event, result: ImageSearchResult): void {
    const img = event.target as HTMLImageElement;
    if (img.src !== result.link && result.image?.thumbnailLink) {
      img.src = result.link;
    }
  }

  onClose(): void {
    if (!this.isLoading && !this.isUploading) {
      this.enableBodyScroll();
      this.closeModal.emit();
    }
  }
}

