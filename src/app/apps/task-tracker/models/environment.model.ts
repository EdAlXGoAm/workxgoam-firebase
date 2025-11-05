export interface Environment {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  customOrder?: number; // Orden personalizado sincronizable entre dispositivos (opcional para compatibilidad)
} 