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
    path: '', 
    canActivate: [rootRedirectGuard],
    component: HomeComponent
  },
  { path: '**', redirectTo: '' }
];
