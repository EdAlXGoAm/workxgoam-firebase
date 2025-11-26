import { Injectable, NgZone } from '@angular/core';
import { Subject, Observable, fromEvent, merge } from 'rxjs';
import { filter, takeUntil, map, tap } from 'rxjs/operators';

/**
 * Tipos de gestos detectados
 */
export type GestureType = 
  | 'drag-left'      // Arrastrar hacia la izquierda
  | 'drag-right'     // Arrastrar hacia la derecha
  | 'drag-up'        // Arrastrar hacia arriba
  | 'drag-down'      // Arrastrar hacia abajo
  | 'resize-start'   // Redimensionar desde el inicio (borde izquierdo/superior)
  | 'resize-end'     // Redimensionar desde el final (borde derecho/inferior)
  | 'tap'            // Toque simple
  | 'long-press';    // Pulsación larga

/**
 * Información completa del gesto detectado
 */
export interface GestureEvent {
  type: GestureType;
  element: HTMLElement | SVGElement;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  deltaX: number;
  deltaY: number;
  duration: number; // ms
  velocity: number; // pixels/second
  data?: any; // Datos adicionales asociados al elemento
}

/**
 * Configuración para la detección de gestos
 */
export interface GestureConfig {
  /** Umbral mínimo de movimiento para considerar un drag (px) */
  dragThreshold: number;
  /** Duración mínima para long-press (ms) */
  longPressDuration: number;
  /** Ancho de la zona de resize en los bordes (px) */
  resizeZoneWidth: number;
  /** Dirección principal: 'horizontal' | 'vertical' | 'both' */
  direction: 'horizontal' | 'vertical' | 'both';
  /** Si debe detectar resize en los bordes */
  enableResize: boolean;
  /** Si se define, fuerza que este elemento sea siempre un handle de resize de este tipo */
  fixedResizeEdge?: 'start' | 'end';
}

/**
 * Estado interno del tracking de gestos
 */
interface GestureState {
  isActive: boolean;
  startX: number;
  startY: number;
  startTime: number;
  element: HTMLElement | SVGElement | null;
  elementRect: DOMRect | null;
  data: any;
  longPressTimeout: any;
  longPressTriggered: boolean;
  isResizing: boolean;
  resizeEdge: 'start' | 'end' | null;
}

@Injectable({
  providedIn: 'root'
})
export class GestureService {
  private gestureSubject = new Subject<GestureEvent>();
  private cursorChangeSubject = new Subject<{ element: Element; cursor: string }>();
  
  private defaultConfig: GestureConfig = {
    dragThreshold: 15,
    longPressDuration: 500,
    resizeZoneWidth: 18, // Área más grande para mejor detección
    direction: 'horizontal',
    enableResize: true
  };

  private state: GestureState = {
    isActive: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    element: null,
    elementRect: null,
    data: null,
    longPressTimeout: null,
    longPressTriggered: false,
    isResizing: false,
    resizeEdge: null
  };

  private destroy$ = new Subject<void>();
  private activeConfig: GestureConfig = { ...this.defaultConfig };

  constructor(private ngZone: NgZone) {}

  /**
   * Obtener observable de gestos
   */
  get gestures$(): Observable<GestureEvent> {
    return this.gestureSubject.asObservable();
  }

  /**
   * Obtener observable de cambios de cursor
   */
  get cursorChanges$(): Observable<{ element: Element; cursor: string }> {
    return this.cursorChangeSubject.asObservable();
  }

  private globalListenersInitialized = false;

  private initGlobalListeners(): void {
    if (this.globalListenersInitialized) return;
    this.globalListenersInitialized = true;

    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', (e) => {
        if (this.state.isActive) {
          this.onPointerMove(e, this.activeConfig);
        }
      });
      document.addEventListener('mouseup', (e) => {
        if (this.state.isActive) {
          this.onPointerUp(e, this.activeConfig);
        }
      });
    });
  }

  /**
   * Registrar un elemento para detección de gestos
   * @param element Elemento SVG o HTML
   * @param data Datos asociados (ej: tarea, fragmento)
   * @param config Configuración personalizada
   */
  registerElement(
    element: HTMLElement | SVGElement, 
    data: any, 
    config?: Partial<GestureConfig>
  ): () => void {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    // Inicializar listeners globales si no existen
    this.initGlobalListeners();

    // Handlers para mouse (solo los que van al elemento)
    const mouseDownHandler = (e: Event) => this.onPointerDown(e as MouseEvent, element, data, mergedConfig);
    // hoverHandler solo detecta zona de resize cuando NO hay drag activo
    const hoverHandler = (e: Event) => this.onHover(e as MouseEvent, element, mergedConfig);
    const mouseLeaveHandler = () => this.resetCursor(element);
    
    // Handlers para touch (estos se quedan en el elemento por ahora, implicit capture)
    const touchStartHandler = (e: Event) => this.onTouchStart(e as TouchEvent, element, data, mergedConfig);
    const touchMoveHandler = (e: Event) => this.onTouchMove(e as TouchEvent, mergedConfig);
    const touchEndHandler = (e: Event) => this.onTouchEnd(e as TouchEvent, mergedConfig);
    
    // Añadir clase de cursor inicial
    element.classList.add('cursor-grab');

    // Registrar eventos FUERA de Angular Zone para performance
    this.ngZone.runOutsideAngular(() => {
        element.addEventListener('mousedown', mouseDownHandler);
        element.addEventListener('mousemove', hoverHandler);
        element.addEventListener('mouseleave', mouseLeaveHandler);
        
        element.addEventListener('touchstart', touchStartHandler, { passive: false });
        element.addEventListener('touchmove', touchMoveHandler, { passive: false });
        element.addEventListener('touchend', touchEndHandler);
        element.addEventListener('touchcancel', touchEndHandler);
    });

    // Retornar función de cleanup
    return () => {
      element.removeEventListener('mousedown', mouseDownHandler);
      element.removeEventListener('mousemove', hoverHandler);
      element.removeEventListener('mouseleave', mouseLeaveHandler);
      element.removeEventListener('touchstart', touchStartHandler);
      element.removeEventListener('touchmove', touchMoveHandler);
      element.removeEventListener('touchend', touchEndHandler);
      element.removeEventListener('touchcancel', touchEndHandler);
      // NO removemos listeners globales del document (son singleton)
      
      // Limpiar clases de cursor
      element.classList.remove('cursor-grab', 'cursor-grabbing', 'cursor-resize-h', 'cursor-resize-v');
    };
  }

  /**
   * Detectar si el cursor está en zona de resize
   * Para horizontal: bordes izquierdo/derecho
   * Para vertical: bordes superior/inferior
   */
  private getResizeEdge(
    clientX: number, 
    element: HTMLElement | SVGElement, 
    config: GestureConfig,
    clientY?: number
  ): 'start' | 'end' | null {
    if (!config.enableResize) return null;
    
    const rect = element.getBoundingClientRect();
    
    if (config.direction === 'vertical' && clientY !== undefined) {
      // Para dirección vertical: detectar bordes superior/inferior
      const relativeY = clientY - rect.top;
      
      if (relativeY <= config.resizeZoneWidth) {
        return 'start'; // Borde superior
      } else if (relativeY >= rect.height - config.resizeZoneWidth) {
        return 'end'; // Borde inferior
      }
    } else {
      // Para dirección horizontal: detectar bordes izquierdo/derecho
      const relativeX = clientX - rect.left;
      
      if (relativeX <= config.resizeZoneWidth) {
        return 'start'; // Borde izquierdo
      } else if (relativeX >= rect.width - config.resizeZoneWidth) {
        return 'end'; // Borde derecho
      }
    }
    
    return null;
  }

  /**
   * Handler para hover - cambiar cursor según zona usando CLASES CSS
   * Optimizado para evitar cambios innecesarios
   */
  private onHover(e: MouseEvent, element: HTMLElement | SVGElement, config: GestureConfig): void {
    if (this.state.isActive) return; // No cambiar cursor durante drag
    
    const resizeEdge = config.fixedResizeEdge || this.getResizeEdge(e.clientX, element, config, e.clientY);
    
    // Determinar la clase que debería tener
    let targetClass: string;
    if (resizeEdge) {
      targetClass = config.direction === 'vertical' ? 'cursor-resize-v' : 'cursor-resize-h';
    } else {
      targetClass = 'cursor-grab';
    }
    
    // Solo cambiar si es necesario (evita parpadeo)
    if (!element.classList.contains(targetClass)) {
      element.classList.remove('cursor-resize-h', 'cursor-resize-v', 'cursor-grab');
      element.classList.add(targetClass);
      this.cursorChangeSubject.next({ element, cursor: resizeEdge ? 'resize' : 'grab' });
    }
  }

  /**
   * Reset cursor - limpiar clases de cursor
   */
  private resetCursor(element: HTMLElement | SVGElement): void {
    if (!this.state.isActive) {
      element.classList.remove('cursor-resize-h', 'cursor-resize-v', 'cursor-grab', 'cursor-grabbing');
      element.classList.add('cursor-grab');
    }
  }

  /**
   * Inicio de gesto con mouse
   */
  private onPointerDown(
    e: MouseEvent, 
    element: HTMLElement | SVGElement, 
    data: any, 
    config: GestureConfig
  ): void {
    if (e.button !== 0) return; // Solo botón izquierdo
    
    e.preventDefault();
    e.stopPropagation();
    
    // Determinar si es resize: o por configuración fija o por detección de zona
    const resizeEdge = config.fixedResizeEdge || this.getResizeEdge(e.clientX, element, config, e.clientY);
    
    this.state = {
      isActive: true,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      element: element,
      elementRect: element.getBoundingClientRect(),
      data: data,
      longPressTimeout: null,
      longPressTriggered: false,
      isResizing: resizeEdge !== null,
      resizeEdge: resizeEdge
    };
    
    // Cambiar cursor usando clases
    element.classList.remove('cursor-resize-h', 'cursor-resize-v', 'cursor-grab');
    if (resizeEdge) {
      if (config.direction === 'vertical') {
        element.classList.add('cursor-resize-v');
      } else {
        element.classList.add('cursor-resize-h');
      }
    } else {
      element.classList.add('cursor-grabbing');
    }

    this.activeConfig = config;
  }

  /**
   * Movimiento durante gesto con mouse
   */
  private onPointerMove(e: MouseEvent, config: GestureConfig): void {
    if (!this.state.isActive || !this.state.element) return;
    
    // Solo para feedback visual durante el drag (opcional)
  }

  /**
   * Fin de gesto con mouse
   */
  private onPointerUp(e: MouseEvent, config: GestureConfig): void {
    if (!this.state.isActive || !this.state.element) return;
    
    const endX = e.clientX;
    const endY = e.clientY;
    const deltaX = endX - this.state.startX;
    const deltaY = endY - this.state.startY;
    const duration = Date.now() - this.state.startTime;
    
    this.processGesture(deltaX, deltaY, duration, config);
    
    // Restaurar cursor usando clases
    this.state.element.classList.remove('cursor-resize-h', 'cursor-resize-v', 'cursor-grabbing');
    this.state.element.classList.add('cursor-grab');
    this.resetState();
  }

  /**
   * Inicio de gesto con touch
   */
  private onTouchStart(
    e: TouchEvent, 
    element: HTMLElement | SVGElement, 
    data: any, 
    config: GestureConfig
  ): void {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const resizeEdge = config.fixedResizeEdge || this.getResizeEdge(touch.clientX, element, config, touch.clientY);
    
    this.state = {
      isActive: true,
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      element: element,
      elementRect: element.getBoundingClientRect(),
      data: data,
      longPressTimeout: null,
      longPressTriggered: false,
      isResizing: resizeEdge !== null,
      resizeEdge: resizeEdge
    };

    this.activeConfig = config;
    
    // Iniciar timer para long-press
    this.state.longPressTimeout = setTimeout(() => {
      if (this.state.isActive) {
        this.state.longPressTriggered = true;
        // Vibrar en dispositivos móviles
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    }, config.longPressDuration);
  }

  /**
   * Movimiento durante gesto con touch
   */
  private onTouchMove(e: TouchEvent, config: GestureConfig): void {
    if (!this.state.isActive || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - this.state.startX);
    const deltaY = Math.abs(touch.clientY - this.state.startY);
    
    // Si hay movimiento significativo, cancelar long-press
    if (deltaX > config.dragThreshold || deltaY > config.dragThreshold) {
      this.cancelLongPress();
    }
  }

  /**
   * Fin de gesto con touch
   */
  private onTouchEnd(e: TouchEvent, config: GestureConfig): void {
    if (!this.state.isActive) return;
    
    this.cancelLongPress();
    
    if (e.changedTouches.length === 0) {
      this.resetState();
      return;
    }
    
    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    const deltaX = endX - this.state.startX;
    const deltaY = endY - this.state.startY;
    const duration = Date.now() - this.state.startTime;
    
    // Si fue long-press y no hubo movimiento significativo
    if (this.state.longPressTriggered && 
        Math.abs(deltaX) < config.dragThreshold && 
        Math.abs(deltaY) < config.dragThreshold) {
      this.emitGesture('long-press', 0, 0, duration);
    } else {
      this.processGesture(deltaX, deltaY, duration, config);
    }
    
    this.resetState();
  }

  /**
   * Procesar y clasificar el gesto
   */
  private processGesture(deltaX: number, deltaY: number, duration: number, config: GestureConfig): void {
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    
    // Si el movimiento es menor que el umbral, es un tap
    if (absDeltaX < config.dragThreshold && absDeltaY < config.dragThreshold) {
      this.emitGesture('tap', deltaX, deltaY, duration);
      return;
    }
    
    // Si está en modo resize
    if (this.state.isResizing && this.state.resizeEdge) {
      const type: GestureType = this.state.resizeEdge === 'start' ? 'resize-start' : 'resize-end';
      this.emitGesture(type, deltaX, deltaY, duration);
      return;
    }
    
    // Determinar dirección del drag según configuración
    if (config.direction === 'horizontal' || 
        (config.direction === 'both' && absDeltaX > absDeltaY)) {
      const type: GestureType = deltaX > 0 ? 'drag-right' : 'drag-left';
      this.emitGesture(type, deltaX, deltaY, duration);
    } else if (config.direction === 'vertical' || 
               (config.direction === 'both' && absDeltaY > absDeltaX)) {
      const type: GestureType = deltaY > 0 ? 'drag-down' : 'drag-up';
      this.emitGesture(type, deltaX, deltaY, duration);
    }
  }

  /**
   * Emitir evento de gesto
   */
  private emitGesture(type: GestureType, deltaX: number, deltaY: number, duration: number): void {
    if (!this.state.element) return;
    
    const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / (duration / 1000);
    
    const event: GestureEvent = {
      type,
      element: this.state.element,
      startX: this.state.startX,
      startY: this.state.startY,
      endX: this.state.startX + deltaX,
      endY: this.state.startY + deltaY,
      deltaX,
      deltaY,
      duration,
      velocity,
      data: this.state.data
    };
    
    this.ngZone.run(() => {
      this.gestureSubject.next(event);
    });
  }

  /**
   * Cancelar timer de long-press
   */
  private cancelLongPress(): void {
    if (this.state.longPressTimeout) {
      clearTimeout(this.state.longPressTimeout);
      this.state.longPressTimeout = null;
    }
  }

  /**
   * Resetear estado
   */
  private resetState(): void {
    this.cancelLongPress();
    this.state = {
      isActive: false,
      startX: 0,
      startY: 0,
      startTime: 0,
      element: null,
      elementRect: null,
      data: null,
      longPressTimeout: null,
      longPressTriggered: false,
      isResizing: false,
      resizeEdge: null
    };
  }

  /**
   * Limpiar recursos
   */
  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.resetState();
  }

  /**
   * Calcular desplazamiento de tiempo basado en píxeles
   * @param pixels Píxeles de movimiento
   * @param pixelsPerHour Píxeles por hora en el timeline
   * @param snapToMinutes Redondear a minutos (ej: 15 para cuartos de hora)
   */
  calculateTimeShift(pixels: number, pixelsPerHour: number, snapToMinutes: number = 15): number {
    const hours = pixels / pixelsPerHour;
    const minutes = hours * 60;
    const snappedMinutes = Math.round(minutes / snapToMinutes) * snapToMinutes;
    return snappedMinutes;
  }

  /**
   * Calcular nueva duración basada en píxeles
   * @param originalDurationMinutes Duración original en minutos
   * @param pixels Píxeles de cambio
   * @param pixelsPerHour Píxeles por hora
   * @param minDuration Duración mínima en minutos
   */
  calculateDurationChange(
    originalDurationMinutes: number, 
    pixels: number, 
    pixelsPerHour: number, 
    minDuration: number = 15
  ): number {
    const changeHours = pixels / pixelsPerHour;
    const changeMinutes = changeHours * 60;
    const newDuration = Math.max(minDuration, originalDurationMinutes + changeMinutes);
    // Snap a 15 minutos
    return Math.round(newDuration / 15) * 15;
  }
}

