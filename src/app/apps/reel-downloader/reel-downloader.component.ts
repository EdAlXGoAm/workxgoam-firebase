import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Platform {
  id: string;
  name: string;
  icon: string;
  gradient: string;
  placeholder: string;
  urlPattern: RegExp;
  endpoint: string;
  filenamePrefix: string;
}

@Component({
  selector: 'app-reel-downloader',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div 
      class="min-h-screen relative overflow-hidden transition-all duration-500"
      [style.background]="currentPlatform.gradient"
    >
      <!-- Patrón de fondo animado -->
      <div class="absolute inset-0 opacity-10">
        <div class="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
        <div class="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2 animate-pulse"></div>
        <div class="absolute top-1/2 left-1/2 w-64 h-64 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-ping" style="animation-duration: 3s;"></div>
      </div>

      <!-- Header -->
      <header class="relative z-10 pt-6 pb-2">
        <div class="container mx-auto px-4">
          <a routerLink="/home" class="inline-flex items-center text-white/80 hover:text-white transition mb-4 group">
            <svg class="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
            Volver
          </a>
          
          <div class="text-center">
            <!-- Logo dinámico -->
            <div class="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/20 backdrop-blur-xl mb-3 shadow-2xl border border-white/30 transition-all duration-300">
              <div [innerHTML]="currentPlatform.icon" class="w-8 h-8 md:w-10 md:h-10 text-white"></div>
            </div>
            
            <h1 class="text-3xl md:text-4xl font-black text-white mb-1 tracking-tight">
              Video Downloader
            </h1>
            <p class="text-white/80 text-base font-light">
              Descarga videos de tus redes favoritas
            </p>
          </div>
        </div>
      </header>

      <!-- Tabs de plataformas -->
      <div class="relative z-10 container mx-auto px-4 mt-4">
        <div class="max-w-2xl mx-auto">
          <div class="flex bg-white/10 backdrop-blur-xl rounded-2xl p-1.5 border border-white/20 overflow-x-auto scrollbar-hide">
            <button 
              *ngFor="let platform of platforms"
              (click)="selectPlatform(platform.id)"
              [ngClass]="{
                'bg-white text-gray-800 shadow-lg': selectedPlatform === platform.id,
                'text-white hover-tab': selectedPlatform !== platform.id
              }"
              class="flex-1 min-w-[80px] flex flex-col items-center gap-1 py-2.5 px-3 rounded-xl transition-all duration-300 relative"
            >
              <div 
                [innerHTML]="platform.icon" 
                class="w-5 h-5 md:w-6 md:h-6 transition-transform duration-300"
                [class.scale-110]="selectedPlatform === platform.id"
              ></div>
              <span class="text-xs font-medium whitespace-nowrap">{{ platform.name }}</span>
              <!-- Indicador activo -->
              <div 
                *ngIf="selectedPlatform === platform.id"
                class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current"
              ></div>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <main class="relative z-10 container mx-auto px-4 py-6">
        <div class="max-w-2xl mx-auto">
          <!-- Card principal -->
          <div class="bg-white/10 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl border border-white/20 transition-all duration-300">
            
            <!-- Input URL -->
            <div class="relative mb-5">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg class="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                </svg>
              </div>
              <input 
                type="text" 
                [(ngModel)]="videoUrl"
                [placeholder]="currentPlatform.placeholder"
                class="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all text-base md:text-lg"
                [disabled]="isLoading"
                (keyup.enter)="downloadVideo()"
              />
            </div>

            <!-- Botón de descarga -->
            <button 
              (click)="downloadVideo()"
              [disabled]="isLoading || !videoUrl.trim()"
              class="w-full py-4 px-6 bg-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
              [style.color]="getButtonTextColor()"
            >
              <ng-container *ngIf="!isLoading">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Descargar Video
              </ng-container>
              <ng-container *ngIf="isLoading">
                <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ statusMessage }}
              </ng-container>
            </button>

            <!-- Progress bar -->
            <div *ngIf="isLoading" class="mt-4">
              <div class="h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-white rounded-full transition-all duration-300"
                  [style.width.%]="progress"
                ></div>
              </div>
              <p class="text-white/60 text-sm text-center mt-2">{{ progress }}%</p>
            </div>

            <!-- Mensaje de error -->
            <div *ngIf="errorMessage" class="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-2xl animate-shake">
              <p class="text-white text-center flex items-center justify-center gap-2 text-sm md:text-base">
                <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {{ errorMessage }}
              </p>
            </div>

            <!-- Mensaje de éxito -->
            <div *ngIf="successMessage" class="mt-4 p-4 bg-green-500/20 border border-green-500/30 rounded-2xl">
              <p class="text-white text-center flex items-center justify-center gap-2 text-sm md:text-base">
                <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                {{ successMessage }}
              </p>
            </div>
          </div>

          <!-- Instrucciones -->
          <div class="mt-6 text-center">
            <h3 class="text-white font-semibold mb-3">¿Cómo usar?</h3>
            <div class="grid grid-cols-3 gap-2 md:gap-4">
              <div class="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-white/10">
                <div class="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span class="text-white font-bold text-sm md:text-base">1</span>
                </div>
                <p class="text-white/80 text-xs md:text-sm">Copia el link del video</p>
              </div>
              <div class="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-white/10">
                <div class="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span class="text-white font-bold text-sm md:text-base">2</span>
                </div>
                <p class="text-white/80 text-xs md:text-sm">Pégalo aquí arriba</p>
              </div>
              <div class="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-white/10">
                <div class="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span class="text-white font-bold text-sm md:text-base">3</span>
                </div>
                <p class="text-white/80 text-xs md:text-sm">Descarga el video</p>
              </div>
            </div>
          </div>

          <!-- Historial de descargas -->
          <div *ngIf="downloadHistory.length > 0" class="mt-6">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-white font-semibold">Descargas recientes</h3>
              <button 
                (click)="clearHistory()"
                class="text-white/50 hover:text-white text-xs transition"
              >
                Limpiar
              </button>
            </div>
            <div class="space-y-2">
              <div *ngFor="let item of downloadHistory" 
                   class="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex items-center justify-between group hover:bg-white/15 transition-all">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <div 
                    class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    [style.background]="getPlatformGradient(item.platform)"
                  >
                    <div [innerHTML]="getPlatformIcon(item.platform)" class="w-4 h-4 text-white"></div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-white text-sm truncate">{{ item.url }}</p>
                    <p class="text-white/50 text-xs">{{ item.date | date:'short' }} • {{ getPlatformName(item.platform) }}</p>
                  </div>
                </div>
                <button 
                  (click)="redownload(item)"
                  class="ml-2 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="Descargar de nuevo"
                >
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Footer -->
      <footer class="relative z-10 py-4 text-center">
        <p class="text-white/50 text-xs md:text-sm">
          Solo funciona con videos públicos • Usa con responsabilidad
        </p>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    
    input::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
    
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    
    .hover-tab:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
    
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
      20%, 40%, 60%, 80% { transform: translateX(2px); }
    }
    
    .animate-shake {
      animation: shake 0.5s ease-in-out;
    }
    
    .min-h-screen {
      background-size: 200% 200%;
      animation: gradient 15s ease infinite;
    }
    
    @keyframes gradient {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `]
})
export class ReelDownloaderComponent {
  videoUrl = '';
  isLoading = false;
  progress = 0;
  statusMessage = '';
  errorMessage = '';
  successMessage = '';
  selectedPlatform = 'instagram';
  downloadHistory: { url: string; date: Date; platform: string }[] = [];

  private readonly BASE_API_URL = 'https://functions.zonayummy.com/api';

  platforms: Platform[] = [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
      gradient: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
      placeholder: 'https://www.instagram.com/reel/ABC123...',
      urlPattern: /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+/i,
      endpoint: 'reel-downloader-ig',
      filenamePrefix: 'instagram_reel'
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>`,
      gradient: 'linear-gradient(135deg, #000000 0%, #25F4EE 50%, #FE2C55 100%)',
      placeholder: 'https://vt.tiktok.com/ABC123 o @user/video/123...',
      urlPattern: /^https?:\/\/([a-z]+\.)?(tiktok\.com|tiktokcdn\.com)\/.+/i,
      endpoint: 'reel-downloader-tiktok',
      filenamePrefix: 'tiktok'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
      gradient: 'linear-gradient(135deg, #FF0000 0%, #282828 100%)',
      placeholder: 'https://youtube.com/shorts/ABC123...',
      urlPattern: /^https?:\/\/(www\.|m\.)?(youtube\.com\/(shorts\/|watch\?v=)|youtu\.be\/)/i,
      endpoint: 'reel-downloader-yt',
      filenamePrefix: 'youtube_shorts'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
      gradient: 'linear-gradient(135deg, #1877F2 0%, #42B72A 100%)',
      placeholder: 'https://www.facebook.com/reel/123... o share/r/...',
      urlPattern: /^https?:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.watch)\/(reel|watch|video|share\/[rv]|.*\/videos)\/[\w\d\-\/?=&]+/i,
      endpoint: 'reel-downloader-fb',
      filenamePrefix: 'facebook_reel'
    }
  ];

  constructor(private http: HttpClient) {
    this.loadHistory();
  }

  get currentPlatform(): Platform {
    return this.platforms.find(p => p.id === this.selectedPlatform) || this.platforms[0];
  }

  selectPlatform(platformId: string) {
    this.selectedPlatform = platformId;
    this.errorMessage = '';
    this.successMessage = '';
  }

  getButtonTextColor(): string {
    const colors: { [key: string]: string } = {
      instagram: '#833ab4',
      tiktok: '#000000',
      youtube: '#FF0000',
      facebook: '#1877F2'
    };
    return colors[this.selectedPlatform] || '#833ab4';
  }

  getPlatformGradient(platformId: string): string {
    const platform = this.platforms.find(p => p.id === platformId);
    return platform?.gradient || this.platforms[0].gradient;
  }

  getPlatformIcon(platformId: string): string {
    const platform = this.platforms.find(p => p.id === platformId);
    return platform?.icon || this.platforms[0].icon;
  }

  getPlatformName(platformId: string): string {
    const platform = this.platforms.find(p => p.id === platformId);
    return platform?.name || 'Unknown';
  }

  async downloadVideo() {
    if (!this.videoUrl.trim()) {
      this.errorMessage = 'Por favor ingresa una URL válida';
      return;
    }

    // Validar URL según la plataforma seleccionada
    if (!this.currentPlatform.urlPattern.test(this.videoUrl)) {
      this.errorMessage = `URL inválida para ${this.currentPlatform.name}. Ejemplo: ${this.currentPlatform.placeholder}`;
      return;
    }

    this.isLoading = true;
    this.progress = 0;
    this.errorMessage = '';
    this.successMessage = '';
    this.statusMessage = 'Conectando...';

    try {
      this.simulateProgress(0, 30, `Obteniendo información de ${this.currentPlatform.name}...`);

      const apiUrl = `${this.BASE_API_URL}/${this.currentPlatform.endpoint}`;
      console.log(`🚀 Enviando petición a: ${apiUrl}`, { url: this.videoUrl });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: this.videoUrl }),
      });

      console.log(`📥 Respuesta recibida: ${response.status} ${response.statusText}`);

      this.progress = 50;
      this.statusMessage = 'Descargando video...';

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error body:', errorText);
        let errorData: any = {};
        try {
            errorData = JSON.parse(errorText);
        } catch (e) {
            errorData = { error: errorText };
        }
        throw new Error(errorData.error || 'Error descargando el video');
      }

      this.progress = 80;
      this.statusMessage = 'Procesando...';

      const blob = await response.blob();
      console.log(`📦 Blob recibido: ${blob.size} bytes, type: ${blob.type}`);
      
      this.progress = 95;
      this.statusMessage = 'Preparando descarga...';

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${this.currentPlatform.filenamePrefix}_${Date.now()}.mp4`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.progress = 100;
      this.successMessage = `¡Video descargado! (${(blob.size / 1024 / 1024).toFixed(2)} MB)`;
      
      this.addToHistory(this.videoUrl, this.selectedPlatform);
      
      setTimeout(() => {
        this.videoUrl = '';
      }, 2000);

    } catch (error: any) {
      console.error('Error:', error);
      this.errorMessage = error.message || 'Error descargando el video. Intenta de nuevo.';
    } finally {
      this.isLoading = false;
      this.progress = 0;
      this.statusMessage = '';
    }
  }

  redownload(item: { url: string; platform: string }) {
    this.selectPlatform(item.platform);
    this.videoUrl = item.url;
    setTimeout(() => this.downloadVideo(), 100);
  }

  private simulateProgress(from: number, to: number, message: string) {
    this.statusMessage = message;
    const step = (to - from) / 10;
    let current = from;
    
    const interval = setInterval(() => {
      current += step;
      if (current >= to) {
        this.progress = to;
        clearInterval(interval);
      } else {
        this.progress = Math.round(current);
      }
    }, 100);
  }

  private loadHistory() {
    try {
      const saved = localStorage.getItem('videoDownloadHistory');
      if (saved) {
        this.downloadHistory = JSON.parse(saved).map((item: any) => ({
          ...item,
          date: new Date(item.date)
        }));
      }
    } catch (e) {
      console.error('Error loading history:', e);
    }
  }

  private addToHistory(url: string, platform: string) {
    const exists = this.downloadHistory.some(item => item.url === url);
    if (!exists) {
      this.downloadHistory.unshift({ url, date: new Date(), platform });
      if (this.downloadHistory.length > 10) {
        this.downloadHistory = this.downloadHistory.slice(0, 10);
      }
      localStorage.setItem('videoDownloadHistory', JSON.stringify(this.downloadHistory));
    }
  }

  clearHistory() {
    this.downloadHistory = [];
    localStorage.removeItem('videoDownloadHistory');
  }
}
