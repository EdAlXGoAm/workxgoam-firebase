import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/task.model';
import { Environment } from '../../models/environment.model';

@Component({
  selector: 'app-timeline-svg',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg [attr.width]="svgWidth" [attr.height]="svgHeight" class="w-full">
      <!-- Tercio 1: 00:00 - 08:00 -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" [attr.width]="svgWidth" [attr.height]="sectionHeight" fill="#f0f4f8" rx="6" ry="6"/>
        <line x1="0" y1="40" [attr.x2]="svgWidth" y2="40" stroke="#888" stroke-width="1.5" />
        <text x="10" y="15" font-size="12" fill="#333" font-weight="bold">00:00 - 08:00</text>
        <g *ngFor="let hour of hoursPerSection[0]">
          <line [attr.x1]="getX(hour, 0)" y1="30" [attr.x2]="getX(hour, 0)" y2="50" stroke="#bbb" stroke-width="1" />
          <text [attr.x]="getX(hour, 0)" y="65" font-size="10" text-anchor="middle" fill="#666">{{ hour }}:00</text>
        </g>
        <g *ngFor="let task of getTasksForSection(0)">
          <rect [attr.x]="getTaskX(task, 0)" y="20" [attr.width]="getTaskWidth(task, 0)" height="40"
                [attr.fill]="getTaskColor(task)" rx="6" ry="6" fill-opacity="0.8" />
          <text [attr.x]="getTaskX(task, 0) + 6" y="45" font-size="12" fill="#111" alignment-baseline="middle">
            {{ task.emoji }} {{ task.name }}
          </text>
        </g>
        <line *ngIf="isNowInSection(0)" [attr.x1]="getNowX(0)" y1="10" [attr.x2]="getNowX(0)" y2="70" stroke="#f87171" stroke-width="2" stroke-dasharray="4 2" />
      </g>

      <!-- Tercio 2: 08:00 - 16:00 -->
      <g [attr.transform]="'translate(0, ' + sectionHeight + ')'">
        <rect x="0" y="0" [attr.width]="svgWidth" [attr.height]="sectionHeight" fill="#e9eff5" rx="6" ry="6"/>
        <line x1="0" y1="40" [attr.x2]="svgWidth" y2="40" stroke="#888" stroke-width="1.5" />
        <text x="10" y="15" font-size="12" fill="#333" font-weight="bold">08:00 - 16:00</text>
        <g *ngFor="let hour of hoursPerSection[1]">
          <line [attr.x1]="getX(hour, 8)" y1="30" [attr.x2]="getX(hour, 8)" y2="50" stroke="#bbb" stroke-width="1" />
          <text [attr.x]="getX(hour, 8)" y="65" font-size="10" text-anchor="middle" fill="#666">{{ hour }}:00</text>
        </g>
        <g *ngFor="let task of getTasksForSection(1)">
          <rect [attr.x]="getTaskX(task, 8)" y="20" [attr.width]="getTaskWidth(task, 8)" height="40"
                [attr.fill]="getTaskColor(task)" rx="6" ry="6" fill-opacity="0.8" />
          <text [attr.x]="getTaskX(task, 8) + 6" y="45" font-size="12" fill="#111" alignment-baseline="middle">
            {{ task.emoji }} {{ task.name }}
          </text>
        </g>
        <line *ngIf="isNowInSection(1)" [attr.x1]="getNowX(8)" y1="10" [attr.x2]="getNowX(8)" y2="70" stroke="#f87171" stroke-width="2" stroke-dasharray="4 2" />
      </g>

      <!-- Tercio 3: 16:00 - 24:00 -->
      <g [attr.transform]="'translate(0, ' + (sectionHeight * 2) + ')'">
        <rect x="0" y="0" [attr.width]="svgWidth" [attr.height]="sectionHeight" fill="#e2eaf0" rx="6" ry="6"/>
        <line x1="0" y1="40" [attr.x2]="svgWidth" y2="40" stroke="#888" stroke-width="1.5" />
        <text x="10" y="15" font-size="12" fill="#333" font-weight="bold">16:00 - 24:00</text>
        <g *ngFor="let hour of hoursPerSection[2]">
          <line [attr.x1]="getX(hour, 16)" y1="30" [attr.x2]="getX(hour, 16)" y2="50" stroke="#bbb" stroke-width="1" />
          <text [attr.x]="getX(hour, 16)" y="65" font-size="10" text-anchor="middle" fill="#666">{{ hour }}:00</text>
        </g>
        <g *ngFor="let task of getTasksForSection(2)">
          <rect [attr.x]="getTaskX(task, 16)" y="20" [attr.width]="getTaskWidth(task, 16)" height="40"
                [attr.fill]="getTaskColor(task)" rx="6" ry="6" fill-opacity="0.8" />
          <text [attr.x]="getTaskX(task, 16) + 6" y="45" font-size="12" fill="#111" alignment-baseline="middle">
            {{ task.emoji }} {{ task.name }}
          </text>
        </g>
        <line *ngIf="isNowInSection(2)" [attr.x1]="getNowX(16)" y1="10" [attr.x2]="getNowX(16)" y2="70" stroke="#f87171" stroke-width="2" stroke-dasharray="4 2" />
      </g>
    </svg>
  `,
  styles: [`
    svg { background: #f9fafb; border-radius: 12px; }
    /* Removed fixed height from parent component, adjust as needed */
  `]
})
export class TimelineSvgComponent {
  @Input() tasks: Task[] = [];
  @Input() environments: Environment[] = [];

  svgWidth = 450; // Ancho total del SVG
  sectionHeight = 100; // Altura de cada sección de 8 horas
  svgHeight = this.sectionHeight * 3; // Altura total del SVG

  hoursPerSection: number[][] = [
    Array.from({length: 8}, (_, i) => i),       // 0-7
    Array.from({length: 8}, (_, i) => i + 8),    // 8-15
    Array.from({length: 8}, (_, i) => i + 16)   // 16-23
  ];
  
  // Método utilitario para convertir fechas UTC de la base de datos a hora local
  private parseUTCToLocal(dateTimeString: string): Date {
    // Asegurar que el string se interprete como UTC añadiendo 'Z' si no lo tiene
    const utcString = dateTimeString + (dateTimeString.includes('Z') ? '' : 'Z');
    return new Date(utcString);
  }

  // Devuelve la posición X para una hora dentro de una sección (0-23)
  // sectionStartHour es la hora de inicio de la sección (0, 8, o 16)
  getX(hourInDay: number, sectionStartHour: number): number {
    const hourInSection = hourInDay - sectionStartHour;
    // Cada sección representa 8 horas
    return (hourInSection / 8) * this.svgWidth;
  }

  getTaskX(task: Task, sectionStartHour: number): number {
    const taskActualStart = this.parseUTCToLocal(task.start);
    const taskActualStartHour = taskActualStart.getHours() + taskActualStart.getMinutes() / 60;

    // Determinar el inicio de la porción visible de la tarea dentro de esta sección
    const visiblePortionStartHourInDay = Math.max(taskActualStartHour, sectionStartHour);
    
    // Convertir este inicio visible a un desplazamiento desde el inicio de la sección
    const offsetFromSectionStart = visiblePortionStartHourInDay - sectionStartHour;
    
    return (offsetFromSectionStart / 8) * this.svgWidth;
  }

  getTaskWidth(task: Task, sectionStartHour: number): number {
    const start = this.parseUTCToLocal(task.start);
    const end = this.parseUTCToLocal(task.end);
    
    let taskStartHour = start.getHours() + start.getMinutes() / 60;
    let taskEndHour = end.getHours() + end.getMinutes() / 60;

    // Ajustar las horas de inicio y fin para que estén dentro de los límites de la sección
    taskStartHour = Math.max(taskStartHour, sectionStartHour);
    taskEndHour = Math.min(taskEndHour, sectionStartHour + 8);
    
    const durationInSection = taskEndHour - taskStartHour;
    
    if (durationInSection <= 0) return 0; // La tarea no está en esta parte de la sección o es inválida

    return Math.max(8, (durationInSection / 8) * this.svgWidth);
  }

  getTasksForSection(sectionIndex: 0 | 1 | 2): Task[] {
    const sectionStartHour = sectionIndex * 8;
    const sectionEndHour = sectionStartHour + 8;

    return this.tasks.filter(task => {
      const taskStart = this.parseUTCToLocal(task.start);
      const taskEnd = this.parseUTCToLocal(task.end);
      const taskStartHour = taskStart.getHours() + taskStart.getMinutes() / 60;
      const taskEndHour = taskEnd.getHours() + taskEnd.getMinutes() / 60;

      // La tarea se superpone con la sección si:
      // Su inicio es antes del fin de la sección Y su fin es después del inicio de la sección
      return taskStartHour < sectionEndHour && taskEndHour > sectionStartHour;
    });
  }
  
  getTaskColor(task: Task): string {
    if (task.environment && this.environments.length > 0) {
      const environment = this.environments.find(env => env.id === task.environment);
      if (environment && environment.color) {
        return environment.color;
      }
    }
    // Fallback a colores por prioridad si no hay environment o color
    // O puedes optar por un gris por defecto directamente:
    // return '#a3a3a3'; 
    switch (task.priority) {
      case 'low': return '#4ade80'; // Verde
      case 'medium': return '#60a5fa'; // Azul
      case 'high': return '#f87171'; // Rojo
      case 'critical': return '#f472b6'; // Rosa
      default: return '#a3a3a3'; // Gris
    }
  }

  getNowX(sectionStartHour: number): number {
    const now = new Date();
    const currentHourInDay = now.getHours() + now.getMinutes() / 60;
    const hourInSection = currentHourInDay - sectionStartHour;
    return (hourInSection / 8) * this.svgWidth;
  }

  isNowInSection(sectionIndex: 0 | 1 | 2): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const sectionStartHour = sectionIndex * 8;
    const sectionEndHour = sectionStartHour + 8;
    return currentHour >= sectionStartHour && currentHour < sectionEndHour;
  }
} 
