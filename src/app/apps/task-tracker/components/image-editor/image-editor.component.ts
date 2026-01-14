import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OpenAIService } from '../../services/openai.service';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-image-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4" (click)="$event.stopPropagation()">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <h3 class="text-lg font-semibold text-gray-800">Editar Imagen</h3>
          <button 
            (click)="onClose()" 
            [disabled]="isProcessing"
            class="text-gray-400 hover:text-gray-600 transition p-1 disabled:opacity-50">
            <i class="fas fa-times fa-lg"></i>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Preview -->
          <div class="relative bg-gray-100 rounded-lg overflow-hidden mb-4" #containerRef>
            <canvas
              #canvasRef
              class="max-w-full max-h-64 mx-auto block"
              [style.cursor]="isCropMode ? 'crosshair' : 'default'"
              (mousedown)="handleMouseDown($event)"
              (touchstart)="handleTouchStart($event)">
            </canvas>
            
            <!-- Processing overlay -->
            <div *ngIf="isProcessing" class="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white gap-2">
              <div class="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              <span class="text-sm">{{ processingMessage }}</span>
            </div>
          </div>

          <!-- Crop info -->
          <div *ngIf="isCropMode" class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
            <p class="font-medium">Área: {{ cropArea.width | number:'1.0-0' }} × {{ cropArea.height | number:'1.0-0' }} px</p>
            <p class="text-xs mt-1">💡 Arrastra las esquinas para recortar.</p>
          </div>

          <!-- Action buttons -->
          <div class="space-y-3">
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                (click)="handleRemoveBackground()"
                [disabled]="isProcessing"
                class="flex-1 min-w-[120px] px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                🪄 Quitar fondo
              </button>
              
              <button
                type="button"
                (click)="toggleCropMode()"
                [disabled]="isProcessing"
                [class.bg-indigo-600]="isCropMode"
                [class.text-white]="isCropMode"
                [class.bg-gray-100]="!isCropMode"
                [class.text-gray-700]="!isCropMode"
                class="flex-1 min-w-[120px] px-3 py-2 rounded-lg hover:opacity-90 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                ✂️ {{ isCropMode ? 'Cancelar' : 'Recortar' }}
              </button>
            </div>

            <button
              *ngIf="isCropMode"
              type="button"
              (click)="applyCrop()"
              [disabled]="isProcessing"
              class="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              ✓ Aplicar recorte
            </button>

            <button
              type="button"
              (click)="resetToOriginal()"
              [disabled]="isProcessing"
              class="w-full px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm">
              ↺ Restaurar original
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            type="button"
            (click)="onClose()"
            [disabled]="isProcessing"
            class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm font-medium disabled:opacity-50">
            Cancelar
          </button>
          <button
            type="button"
            (click)="handleConfirm()"
            [disabled]="isProcessing || isCropMode"
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {{ isProcessing ? 'Procesando...' : '✓ Usar imagen' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ImageEditorComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen: boolean = false;
  @Input() imageUrl: string = '';
  @Output() closeModal = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<{ base64: string; contentType: string }>();

  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('containerRef') containerRef!: ElementRef<HTMLDivElement>;

  isProcessing: boolean = false;
  processingMessage: string = '';
  isCropMode: boolean = false;
  cropArea: CropArea = { x: 0, y: 0, width: 0, height: 0 };
  private cropPadding: number = 0;
  
  private imageElement: HTMLImageElement | null = null;
  private originalImageSize = { width: 0, height: 0 };
  private isDragging = false;
  private dragHandle: string | null = null;
  private dragStart = { x: 0, y: 0 };
  private cropStart: CropArea = { x: 0, y: 0, width: 0, height: 0 };

  constructor(private openAIService: OpenAIService) {}

  ngOnInit(): void {
    if (this.isOpen) {
      document.body.style.overflow = 'hidden';
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.removeGlobalListeners();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.imageUrl) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => this.loadImage(), 100);
    }
    if (changes['imageUrl'] && this.isOpen && this.imageUrl) {
      setTimeout(() => this.loadImage(), 100);
    }
  }

  private loadImage(): void {
    if (!this.imageUrl) return;

    this.isCropMode = false;
    this.cropArea = { x: 0, y: 0, width: 0, height: 0 };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.imageElement = img;
      this.originalImageSize = { width: img.width, height: img.height };
      const pad = this.clamp(Math.round(Math.max(img.width, img.height) * 0.3), 80, 300);
      this.cropPadding = pad;
      this.cropArea = { x: 0, y: 0, width: img.width, height: img.height };
      this.drawImageToCanvas(img);
    };
    img.onerror = () => {
      console.error('Error cargando imagen para editar');
    };
    img.src = this.imageUrl;
  }

  private drawImageToCanvas(img: HTMLImageElement, crop?: CropArea): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const area = crop || this.cropArea;
    
    if (!this.isCropMode || (area.width === 0 && area.height === 0)) {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      return;
    }

    const pad = this.cropPadding || 0;
    canvas.width = img.width + pad * 2;
    canvas.height = img.height + pad * 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(img, pad, pad);
    
    // Overlay oscuro fuera del área de crop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const x0 = this.clamp(area.x, -1e9, canvas.width);
    const y0 = this.clamp(area.y, -1e9, canvas.height);
    const x1 = this.clamp(area.x + area.width, -1e9, canvas.width);
    const y1 = this.clamp(area.y + area.height, -1e9, canvas.height);
    
    ctx.fillRect(0, 0, canvas.width, Math.max(0, y0));
    ctx.fillRect(0, Math.max(0, y1), canvas.width, Math.max(0, canvas.height - y1));
    ctx.fillRect(0, Math.max(0, y0), Math.max(0, x0), Math.max(0, y1 - y0));
    ctx.fillRect(Math.max(0, x1), Math.max(0, y0), Math.max(0, canvas.width - x1), Math.max(0, y1 - y0));
    
    // Borde del área de crop
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(area.x, area.y, area.width, area.height);
    ctx.setLineDash([]);
    
    // Handles
    const handleSize = 10;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    
    const handles = [
      { x: area.x - handleSize / 2, y: area.y - handleSize / 2 },
      { x: area.x + area.width / 2 - handleSize / 2, y: area.y - handleSize / 2 },
      { x: area.x + area.width - handleSize / 2, y: area.y - handleSize / 2 },
      { x: area.x + area.width - handleSize / 2, y: area.y + area.height / 2 - handleSize / 2 },
      { x: area.x + area.width - handleSize / 2, y: area.y + area.height - handleSize / 2 },
      { x: area.x + area.width / 2 - handleSize / 2, y: area.y + area.height - handleSize / 2 },
      { x: area.x - handleSize / 2, y: area.y + area.height - handleSize / 2 },
      { x: area.x - handleSize / 2, y: area.y + area.height / 2 - handleSize / 2 },
    ];
    
    handles.forEach(h => {
      ctx.fillRect(h.x, h.y, handleSize, handleSize);
      ctx.strokeRect(h.x, h.y, handleSize, handleSize);
    });
  }

  handleMouseDown(e: MouseEvent): void {
    if (!this.isCropMode) return;
    const pos = this.getMousePosOnCanvas(e);
    const handle = this.getHandleAtPosition(pos.x, pos.y);
    if (handle) {
      this.startDrag(pos, handle);
      e.preventDefault();
    }
  }

  handleTouchStart(e: TouchEvent): void {
    if (!this.isCropMode) return;
    const pos = this.getMousePosOnCanvas(e);
    const handle = this.getHandleAtPosition(pos.x, pos.y);
    if (handle) {
      this.startDrag(pos, handle);
      e.preventDefault();
    }
  }

  private startDrag(pos: { x: number; y: number }, handle: string): void {
    this.isDragging = true;
    this.dragHandle = handle;
    this.dragStart = pos;
    this.cropStart = { ...this.cropArea };
    this.addGlobalListeners();
  }

  private addGlobalListeners(): void {
    window.addEventListener('mousemove', this.handleMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    window.addEventListener('touchend', this.handleMouseUp);
  }

  private removeGlobalListeners(): void {
    window.removeEventListener('mousemove', this.handleMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleMouseUp);
  }

  private handleMove = (e: MouseEvent | TouchEvent): void => {
    if (!this.isDragging || !this.dragHandle) return;

    const pos = this.getMousePosOnCanvas(e);
    const dx = pos.x - this.dragStart.x;
    const dy = pos.y - this.dragStart.y;

    let newArea = { ...this.cropStart };
    const minSize = 20;

    switch (this.dragHandle) {
      case 'move':
        newArea.x = this.cropStart.x + dx;
        newArea.y = this.cropStart.y + dy;
        break;
      case 'nw':
        newArea.x = this.cropStart.x + dx;
        newArea.y = this.cropStart.y + dy;
        newArea.width = this.cropStart.width - dx;
        newArea.height = this.cropStart.height - dy;
        break;
      case 'n':
        newArea.y = this.cropStart.y + dy;
        newArea.height = this.cropStart.height - dy;
        break;
      case 'ne':
        newArea.y = this.cropStart.y + dy;
        newArea.width = this.cropStart.width + dx;
        newArea.height = this.cropStart.height - dy;
        break;
      case 'e':
        newArea.width = this.cropStart.width + dx;
        break;
      case 'se':
        newArea.width = this.cropStart.width + dx;
        newArea.height = this.cropStart.height + dy;
        break;
      case 's':
        newArea.height = this.cropStart.height + dy;
        break;
      case 'sw':
        newArea.x = this.cropStart.x + dx;
        newArea.width = this.cropStart.width - dx;
        newArea.height = this.cropStart.height + dy;
        break;
      case 'w':
        newArea.x = this.cropStart.x + dx;
        newArea.width = this.cropStart.width - dx;
        break;
    }

    if (newArea.width < minSize) {
      if (this.dragHandle.includes('w')) {
        newArea.x = this.cropStart.x + this.cropStart.width - minSize;
      }
      newArea.width = minSize;
    }
    if (newArea.height < minSize) {
      if (this.dragHandle.includes('n')) {
        newArea.y = this.cropStart.y + this.cropStart.height - minSize;
      }
      newArea.height = minSize;
    }

    this.cropArea = newArea;
    if (this.imageElement) {
      this.drawImageToCanvas(this.imageElement, this.cropArea);
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (this.isDragging) {
      e.preventDefault();
    }
    this.handleMove(e);
  };

  private handleMouseUp = (): void => {
    this.isDragging = false;
    this.dragHandle = null;
    this.removeGlobalListeners();
  };

  private getMousePosOnCanvas(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    
    let clientX: number;
    let clientY: number;
    
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return { x: 0, y: 0 };
    }
    
    return {
      x: (clientX - rect.left) * scale,
      y: (clientY - rect.top) * scale,
    };
  }

  private getHandleAtPosition(x: number, y: number): string | null {
    const handleSize = 15;
    const area = this.cropArea;

    const handles: { name: string; x: number; y: number }[] = [
      { name: 'nw', x: area.x, y: area.y },
      { name: 'n', x: area.x + area.width / 2, y: area.y },
      { name: 'ne', x: area.x + area.width, y: area.y },
      { name: 'e', x: area.x + area.width, y: area.y + area.height / 2 },
      { name: 'se', x: area.x + area.width, y: area.y + area.height },
      { name: 's', x: area.x + area.width / 2, y: area.y + area.height },
      { name: 'sw', x: area.x, y: area.y + area.height },
      { name: 'w', x: area.x, y: area.y + area.height / 2 },
    ];

    for (const h of handles) {
      if (Math.abs(x - h.x) < handleSize && Math.abs(y - h.y) < handleSize) {
        return h.name;
      }
    }

    if (x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height) {
      return 'move';
    }

    return null;
  }

  async handleRemoveBackground(): Promise<void> {
    if (!this.imageElement) {
      alert('No hay imagen cargada');
      return;
    }

    try {
      this.isProcessing = true;
      this.processingMessage = 'Quitando fondo...';

      const img = this.imageElement;
      
      // Limitar tamaño
      let processWidth = img.width;
      let processHeight = img.height;
      const maxDim = 800;
      
      if (processWidth > maxDim || processHeight > maxDim) {
        const scale = Math.min(maxDim / processWidth, maxDim / processHeight);
        processWidth = Math.round(processWidth * scale);
        processHeight = Math.round(processHeight * scale);
      }
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = processWidth;
      tempCanvas.height = processHeight;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) throw new Error('No se pudo crear canvas temporal');
      
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, processWidth, processHeight);
      tempCtx.drawImage(img, 0, 0, processWidth, processHeight);
      
      const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.85);
      const base64Image = dataUrl.split(',')[1] || '';

      const result = await this.openAIService.removeBackground(base64Image);
      
      const newDataUrl = `data:${result.contentType};base64,${result.processedImage}`;
      
      await new Promise<void>((resolve, reject) => {
        const newImg = new Image();
        newImg.onload = () => {
          this.imageElement = newImg;
          this.originalImageSize = { width: newImg.width, height: newImg.height };
          this.cropArea = { x: 0, y: 0, width: newImg.width, height: newImg.height };
          this.drawImageToCanvas(newImg);
          resolve();
        };
        newImg.onerror = () => reject(new Error('Error al cargar imagen procesada'));
        newImg.src = newDataUrl;
      });
      
    } catch (error) {
      console.error('Error quitando fondo:', error);
      alert(error instanceof Error ? error.message : 'Error al quitar el fondo');
    } finally {
      this.isProcessing = false;
      this.processingMessage = '';
    }
  }

  toggleCropMode(): void {
    if (!this.isCropMode && this.imageElement) {
      const pad = this.cropPadding;
      this.cropArea = { x: pad, y: pad, width: this.originalImageSize.width, height: this.originalImageSize.height };
    }
    this.isCropMode = !this.isCropMode;
    
    if (this.imageElement) {
      setTimeout(() => {
        this.drawImageToCanvas(this.imageElement!, this.isCropMode ? this.cropArea : { x: 0, y: 0, width: 0, height: 0 });
      }, 0);
    }
  }

  applyCrop(): void {
    if (!this.imageElement) return;

    const img = this.imageElement;
    const area = this.cropArea;
    const pad = this.cropPadding || 0;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = area.width;
    tempCanvas.height = area.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, area.width, area.height);
    ctx.drawImage(img, pad - area.x, pad - area.y);

    const newDataUrl = tempCanvas.toDataURL('image/png');
    this.isCropMode = false;

    const newImg = new Image();
    newImg.onload = () => {
      this.imageElement = newImg;
      this.originalImageSize = { width: newImg.width, height: newImg.height };
      const nextPad = this.clamp(Math.round(Math.max(newImg.width, newImg.height) * 0.3), 80, 300);
      this.cropPadding = nextPad;
      this.cropArea = { x: 0, y: 0, width: newImg.width, height: newImg.height };
      this.drawImageToCanvas(newImg);
    };
    newImg.src = newDataUrl;
  }

  resetToOriginal(): void {
    if (!this.imageUrl) return;
    this.isCropMode = false;
    this.loadImage();
  }

  async handleConfirm(): Promise<void> {
    if (!this.imageElement) return;

    try {
      this.isProcessing = true;
      this.processingMessage = 'Procesando imagen final...';

      const img = this.imageElement;
      
      // Crear canvas cuadrado 200x200 con fondo blanco
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = 200;
      finalCanvas.height = 200;
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar canvas final');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 200, 200);

      const scale = Math.min(200 / img.width, 200 / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const x = Math.floor((200 - w) / 2);
      const y = Math.floor((200 - h) / 2);

      ctx.drawImage(img, x, y, w, h);

      const dataUrl = finalCanvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1] || '';

      this.confirm.emit({ base64, contentType: 'image/png' });
    } catch (error) {
      console.error('Error procesando imagen final:', error);
      alert(error instanceof Error ? error.message : 'Error al procesar la imagen');
    } finally {
      this.isProcessing = false;
      this.processingMessage = '';
    }
  }

  onClose(): void {
    if (!this.isProcessing) {
      document.body.style.overflow = '';
      this.closeModal.emit();
    }
  }

  private clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }
}

