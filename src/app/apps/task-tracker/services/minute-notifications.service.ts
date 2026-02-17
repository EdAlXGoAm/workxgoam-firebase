import { Injectable } from '@angular/core';

const STORAGE_KEY = 'task-tracker-minute-notifications';
const NOTIFICATION_TITLE = 'Task Tracker';
const FIVE_MIN_MS = 5 * 60 * 1000;
const FIVE_MIN_SEC = 5 * 60;
const PENDING_ENDED_MS = 1500;

@Injectable({
  providedIn: 'root'
})
export class MinuteNotificationsService {
  enabled = false;
  permission: NotificationPermission = 'default';
  private timeoutId: number | null = null;
  /** Callback para saber si hay alguna tarea en curso (en múltiplos de 5 min) */
  private getHasRunningTask: (() => boolean) | null = null;
  /** Si una tarea acaba de terminar, guardamos el nombre para combinar con la siguiente que empiece */
  private pendingEndedTaskName: string | null = null;
  private pendingEndedTimeoutId: number | null = null;

  get supported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * El componente debe llamar esto (p. ej. en ngOnInit) para que en cada múltiplo de 5 min
   * se decida si mostrar el recordatorio "¿Qué estás haciendo? Regístralo en la app".
   */
  setHasRunningTaskGetter(getter: () => boolean): void {
    this.getHasRunningTask = getter;
  }

  async toggle(): Promise<void> {
    if (!this.supported) {
      alert('Tu navegador no soporta notificaciones.');
      return;
    }
    if (this.permission === 'granted' && this.enabled) {
      this.stop();
      this.enabled = false;
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (this.permission === 'denied') {
      alert('Las notificaciones están bloqueadas. Actívalas en los ajustes del sitio (icono de candado o información en la barra de direcciones). En Brave: Notificaciones y, si aplica, Push.');
      return;
    }
    const result = await Notification.requestPermission();
    this.permission = result;
    if (result === 'granted') {
      this.start();
      this.enabled = true;
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      this.enabled = false;
      if (result === 'denied') {
        alert('Has bloqueado las notificaciones. Para activarlas más tarde, permite Notificaciones (y en Brave también Push si hace falta) en la configuración del sitio.');
      }
    }
  }

  initFromStorage(): void {
    if (!this.supported) return;
    this.permission = Notification.permission;
    const stored = localStorage.getItem(STORAGE_KEY) === 'true';
    if (stored && this.permission === 'granted') {
      this.enabled = true;
      this.start();
    } else {
      this.enabled = false;
    }
  }

  destroy(): void {
    this.stop();
    this.clearPendingEnded();
  }

  /**
   * Llamar cuando una tarea comienza (el usuario la inicia).
   * Si justo antes otra terminó, se muestra una sola notificación combinada.
   */
  notifyTaskStarted(taskName: string): void {
    if (this.permission !== 'granted' || !this.enabled) return;
    const ended = this.pendingEndedTaskName;
    this.clearPendingEnded();
    const displayName = this.escapeTaskName(taskName);
    if (ended) {
      this.showNotification(`${this.escapeTaskName(ended)} terminó, ${displayName} comenzó`);
    } else {
      this.showNotification(`${displayName} comenzó`);
    }
  }

  /**
   * Llamar cuando una tarea termina (el usuario la finaliza).
   * Si en los próximos segundos otra tarea comienza, se combinará en una sola notificación.
   */
  notifyTaskEnded(taskName: string): void {
    if (this.permission !== 'granted' || !this.enabled) return;
    this.clearPendingEnded();
    this.pendingEndedTaskName = taskName;
    this.pendingEndedTimeoutId = window.setTimeout(() => {
      this.showNotification(`${this.escapeTaskName(taskName)} terminó`);
      this.pendingEndedTaskName = null;
      this.pendingEndedTimeoutId = null;
    }, PENDING_ENDED_MS);
  }

  private clearPendingEnded(): void {
    if (this.pendingEndedTimeoutId !== null) {
      clearTimeout(this.pendingEndedTimeoutId);
      this.pendingEndedTimeoutId = null;
    }
    this.pendingEndedTaskName = null;
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
      const hasRunning = this.getHasRunningTask?.() ?? false;
      if (!hasRunning) {
        this.showNotification('¿Qué estás haciendo? Regístralo en la app.');
      }
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
