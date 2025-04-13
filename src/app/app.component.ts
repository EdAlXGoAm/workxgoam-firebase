import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: `
    <!-- Header -->
    <header class="gradient-bg text-white shadow-lg">
      <div class="container mx-auto px-4 py-6 flex justify-between items-center">
        <h1 class="text-2xl md:text-3xl font-bold flex items-center">
          <span class="mr-3">🚀</span>
          WorkXGoAm
        </h1>
        <button id="user-menu" class="flex items-center space-x-2 focus:outline-none">
          <span class="hidden md:inline">Usuario</span>
          <div class="w-10 h-10 rounded-full bg-white text-purple-600 flex items-center justify-center font-bold">
            <span>👤</span>
          </div>
        </button>
      </div>
    </header>

    <!-- Router Outlet -->
    <router-outlet />
  `,
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'myapp';
}
