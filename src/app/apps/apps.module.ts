import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SuscripcionesComponent } from './suscripciones/suscripciones.component';

@NgModule({
  imports: [
    CommonModule,
    SuscripcionesComponent
  ],
  exports: [
    SuscripcionesComponent
  ]
})
export class AppsModule { } 