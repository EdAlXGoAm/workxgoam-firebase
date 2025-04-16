import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginGlowService } from '../../services/login-glow.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-100">
      <div #loginCard class="max-w-md w-full bg-white rounded-lg shadow-md p-8" [ngClass]="{'glow-animation': isGlowing}">
        <h2 class="text-2xl font-bold text-center text-gray-800 mb-6">Iniciar Sesión</h2>
        <div class="flex flex-col items-center">
          <button 
            (click)="loginWithGoogle()" 
            class="flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg shadow-sm px-6 py-3 w-full mb-4 hover:bg-gray-50 transition-colors">
            <img src="https://cdn.freebiesupply.com/logos/large/2x/google-g-2015-logo-png-transparent.png" width="24" height="24" alt="Logo de Google">
            <span>Continuar con Google</span>
          </button>
          <p class="text-gray-600 text-sm mt-4">Al iniciar sesión, aceptas nuestros términos de servicio y política de privacidad.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    
    .glow-animation {
      animation: glow 1s ease-in-out;
      box-shadow: 0 0 20px #a777e3;
    }
    
    @keyframes glow {
      0% {
        box-shadow: 0 0 0px #a777e3;
      }
      50% {
        box-shadow: 0 0 30px #a777e3;
      }
      100% {
        box-shadow: 0 0 0px #a777e3;
      }
    }
  `]
})
export class LoginComponent implements OnInit {
  @ViewChild('loginCard') loginCard!: ElementRef;
  isGlowing = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private glowService: LoginGlowService
  ) {}

  ngOnInit() {
    // Suscribirse al evento de resplandor
    this.glowService.glow$.subscribe(shouldGlow => {
      this.isGlowing = shouldGlow;
    });
  }

  async loginWithGoogle(): Promise<void> {
    try {
      const user = await this.authService.loginWithGoogle();
      if (user) {
        // Redirigir al usuario a la página principal
        this.router.navigate(['/home']);
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
    }
  }
} 