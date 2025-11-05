import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginGlowService } from '../../services/login-glow.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.css']
})
export class NavComponent {
  currentYear = new Date().getFullYear();
  isLinksExpanded = false;

  constructor(
    public authService: AuthService,
    private router: Router,
    private loginGlowService: LoginGlowService
  ) {}

  toggleLinks(): void {
    this.isLinksExpanded = !this.isLinksExpanded;
  }

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