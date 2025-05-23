import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { HomeComponent } from './home/home.component';
import { authGuard } from './guards/auth.guard';
import { loggedInGuard } from './guards/logged-in.guard';
import { rootRedirectGuard } from './guards/root-redirect.guard';

export const routes: Routes = [
  { 
    path: 'login', 
    component: LoginComponent,
    canActivate: [loggedInGuard]
  },
  { 
    path: 'home', 
    component: HomeComponent,
    canActivate: [authGuard]
  },
  { 
    path: 'apps/suscripciones', 
    loadComponent: () => import('./apps/suscripciones/suscripciones.component').then(m => m.SuscripcionesComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'apps/mesero', 
    loadComponent: () => import('./apps/mesero/mesero.component').then(m => m.MeseroComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'apps/calculadora', 
    loadComponent: () => import('./apps/calculadora/calculadora.component').then(m => m.CalculadoraComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'apps/calculadora-3d', 
    loadComponent: () => import('./apps/calculadora-3d/calculadora-3d.component').then(m => m.Calculadora3DComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'apps/upload-videos', 
    loadComponent: () => import('./apps/upload-videos/upload-videos.component').then(m => m.UploadVideosComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'apps/comparador-videos', 
    loadComponent: () => import('./apps/comparador-videos/comparador-videos.component').then(m => m.ComparadorVideosComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'apps/task-tracker', 
    loadComponent: () => import('./apps/task-tracker/task-tracker.component').then(m => m.TaskTrackerComponent),
    canActivate: [authGuard]
  },
  { 
    path: '', 
    canActivate: [rootRedirectGuard],
    component: HomeComponent
  },
  { path: '**', redirectTo: '' }
];
