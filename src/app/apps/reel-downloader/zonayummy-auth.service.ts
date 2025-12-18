import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type ZonayummyLoginResult = { ok: true; token: string; username: string } | { ok: false; error: string; useGoogleAuth?: boolean };

@Injectable({ providedIn: 'root' })
export class ZonayummyAuthService {
  private readonly TOKEN_KEY = 'zonayummy_token';
  private readonly USERNAME_KEY = 'zonayummy_username';
  private readonly DEVICE_ID_KEY = 'zonayummy_deviceId';

  get apiBaseUrl(): string {
    return environment.zonayummyFunctionsUrl || 'https://functions.zonayummy.com/api';
  }

  get googleClientId(): string | undefined {
    return environment.zonayummyGoogleClientId;
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY);
  }

  getUsername(): string | null {
    return localStorage.getItem(this.USERNAME_KEY) || sessionStorage.getItem(this.USERNAME_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USERNAME_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USERNAME_KEY);
  }

  persistAuth(token: string, username: string, remember: boolean): void {
    // limpiar primero
    this.logout();
    if (remember) {
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USERNAME_KEY, username);
    } else {
      sessionStorage.setItem(this.TOKEN_KEY, token);
      sessionStorage.setItem(this.USERNAME_KEY, username);
    }
  }

  getOrCreateDeviceId(): string {
    const existing = localStorage.getItem(this.DEVICE_ID_KEY);
    if (existing) return existing;
    const id = this.generateDeviceId();
    localStorage.setItem(this.DEVICE_ID_KEY, id);
    return id;
  }

  async loginWithEmail(email: string, password: string): Promise<ZonayummyLoginResult> {
    return this.postLogin('/auth/email/login', { email, password });
  }

  async loginWithPhone(phone: string, password: string): Promise<ZonayummyLoginResult> {
    return this.postLogin('/auth/phone/login', { phone, password });
  }

  async loginWithUsername(username: string, password: string): Promise<ZonayummyLoginResult> {
    return this.postLogin('/auth/username/login', { username, password });
  }

  async loginWithGoogle(idToken: string): Promise<ZonayummyLoginResult> {
    return this.postLogin('/auth/google/login', { idToken });
  }

  private async postLogin(path: string, payload: Record<string, any>): Promise<ZonayummyLoginResult> {
    const deviceId = this.getOrCreateDeviceId();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

    const res = await fetch(`${this.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, deviceId, userAgent }),
    });

    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { error: text };
    }

    if (!res.ok) {
      return { ok: false, error: json?.error || `Error (${res.status})`, useGoogleAuth: json?.useGoogleAuth };
    }

    if (!json?.ok || !json?.token) {
      return { ok: false, error: json?.error || 'Respuesta inválida del servidor' };
    }

    return { ok: true, token: json.token, username: json.username || 'Usuario' };
  }

  private generateDeviceId(): string {
    // Preferir crypto.randomUUID cuando exista
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
    // Fallback (no criptográfico, pero suficiente como deviceId)
    return `dev_${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
  }
}


