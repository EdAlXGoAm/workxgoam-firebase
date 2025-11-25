export interface TaskSumTemplate {
  id: string;
  userId: string;
  name: string;
  projectId: string;
  environmentId: string;
  selectedTaskIds: string[]; // IDs de tareas con checkbox true
  totalDuration: number; // Suma total en horas
  createdAt: string;
  updatedAt: string;
}

