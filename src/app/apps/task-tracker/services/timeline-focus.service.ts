import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TimelineFocusService {
  private focusedEnvironmentId$ = new BehaviorSubject<string | null>(null);

  setFocusedEnvironmentId(envId: string | null): void {
    this.focusedEnvironmentId$.next(envId);
  }

  getFocusedEnvironmentId(): Observable<string | null> {
    return this.focusedEnvironmentId$.asObservable();
  }

  getCurrentFocusedEnvironmentId(): string | null {
    return this.focusedEnvironmentId$.value;
  }
}

