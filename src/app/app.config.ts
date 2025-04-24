import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getStorage, provideStorage } from '@angular/fire/storage';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD49YEWjdJZBsKWCiH9IId1JxxrFNuUHMM",
  authDomain: "aixgoam.firebaseapp.com",
  projectId: "aixgoam",
  storageBucket: "aixgoam.firebasestorage.app",
  messagingSenderId: "387716917046",
  appId: "1:387716917046:web:91a08738fae06a614f3597"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
    provideHttpClient()
  ]
};
