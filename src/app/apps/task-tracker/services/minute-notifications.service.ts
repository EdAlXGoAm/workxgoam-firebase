import { Injectable } from '@angular/core';

const STORAGE_KEY = 'task-tracker-minute-notifications';
const STORAGE_LOCAL_ONLY_KEY = 'task-tracker-minute-notifications-local-only';
const NOTIFICATION_TITLE = 'Task Tracker';
const FIVE_MIN_MS = 5 * 60 * 1000;
const FIVE_MIN_SEC = 5 * 60;

export interface ToggleResult {
  ok: boolean;
  /** Mostrar modal de fallback (Brave, permisos bloqueados, etc.) */
  showFallbackModal?: boolean;
}

/** Resultado de evaluar qué notificación mostrar en un boundary de 5 min (hora del trigger). */
export interface BoundaryEvaluation {
  /** Si en ese momento hay al menos una tarea en curso (start <= now <= end, no completada). */
  hasRunningTask: boolean;
  /** Nombres de tareas cuyo inicio (start) cae en el mismo minuto que el boundary. */
  startingNames: string[];
  /** Nombres de tareas cuyo fin (end) cae en el mismo minuto que el boundary. */
  endingNames: string[];
}

@Injectable({
  providedIn: 'root'
})
export class MinuteNotificationsService {
  enabled = false;
  permission: NotificationPermission = 'default';
  /** true = solo locales (Notification API, sitio abierto); false = push completo si está disponible */
  localOnly = true;
  private timeoutId: number | null = null;
  /** Evaluador llamado cada 5 min con la fecha del trigger; decide qué notificación enviar. */
  private evaluateAtBoundary: ((boundaryDate: Date) => BoundaryEvaluation) | null = null;

  get supported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /** Indica si está en modo solo local (Notification API, solo cuando el sitio está abierto) */
  get isLocalOnly(): boolean {
    return this.localOnly || localStorage.getItem(STORAGE_LOCAL_ONLY_KEY) === 'true';
  }

  /**
   * El componente debe llamar esto (p. ej. en ngOnInit). En cada múltiplo de 5 min se invoca
   * con la fecha del trigger; el resultado decide si enviar recordatorio, resumen de inicio/fin, o nada.
   */
  setBoundaryEvaluator(evaluator: (boundaryDate: Date) => BoundaryEvaluation): void {
    this.evaluateAtBoundary = evaluator;
  }

  async toggle(): Promise<ToggleResult> {
    if (!this.supported) {
      return { ok: false, showFallbackModal: true };
    }
    if (this.permission === 'granted' && this.enabled) {
      this.stop();
      this.enabled = false;
      this.localOnly = true;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_LOCAL_ONLY_KEY);
      return { ok: true };
    }
    if (this.permission === 'denied') {
      return { ok: false, showFallbackModal: true };
    }
    const result = await Notification.requestPermission();
    this.permission = result;
    if (result === 'granted') {
      this.start();
      this.enabled = true;
      this.localOnly = true;
      localStorage.setItem(STORAGE_KEY, 'true');
      return { ok: true };
    }
    this.enabled = false;
    return { ok: false, showFallbackModal: result === 'denied' };
  }

  /**
   * Intenta habilitar notificaciones solo locales (Notification API).
   * Solo funcionan cuando el sitio está abierto.
   */
  async tryEnableLocalOnly(): Promise<ToggleResult> {
    if (!this.supported) return { ok: false };
    if (this.permission === 'denied') {
      return { ok: false, showFallbackModal: true };
    }
    const result = await Notification.requestPermission();
    this.permission = result;
    if (result === 'granted') {
      this.start();
      this.enabled = true;
      this.localOnly = true;
      localStorage.setItem(STORAGE_KEY, 'true');
      localStorage.setItem(STORAGE_LOCAL_ONLY_KEY, 'true');
      return { ok: true };
    }
    return { ok: false, showFallbackModal: result === 'denied' };
  }

  initFromStorage(): void {
    if (!this.supported) return;
    this.permission = Notification.permission;
    const stored = localStorage.getItem(STORAGE_KEY) === 'true';
    this.localOnly = true;
    if (stored && this.permission === 'granted') {
      this.enabled = true;
      this.start();
    } else {
      this.enabled = false;
    }
  }

  destroy(): void {
    this.stop();
  }

  private escapeTaskName(name: string): string {
    return (name || 'Tarea').trim() || 'Tarea';
  }

  private showNotification(body: string): void {
    if (this.permission !== 'granted') return;
    try {
      new Notification(NOTIFICATION_TITLE, { body, icon: '/favicon.ico' });
    } catch {
      new Notification(NOTIFICATION_TITLE, { body });
    }
  }

  private start(): void {
    this.stop();
    const getDelayToNextBoundary = (): number => {
      const now = new Date();
      const secondsOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
      const nextBoundary = Math.ceil(secondsOfDay / FIVE_MIN_SEC) * FIVE_MIN_SEC;
      let delayMs = (nextBoundary - secondsOfDay) * 1000;
      if (delayMs < 0) delayMs = 0;
      return delayMs;
    };

    const onBoundary = () => {
      const boundaryDate = new Date();
      const evaluation = this.evaluateAtBoundary?.(boundaryDate);
      if (!evaluation) return;

      const { hasRunningTask, startingNames, endingNames } = evaluation;
      const hasStartsOrEnds = startingNames.length > 0 || endingNames.length > 0;

      if (hasStartsOrEnds) {
        const parts: string[] = [];
        endingNames.forEach((name) => parts.push(`${this.escapeTaskName(name)} terminó`));
        startingNames.forEach((name) => parts.push(`${this.escapeTaskName(name)} comenzó`));
        this.showNotification(parts.join('. '));
      } else if (!hasRunningTask) {
        this.showNotification('¿Qué estás haciendo? Regístralo en la app.');
      }
      // Si hay tarea en curso pero ninguna empieza/termina en este minuto: no notificar
    };

    const scheduleNext = () => {
      const delayMs = getDelayToNextBoundary();
      this.timeoutId = window.setTimeout(() => {
        onBoundary();
        scheduleNext();
      }, delayMs);
    };

    scheduleNext();
  }

  private stop(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
