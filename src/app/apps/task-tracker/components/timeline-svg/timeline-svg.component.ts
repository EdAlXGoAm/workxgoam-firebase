import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/task.model';

@Component({
  selector: 'app-timeline-svg',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg [attr.width]="svgWidth" [attr.height]="svgHeight" class="w-full h-48">
      <!-- Eje de tiempo -->
      <line x1="0" y1="40" [attr.x2]="svgWidth" y2="40" stroke="#888" stroke-width="2" />
      <!-- Horas -->
      <g *ngFor="let hour of hours">
        <line [attr.x1]="getX(hour)" y1="30" [attr.x2]="getX(hour)" y2="50" stroke="#bbb" stroke-width="1" />
        <text [attr.x]="getX(hour)" y="65" font-size="12" text-anchor="middle" fill="#666">{{ hour }}:00</text>
      </g>
      <!-- Tareas -->
      <g *ngFor="let task of tasks">
        <rect [attr.x]="getTaskX(task)" y="20" [attr.width]="getTaskWidth(task)" height="40"
              [attr.fill]="getTaskColor(task)" rx="6" ry="6" fill-opacity="0.8" />
        <text [attr.x]="getTaskX(task) + 6" y="45" font-size="13" fill="#222" alignment-baseline="middle">
          {{ task.emoji }} {{ task.name }}
        </text>
      </g>
      <!-- Línea de la hora actual -->
      <line [attr.x1]="getNowX()" y1="10" [attr.x2]="getNowX()" y2="70" stroke="#f87171" stroke-width="2" stroke-dasharray="4 2" />
    </svg>
  `,
  styles: [`
    svg { background: #f9fafb; border-radius: 12px; }
  `]
})
export class TimelineSvgComponent {
  @Input() tasks: Task[] = [];

  svgWidth = 900;
  svgHeight = 80;
  hourMin = 6; // 6:00 am
  hourMax = 22; // 10:00 pm
  hours = Array.from({length: this.hourMax - this.hourMin + 1}, (_, i) => i + this.hourMin);

  getX(hour: number): number {
    return ((hour - this.hourMin) / (this.hourMax - this.hourMin)) * this.svgWidth;
  }

  getTaskX(task: Task): number {
    const start = new Date(task.start);
    const hour = start.getHours() + start.getMinutes() / 60;
    return ((hour - this.hourMin) / (this.hourMax - this.hourMin)) * this.svgWidth;
  }

  getTaskWidth(task: Task): number {
    const start = new Date(task.start);
    const end = new Date(task.end);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    return Math.max(8, ((endHour - startHour) / (this.hourMax - this.hourMin)) * this.svgWidth);
  }

  getTaskColor(task: Task): string {
    // Puedes personalizar colores según prioridad, proyecto, etc.
    switch (task.priority) {
      case 'low': return '#4ade80';
      case 'medium': return '#60a5fa';
      case 'high': return '#f87171';
      case 'critical': return '#f472b6';
      default: return '#a3a3a3';
    }
  }

  getNowX(): number {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    return ((hour - this.hourMin) / (this.hourMax - this.hourMin)) * this.svgWidth;
  }
} 