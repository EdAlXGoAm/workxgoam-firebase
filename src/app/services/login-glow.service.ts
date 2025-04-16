import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoginGlowService {
  private glowSubject = new BehaviorSubject<boolean>(false);
  public glow$ = this.glowSubject.asObservable();

  triggerGlow() {
    this.glowSubject.next(true);
    // Resetear después de 1 segundo
    setTimeout(() => {
      this.glowSubject.next(false);
    }, 1000);
  }
} 