export interface TaskGroup {
  id: string;
  userId: string;
  projectId: string;        // Alcance por proyecto
  name: string;             // Nombre/identificador del grupo
  description?: string;     // Descripción opcional
  createdAt: string;
  updatedAt: string;
}
