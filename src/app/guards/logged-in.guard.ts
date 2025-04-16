import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const loggedInGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isLoggedIn = await authService.isLoggedInAsync();
  
  if (isLoggedIn) {
    // Si el usuario ya está autenticado, redirigir a la página de inicio
    return router.parseUrl('/home');
  }

  // Si no está autenticado, permite el acceso a la página de login
  return true;
}; 