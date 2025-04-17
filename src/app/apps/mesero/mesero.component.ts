import { Component, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Firestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } from '@angular/fire/firestore';

interface Orden {
  id?: string;
  cliente: string;
  total: number;
  notas?: string;
  items: string[];
  fecha: Date | Timestamp;
  tipo: 'llevar' | 'whatsapp' | 'mesa';
  estado: 'pendiente' | 'completada' | 'pagada' | 'ocupada';
  numeroOrden: number;
  numeroMesa?: number;
}

interface Mesa {
  numero: number;
  estado: 'libre' | 'ocupada' | 'pagada';
  orden?: Orden;
}

@Component({
  selector: 'app-mesero',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './mesero.component.html',
  styleUrls: ['./mesero.component.css']
})
export class MeseroComponent implements OnInit {
  // Datos para las órdenes
  ordenesPendientes: Orden[] = [];
  historialOrdenes: Orden[] = [];
  ordenesLlevar: Orden[] = [];
  ordenesWhatsapp: Orden[] = [];
  siguienteNumeroOrden = 1;
  totalGanancias = 0;
  totalOrdenes = 0;
  formVisible = false;
  tipoOrdenActual: 'llevar' | 'whatsapp' | 'mesa' = 'llevar';
  
  // Datos para las mesas
  mesas: Mesa[] = [
    { numero: 1, estado: 'libre' },
    { numero: 2, estado: 'libre' },
    { numero: 3, estado: 'libre' },
    { numero: 4, estado: 'libre' }
  ];
  mesaSeleccionada?: number;
  
  // Datos para el formulario
  clienteNombre = '';
  ordenTotal = 0;
  ordenItems: string[] = [''];
  ordenNotas = '';

  constructor(private firestore: Firestore, private el: ElementRef) {}

  ngOnInit(): void {
    this.cargarOrdenes();
    this.actualizarEstadisticas();
  }

  cargarOrdenes(): void {
    const ordenesRef = collection(this.firestore, 'ZonaYummyOrdenes');
    const q = query(ordenesRef, orderBy('fecha', 'desc'));

    onSnapshot(q, (snapshot) => {
      const ordenes: Orden[] = [];
      let maxNumeroOrden = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        // Convertir explícitamente el timestamp de Firestore a Date
        let fechaJS: Date;
        
        if (data['fecha'] && typeof data['fecha'].toDate === 'function') {
          // Es un timestamp de Firestore
          fechaJS = data['fecha'].toDate();
        } else if (data['fecha'] && data['fecha'].seconds) {
          // Es un objeto con seconds y nanoseconds
          fechaJS = new Date(data['fecha'].seconds * 1000);
        } else if (data['fecha']) {
          // Intenta convertir cualquier otro formato
          fechaJS = new Date(data['fecha']);
        } else {
          // Si no hay fecha, usa la actual
          fechaJS = new Date();
        }
        
        const orden: Orden = {
          id: doc.id,
          cliente: data['cliente'] || '',
          total: data['total'] || 0,
          notas: data['notas'],
          items: data['items'] || [],
          fecha: fechaJS,
          tipo: data['tipo'] as 'llevar' | 'whatsapp' | 'mesa',
          estado: data['estado'] as 'pendiente' | 'completada' | 'pagada' | 'ocupada',
          numeroOrden: data['numeroOrden'] || 0,
          numeroMesa: data['numeroMesa']
        };
        
        ordenes.push(orden);
        
        // Encontrar el número de orden más alto
        if (orden.numeroOrden > maxNumeroOrden) {
          maxNumeroOrden = orden.numeroOrden;
        }
      });

      // Actualizar el siguiente número de orden
      this.siguienteNumeroOrden = maxNumeroOrden + 1;
      
      // Filtrar órdenes por estado y tipo
      this.ordenesLlevar = ordenes.filter(o => o.tipo === 'llevar' && o.estado === 'pendiente');
      this.ordenesWhatsapp = ordenes.filter(o => o.tipo === 'whatsapp' && o.estado === 'pendiente');
      this.historialOrdenes = ordenes.filter(o => o.estado === 'completada' || o.estado === 'pagada');
      
      // Actualizar estado de las mesas
      this.actualizarEstadoMesas(ordenes);
      
      // Actualizar estadísticas
      this.actualizarEstadisticas();
    });
  }

  actualizarEstadoMesas(ordenes: Orden[]): void {
    // Primero resetear todas las mesas a libre
    this.mesas.forEach(mesa => {
      mesa.estado = 'libre';
      mesa.orden = undefined;
    });
    
    // Luego actualizar con las órdenes activas
    ordenes.forEach(orden => {
      if (orden.tipo === 'mesa' && orden.numeroMesa && orden.estado !== 'completada') {
        const mesa = this.mesas.find(m => m.numero === orden.numeroMesa);
        if (mesa) {
          mesa.estado = orden.estado === 'pagada' ? 'pagada' : 'ocupada';
          mesa.orden = orden;
        }
      }
    });
  }

  // Método auxiliar para formatear fechas
  formatearFecha(fecha: Date | Timestamp): string {
    if (fecha instanceof Date) {
      return fecha.toLocaleTimeString();
    } else if (typeof fecha === 'object' && fecha !== null && 'toDate' in fecha) {
      return fecha.toDate().toLocaleTimeString();
    } else {
      return 'Fecha no disponible';
    }
  }

  // Métodos para calcular estadísticas
  getMesasOcupadas(): number {
    return this.mesas.filter(m => m.estado !== 'libre').length;
  }

  getMesasLibres(): number {
    return this.mesas.filter(m => m.estado === 'libre').length;
  }

  getPorcentajeOcupacion(): string {
    const ocupadas = this.getMesasOcupadas();
    const total = this.mesas.length;
    return Math.round((ocupadas / total) * 100).toString();
  }

  getPorcentajeDisponibilidad(): string {
    const libres = this.getMesasLibres();
    const total = this.mesas.length;
    return Math.round((libres / total) * 100).toString();
  }

  getOrdenesActivas(): number {
    return this.ordenesLlevar.length + this.ordenesWhatsapp.length;
  }

  mostrarFormulario(tipo: 'llevar' | 'whatsapp'): void {
    this.tipoOrdenActual = tipo;
    this.formVisible = true;
    this.limpiarFormulario();
  }

  abrirModalMesa(numeroMesa: number): void {
    const mesa = this.mesas.find(m => m.numero === numeroMesa);
    if (!mesa) return;
    
    this.mesaSeleccionada = numeroMesa;
    
    const modal = this.el.nativeElement.querySelector('#detallesOrdenModal');
    const contenido = this.el.nativeElement.querySelector('#detallesOrdenContent');
    const borde = this.el.nativeElement.querySelector('#modalBorde');
    
    // Establecer el color del borde
    borde.classList.remove('border-[#25D366]', 'border-[#FF7F50]');
    borde.classList.add('border-[#FFD700]');
    
    if (mesa.estado === 'libre') {
      // Mostrar formulario para nueva orden
      contenido.innerHTML = `
        <h3 class="text-xl font-bold mb-4 text-[#FF8C42]">
          <i class="fas fa-utensils mr-2"></i> Mesa ${numeroMesa}
        </h3>
        <p class="mb-4 text-gray-700">Esta mesa está libre. ¿Qué acción deseas realizar?</p>
        <div class="grid grid-cols-1 gap-2">
          <button id="levantarOrdenBtn" 
                  class="bg-[#4ECDC4] hover:bg-[#3AAFA9] text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
            <i class="fas fa-utensils mr-2"></i> Levantar Orden
          </button>
          <button id="cerrarModalBtn" 
                  class="bg-gray-400 hover:bg-gray-500 text-white py-2 px-4 rounded-full order-button">
            <i class="fas fa-times mr-2"></i> Cancelar
          </button>
        </div>
      `;
      
      // Agregar event listeners
      setTimeout(() => {
        const levantarOrdenBtn = this.el.nativeElement.querySelector('#levantarOrdenBtn');
        const cerrarModalBtn = this.el.nativeElement.querySelector('#cerrarModalBtn');
        
        if (levantarOrdenBtn) {
          levantarOrdenBtn.addEventListener('click', () => {
            this.tipoOrdenActual = 'mesa';
            this.formVisible = true;
            this.limpiarFormulario();
            this.cerrarDetallesOrden();
          });
        }
        
        if (cerrarModalBtn) {
          cerrarModalBtn.addEventListener('click', () => {
            this.cerrarDetallesOrden();
          });
        }
      }, 0);
      
    } else if (mesa.orden) {
      // Mostrar detalles de la orden
      const orden = mesa.orden;
      
      // Formatear la fecha para el modal
      let fechaFormateada = 'Fecha no disponible';
      if (orden.fecha instanceof Date) {
        fechaFormateada = orden.fecha.toLocaleString();
      } else if (typeof orden.fecha === 'object' && orden.fecha !== null && 'toDate' in orden.fecha) {
        fechaFormateada = orden.fecha.toDate().toLocaleString();
      }
      
      contenido.innerHTML = `
        <h3 class="text-xl font-bold mb-4 text-[#FF8C42]">
          <i class="fas fa-utensils mr-2"></i> Mesa ${numeroMesa}
        </h3>
        <div class="mb-4 bg-[#FFF5E6] p-3 rounded-lg border border-[#FFD700]">
          <p class="text-gray-700"><span class="font-bold">Cliente:</span> ${orden.cliente}</p>
          <p class="text-gray-700"><span class="font-bold">Total:</span> $${orden.total}</p>
          ${orden.notas ? `<p class="text-gray-700"><span class="font-bold">Notas:</span> ${orden.notas}</p>` : ''}
          <p class="text-gray-700"><span class="font-bold">Pedido:</span> ${orden.items.join(', ')}</p>
          <p class="text-gray-700"><span class="font-bold">Fecha:</span> ${fechaFormateada}</p>
        </div>
      `;
      
      if (mesa.estado === 'ocupada') {
        contenido.innerHTML += `
          <div class="grid grid-cols-2 gap-2">
            <button id="cobrarOrdenBtn" 
                    class="bg-[#25D366] hover:bg-[#1DA851] text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
              <i class="fas fa-money-bill-wave mr-2"></i> Cobrar
            </button>
            <button id="desocuparMesaBtn" 
                    class="bg-[#FF6B6B] hover:bg-[#D35D5D] text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
              <i class="fas fa-door-open mr-2"></i> Desocupar
            </button>
          </div>
        `;
        
        // Agregar event listeners
        setTimeout(() => {
          const cobrarOrdenBtn = this.el.nativeElement.querySelector('#cobrarOrdenBtn');
          const desocuparMesaBtn = this.el.nativeElement.querySelector('#desocuparMesaBtn');
          
          if (cobrarOrdenBtn && orden.id) {
            cobrarOrdenBtn.addEventListener('click', () => {
              this.marcarComoPagada(orden.id!);
            });
          }
          
          if (desocuparMesaBtn && orden.id) {
            desocuparMesaBtn.addEventListener('click', () => {
              this.desocuparMesa(orden.id!);
            });
          }
        }, 0);
      } else if (mesa.estado === 'pagada') {
        contenido.innerHTML += `
          <p class="text-[#25D366] mb-4 flex items-center">
            <i class="fas fa-check-circle mr-2"></i> Esta orden ya fue cobrada
          </p>
          <button id="desocuparMesaBtn" 
                  class="w-full bg-[#FF6B6B] hover:bg-[#D35D5D] text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
            <i class="fas fa-door-open mr-2"></i> Desocupar mesa
          </button>
        `;
        
        // Agregar event listener
        setTimeout(() => {
          const desocuparMesaBtn = this.el.nativeElement.querySelector('#desocuparMesaBtn');
          
          if (desocuparMesaBtn && orden.id) {
            desocuparMesaBtn.addEventListener('click', () => {
              this.desocuparMesa(orden.id!);
            });
          }
        }, 0);
      }
    }
    
    // Mostrar el modal
    modal.classList.remove('hidden');
  }

  cerrarFormulario(): void {
    this.formVisible = false;
  }

  agregarItem(): void {
    this.ordenItems.push('');
  }

  eliminarItem(index: number): void {
    if (this.ordenItems.length > 1) {
      this.ordenItems.splice(index, 1);
    }
  }

  limpiarFormulario(): void {
    this.clienteNombre = '';
    this.ordenTotal = 0;
    this.ordenItems = [''];
    this.ordenNotas = '';
  }

  calcularTotal(): void {
    // En un caso real, aquí se calcularía el total en base a los items
    // Por ahora, simplemente usamos el valor ingresado
  }

  async guardarOrden(): Promise<void> {
    if (!this.clienteNombre || this.ordenTotal <= 0) {
      return; // Validación básica
    }

    // Filtrar items vacíos
    const items = this.ordenItems.filter(item => item.trim() !== '');
    
    if (items.length === 0) {
      return; // Al menos un item es requerido
    }

    const nuevaOrden: Orden = {
      cliente: this.clienteNombre,
      total: this.ordenTotal,
      items: items,
      notas: this.ordenNotas,
      fecha: new Date(),
      tipo: this.tipoOrdenActual,
      estado: this.tipoOrdenActual === 'mesa' ? 'ocupada' : 'pendiente',
      numeroOrden: this.siguienteNumeroOrden
    };
    
    // Si es una orden de mesa, agregar el número de mesa
    if (this.tipoOrdenActual === 'mesa' && this.mesaSeleccionada) {
      nuevaOrden.numeroMesa = this.mesaSeleccionada;
    }

    try {
      // Agregar a Firebase
      await addDoc(collection(this.firestore, 'ZonaYummyOrdenes'), nuevaOrden);
      
      // Cerrar formulario
      this.cerrarFormulario();
      
      // Actualizar estadísticas
      this.totalOrdenes++;
    } catch (error) {
      console.error('Error al guardar la orden:', error);
    }
  }

  abrirDetallesOrden(orden: Orden): void {
    const modal = this.el.nativeElement.querySelector('#detallesOrdenModal');
    const contenido = this.el.nativeElement.querySelector('#detallesOrdenContent');
    const borde = this.el.nativeElement.querySelector('#modalBorde');
    
    // Establecer el color del borde según el tipo de orden
    if (orden.tipo === 'llevar') {
      borde.classList.remove('border-[#25D366]', 'border-[#FFD700]');
      borde.classList.add('border-[#FF7F50]');
    } else {
      borde.classList.remove('border-[#FF7F50]', 'border-[#FFD700]');
      borde.classList.add('border-[#25D366]');
    }
    
    // Formatear la fecha para el modal
    let fechaFormateada = 'Fecha no disponible';
    if (orden.fecha instanceof Date) {
      fechaFormateada = orden.fecha.toLocaleString();
    } else if (typeof orden.fecha === 'object' && orden.fecha !== null && 'toDate' in orden.fecha) {
      fechaFormateada = orden.fecha.toDate().toLocaleString();
    }
    
    // Construir el contenido del modal
    contenido.innerHTML = `
      <h3 class="text-xl font-bold mb-4 text-${orden.tipo === 'llevar' ? '[#FF7F50]' : '[#25D366]'}">
        <i class="fas ${orden.tipo === 'llevar' ? 'fa-walking' : 'fa-whatsapp'} mr-2"></i>
        ${orden.tipo === 'llevar' ? 'Para llevar' : 'WhatsApp'} #${orden.numeroOrden}
      </h3>
      <div class="mb-4 bg-[#F0FFF4] p-3 rounded-lg border border-[#C6F6D5]">
        <p class="text-gray-700"><span class="font-bold">Cliente:</span> ${orden.cliente}</p>
        <p class="text-gray-700"><span class="font-bold">Total:</span> $${orden.total}</p>
        ${orden.notas ? `<p class="text-gray-700"><span class="font-bold">Notas:</span> ${orden.notas}</p>` : ''}
        <p class="text-gray-700"><span class="font-bold">Pedido:</span> ${orden.items.join(', ')}</p>
        <p class="text-gray-700"><span class="font-bold">Fecha:</span> ${fechaFormateada}</p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button onclick="document.querySelector('#completarOrden${orden.id}').click()" 
                class="bg-[#4ECDC4] hover:bg-[#3AAFA9] text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
          <i class="fas fa-check mr-2"></i> Completar
        </button>
        <button onclick="document.querySelector('#detallesOrdenModal').classList.add('hidden')" 
                class="bg-gray-400 hover:bg-gray-500 text-white py-2 px-4 rounded-full order-button">
          <i class="fas fa-times mr-2"></i> Cerrar
        </button>
      </div>
    `;
    
    // Crear un botón oculto para manejar la acción de completar
    const completarBtn = document.createElement('button');
    completarBtn.id = `completarOrden${orden.id}`;
    completarBtn.style.display = 'none';
    completarBtn.addEventListener('click', () => this.completarOrden(orden.id!));
    this.el.nativeElement.appendChild(completarBtn);
    
    // Mostrar el modal
    modal.classList.remove('hidden');
  }

  cerrarDetallesOrden(): void {
    const modal = this.el.nativeElement.querySelector('#detallesOrdenModal');
    modal.classList.add('hidden');
  }

  async completarOrden(ordenId: string): Promise<void> {
    try {
      const ordenRef = doc(this.firestore, 'ZonaYummyOrdenes', ordenId);
      
      // Actualizar a completada
      await updateDoc(ordenRef, {
        estado: 'completada'
      });
      
      // Actualizar estadísticas
      this.totalGanancias += this.obtenerOrdenPorId(ordenId)?.total || 0;
      
      // Cerrar modal
      this.cerrarDetallesOrden();
    } catch (error) {
      console.error('Error al completar la orden:', error);
    }
  }

  async marcarComoPagada(ordenId: string): Promise<void> {
    try {
      const ordenRef = doc(this.firestore, 'ZonaYummyOrdenes', ordenId);
      
      // Actualizar a pagada
      await updateDoc(ordenRef, {
        estado: 'pagada'
      });
      
      // Actualizar estadísticas
      this.totalGanancias += this.obtenerOrdenPorId(ordenId)?.total || 0;
      
      // Cerrar modal
      this.cerrarDetallesOrden();
    } catch (error) {
      console.error('Error al marcar como pagada la orden:', error);
    }
  }

  async desocuparMesa(ordenId: string): Promise<void> {
    try {
      const ordenRef = doc(this.firestore, 'ZonaYummyOrdenes', ordenId);
      
      // Actualizar a completada
      await updateDoc(ordenRef, {
        estado: 'completada'
      });
      
      // Cerrar modal
      this.cerrarDetallesOrden();
    } catch (error) {
      console.error('Error al desocupar la mesa:', error);
    }
  }

  async eliminarOrden(ordenId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, 'ZonaYummyOrdenes', ordenId));
    } catch (error) {
      console.error('Error al eliminar la orden:', error);
    }
  }

  obtenerOrdenPorId(id: string): Orden | undefined {
    return [...this.ordenesLlevar, ...this.ordenesWhatsapp, ...this.historialOrdenes]
      .find(orden => orden.id === id);
  }

  actualizarEstadisticas(): void {
    // Calcular total de órdenes
    this.totalOrdenes = this.ordenesLlevar.length + 
                         this.ordenesWhatsapp.length + 
                         this.historialOrdenes.length;
    
    // Calcular ganancias
    this.totalGanancias = this.historialOrdenes
      .reduce((total, orden) => total + orden.total, 0);
  }

  // Obtener el color de clase CSS para las mesas según su estado
  getClaseMesa(mesa: Mesa): string {
    if (mesa.estado === 'ocupada') {
      return 'table occupied';
    } else if (mesa.estado === 'pagada') {
      return 'table paid';
    } else {
      return 'table';
    }
  }
} 