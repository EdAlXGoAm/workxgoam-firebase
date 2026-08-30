import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// Public mode: always land on home.
export const rootRedirectGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return router.parseUrl('/home');
}; 