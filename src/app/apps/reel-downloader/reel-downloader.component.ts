import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ZonayummyAuthService } from './zonayummy-auth.service';
import { ZonayummyReelHistoryItem, ZonayummyReelHistoryService, ZonayummyFolder, ZonayummyLabel } from './zonayummy-reel-history.service';
import { ZonayummyLoginModalComponent } from './zonayummy-login-modal.component';
import { ReelItemEditModalComponent } from './reel-item-edit-modal.component';

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
  imports: [CommonModule, FormsModule, RouterModule, ZonayummyLoginModalComponent, ReelItemEditModalComponent],
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

            <!-- Login ZonaYummy / modo invitado -->
            <div class="mt-4 flex flex-col items-center gap-2">
              <div *ngIf="!isZyLoggedIn" class="text-white/80 text-sm">
                Modo invitado: puedes descargar, pero no se guardará el link ni el video.
              </div>
              <div *ngIf="isZyLoggedIn" class="text-white/80 text-sm">
                Sesión ZonaYummy: <span class="font-semibold text-white">{{ zyUsername || 'Usuario' }}</span>
              </div>
              <div class="flex flex-wrap items-center justify-center gap-2">
                <button
                  *ngIf="!isZyLoggedIn"
                  (click)="openLogin()"
                  class="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-semibold transition"
                >
                  Iniciar sesión para guardar
                </button>

                <button
                  *ngIf="isZyLoggedIn"
                  (click)="toggleHistory()"
                  class="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-semibold transition"
                >
                  {{ isHistoryOpen ? 'Ocultar historial' : 'Ver historial' }}
                </button>

                <button
                  *ngIf="isZyLoggedIn"
                  (click)="logoutZy()"
                  class="px-4 py-2 rounded-xl bg-black/30 hover:bg-black/40 border border-white/20 text-white text-sm font-semibold transition"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
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

            <!-- Botones: Guardar en la nube + Descargar -->
            <div class="flex gap-3">
              <button
                (click)="saveToCloud()"
                [disabled]="isLoading || !videoUrl.trim()"
                class="flex-1 py-4 px-4 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
                title="Guarda el video y el link en tu cuenta (no lo descarga al dispositivo)"
              >
                <ng-container *ngIf="!isLoading">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h10a4 4 0 000-8 5 5 0 00-9.9-1A4 4 0 003 15z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 13v6"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.5 16.5L12 13l3.5 3.5"></path>
                  </svg>
                  Guardar en la nube
                </ng-container>
                <ng-container *ngIf="isLoading">
                  <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ statusMessage }}
                </ng-container>
              </button>

              <button 
                (click)="downloadVideo()"
                [disabled]="isLoading || !videoUrl.trim()"
                class="flex-1 py-4 px-4 bg-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
                [style.color]="getButtonTextColor()"
                title="Descarga el video al dispositivo (no lo guarda en la nube)"
              >
                <ng-container *ngIf="!isLoading">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Descargar
                </ng-container>
                <ng-container *ngIf="isLoading">
                  <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ statusMessage }}
                </ng-container>
              </button>
            </div>

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

          <!-- Historial de descargas (modo invitado) -->
          <div *ngIf="!isZyLoggedIn && downloadHistory.length > 0" class="mt-6">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-white font-semibold">Descargas recientes (invitado)</h3>
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

      <!-- Panel lateral: historial ZonaYummy -->
      <div *ngIf="isZyLoggedIn && isHistoryOpen" class="fixed inset-0 z-20 md:hidden bg-black/40" (click)="isHistoryOpen = false"></div>
      <aside
        *ngIf="isZyLoggedIn"
        class="fixed top-0 left-0 bottom-0 z-30 w-[340px] max-w-[90vw] bg-white/95 backdrop-blur-xl shadow-2xl border-r border-white/40 transition-transform duration-300"
        [class.-translate-x-full]="!isHistoryOpen"
      >
        <div class="p-4 border-b flex items-center justify-between">
          <div>
            <div class="text-sm font-black text-gray-900">Historial</div>
            <div class="text-xs text-gray-500">Links + videos guardados</div>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold"
              (click)="refreshZyHistory()"
              [disabled]="zyHistoryLoading"
            >
              {{ zyHistoryLoading ? '...' : 'Actualizar' }}
            </button>
            <button class="text-gray-500 hover:text-gray-900 text-xl leading-none" (click)="isHistoryOpen = false" aria-label="Cerrar panel">×</button>
          </div>
        </div>

        <!-- Carpetas -->
        <div class="px-4 py-2 border-b bg-gray-50/50" *ngIf="zyFolders.length > 0 || !zyHistoryLoading">
          <div class="text-xs font-semibold text-gray-500 mb-2">CARPETAS</div>
          <div class="flex flex-wrap gap-1">
            <button
              class="px-2 py-1 rounded-lg text-xs font-medium transition"
              [class.bg-indigo-100]="selectedFolderId === null"
              [class.text-indigo-700]="selectedFolderId === null"
              [class.bg-gray-100]="selectedFolderId !== null"
              [class.text-gray-600]="selectedFolderId !== null"
              [class.hover:bg-gray-200]="selectedFolderId !== null"
              (click)="selectFolder(null)"
            >
              📋 Todos ({{ zyHistory.length }})
            </button>
            <button
              *ngFor="let folder of zyFolders"
              class="px-2 py-1 rounded-lg text-xs font-medium transition"
              [class.bg-indigo-100]="selectedFolderId === folder.id"
              [class.text-indigo-700]="selectedFolderId === folder.id"
              [class.bg-gray-100]="selectedFolderId !== folder.id"
              [class.text-gray-600]="selectedFolderId !== folder.id"
              [class.hover:bg-gray-200]="selectedFolderId !== folder.id"
              (click)="selectFolder(folder.id)"
            >
              {{ folder.icon || '📁' }} {{ folder.name }}
            </button>
          </div>
        </div>

        <div class="p-4 overflow-y-auto" style="max-height: calc(100vh - 180px);">
          <div *ngIf="zyHistoryError" class="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {{ zyHistoryError }}
          </div>
          <div *ngIf="zyHistoryLoading" class="text-sm text-gray-500">Cargando historial...</div>

          <div *ngIf="!zyHistoryLoading && filteredZyHistory.length === 0" class="text-sm text-gray-500">
            {{ zyHistory.length === 0 ? 'Aún no tienes descargas guardadas.' : 'No hay descargas en esta carpeta.' }}
          </div>

          <div class="space-y-2" *ngIf="filteredZyHistory.length > 0">
            <div *ngFor="let it of filteredZyHistory" class="p-3 rounded-2xl bg-gray-50 border border-gray-200 hover:border-gray-300 transition">
              <div class="flex items-start gap-3">
                <!-- Thumbnail o ícono de plataforma -->
                <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" [style.background]="getPlatformGradient(it.platform)">
                  <img *ngIf="it.thumbnailUrlWithSas" [src]="it.thumbnailUrlWithSas" class="w-full h-full object-cover" alt="Thumbnail" />
                  <div *ngIf="!it.thumbnailUrlWithSas" class="w-5 h-5 text-white" [innerHTML]="getPlatformIcon(it.platform)"></div>
                </div>
                <div class="min-w-0 flex-1">
                  <!-- Título o URL -->
                  <div class="text-sm font-medium text-gray-900 truncate">
                    {{ it.title || it.url }}
                  </div>
                  <div *ngIf="it.title" class="text-xs text-gray-500 truncate">{{ it.url }}</div>
                  <div class="text-xs text-gray-400 mt-0.5">{{ it.createdAt | date:'short' }}</div>

                  <!-- Etiquetas -->
                  <div class="flex flex-wrap gap-1 mt-1" *ngIf="getItemLabels(it).length > 0">
                    <span
                      *ngFor="let label of getItemLabels(it)"
                      class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                      [style.backgroundColor]="label.color"
                      [style.color]="getContrastColor(label.color)"
                    >
                      {{ label.name }}
                    </span>
                  </div>

                  <!-- Descripción -->
                  <div *ngIf="it.description" class="text-xs text-gray-600 mt-1 line-clamp-2">
                    {{ it.description }}
                  </div>

                  <!-- Acciones -->
                  <div class="mt-2 flex items-center gap-1.5 flex-wrap">
                    <button
                      class="px-2 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-xs font-medium flex items-center gap-1"
                      (click)="copyToClipboard(it.url)"
                      title="Copiar link"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      Copiar
                    </button>
                    <button
                      class="px-2 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-medium"
                      [disabled]="!it.downloadUrlWithSas"
                      (click)="downloadFromHistory(it)"
                      title="Descargar video"
                    >
                      Descargar
                    </button>
                    <button
                      class="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 transition"
                      (click)="openEditModal(it)"
                      title="Editar"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button
                      class="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 transition"
                      (click)="confirmDeleteItem(it)"
                      title="Eliminar"
                      [disabled]="deletingId === it.id"
                    >
                      <svg *ngIf="deletingId !== it.id" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      <svg *ngIf="deletingId === it.id" class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Modal de confirmación de eliminación -->
      <div
        *ngIf="deleteConfirmItem"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        (click)="cancelDelete()"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-bold text-gray-900">¿Eliminar descarga?</h3>
              <p class="text-sm text-gray-500">Esta acción no se puede deshacer</p>
            </div>
          </div>

          <div class="bg-gray-50 rounded-xl p-3 mb-4">
            <p class="text-xs text-gray-500 mb-1">{{ getPlatformName(deleteConfirmItem.platform) }}</p>
            <p class="text-sm text-gray-700 break-all line-clamp-2">{{ deleteConfirmItem.url }}</p>
          </div>

          <p class="text-sm text-gray-600 mb-4">
            Se eliminará el registro y el archivo de video del servidor.
          </p>

          <div class="flex gap-3">
            <button
              class="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition"
              (click)="cancelDelete()"
            >
              Cancelar
            </button>
            <button
              class="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
              (click)="executeDelete()"
              [disabled]="deletingId"
            >
              <svg *ngIf="deletingId" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {{ deletingId ? 'Eliminando...' : 'Eliminar' }}
            </button>
          </div>

          <div *ngIf="deleteError" class="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {{ deleteError }}
          </div>
        </div>
      </div>

      <!-- Modal Login ZonaYummy -->
      <app-zonayummy-login-modal
        [isOpen]="isLoginOpen"
        (closed)="isLoginOpen = false"
        (loggedIn)="onZyLoggedIn()"
      />

      <!-- Modal de edición de item -->
      <app-reel-item-edit-modal
        [isOpen]="isEditModalOpen"
        [item]="editingItem"
        [folders]="zyFolders"
        [labels]="zyLabels"
        (closed)="closeEditModal()"
        (saved)="onItemSaved($event)"
        (folderCreated)="onFolderCreated($event)"
        (labelsCreated)="onLabelsCreated($event)"
      />
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

  private readonly BASE_API_URL = environment.zonayummyFunctionsUrl || 'https://functions.zonayummy.com/api';

  // Auth + historial ZonaYummy
  isLoginOpen = false;
  isHistoryOpen = false;
  zyHistory: ZonayummyReelHistoryItem[] = [];
  zyHistoryLoading = false;
  zyHistoryError = '';
  zyUsername: string = '';

  // Eliminación
  deleteConfirmItem: ZonayummyReelHistoryItem | null = null;
  deletingId: string | null = null;
  deleteError = '';

  // Carpetas y etiquetas
  zyFolders: ZonayummyFolder[] = [];
  zyLabels: ZonayummyLabel[] = [];
  selectedFolderId: string | null = null; // Carpeta seleccionada para filtrar

  // Modal de edición
  editingItem: ZonayummyReelHistoryItem | null = null;
  isEditModalOpen = false;

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

  constructor(
    private zyAuth: ZonayummyAuthService,
    private zyHistoryService: ZonayummyReelHistoryService
  ) {
    this.loadHistory();
    this.zyUsername = this.zyAuth.getUsername() || '';
    if (this.isZyLoggedIn) {
      this.isHistoryOpen = true;
      this.refreshZyHistory();
    }
  }

  get isZyLoggedIn(): boolean {
    return this.zyAuth.isLoggedIn();
  }

  openLogin() {
    this.isLoginOpen = true;
  }

  toggleHistory() {
    this.isHistoryOpen = !this.isHistoryOpen;
    if (this.isHistoryOpen) this.refreshZyHistory();
  }

  onZyLoggedIn() {
    this.zyUsername = this.zyAuth.getUsername() || 'Usuario';
    this.isHistoryOpen = true;
    this.refreshZyHistory();
  }

  logoutZy() {
    this.zyAuth.logout();
    this.zyUsername = '';
    this.zyHistory = [];
    this.zyHistoryError = '';
    this.isHistoryOpen = false;
  }

  async refreshZyHistory() {
    if (!this.isZyLoggedIn) return;
    this.zyHistoryLoading = true;
    this.zyHistoryError = '';
    
    // Cargar historial, carpetas y etiquetas en paralelo
    const [historyRes, foldersRes, labelsRes] = await Promise.all([
      this.zyHistoryService.list(),
      this.zyHistoryService.listFolders(),
      this.zyHistoryService.listLabels(),
    ]);

    if (historyRes.ok) {
      this.zyHistory = historyRes.items || [];
    } else {
      this.zyHistoryError = historyRes.error || 'No se pudo cargar el historial';
    }

    if (foldersRes.ok) {
      this.zyFolders = foldersRes.folders || [];
    }

    if (labelsRes.ok) {
      this.zyLabels = labelsRes.labels || [];
    }

    this.zyHistoryLoading = false;
  }

  // Items filtrados por carpeta seleccionada
  get filteredZyHistory(): ZonayummyReelHistoryItem[] {
    if (this.selectedFolderId === null) {
      return this.zyHistory;
    }
    return this.zyHistory.filter(it => it.folderId === this.selectedFolderId);
  }

  selectFolder(folderId: string | null) {
    this.selectedFolderId = folderId;
  }

  // Obtener nombre de carpeta por ID
  getFolderName(folderId: string | null): string {
    if (!folderId) return 'Sin carpeta';
    const folder = this.zyFolders.find(f => f.id === folderId);
    return folder ? folder.name : 'Carpeta';
  }

  // Obtener etiquetas de un item
  getItemLabels(item: ZonayummyReelHistoryItem): ZonayummyLabel[] {
    if (!item.labelIds || item.labelIds.length === 0) return [];
    return this.zyLabels.filter(l => item.labelIds?.includes(l.id));
  }

  // Abrir modal de edición
  openEditModal(item: ZonayummyReelHistoryItem) {
    this.editingItem = item;
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editingItem = null;
  }

  onItemSaved(updatedItem: ZonayummyReelHistoryItem) {
    // Actualizar el item en la lista local
    const idx = this.zyHistory.findIndex(h => h.id === updatedItem.id);
    if (idx >= 0) {
      this.zyHistory[idx] = { ...this.zyHistory[idx], ...updatedItem };
      this.zyHistory = [...this.zyHistory]; // Trigger change detection
    }
  }

  onFolderCreated(folder: ZonayummyFolder) {
    this.zyFolders = [...this.zyFolders, folder];
  }

  onLabelsCreated(labels: ZonayummyLabel[]) {
    this.zyLabels = [...this.zyLabels, ...labels];
  }

  // Color de contraste para etiquetas
  getContrastColor(hexColor: string): string {
    if (!hexColor || !hexColor.startsWith('#')) return '#000000';
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#374151' : '#ffffff';
  }

  async copyToClipboard(text: string) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {
      console.warn('No se pudo copiar al portapapeles', e);
    }
  }

  confirmDeleteItem(item: ZonayummyReelHistoryItem) {
    this.deleteConfirmItem = item;
    this.deleteError = '';
  }

  cancelDelete() {
    this.deleteConfirmItem = null;
    this.deleteError = '';
  }

  async executeDelete() {
    if (!this.deleteConfirmItem) return;

    const downloadId = this.deleteConfirmItem.id;
    this.deletingId = downloadId;
    this.deleteError = '';

    try {
      const result = await this.zyHistoryService.delete(downloadId, true);
      if (result.ok) {
        // Eliminar de la lista local
        this.zyHistory = this.zyHistory.filter(h => h.id !== downloadId);
        this.deleteConfirmItem = null;
      } else {
        this.deleteError = result.error || 'Error al eliminar';
      }
    } catch (e: any) {
      this.deleteError = e?.message || 'Error inesperado';
    } finally {
      this.deletingId = null;
    }
  }

  downloadFromHistory(it: ZonayummyReelHistoryItem) {
    if (!it.downloadUrlWithSas) return;
    const a = document.createElement('a');
    a.href = it.downloadUrlWithSas;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
    const originalUrl = (this.videoUrl || '').trim();
    if (!originalUrl) {
      this.errorMessage = 'Por favor ingresa una URL válida';
      return;
    }

    // Validar URL según la plataforma seleccionada
    if (!this.currentPlatform.urlPattern.test(originalUrl)) {
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
      console.log(`🚀 Enviando petición a: ${apiUrl}`, { url: originalUrl });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: originalUrl }),
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

      // Historial local (solo invitado). En sesión, el guardado se hace con "Guardar en la nube".
      if (!this.isZyLoggedIn) {
        this.addToHistory(originalUrl, this.selectedPlatform);
      }
      
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

  /**
   * Descarga el video (como blob) y lo guarda en la nube (Blob + Cosmos),
   * sin descargarlo al dispositivo.
   */
  async saveToCloud() {
    const originalUrl = (this.videoUrl || '').trim();
    if (!originalUrl) {
      this.errorMessage = 'Por favor ingresa una URL válida';
      return;
    }

    if (!this.currentPlatform.urlPattern.test(originalUrl)) {
      this.errorMessage = `URL inválida para ${this.currentPlatform.name}. Ejemplo: ${this.currentPlatform.placeholder}`;
      return;
    }

    if (!this.isZyLoggedIn) {
      // En modo invitado no guardamos en backend
      this.openLogin();
      return;
    }

    this.isLoading = true;
    this.progress = 0;
    this.errorMessage = '';
    this.successMessage = '';
    this.statusMessage = 'Conectando...';

    try {
      this.simulateProgress(0, 30, `Obteniendo video de ${this.currentPlatform.name}...`);

      const apiUrl = `${this.BASE_API_URL}/${this.currentPlatform.endpoint}`;
      console.log(`☁️🚀 Enviando petición a: ${apiUrl}`, { url: originalUrl });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: originalUrl }),
      });

      console.log(`☁️📥 Respuesta recibida: ${response.status} ${response.statusText}`);
      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || 'Error descargando el video');
      }

      this.progress = 60;
      this.statusMessage = 'Descargando en memoria...';

      const blob = await response.blob();
      console.log(`☁️📦 Blob recibido: ${blob.size} bytes, type: ${blob.type}`);

      this.progress = 75;
      this.statusMessage = 'Subiendo a la nube...';

      await this.saveToZonayummyAccount(blob, originalUrl, this.selectedPlatform);

      this.progress = 100;
      this.successMessage = `✅ Guardado en la nube (${(blob.size / 1024 / 1024).toFixed(2)} MB)`;

      setTimeout(() => {
        this.videoUrl = '';
      }, 1500);
    } catch (error: any) {
      console.error('Error:', error);
      this.errorMessage = error.message || 'Error guardando en la nube. Intenta de nuevo.';
    } finally {
      this.isLoading = false;
      this.progress = 0;
      this.statusMessage = '';
    }
  }

  private async saveToZonayummyAccount(videoBlob: Blob, url: string, platform: string) {
    const contentType = videoBlob.type || 'video/mp4';

    const upload = await this.zyHistoryService.getUploadUrl({
      platform,
      url,
      contentType,
    });

    if (!upload.ok) {
      throw new Error(upload.error || 'Error obteniendo URL de subida');
    }

    // Subir directo a Blob Storage usando SAS (evita pasar el video por Azure Function)
    const putRes = await fetch(upload.uploadUrlWithSas, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': contentType,
      },
      body: videoBlob,
    });

    if (!putRes.ok) {
      const t = await putRes.text().catch(() => '');
      throw new Error(`Error subiendo a Blob: ${putRes.status} ${putRes.statusText} ${t}`.trim());
    }

    const created = await this.zyHistoryService.createRecord({
      downloadId: upload.downloadId,
      platform,
      url,
      blobPath: upload.blobPath,
      contentType,
      size: videoBlob.size,
    });

    if (!created.ok) {
      throw new Error(created.error || 'Error guardando el registro');
    }

    // Generar thumbnail en background (no esperar)
    this.zyHistoryService.generateThumbnail(upload.downloadId)
      .then((res: { ok: boolean; thumbnailPath?: string; thumbnailUrlWithSas?: string | null; existed?: boolean; error?: string }) => {
        if (!res.ok || !res.thumbnailPath) {
          console.warn('⚠️ No se pudo generar thumbnail:', res.error);
          return;
        }
        console.log('📸 Thumbnail generado:', res.thumbnailPath);
        // Actualizar el item en la lista local si ya está cargada
        const idx = this.zyHistory.findIndex(h => h.id === upload.downloadId);
        if (idx >= 0) {
          this.zyHistory[idx] = { 
            ...this.zyHistory[idx], 
            thumbnailPath: res.thumbnailPath,
            thumbnailUrlWithSas: res.thumbnailUrlWithSas || undefined
          };
          this.zyHistory = [...this.zyHistory]; // Trigger change detection
        }
      })
      .catch(err => console.warn('⚠️ Error generando thumbnail:', err));

    this.isHistoryOpen = true;
    await this.refreshZyHistory();
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
