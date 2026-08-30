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
  private authStatePromise: Promise<void>;
  private authStateResolver!: () => void;

  constructor(
    private auth: Auth,
    private router: Router
  ) {
    // Inicializar la promesa
    this.authStatePromise = new Promise<void>((resolve) => {
      this.authStateResolver = resolve;
    });

    // Observe auth state only (no forced redirects; app runs in public mode).
    this.auth.onAuthStateChanged(user => {
      this.user.next(user);
      this.authStateReady = true;
      this.authStateResolver();

      if (user && window.location.pathname === '/login') {
        this.router.navigate(['/home']);
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
      this.router.navigate(['/home']);
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
    // Esperar a que el estado de autenticación esté listo
    await this.authStatePromise;
    
    // Una vez que el estado está listo, devolver el valor actual
    return !!this.auth.currentUser;
  }
} 