import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc } from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private firestore: Firestore, private authService: AuthService) {
    // Al iniciar sesión, guardamos o actualizamos el perfil en Firestore
    this.authService.user$.subscribe((user: User | null) => {
      if (user) {
        const ref = doc(this.firestore, 'users', user.uid);
        setDoc(ref, { displayName: user.displayName, email: user.email }, { merge: true });
      }
    });
  }

  /** Obtiene la lista de usuarios registrados */
  getUsers(): Observable<UserProfile[]> {
    const ref = collection(this.firestore, 'users');
    return collectionData(ref, { idField: 'uid' }) as Observable<UserProfile[]>;
  }
} 