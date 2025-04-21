import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Storage, ref, uploadBytesResumable, getDownloadURL, listAll, getMetadata, updateMetadata } from '@angular/fire/storage';

interface Video {
  id: string;
  title: string;
  description: string;
  category: string;
  views: number;
  date: string;
  duration: string;
  size: string;
  url: string;
  favorite: boolean;
}

@Component({
  selector: 'app-upload-videos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <header class="bg-indigo-600 text-white shadow-lg">
      <div class="container mx-auto px-4 py-6 flex justify-between items-center">
        <h1 class="text-2xl font-bold">Galería de Videos Públicos</h1>
        <button (click)="openUploadModal()" class="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition">
          <i class="fas fa-upload mr-2"></i>Subir Video
        </button>
      </div>
    </header>

    <main class="container mx-auto px-4 py-8">
      <!-- Búsqueda y filtro -->
      <div class="mb-8 bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-4">
        <div class="flex-1 relative">
          <input [(ngModel)]="searchTerm" type="text" placeholder="Buscar videos..." class="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
          <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
        </div>
        <div>
          <select [(ngModel)]="filterValue" class="w-full md:w-48 px-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
            <option value="all">Todos</option>
            <option value="recent">Más recientes</option>
            <option value="popular">Más vistos</option>
            <option value="favorites">Favoritos</option>
          </select>
        </div>
      </div>

      <!-- Galería de videos -->
      <div *ngIf="filteredVideos.length > 0; else emptyState" id="videoGallery" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div *ngFor="let video of filteredVideos" class="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition">
          <div class="relative">
            <video [src]="video.url" class="w-full h-48 object-cover" muted playsinline></video>
            <div class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition">
              <button (click)="openDetail(video)" class="bg-white bg-opacity-80 rounded-full p-3 text-indigo-600 hover:bg-opacity-100 transition">
                <i class="fas fa-play"></i>
              </button>
            </div>
            <div class="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
              {{ video.duration }}
            </div>
          </div>
          <div class="p-4">
            <h3 class="font-medium text-gray-800 mb-1 truncate">{{ video.title }}</h3>
            <div class="flex justify-between items-center text-sm text-gray-500">
              <span><i class="fas fa-eye mr-1"></i> {{ video.views | number }} views</span>
              <span><i class="far fa-calendar-alt mr-1"></i> {{ video.date | date:'mediumDate' }}</span>
            </div>
            <div class="mt-3 flex justify-between items-center">
              <span class="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full">{{ video.category }}</span>
              <button (click)="toggleFavorite(video)" [ngClass]="video.favorite ? 'text-red-500' : 'text-gray-400 hover:text-red-500'" class="favorite-btn">
                <i [class.fas]="video.favorite" [class.far]="!video.favorite"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      <ng-template #emptyState>
        <div class="text-center py-12">
          <i class="fas fa-video-slash text-5xl text-gray-300 mb-4"></i>
          <h3 class="text-xl font-medium text-gray-700">No se encontraron videos</h3>
          <button (click)="openUploadModal()" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition">
            <i class="fas fa-upload mr-2"></i>Subir Video
          </button>
        </div>
      </ng-template>
    </main>

    <!-- Modal de subida -->
    <div *ngIf="showUploadModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div class="flex justify-between items-center border-b px-6 py-4">
          <h3 class="text-lg font-medium">Subir nuevo video</h3>
          <button (click)="closeUploadModal()" class="text-gray-500 hover:text-gray-700"><i class="fas fa-times"></i></button>
        </div>
        <form #f="ngForm" (ngSubmit)="uploadVideo(f)">
          <div class="p-6 space-y-6">
            <div class="upload-dropzone rounded-lg p-8 text-center cursor-pointer border-2 border-dashed text-gray-600" 
                 (click)="fileInput.click()">
              <input type="file" #fileInput class="hidden" accept="video/*" (change)="onFileSelected($event)" />
              <i class="fas fa-cloud-upload-alt text-4xl text-indigo-500 mb-3"></i>
              <p>Arrastra y suelta tu video o haz clic aquí</p>
              <p *ngIf="selectedFile" class="mt-3 text-sm text-gray-500">{{ selectedFile.name }}</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input name="title" ngModel required class="w-full px-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select name="category" ngModel required class="w-full px-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">Selecciona</option>
                  <option value="travel">Travel</option>
                  <option value="music">Music</option>
                  <option value="education">Education</option>
                  <option value="gaming">Gaming</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea name="description" ngModel rows="3" class="w-full px-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"></textarea>
            </div>
          </div>
          <div class="flex justify-end gap-3 border-t px-6 py-4">
            <button type="button" (click)="closeUploadModal()" class="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
              <i class="fas fa-save mr-2"></i>Guardar Video
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal detalle -->
    <div *ngIf="showDetailModal && currentVideo" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div class="flex justify-between items-center border-b px-6 py-4">
          <h3 class="text-lg font-medium">{{ currentVideo.title }}</h3>
          <button (click)="closeDetail()" class="text-gray-500 hover:text-gray-700"><i class="fas fa-times"></i></button>
        </div>
        <div class="p-6">
          <video controls [src]="currentVideo.url" class="w-full rounded-lg bg-black mb-6"></video>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="md:col-span-2">
              <div class="flex items-center mb-4 text-gray-500">
                <i class="fas fa-eye mr-1"></i>{{ currentVideo.views }} views
                <i class="far fa-calendar-alt ml-6 mr-1"></i>{{ currentVideo.date | date:'mediumDate' }}
              </div>
              <h4 class="font-medium text-gray-800 mb-2">Descripción</h4>
              <p class="text-gray-600 mb-6">{{ currentVideo.description }}</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-4">
              <h4 class="font-medium text-gray-800 mb-3">Detalles</h4>
              <p class="text-sm text-gray-500">Categoría</p>
              <p class="font-medium mb-3">{{ currentVideo.category }}</p>
              <p class="text-sm text-gray-500">Duración</p>
              <p class="font-medium mb-3">{{ currentVideo.duration }}</p>
              <p class="text-sm text-gray-500">Tamaño</p>
              <p class="font-medium mb-3">{{ currentVideo.size }}</p>
              <div class="mt-4 pt-4 border-t">
                <button (click)="toggleFavorite(currentVideo)" class="mr-4 text-gray-500 hover:text-red-500">
                  <i [class.fas]="currentVideo.favorite" [class.far]="!currentVideo.favorite"></i> {{ currentVideo.favorite ? 'Favorito' : 'Favorite' }}
                </button>
                <button (click)="copyShareLink(currentVideo)" class="text-gray-500 hover:text-indigo-500">
                  <i class="fas fa-share-alt"></i> Share
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [``]
})
export class UploadVideosComponent implements OnInit {
  private storage = inject(Storage);
  videos: Video[] = [];
  searchTerm = '';
  filterValue = 'all';
  selectedFile?: File;
  showUploadModal = false;
  showDetailModal = false;
  currentVideo?: Video;

  ngOnInit() {
    this.loadVideos();
  }

  async loadVideos() {
    const listRef = ref(this.storage, 'public_videos');
    const res = await listAll(listRef);
    this.videos = await Promise.all(
      res.items.map(async itemRef => {
        const url = await getDownloadURL(itemRef);
        const metadata = await getMetadata(itemRef);
        return {
          id: itemRef.name,
          title: metadata.customMetadata?.['title'] || itemRef.name,
          description: metadata.customMetadata?.['description'] || '',
          category: metadata.customMetadata?.['category'] || 'other',
          views: +(metadata.customMetadata?.['views'] ?? '0'),
          date: metadata.timeCreated || '',
          duration: this.formatDuration(metadata.size),
          size: this.formatSize(metadata.size),
          url,
          favorite: metadata.customMetadata?.['favorite'] === 'true'
        };
      })
    );
  }

  formatDuration(size: number): string {
    return this.formatSize(size).replace(' MB','') + ':00';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
  }

  openUploadModal() { this.showUploadModal = true; }
  closeUploadModal() { this.showUploadModal = false; this.selectedFile = undefined; }

  onFileSelected(event: any) { this.selectedFile = event.target.files[0]; }

  async uploadVideo(form: any) {
    const { title, category, description } = form.value;
    if (!title || !category || !this.selectedFile) {
      alert('Por favor completa todos los campos');
      return;
    }
    const fileRef = ref(this.storage, `public_videos/${Date.now()}_${this.selectedFile.name}`);
    const metadata = { customMetadata: { title, description, category, views: '0', favorite: 'false' } };
    const task = uploadBytesResumable(fileRef, this.selectedFile, metadata);
    task.on('state_changed', null, err => alert(err), async () => {
      await this.loadVideos();
      this.closeUploadModal();
    });
  }

  openDetail(video: Video) {
    this.currentVideo = { ...video };
    this.showDetailModal = true;
    this.incrementViews(video);
  }
  closeDetail() { this.showDetailModal = false; }

  async incrementViews(video: Video) {
    const itemRef = ref(this.storage, `public_videos/${video.id}`);
    const meta = await getMetadata(itemRef);
    const newCount = +(meta.customMetadata?.['views'] ?? '0') + 1;
    await updateMetadata(itemRef, { customMetadata: { ...meta.customMetadata, views: newCount.toString() } });
    if (this.currentVideo) this.currentVideo.views = newCount;
    this.loadVideos();
  }

  async toggleFavorite(video: Video) {
    const itemRef = ref(this.storage, `public_videos/${video.id}`);
    const meta = await getMetadata(itemRef);
    const fav = !(meta.customMetadata?.['favorite'] === 'true');
    await updateMetadata(itemRef, { customMetadata: { ...meta.customMetadata, favorite: fav.toString() } });
    video.favorite = fav;
  }

  copyShareLink(video: Video) {
    navigator.clipboard.writeText(video.url);
    alert(`Enlace copiado: ${video.url}`);
  }

  get filteredVideos(): Video[] {
    let arr = [...this.videos];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      arr = arr.filter(v => v.title.toLowerCase().includes(term) || v.description.toLowerCase().includes(term));
    }
    if (this.filterValue === 'recent') {
      arr.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (this.filterValue === 'popular') {
      arr.sort((a,b) => b.views - a.views);
    } else if (this.filterValue === 'favorites') {
      arr = arr.filter(v => v.favorite);
    }
    return arr;
  }
} 