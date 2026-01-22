import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { NavComponent } from './components/nav/nav.component';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { LoginGlowService } from './services/login-glow.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavComponent, CommonModule, RouterModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'AixGoam';
  isUserMenuOpen = false;
  menuPosition = { top: '0px', right: '0px' };
  isTaskTrackerRoute: boolean = false;
  private routerSubscription?: Subscription;
  
  constructor(
    public authService: AuthService,
    private router: Router,
    private loginGlowService: LoginGlowService
  ) {}
  
  ngOnInit(): void {
    // Verificar la ruta inicial
    this.checkTaskTrackerRoute();
    
    // Suscribirse a los cambios de ruta
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkTaskTrackerRoute();
      });
  }
  
  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
  
  // Verificar si estamos en la ruta de task-tracker
  private checkTaskTrackerRoute(): void {
    this.isTaskTrackerRoute = this.router.url.includes('/apps/task-tracker');
  }
  
  // Cerrar el menú al hacer clic en cualquier parte fuera de él
  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    // Verificar si el menú está abierto
    if (!this.isUserMenuOpen) return;
    
    // Comprobar si el clic fue dentro del menú o en el botón de usuario
    const target = event.target as HTMLElement;
    if (target.closest('.user-menu-dropdown') || target.closest('#user-profile-button')) {
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
      
      // Calcular la posición del menú basándose en la posición del botón
      const button = event.target as HTMLElement;
      const buttonRect = button.closest('#user-profile-button')?.getBoundingClientRect();
      
      if (buttonRect) {
        // Posicionar el menú justo debajo del botón, alineado a la derecha
        this.menuPosition = {
          top: `${buttonRect.bottom + 8}px`, // 8px de espacio debajo del botón
          right: `${window.innerWidth - buttonRect.right}px` // Alineado con el borde derecho del botón
        };
      }
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
