import { Injectable } from '@angular/core';

const STORAGE_KEY = 'task-tracker-minute-notifications';
const NOTIFICATION_TITLE = 'Task Tracker';
const FIVE_MIN_MS = 5 * 60 * 1000;
const FIVE_MIN_SEC = 5 * 60;

@Injectable({
  providedIn: 'root'
})
export class MinuteNotificationsService {
  enabled = false;
  permission: NotificationPermission = 'default';
  private timeoutId: number | null = null;

  get supported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
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
  }

  private start(): void {
    this.stop();
    const showTime = () => {
      if (this.permission !== 'granted') return;
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const h12 = h % 12 || 12;
      const timeStr = `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
      try {
        new Notification(NOTIFICATION_TITLE, { body: `Hora: ${timeStr}`, icon: '/favicon.ico' });
      } catch {
        new Notification(NOTIFICATION_TITLE, { body: `Hora: ${timeStr}` });
      }
    };

    const getDelayToNextBoundary = (): number => {
      const now = new Date();
      const secondsOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
      const nextBoundary = Math.ceil(secondsOfDay / FIVE_MIN_SEC) * FIVE_MIN_SEC;
      let delayMs = (nextBoundary - secondsOfDay) * 1000;
      if (delayMs < 0) delayMs = 0;
      return delayMs;
    };

    const scheduleNext = () => {
      const delayMs = getDelayToNextBoundary();
      this.timeoutId = window.setTimeout(() => {
        showTime();
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
