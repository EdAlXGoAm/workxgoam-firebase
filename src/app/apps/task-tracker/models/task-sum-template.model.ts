export interface TaskSumTemplate {
  id: string;
  userId: string;
  name: string;
  projectId: string;
  environmentId: string;
  selectedTaskIds: string[]; // IDs de tareas con checkbox true
  totalDuration: number; // Suma total en horas
  startDateFilter?: string; // Fecha de inicio del filtro (opcional)
  endDateFilter?: string; // Fecha de fin del filtro (opcional)
  createdAt: string;
  updatedAt: string;
}

