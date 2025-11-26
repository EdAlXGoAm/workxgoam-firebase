import { Injectable } from '@angular/core';
import { Firestore, doc, updateDoc, writeBatch } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { Task } from '../models/task.model';
import { EnvironmentService } from './environment.service';

/**
 * Resultado de una operación de modificación de tiempo
 */
export interface TimeUpdateResult {
  success: boolean;
  message: string;
  updatedTask?: Partial<Task>;
  updatedFragment?: { index: number; start: string; end: string };
}

/**
 * Opciones para desplazar una tarea
 */
export interface ShiftOptions {
  /** Minutos a desplazar (positivo = adelante, negativo = atrás) */
  minutes: number;
  /** Si true, mueve solo el fragmento especificado */
  fragmentOnly?: boolean;
  /** Índice del fragmento a mover (si fragmentOnly es true) */
  fragmentIndex?: number;
}

/**
 * Opciones para cambiar duración
 */
export interface DurationChangeOptions {
  /** Nueva duración en minutos */
  newDurationMinutes: number;
  /** Si se modifica el inicio (true) o el final (false) */
  adjustStart: boolean;
  /** Si true, modifica solo el fragmento especificado */
  fragmentOnly?: boolean;
  /** Índice del fragmento (si fragmentOnly es true) */
  fragmentIndex?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TaskTimeService {
  
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  /**
   * Desplazar una tarea o fragmento en el tiempo
   * @param task Tarea a modificar
   * @param options Opciones de desplazamiento
   */
  async shiftTask(task: Task, options: ShiftOptions): Promise<TimeUpdateResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return { success: false, message: 'Usuario no autenticado' };
    }

    try {
      const updates: Partial<Task> = {};
      const shiftMs = options.minutes * 60 * 1000;

      // Si es un fragmento específico
      if (options.fragmentOnly && options.fragmentIndex !== undefined) {
        if (!task.fragments || options.fragmentIndex >= task.fragments.length) {
          return { success: false, message: 'Fragmento no encontrado' };
        }

        const fragment = task.fragments[options.fragmentIndex];
        const newFragmentStart = this.addMilliseconds(fragment.start, shiftMs);
        const newFragmentEnd = this.addMilliseconds(fragment.end, shiftMs);

        // Copiar fragmentos y actualizar el específico
        const newFragments = [...task.fragments];
        newFragments[options.fragmentIndex] = {
          start: newFragmentStart,
          end: newFragmentEnd
        };

        updates.fragments = newFragments;

        // También actualizar start/end de la tarea principal si es necesario
        const allStarts = newFragments.map(f => new Date(f.start + 'Z').getTime());
        const allEnds = newFragments.map(f => new Date(f.end + 'Z').getTime());
        const minStart = new Date(Math.min(...allStarts));
        const maxEnd = new Date(Math.max(...allEnds));
        
        updates.start = this.formatToUTC(minStart);
        updates.end = this.formatToUTC(maxEnd);

        await this.updateTask(task.id, updates);

        return {
          success: true,
          message: `Fragmento ${options.fragmentIndex + 1} desplazado ${options.minutes} minutos`,
          updatedTask: updates,
          updatedFragment: {
            index: options.fragmentIndex,
            start: newFragmentStart,
            end: newFragmentEnd
          }
        };
      }

      // Desplazar tarea completa (incluyendo todos sus fragmentos)
      const newStart = this.addMilliseconds(task.start, shiftMs);
      const newEnd = this.addMilliseconds(task.end, shiftMs);

      updates.start = newStart;
      updates.end = newEnd;

      // Si tiene fragmentos, desplazarlos también
      if (task.fragments && task.fragments.length > 0) {
        updates.fragments = task.fragments.map(f => ({
          start: this.addMilliseconds(f.start, shiftMs),
          end: this.addMilliseconds(f.end, shiftMs)
        }));
      }

      await this.updateTask(task.id, updates);

      return {
        success: true,
        message: `Tarea desplazada ${options.minutes} minutos`,
        updatedTask: updates
      };

    } catch (error: any) {
      console.error('Error al desplazar tarea:', error);
      return { success: false, message: error.message || 'Error desconocido' };
    }
  }

  /**
   * Cambiar la duración de una tarea o fragmento
   * @param task Tarea a modificar
   * @param options Opciones de cambio de duración
   */
  async changeDuration(task: Task, options: DurationChangeOptions): Promise<TimeUpdateResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return { success: false, message: 'Usuario no autenticado' };
    }

    try {
      const updates: Partial<Task> = {};
      const newDurationMs = options.newDurationMinutes * 60 * 1000;

      // Si es un fragmento específico
      if (options.fragmentOnly && options.fragmentIndex !== undefined) {
        if (!task.fragments || options.fragmentIndex >= task.fragments.length) {
          return { success: false, message: 'Fragmento no encontrado' };
        }

        const fragment = task.fragments[options.fragmentIndex];
        const fragmentStart = new Date(fragment.start + 'Z');
        const fragmentEnd = new Date(fragment.end + 'Z');

        let newFragmentStart: string;
        let newFragmentEnd: string;

        if (options.adjustStart) {
          // Mantener el final, ajustar el inicio
          newFragmentEnd = fragment.end;
          const newStartTime = new Date(fragmentEnd.getTime() - newDurationMs);
          newFragmentStart = this.formatToUTC(newStartTime);
        } else {
          // Mantener el inicio, ajustar el final
          newFragmentStart = fragment.start;
          const newEndTime = new Date(fragmentStart.getTime() + newDurationMs);
          newFragmentEnd = this.formatToUTC(newEndTime);
        }

        // Copiar fragmentos y actualizar el específico
        const newFragments = [...task.fragments];
        newFragments[options.fragmentIndex] = {
          start: newFragmentStart,
          end: newFragmentEnd
        };

        updates.fragments = newFragments;

        // Actualizar start/end de la tarea principal
        const allStarts = newFragments.map(f => new Date(f.start + 'Z').getTime());
        const allEnds = newFragments.map(f => new Date(f.end + 'Z').getTime());
        const minStart = new Date(Math.min(...allStarts));
        const maxEnd = new Date(Math.max(...allEnds));
        
        updates.start = this.formatToUTC(minStart);
        updates.end = this.formatToUTC(maxEnd);
        updates.duration = options.newDurationMinutes / 60; // Convertir a horas

        await this.updateTask(task.id, updates);

        return {
          success: true,
          message: `Duración del fragmento ${options.fragmentIndex + 1} cambiada a ${this.formatDuration(options.newDurationMinutes)}`,
          updatedTask: updates,
          updatedFragment: {
            index: options.fragmentIndex,
            start: newFragmentStart,
            end: newFragmentEnd
          }
        };
      }

      // Cambiar duración de la tarea completa
      const taskStart = new Date(task.start + 'Z');
      const taskEnd = new Date(task.end + 'Z');

      if (options.adjustStart) {
        // Mantener el final, ajustar el inicio
        const newStartTime = new Date(taskEnd.getTime() - newDurationMs);
        updates.start = this.formatToUTC(newStartTime);
        updates.end = task.end;
      } else {
        // Mantener el inicio, ajustar el final
        updates.start = task.start;
        const newEndTime = new Date(taskStart.getTime() + newDurationMs);
        updates.end = this.formatToUTC(newEndTime);
      }

      updates.duration = options.newDurationMinutes / 60; // Convertir a horas

      // Si tiene fragmentos, ajustarlos proporcionalmente (opcional)
      // Por ahora, limpiar fragmentos si se cambia la duración de la tarea principal
      if (task.fragments && task.fragments.length > 0) {
        // Mantener fragmentos pero advertir al usuario
        console.warn('La tarea tiene fragmentos. Considere editar fragmentos individualmente.');
      }

      await this.updateTask(task.id, updates);

      return {
        success: true,
        message: `Duración cambiada a ${this.formatDuration(options.newDurationMinutes)}`,
        updatedTask: updates
      };

    } catch (error: any) {
      console.error('Error al cambiar duración:', error);
      return { success: false, message: error.message || 'Error desconocido' };
    }
  }

  /**
   * Obtener la duración actual de una tarea en minutos
   */
  getTaskDurationMinutes(task: Task): number {
    // Si tiene fragmentos, sumar duración de todos
    if (task.fragments && task.fragments.length > 0) {
      let totalMinutes = 0;
      for (const fragment of task.fragments) {
        const start = new Date(fragment.start + 'Z');
        const end = new Date(fragment.end + 'Z');
        const diffMs = end.getTime() - start.getTime();
        totalMinutes += diffMs / (1000 * 60);
      }
      return Math.round(totalMinutes);
    }

    // Si no hay fragmentos, usar start/end o duration
    if (task.start && task.end) {
      const start = new Date(task.start + 'Z');
      const end = new Date(task.end + 'Z');
      const diffMs = end.getTime() - start.getTime();
      return Math.round(diffMs / (1000 * 60));
    }

    if (task.duration) {
      return Math.round(task.duration * 60);
    }

    return 0;
  }

  /**
   * Obtener la duración de un fragmento específico en minutos
   */
  getFragmentDurationMinutes(task: Task, fragmentIndex: number): number {
    if (!task.fragments || fragmentIndex >= task.fragments.length) {
      return 0;
    }

    const fragment = task.fragments[fragmentIndex];
    const start = new Date(fragment.start + 'Z');
    const end = new Date(fragment.end + 'Z');
    const diffMs = end.getTime() - start.getTime();
    return Math.round(diffMs / (1000 * 60));
  }

  /**
   * Actualización atómica de tarea en Firestore
   */
  private async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const taskRef = doc(this.firestore, `${EnvironmentService.COLLECTION_PREFIX}tasks`, taskId);
    const now = new Date().toISOString();

    await updateDoc(taskRef, {
      ...updates,
      updatedAt: now
    });
  }

  /**
   * Añadir milisegundos a un string de fecha ISO
   */
  private addMilliseconds(isoString: string, ms: number): string {
    const date = new Date(isoString + 'Z');
    const newDate = new Date(date.getTime() + ms);
    return this.formatToUTC(newDate);
  }

  /**
   * Formatear Date a string UTC sin la Z
   */
  private formatToUTC(date: Date): string {
    return date.toISOString().replace('Z', '').split('.')[0];
  }

  /**
   * Formatear minutos a texto legible
   */
  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours} hora${hours > 1 ? 's' : ''}`;
    }
    return `${hours}h ${mins}min`;
  }

  /**
   * Generar opciones de tiempo para el selector del modal
   */
  generateTimeOptions(maxMinutes: number = 480, step: number = 15): { value: number; label: string }[] {
    const options: { value: number; label: string }[] = [];
    
    for (let m = step; m <= maxMinutes; m += step) {
      options.push({
        value: m,
        label: this.formatDuration(m)
      });
    }
    
    return options;
  }

  /**
   * Generar opciones de duración para el modal
   */
  generateDurationOptions(minMinutes: number = 15, maxMinutes: number = 480, step: number = 15): { value: number; label: string }[] {
    const options: { value: number; label: string }[] = [];
    
    for (let m = minMinutes; m <= maxMinutes; m += step) {
      options.push({
        value: m,
        label: this.formatDuration(m)
      });
    }
    
    return options;
  }
}

