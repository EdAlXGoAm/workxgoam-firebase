import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const rootRedirectGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isLoggedIn = await authService.isLoggedInAsync();
  
  if (isLoggedIn) {
    // Si el usuario está autenticado, redirigir a home
    return router.parseUrl('/home');
  } else {
    // Si no está autenticado, redirigir a login
    return router.parseUrl('/login');
  }
}; 