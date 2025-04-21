import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-12">
        <h1 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Bienvenido, {{ getUserName() }}</h1>
        <p class="text-gray-600 max-w-2xl mx-auto">Todas tus aplicaciones en un solo lugar. Gestiona tus suscripciones y más de forma fácil y eficiente.</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Card Suscripciones -->
        <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
          <div class="bg-blue-500 p-5 text-white">
            <h3 class="text-xl font-bold">Suscripciones</h3>
          </div>
          <div class="p-5">
            <p class="text-gray-600 mb-4">Gestiona todas tus suscripciones en un calendario fácil de usar.</p>
            <a routerLink="/apps/suscripciones" class="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition-colors">
              Abrir
            </a>
          </div>
        </div>
        
        <!-- Card Mesero -->
        <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
          <div class="bg-yellow-500 p-5 text-white">
            <h3 class="text-xl font-bold">Mesero</h3>
          </div>
          <div class="p-5">
            <p class="text-gray-600 mb-4">Gestiona mesas y órdenes en tu restaurante.</p>
            <a routerLink="/apps/mesero" class="block w-full text-center bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg transition-colors">
              Abrir
            </a>
          </div>
        </div>
        
        <!-- Más cards de aplicaciones -->
        <div class="bg-white rounded-xl shadow-md overflow-hidden opacity-60">
          <div class="bg-purple-500 p-5 text-white">
            <h3 class="text-xl font-bold">Finanzas</h3>
          </div>
          <div class="p-5">
            <p class="text-gray-600 mb-4">Próximamente: Gestiona tus finanzas personales.</p>
            <button disabled class="block w-full text-center bg-gray-300 text-gray-500 py-2 rounded-lg cursor-not-allowed">
              Próximamente
            </button>
          </div>
        </div>
        
        <div class="bg-white rounded-xl shadow-md overflow-hidden opacity-60">
          <div class="bg-green-500 p-5 text-white">
            <h3 class="text-xl font-bold">Notas</h3>
          </div>
          <div class="p-5">
            <p class="text-gray-600 mb-4">Próximamente: Toma notas y guarda información importante.</p>
            <button disabled class="block w-full text-center bg-gray-300 text-gray-500 py-2 rounded-lg cursor-not-allowed">
              Próximamente
            </button>
          </div>
        </div>
        
        <!-- Card Calculadora -->
        <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
          <div class="bg-indigo-500 p-5 text-white">
            <h3 class="text-xl font-bold">Calculadora de Costos</h3>
          </div>
          <div class="p-5">
            <p class="text-gray-600 mb-4">Calcula precios para comerciantes y público con ganancias automáticas.</p>
            <a routerLink="/apps/calculadora" class="block w-full text-center bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-lg transition-colors">
              Abrir
            </a>
          </div>
        </div>
        <!-- Card Comparador de Videos -->
        <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
          <div class="bg-pink-500 p-5 text-white">
            <h3 class="text-xl font-bold">Comparador de Videos</h3>
          </div>
          <div class="p-5">
            <p class="text-gray-600 mb-4">Busca y compara tus videos favoritos de YouTube.</p>
            <a routerLink="/apps/comparador-videos" class="block w-full text-center bg-pink-500 hover:bg-pink-600 text-white py-2 rounded-lg transition-colors">
              Abrir
            </a>
          </div>
        </div>
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