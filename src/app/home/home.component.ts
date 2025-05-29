import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AppCardComponent } from '../components/app-card/app-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, AppCardComponent],
  template: `
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-12">
        <h1 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Bienvenido, {{ getUserName() }}</h1>
        <p class="text-gray-600 max-w-2xl mx-auto">Todas tus aplicaciones en un solo lugar. Gestiona tus suscripciones y más de forma fácil y eficiente.</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Aplicaciones activas -->
        <app-card 
          title="Suscripciones"
          description="Gestiona todas tus suscripciones en un calendario fácil de usar."
          color="blue"
          routerLink="/apps/suscripciones">
        </app-card>
        
        <app-card 
          title="Mesero"
          description="Gestiona mesas y órdenes en tu restaurante."
          color="yellow"
          routerLink="/apps/mesero">
        </app-card>
        
        <app-card 
          title="Calculadora de Costos"
          description="Calcula precios para comerciantes y público con ganancias automáticas."
          color="indigo"
          routerLink="/apps/calculadora">
        </app-card>

        <app-card 
          title="Calculadora 3D"
          description="Calcula costos de impresiones 3D basado en filamento, electricidad y depreciación."
          color="purple"
          routerLink="/apps/calculadora-3d">
        </app-card>
        
        <app-card 
          title="Comparador de Videos"
          description="Busca y compara tus videos favoritos de YouTube."
          color="pink"
          routerLink="/apps/comparador-videos">
        </app-card>

        <app-card 
          title="Organizador de Tareas"
          description="Gestiona y organiza tus tareas diarias de manera eficiente."
          color="teal"
          routerLink="/apps/task-tracker">
        </app-card>

        <!-- Aplicaciones próximamente -->
        <app-card 
          title="Finanzas"
          description="Próximamente: Gestiona tus finanzas personales."
          color="green"
          buttonText="Próximamente"
          [disabled]="true">
        </app-card>
        
        <app-card 
          title="Notas"
          description="Próximamente: Toma notas y guarda información importante."
          color="gray"
          buttonText="Próximamente"
          [disabled]="true">
        </app-card>
      </div>
    </div>
  `,
  styles: []
})
export class HomeComponent {
  constructor(private authService: AuthService) {}

  getUserName(): string {
    const user = this.authService.getCurrentUser();
    return user?.displayName?.split(' ')[0] || 'Usuario';
  }
} 