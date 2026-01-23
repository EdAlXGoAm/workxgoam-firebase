export interface Task {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  description: string;
  start: string;
  end: string;
  environment: string;
  project: string;
  type?: string; // ID del tipo de tarea (opcional)
  taskGroupId?: string; // ID del grupo de tarea compleja (opcional)
  priority: 'low' | 'medium' | 'high' | 'critical';
  duration: number;
  deadline: string | null;
  reminders: string[];
  fragments: {
    start: string;
    end: string;
  }[];
  createdAt: string;
  updatedAt: string;
  completed: boolean;
  completedAt: string | null;
  hidden: boolean;
  status: 'pending' | 'in-progress' | 'completed';
} 