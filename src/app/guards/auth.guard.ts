import { CanActivateFn } from '@angular/router';

// Public mode: allow all routes without login (Firebase auth project unavailable).
export const authGuard: CanActivateFn = async () => true; 