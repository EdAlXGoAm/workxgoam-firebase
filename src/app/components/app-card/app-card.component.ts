import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow" 
         [class.opacity-60]="disabled">
      <div class="p-5 text-white" [ngClass]="getHeaderClasses()">
        <h3 class="text-xl font-bold">{{ title }}</h3>
      </div>
      <div class="p-5">
        <p class="text-gray-600 mb-4">{{ description }}</p>
        <a *ngIf="!disabled && routerLink" 
           [routerLink]="routerLink" 
           class="block w-full text-center text-white py-2 rounded-lg transition-colors"
           [ngClass]="getButtonClasses()">
          {{ buttonText }}
        </a>
        <button *ngIf="disabled" 
                disabled 
                class="block w-full text-center bg-gray-300 text-gray-500 py-2 rounded-lg cursor-not-allowed">
          {{ buttonText }}
        </button>
      </div>
    </div>
  `,
  styles: []
})
export class AppCardComponent {
  @Input() title: string = '';
  @Input() description: string = '';
  @Input() color: string = 'blue';
  @Input() routerLink?: string;
  @Input() disabled: boolean = false;
  @Input() buttonText: string = 'Abrir';

  getHeaderClasses(): string {
    return `bg-${this.color}-500`;
  }

  getButtonClasses(): string {
    return `bg-${this.color}-500 hover:bg-${this.color}-600`;
  }
} 