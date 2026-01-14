export interface Project {
  id: string;
  userId: string;
  name: string;
  environment: string;
  description: string;
  color: string;
  image?: string; // base64 comprimido (data:image/png;base64,...)
  createdAt: string;
  updatedAt: string;
} 