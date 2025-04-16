import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isLoggedIn = await authService.isLoggedInAsync();
  
  if (isLoggedIn) {
    return true;
  }

  // Redirigir al usuario a la página de login si no está autenticado
  return router.parseUrl('/login');
}; 