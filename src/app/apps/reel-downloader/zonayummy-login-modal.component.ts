import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ZonayummyAuthService } from './zonayummy-auth.service';

type LoginMethod = 'username' | 'email' | 'phone';
type LoginErrors = { identifier?: string; password?: string; submit?: string };

declare global {
  interface Window {
    google?: any;
  }
}

@Component({
  selector: 'app-zonayummy-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 z-[9999]">
      <div class="absolute inset-0 bg-black/60" (click)="close()"></div>

      <div class="absolute inset-0 flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" (click)="$event.stopPropagation()">
          <div class="p-5 border-b flex items-center justify-between">
            <div>
              <h3 class="text-lg font-black text-gray-900">Iniciar sesión (ZonaYummy)</h3>
              <p class="text-xs text-gray-500">Para guardar tus descargas en tu cuenta</p>
            </div>
            <button class="text-gray-500 hover:text-gray-900 text-2xl leading-none" (click)="close()" aria-label="Cerrar">×</button>
          </div>

          <div class="p-5">
            <!-- Google -->
            <div class="flex justify-center">
              <div #googleButtonRef class="min-h-[44px]"></div>
            </div>
            <div *ngIf="isGoogleLoading" class="text-center text-xs text-gray-500 mt-2">Autenticando...</div>

            <div *ngIf="showGoogleAuthHint" class="mt-3 p-3 rounded-xl bg-gray-900 text-white text-sm">
              Este email está registrado con Google. Por favor, usa el botón de Google para iniciar sesión.
            </div>

            <div class="my-4 flex items-center gap-3">
              <div class="h-px bg-gray-200 flex-1"></div>
              <span class="text-xs text-gray-400">o</span>
              <div class="h-px bg-gray-200 flex-1"></div>
            </div>

            <!-- Tabs -->
            <div class="flex bg-gray-100 rounded-xl p-1">
              <button type="button"
                class="flex-1 py-2 rounded-lg text-sm font-semibold transition"
                [ngClass]="activeTab === 'email' ? 'bg-white shadow text-gray-900' : 'text-gray-600'"
                (click)="setTab('email')"
              >Correo</button>
              <button type="button"
                class="flex-1 py-2 rounded-lg text-sm font-semibold transition"
                [ngClass]="activeTab === 'phone' ? 'bg-white shadow text-gray-900' : 'text-gray-600'"
                (click)="setTab('phone')"
              >Número</button>
              <button type="button"
                class="flex-1 py-2 rounded-lg text-sm font-semibold transition"
                [ngClass]="activeTab === 'username' ? 'bg-white shadow text-gray-900' : 'text-gray-600'"
                (click)="setTab('username')"
              >Usuario</button>
            </div>

            <form class="mt-4 space-y-3" (ngSubmit)="submit()">
              <!-- Identificador -->
              <div>
                <ng-container *ngIf="activeTab === 'phone'; else nonPhone">
                  <div class="flex gap-2">
                    <select class="border rounded-xl px-3 py-3 bg-white text-sm" [(ngModel)]="countryCode" name="countryCode">
                      <option *ngFor="let cc of countryCodes" [value]="cc.code">{{ cc.flag }} {{ cc.code }}</option>
                    </select>
                    <input
                      class="flex-1 border rounded-xl px-3 py-3 text-sm"
                      type="tel"
                      inputmode="numeric"
                      placeholder="Número de teléfono"
                      [(ngModel)]="phone"
                      name="phone"
                      (input)="phone = onlyDigits(phone)"
                    />
                  </div>
                </ng-container>

                <ng-template #nonPhone>
                  <input
                    *ngIf="activeTab === 'email'; else usernameInput"
                    class="w-full border rounded-xl px-3 py-3 text-sm"
                    type="email"
                    [attr.inputmode]="'email'"
                    placeholder="correo@ejemplo.com"
                    [(ngModel)]="email"
                    name="email"
                    (ngModelChange)="onIdentifierChange($event)"
                  />
                  <ng-template #usernameInput>
                    <input
                      class="w-full border rounded-xl px-3 py-3 text-sm"
                      type="text"
                      [attr.inputmode]="'text'"
                      placeholder="Nombre de usuario"
                      [(ngModel)]="username"
                      name="username"
                      (ngModelChange)="onIdentifierChange($event)"
                    />
                  </ng-template>
                </ng-template>

                <div *ngIf="errors.identifier" class="text-xs text-red-600 mt-1">{{ errors.identifier }}</div>
              </div>

              <!-- Password -->
              <div>
                <div class="relative">
                  <input
                    class="w-full border rounded-xl px-3 py-3 pr-12 text-sm"
                    [type]="showPassword ? 'text' : 'password'"
                    placeholder="Contraseña"
                    [(ngModel)]="password"
                    name="password"
                  />
                  <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-gray-500"
                    (click)="showPassword = !showPassword"
                    [attr.aria-label]="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  >
                    <span class="text-xs font-semibold">{{ showPassword ? 'Ocultar' : 'Ver' }}</span>
                  </button>
                </div>
                <div *ngIf="errors.password" class="text-xs text-red-600 mt-1">{{ errors.password }}</div>
              </div>

              <div *ngIf="errors.submit" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                {{ errors.submit }}
              </div>

              <button
                class="w-full py-3 rounded-xl font-bold text-white bg-gray-900 hover:bg-black transition disabled:opacity-50"
                type="submit"
                [disabled]="isSubmitting"
              >
                {{ isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión' }}
              </button>
            </form>
          </div>
        </div>
      </div>

      <!-- Confirmar sesión -->
      <div *ngIf="showSessionConfirm" class="absolute inset-0 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60"></div>
        <div class="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5">
          <h4 class="text-lg font-black text-gray-900">Hola, {{ pendingUsername || 'Usuario' }}</h4>
          <p class="text-sm text-gray-600 mt-1">¿Quieres recordar esta sesión en este dispositivo?</p>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <button class="py-3 rounded-xl font-bold bg-gray-100 hover:bg-gray-200" (click)="confirmSession(false)">Solo por ahora</button>
            <button class="py-3 rounded-xl font-bold bg-gray-900 text-white hover:bg-black" (click)="confirmSession(true)">Recordar</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ZonayummyLoginModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() loggedIn = new EventEmitter<void>();

  @ViewChild('googleButtonRef') googleButtonRef!: ElementRef<HTMLDivElement>;

  activeTab: LoginMethod = 'email';
  username = '';
  email = '';
  phone = '';
  countryCode = '+52';
  password = '';
  showPassword = false;
  isSubmitting = false;
  isGoogleLoading = false;
  showGoogleAuthHint = false;

  errors: LoginErrors = {};

  showSessionConfirm = false;
  pendingToken: string | null = null;
  pendingUsername: string | null = null;

  private googleInitialized = false;

  countryCodes = [
    { code: '+52', country: 'México', flag: '🇲🇽' },
    { code: '+1', country: 'USA/Canadá', flag: '🇺🇸' },
    { code: '+34', country: 'España', flag: '🇪🇸' },
    { code: '+54', country: 'Argentina', flag: '🇦🇷' },
    { code: '+57', country: 'Colombia', flag: '🇨🇴' },
    { code: '+51', country: 'Perú', flag: '🇵🇪' },
    { code: '+56', country: 'Chile', flag: '🇨🇱' },
  ];

  constructor(private auth: ZonayummyAuthService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue) {
      // abrir
      this.resetErrors();
      this.showSessionConfirm = false;
      this.pendingToken = null;
      this.pendingUsername = null;
      this.showGoogleAuthHint = false;
      setTimeout(() => this.setupGoogle(), 0);
    } else if (changes['isOpen'] && !changes['isOpen'].currentValue) {
      // cerrar
      this.googleInitialized = false;
      if (this.googleButtonRef?.nativeElement) {
        this.googleButtonRef.nativeElement.innerHTML = '';
      }
    }
  }

  close(): void {
    this.closed.emit();
  }

  setTab(tab: LoginMethod) {
    this.activeTab = tab;
    this.resetErrors();
    this.showGoogleAuthHint = false;
  }

  onIdentifierChange(value: string) {
    if (this.activeTab === 'email') {
      this.email = value;
    } else {
      this.username = (value || '').toLowerCase();
    }
  }

  onlyDigits(v: string): string {
    return (v || '').replace(/\D/g, '');
  }

  private resetErrors() {
    this.errors = {};
  }

  private validate(): boolean {
    this.resetErrors();
    const password = (this.password || '').trim();
    if (!password) this.errors.password = 'La contraseña es requerida';

    if (this.activeTab === 'email') {
      const email = (this.email || '').trim();
      if (!email) this.errors.identifier = 'El correo es requerido';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) this.errors.identifier = 'Correo inválido';
    } else if (this.activeTab === 'username') {
      const username = (this.username || '').trim();
      if (!username) this.errors.identifier = 'El usuario es requerido';
    } else {
      const phone = (this.phone || '').trim();
      if (!phone) this.errors.identifier = 'El número es requerido';
      else if (phone.length < 7) this.errors.identifier = 'Número inválido';
    }

    return Object.keys(this.errors).length === 0;
  }

  async submit() {
    if (this.isSubmitting) return;
    this.showGoogleAuthHint = false;
    if (!this.validate()) return;

    this.isSubmitting = true;
    try {
      let result;
      if (this.activeTab === 'email') {
        result = await this.auth.loginWithEmail(this.email.trim(), this.password);
      } else if (this.activeTab === 'phone') {
        result = await this.auth.loginWithPhone(`${this.countryCode}${this.phone}`, this.password);
      } else {
        result = await this.auth.loginWithUsername(this.username.toLowerCase().trim(), this.password);
      }

      if (result.ok) {
        this.pendingToken = result.token;
        this.pendingUsername = result.username;
        this.showSessionConfirm = true;
      } else {
        this.errors.submit = result.error || 'Error al iniciar sesión';
        if (result.useGoogleAuth) this.showGoogleAuthHint = true;
      }
    } catch (e: any) {
      this.errors.submit = e?.message || 'Error al iniciar sesión';
    } finally {
      this.isSubmitting = false;
    }
  }

  confirmSession(remember: boolean) {
    if (!this.pendingToken) return;
    this.auth.persistAuth(this.pendingToken, this.pendingUsername || 'Usuario', remember);
    this.showSessionConfirm = false;
    this.loggedIn.emit();
    this.close();
  }

  private async setupGoogle() {
    if (!this.isOpen) return;
    const clientId = this.auth.googleClientId;
    if (!clientId) return;
    if (!this.googleButtonRef?.nativeElement) return;
    if (this.googleInitialized) return;

    try {
      await this.loadGoogleScript();
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: any) => {
          if (!this.isOpen) return;
          const credential = resp?.credential;
          if (!credential) return;
          this.isGoogleLoading = true;
          this.resetErrors();
          try {
            const result = await this.auth.loginWithGoogle(credential);
            if (result.ok) {
              this.pendingToken = result.token;
              this.pendingUsername = result.username;
              this.showSessionConfirm = true;
            } else {
              this.errors.submit = result.error || 'Error en autenticación con Google';
            }
          } catch (e: any) {
            this.errors.submit = e?.message || 'Error en autenticación con Google';
          } finally {
            this.isGoogleLoading = false;
          }
        },
      });

      // Render button solo si está vacío
      if (this.googleButtonRef.nativeElement.children.length === 0) {
        window.google.accounts.id.renderButton(this.googleButtonRef.nativeElement, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
        });
      }

      this.googleInitialized = true;
    } catch (e: any) {
      this.errors.submit = e?.message || 'No se pudo cargar Google Identity Services';
    }
  }

  private loadGoogleScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) return resolve();
      const existing = document.getElementById('google-identity-services');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Error cargando Google script')));
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-identity-services';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Error cargando Google script'));
      document.head.appendChild(script);
    });
  }
}


