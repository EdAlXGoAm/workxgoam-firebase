import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-camera-capture',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70]" (click)="handleClose()">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span>📷</span> Tomar Foto
          </h3>
          <button (click)="handleClose()" class="text-gray-400 hover:text-gray-600 transition p-1">
            <i class="fas fa-times fa-lg"></i>
          </button>
        </div>

        <!-- Preview -->
        <div class="relative bg-black aspect-[4/3] flex items-center justify-center">
          <!-- Loading -->
          <div *ngIf="isLoading" class="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
            <div class="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Iniciando cámara...</span>
          </div>

          <!-- Error -->
          <div *ngIf="error" class="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-4 text-center">
            <span class="text-red-400">❌ {{ error }}</span>
            <button 
              (click)="startCamera(facingMode)"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
              Reintentar
            </button>
          </div>

          <!-- Video -->
          <video
            #videoElement
            class="w-full h-full object-cover"
            [class.hidden]="isLoading || error"
            [style.transform]="facingMode === 'user' ? 'scaleX(-1)' : 'none'"
            autoplay
            playsinline
            muted>
          </video>

          <canvas #canvasElement class="hidden"></canvas>
        </div>

        <!-- Actions -->
        <div class="flex justify-center items-center gap-6 p-4 bg-gray-50">
          <button
            (click)="switchCamera()"
            [disabled]="isLoading || !!error"
            class="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Cambiar cámara">
            🔄
          </button>
          
          <button
            (click)="capturePhoto()"
            [disabled]="isLoading || !!error"
            class="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-2xl text-white transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Capturar foto">
            📸
          </button>
          
          <button
            (click)="handleClose()"
            class="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xl transition"
            title="Cancelar">
            ✕
          </button>
        </div>
      </div>
    </div>
  `
})
export class CameraCaptureComponent implements OnInit, OnDestroy {
  @Input() isOpen: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() capture = new EventEmitter<string>();

  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasRef!: ElementRef<HTMLCanvasElement>;

  isLoading: boolean = true;
  error: string | null = null;
  facingMode: 'environment' | 'user' = 'environment';
  private stream: MediaStream | null = null;

  ngOnInit(): void {
    if (this.isOpen) {
      document.body.style.overflow = 'hidden';
      this.startCamera(this.facingMode);
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
    document.body.style.overflow = '';
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoRef?.nativeElement) {
      this.videoRef.nativeElement.srcObject = null;
    }
  }

  async startCamera(facing: 'environment' | 'user'): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this.stopCamera();

    // Esperar a que el video element esté disponible
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.videoRef?.nativeElement) {
        this.videoRef.nativeElement.srcObject = this.stream;
        await this.videoRef.nativeElement.play();
      }
      
      this.isLoading = false;
    } catch (err) {
      console.error('Error accediendo a la cámara:', err);
      
      // Intentar con cámara frontal si falla la trasera
      if (facing === 'environment') {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false,
          });
          
          if (this.videoRef?.nativeElement) {
            this.videoRef.nativeElement.srcObject = this.stream;
            await this.videoRef.nativeElement.play();
          }
          
          this.facingMode = 'user';
          this.isLoading = false;
          return;
        } catch (fallbackErr) {
          console.error('Error con cámara frontal también:', fallbackErr);
        }
      }
      
      this.error = 'No se pudo acceder a la cámara. Verifica los permisos.';
      this.isLoading = false;
    }
  }

  switchCamera(): void {
    const newFacing = this.facingMode === 'environment' ? 'user' : 'environment';
    this.facingMode = newFacing;
    this.startCamera(newFacing);
  }

  capturePhoto(): void {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    
    if (!video || !canvas) return;
    
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    if (!videoWidth || !videoHeight) {
      alert('Error: La cámara aún no está lista. Espera un momento.');
      return;
    }
    
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, videoWidth, videoHeight);
    
    // Si es cámara frontal, voltear horizontalmente
    if (this.facingMode === 'user') {
      ctx.translate(videoWidth, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    
    this.stopCamera();
    this.capture.emit(dataUrl);
  }

  handleClose(): void {
    this.stopCamera();
    this.closeModal.emit();
  }
}

