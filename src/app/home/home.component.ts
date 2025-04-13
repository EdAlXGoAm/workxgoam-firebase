import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface AppCard {
  id: string;
  emoji: string;
  title: string;
  description: string;
  color: string;
  route?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8 flex flex-col space-y-6">
      <div class="text-center w-full">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Tus Aplicaciones</h2>
        <p class="text-gray-600 max-w-2xl mx-auto text-center">Selecciona una aplicación para comenzar. Todas tus herramientas en un solo lugar.</p>
      </div>

      <!-- Floating Cards Grid -->
      <div class="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <!-- Tarjetas dinámicas -->
        <div *ngFor="let card of appCards" class="floating-card rounded-2xl overflow-hidden bg-white">
          <div class="h-full flex flex-col">
            <div class="bg-{{card.color}}-500 p-6 text-white">
              <div class="text-4xl mb-4">{{card.emoji}}</div>
              <h3 class="text-xl font-bold">{{card.title}}</h3>
            </div>
            <div class="p-6 flex-grow">
              <p class="text-gray-600 mb-4">{{card.description}}</p>
              <button 
                (click)="card.route ? navigateTo(card.route) : null" 
                class="w-full bg-{{card.color}}-500 hover:bg-{{card.color}}-600 text-white py-2 px-4 rounded-lg transition">
                {{card.route ? 'Abrir' : 'Administrar'}}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  `,
  styles: []
})
export class HomeComponent {
  appCards: AppCard[] = [
    {
      id: 'calendario',
      emoji: '📅',
      title: 'Calendario',
      description: 'Organiza tus eventos y citas importantes con nuestro calendario interactivo.',
      color: 'blue'
    },
    {
      id: 'finanzas',
      emoji: '💰',
      title: 'Finanzas',
      description: 'Controla tus gastos e ingresos con nuestra herramienta financiera.',
      color: 'purple'
    },
    {
      id: 'noticias',
      emoji: '📰',
      title: 'Noticias',
      description: 'Mantente informado con las últimas noticias de tus fuentes favoritas.',
      color: 'green'
    },
    {
      id: 'tareas',
      emoji: '📋',
      title: 'Tareas',
      description: 'Organiza tus proyectos y tareas diarias con nuestro gestor de productividad.',
      color: 'yellow'
    },
    {
      id: 'fitness',
      emoji: '💪',
      title: 'Fitness',
      description: 'Registra tus entrenamientos y sigue tu progreso físico.',
      color: 'red'
    },
    {
      id: 'suscripciones',
      emoji: '💳',
      title: 'Suscripciones',
      description: 'Administra todas tus suscripciones y servicios recurrentes.',
      color: 'indigo',
      route: '/suscripciones'
    }
  ];
  
  constructor(private router: Router) {}
  
  navigateTo(route: string): void {
    if (route) {
      this.router.navigate([route]);
    }
  }
} 