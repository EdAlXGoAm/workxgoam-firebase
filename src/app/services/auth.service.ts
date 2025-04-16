import { Injectable } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, User } from '@angular/fire/auth';
import { BehaviorSubject, Observable, firstValueFrom, map } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private user = new BehaviorSubject<User | null>(null);
  public user$ = this.user.asObservable();
  private authStateReady = false;

  constructor(
    private auth: Auth,
    private router: Router
  ) {
    // Observar cambios en el estado de autenticación
    this.auth.onAuthStateChanged(user => {
      this.user.next(user);
      this.authStateReady = true;
      
      // Redirigir según el estado de autenticación
      if (user) {
        // Si estamos en login, redirigir a home
        if (window.location.pathname === '/login') {
          this.router.navigate(['/home']);
        }
      } else {
        // Si estamos en una ruta protegida, redirigir a login
        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  // Iniciar sesión con Google
  async loginWithGoogle(): Promise<User | null> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      return result.user;
    } catch (error) {
      console.error('Error durante el inicio de sesión con Google:', error);
      return null;
    }
  }

  // Cerrar sesión
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error durante el cierre de sesión:', error);
    }
  }

  // Obtener usuario actual
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  // Comprobar si el usuario está logueado (sincrónicamente)
  isLoggedIn(): boolean {
    return !!this.auth.currentUser;
  }

  // Comprobar si el usuario está logueado (asincrónicamente)
  async isLoggedInAsync(): Promise<boolean> {
    // Si el estado de autenticación aún no está listo, esperar por el primer valor
    if (!this.authStateReady) {
      return await firstValueFrom(this.user$.pipe(map(user => !!user)));
    }
    // Si ya está listo, devolver el valor actual
    return !!this.auth.currentUser;
  }
} 