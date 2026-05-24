import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZonayummyReelHistoryItem } from './zonayummy-reel-history.service';
import { PlatformIconComponent } from './platform-icon.component';

const PLATFORM_META: Record<string, { name: string; gradient: string }> = {
  instagram: { name: 'Instagram', gradient: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)' },
  tiktok: { name: 'TikTok', gradient: 'linear-gradient(135deg, #000000 0%, #25F4EE 50%, #FE2C55 100%)' },
  youtube: { name: 'YouTube', gradient: 'linear-gradient(135deg, #FF0000 0%, #282828 100%)' },
  facebook: { name: 'Facebook', gradient: 'linear-gradient(135deg, #1877F2 0%, #42B72A 100%)' },
};

@Component({
  selector: 'app-reel-history-grid-modal',
  standalone: true,
  imports: [CommonModule, PlatformIconComponent],
  template: `
    <div
      *ngIf="isOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4"
      (click)="close()"
    >
      <div
        #modalShell
        class="gallery-modal-shell bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] max-h-[96vh] flex flex-col overflow-hidden relative"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <div class="min-w-0">
            <h3 class="font-bold text-gray-900 truncate">Galería de videos</h3>
            <p class="text-xs text-gray-500">{{ items.length }} guardados · clic en un video para previsualizar</p>
          </div>
          <button
            type="button"
            class="text-gray-400 hover:text-gray-700 text-2xl leading-none shrink-0"
            (click)="close()"
            aria-label="Cerrar galería"
          >×</button>
        </div>

        <!-- Grid -->
        <div class="flex-1 overflow-y-auto p-4">
          <div *ngIf="items.length === 0" class="text-sm text-gray-500 text-center py-10">
            No hay videos guardados en la nube.
          </div>

          <div
            *ngIf="items.length > 0"
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2"
          >
            <button
              type="button"
              *ngFor="let it of items; trackBy: trackById"
              class="group relative aspect-[9/16] rounded-xl overflow-hidden border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              [class.border-indigo-500]="selectedItem?.id === it.id"
              [class.border-transparent]="selectedItem?.id !== it.id"
              [class.ring-2]="selectedItem?.id === it.id"
              [class.ring-indigo-200]="selectedItem?.id === it.id"
              (click)="selectItem(it)"
              [title]="it.title || it.url"
            >
              <img
                *ngIf="it.thumbnailUrlWithSas"
                [src]="it.thumbnailUrlWithSas"
                class="absolute inset-0 w-full h-full object-cover"
                alt=""
                loading="lazy"
              />
              <div
                *ngIf="!it.thumbnailUrlWithSas"
                class="absolute inset-0 flex items-center justify-center"
                [style.background]="getPlatformGradient(it.platform)"
              >
                <app-platform-icon [platform]="it.platform" class="w-8 h-8"></app-platform-icon>
              </div>

              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition"></div>

              <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <div class="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <svg class="w-5 h-5 text-gray-900 ml-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>

              <div class="absolute top-1.5 left-1.5 w-5 h-5 rounded-md bg-black/45 flex items-center justify-center">
                <app-platform-icon [platform]="it.platform" class="w-3.5 h-3.5"></app-platform-icon>
              </div>

              <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-2 pt-6">
                <div class="text-[10px] text-white font-medium truncate">{{ it.title || getPlatformName(it.platform) }}</div>
              </div>

              <div
                *ngIf="!it.downloadUrlWithSas"
                class="absolute inset-0 bg-gray-900/50 flex items-center justify-center text-[10px] text-white font-medium px-2 text-center"
              >
                Sin URL
              </div>
            </button>
          </div>
        </div>

        <!-- Floating quick viewer -->
        <div
          *ngIf="selectedItem"
          #floatingPlayer
          class="floating-player absolute z-20 w-[min(92vw,320px)] rounded-xl overflow-hidden border border-gray-200 bg-white shadow-2xl"
          [style.left.px]="playerLeft"
          [style.top.px]="playerTop"
          [class.is-dragging]="isDragging"
        >
          <div
            class="drag-bar flex items-center gap-2 px-3 py-2 bg-gray-900 text-white select-none touch-none"
            [class.cursor-grabbing]="isDragging"
            [class.cursor-grab]="!isDragging"
            (pointerdown)="startDrag($event)"
          >
            <svg class="w-4 h-4 shrink-0 opacity-70" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="7" r="1.5"/><circle cx="12" cy="7" r="1.5"/><circle cx="19" cy="7" r="1.5"/>
              <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
            </svg>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-semibold truncate">{{ selectedItem.title || getPlatformName(selectedItem.platform) }}</div>
            </div>
            <button
              type="button"
              class="shrink-0 p-1 rounded hover:bg-white/15"
              (click)="resetPlayerPosition(); $event.stopPropagation()"
              title="Volver abajo a la derecha"
              aria-label="Volver abajo a la derecha"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"/>
              </svg>
            </button>
          </div>

          <div class="p-2 space-y-2 bg-gray-50">
            <video
              *ngIf="selectedItem.downloadUrlWithSas; else noVideoSource"
              class="w-full max-h-[50vh] rounded-lg bg-black object-contain"
              [src]="selectedItem.downloadUrlWithSas"
              controls
              autoplay
              playsinline
              preload="auto"
            ></video>
            <ng-template #noVideoSource>
              <div class="flex items-center justify-center h-36 rounded-lg bg-gray-100 text-xs text-gray-500 px-3 text-center">
                Video no disponible (URL expirada). Actualiza el historial.
              </div>
            </ng-template>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="flex-1 px-2 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-[11px] font-medium"
                (click)="openInNewTab(selectedItem.url)"
              >Abrir link</button>
              <button
                type="button"
                class="flex-1 px-2 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-[11px] font-medium"
                (click)="copyUrl(selectedItem.url)"
              >Copiar link</button>
              <button
                type="button"
                class="flex-1 px-2 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-[11px] font-medium disabled:opacity-50"
                [disabled]="!selectedItem.downloadUrlWithSas"
                (click)="downloadItem(selectedItem)"
              >Descargar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .floating-player {
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.28);
    }

    .floating-player.is-dragging {
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.36);
    }

    .drag-bar {
      user-select: none;
    }
  `],
})
export class ReelHistoryGridModalComponent implements OnChanges, AfterViewInit {
  @Input() isOpen = false;
  @Input() items: ZonayummyReelHistoryItem[] = [];

  @Output() closed = new EventEmitter<void>();

  @ViewChild('modalShell') modalShell?: ElementRef<HTMLElement>;
  @ViewChild('floatingPlayer') floatingPlayer?: ElementRef<HTMLElement>;

  selectedItem: ZonayummyReelHistoryItem | null = null;
  playerLeft = 0;
  playerTop = 0;
  isDragging = false;

  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private activePointerId: number | null = null;
  private pendingPositionReset = false;

  ngAfterViewInit() {
    if (this.pendingPositionReset) {
      this.resetPlayerPosition();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen']?.currentValue === true) {
      this.selectedItem = this.items.find(it => !!it.downloadUrlWithSas) || this.items[0] || null;
      this.pendingPositionReset = true;
      queueMicrotask(() => this.resetPlayerPosition());
    }
    if (changes['isOpen']?.currentValue === false) {
      this.selectedItem = null;
      this.isDragging = false;
      this.activePointerId = null;
    }
  }

  getPlatformGradient(platformId: string): string {
    return PLATFORM_META[platformId]?.gradient || PLATFORM_META['instagram'].gradient;
  }

  getPlatformName(platformId: string): string {
    return PLATFORM_META[platformId]?.name || platformId;
  }

  selectItem(item: ZonayummyReelHistoryItem) {
    this.selectedItem = item;
  }

  startDrag(event: PointerEvent) {
    if ((event.target as HTMLElement).closest('button')) return;

    event.preventDefault();
    event.stopPropagation();

    const shell = this.modalShell?.nativeElement;
    if (!shell) return;

    const shellRect = shell.getBoundingClientRect();
    this.isDragging = true;
    this.activePointerId = event.pointerId;
    this.dragOffsetX = event.clientX - shellRect.left - this.playerLeft;
    this.dragOffsetY = event.clientY - shellRect.top - this.playerTop;

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  @HostListener('document:pointermove', ['$event'])
  onDocumentPointerMove(event: PointerEvent) {
    if (!this.isDragging || this.activePointerId !== event.pointerId) return;

    const shell = this.modalShell?.nativeElement;
    const player = this.floatingPlayer?.nativeElement;
    if (!shell || !player) return;

    const shellRect = shell.getBoundingClientRect();
    const maxLeft = Math.max(0, shell.clientWidth - player.offsetWidth);
    const maxTop = Math.max(0, shell.clientHeight - player.offsetHeight);

    let left = event.clientX - shellRect.left - this.dragOffsetX;
    let top = event.clientY - shellRect.top - this.dragOffsetY;

    this.playerLeft = Math.min(maxLeft, Math.max(0, left));
    this.playerTop = Math.min(maxTop, Math.max(0, top));
  }

  @HostListener('document:pointerup', ['$event'])
  @HostListener('document:pointercancel', ['$event'])
  onDocumentPointerUp(event: PointerEvent) {
    if (this.activePointerId !== event.pointerId) return;
    this.isDragging = false;
    this.activePointerId = null;
  }

  resetPlayerPosition() {
    const shell = this.modalShell?.nativeElement;
    const player = this.floatingPlayer?.nativeElement;
    if (!shell || !player) {
      this.pendingPositionReset = true;
      return;
    }

    this.pendingPositionReset = false;
    const pad = 16;
    this.playerLeft = Math.max(0, shell.clientWidth - player.offsetWidth - pad);
    this.playerTop = Math.max(0, shell.clientHeight - player.offsetHeight - pad);
  }

  close() {
    this.selectedItem = null;
    this.isDragging = false;
    this.activePointerId = null;
    this.closed.emit();
  }

  trackById(_: number, item: ZonayummyReelHistoryItem) {
    return item.id;
  }

  async copyUrl(text: string) {
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
    } catch {
      // ignore clipboard failures
    }
  }

  openInNewTab(url: string) {
    if (!url?.trim()) return;
    window.open(url.trim(), '_blank', 'noopener,noreferrer');
  }

  downloadItem(item: ZonayummyReelHistoryItem) {
    if (!item.downloadUrlWithSas) return;
    const a = document.createElement('a');
    a.href = item.downloadUrlWithSas;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
