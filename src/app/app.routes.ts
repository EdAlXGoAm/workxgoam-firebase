import { Routes } from '@angular/router';
import { SuscripcionesComponent } from './apps/suscripciones/suscripciones.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'suscripciones', component: SuscripcionesComponent }
];
