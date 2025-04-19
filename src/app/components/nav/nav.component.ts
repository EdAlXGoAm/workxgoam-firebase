import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginGlowService } from '../../services/login-glow.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="bg-white shadow-sm py-3 px-4">
      <div class="container mx-auto flex justify-between items-center">
        <div class="flex items-center">
          <a routerLink="/home" class="text-xl font-bold text-indigo-600">AixGoam</a>
        </div>
        
        <div class="flex items-center gap-4">
          <ng-container *ngIf="authService.isLoggedIn(); else notLoggedIn">
            <a routerLink="/apps/suscripciones" class="text-gray-600 hover:text-gray-900">Suscripciones</a>
            <a routerLink="/apps/mesero" class="text-gray-600 hover:text-gray-900">Mesero</a>
            <a routerLink="/apps/calculadora" class="text-gray-600 hover:text-gray-900">Calculadora</a>
            
            <button 
              (click)="logout()" 
              class="ml-4 px-4 py-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors">
              Cerrar sesión
            </button>
          </ng-container>
          
          <ng-template #notLoggedIn>
            <a 
              (click)="navigateToLogin($event)" 
              class="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer">
              Iniciar sesión
            </a>
          </ng-template>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class NavComponent {
  constructor(
    public authService: AuthService,
    private router: Router,
    private loginGlowService: LoginGlowService
  ) {}

  logout(): void {
    this.authService.logout();
  }
  
  navigateToLogin(event: MouseEvent): void {
    // Verificar si ya estamos en la página de login
    if (this.router.url === '/login') {
      // Si ya estamos en login, activar el resplandor
      event.preventDefault();
      this.loginGlowService.triggerGlow();
    } else {
      // Si no estamos en login, navegar a login
      this.router.navigate(['/login']);
    }
  }
} 