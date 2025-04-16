import { Component, HostListener } from '@angular/core';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { NavComponent } from './components/nav/nav.component';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { LoginGlowService } from './services/login-glow.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavComponent, CommonModule, RouterModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'AixGoam';
  isUserMenuOpen = false;
  
  constructor(
    public authService: AuthService,
    private router: Router,
    private loginGlowService: LoginGlowService
  ) {}
  
  // Cerrar el menú al hacer clic en cualquier parte fuera de él
  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    // Verificar si el menú está abierto
    if (!this.isUserMenuOpen) return;
    
    // Comprobar si el clic fue dentro del menú o en el botón de usuario
    const target = event.target as HTMLElement;
    if (target.closest('.user-menu-container') || target.closest('#user-profile-button')) {
      return;
    }
    
    // Si llegamos aquí, el clic fue fuera del menú, así que lo cerramos
    this.isUserMenuOpen = false;
  }
  
  // Mostrar el nombre del usuario
  getUserName(): string {
    const user = this.authService.getCurrentUser();
    return user?.displayName?.split(' ')[0] || 'Usuario';
  }
  
  // Obtener la URL de la foto del usuario
  getUserPhotoUrl(): string | null {
    const user = this.authService.getCurrentUser();
    return user?.photoURL || null;
  }
  
  // Obtener las iniciales del nombre del usuario para mostrar si no hay foto
  getInitials(): string {
    const user = this.authService.getCurrentUser();
    if (!user?.displayName) return 'U';
    
    const nameParts = user.displayName.split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    return nameParts[0][0].toUpperCase();
  }
  
  // Alternar la visibilidad del menú de usuario
  toggleUserMenu(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation(); // Evitar que el evento de clic se propague
    }
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }
  
  // Cerrar sesión
  logout(): void {
    this.authService.logout();
    this.isUserMenuOpen = false;
  }

  // Navegar a la página de login o activar resplandor si ya estamos en login
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
