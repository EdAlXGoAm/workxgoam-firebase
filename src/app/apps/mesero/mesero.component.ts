import { Component, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Firestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } from '@angular/fire/firestore';
import { v4 as uuidv4 } from 'uuid';
import { HttpClientModule } from '@angular/common/http';
import { PlatillosService } from '../../services/platillos.service';

interface OrdenItem {
  id: string;        // identificador único
  nombre: string;
  precio: number;
  cobrado: boolean; // true si ya fue incluido en un cobro parcial/final
}

interface Orden {
  id?: string;
  cliente: string;
  total: number;
  notas?: string;
  items: OrdenItem[];
  fecha: Date | Timestamp;
  tipo: 'llevar' | 'whatsapp' | 'mesa';
  estado: 'pendiente' | 'completada' | 'pagada' | 'ocupada';
  numeroOrden: number;
  numeroMesa?: number;
  pagado?: number;
  pendiente?: number;
}

interface Mesa {
  numero: number;
  estado: 'libre' | 'ocupada' | 'pagada';
  orden?: Orden;
}

@Component({
  selector: 'app-mesero',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './mesero.component.html',
  styleUrls: ['./mesero.component.css']
})
export class MeseroComponent implements OnInit {
  // Datos para las órdenes
  ordenesPendientes: Orden[] = [];
  historialOrdenes: Orden[] = [];
  ordenesLlevar: Orden[] = [];
  ordenesWhatsapp: Orden[] = [];
  platillos: any[] = [];
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
  ordenItems: OrdenItem[] = [ { id: uuidv4(), nombre: '', precio: 0, cobrado: false } ];
  ordenNotas = '';

  // Estado del modal de cobro parcial
  cobroParcialVisible = false;
  ordenEnCobroParcial?: Orden;
  itemsSeleccionados: Set<string> = new Set();
  modoMontoEspecifico = false;
  montoEspecifico = 0;

  constructor(private firestore: Firestore, private el: ElementRef, private platillosService: PlatillosService) {}

  ngOnInit(): void {
    this.cargarOrdenes();
    this.actualizarEstadisticas();
    this.loadPlatillos();
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
          items: (data['items'] || []).map((it: any) => ({
            id: it.id ?? uuidv4(),
            nombre: it.nombre ?? it,      // compat. con antiguo string
            precio: Number(it.precio ?? 0),
            cobrado: !!it.cobrado
          })),
          fecha: fechaJS,
          tipo: data['tipo'] as 'llevar' | 'whatsapp' | 'mesa',
          estado: data['estado'] as 'pendiente' | 'completada' | 'pagada' | 'ocupada',
          numeroOrden: data['numeroOrden'] || 0,
          numeroMesa: data['numeroMesa'],
          pagado: data['pagado'] ?? 0,
          pendiente: data['pendiente'] ?? (data['total'] || 0) - (data['pagado'] ?? 0)
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

  // Devuelve el monto pendiente (o total si aún no se ha definido)
  getPendiente(orden: Orden | undefined): number {
    if (!orden) return 0;
    // Si existen items con bandera cobrado, recalculamos pendiente en cliente para mostrar correctamente
    if (orden.items && orden.items.length) {
      const totalCobrado = orden.items
        .filter(i => i.cobrado)
        .reduce((s, i) => s + i.precio, 0);
      return orden.total - totalCobrado;
    }
    return orden.pendiente !== undefined ? orden.pendiente : orden.total;
  }

  mostrarFormulario(tipo: 'llevar' | 'whatsapp'): void {
    this.tipoOrdenActual = tipo;
    this.formVisible = true;
    this.limpiarFormulario();
    // Valores por defecto para testing rápido
    this.clienteNombre = 'Cliente Demo';
    this.ordenNotas = 'Nota de prueba';
    this.ordenItems = [ { id: uuidv4(), nombre: '', precio: 0, cobrado: false } ];
    this.ordenTotal = 42.00;

    // Enfocar el botón Guardar para que al presionar Enter se dispare la acción por defecto
    setTimeout(() => {
      const guardarBtn = this.el.nativeElement.querySelector('button[type="submit"]');
      if (guardarBtn) {
        guardarBtn.focus();
      }
    }, 0);
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
            // Valores por defecto para testing rápido
            this.clienteNombre = 'Cliente Demo';
            this.ordenNotas = 'Orden mesa de prueba';
            this.ordenItems = [ { id: uuidv4(), nombre: '', precio: 0, cobrado: false } ];
            this.ordenTotal = 99.99;
            this.cerrarDetallesOrden();
            // Enfocar el botón Guardar para la nueva orden de mesa
            setTimeout(() => {
              const guardarBtn = this.el.nativeElement.querySelector('button[type="submit"]');
              if (guardarBtn) {
                guardarBtn.focus();
              }
            }, 0);
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
          <p class="text-gray-700"><span class="font-bold">Pedido:</span> ${orden.items.map(i => i.nombre).join(', ')}</p>
          <p class="text-gray-700"><span class="font-bold">Pendiente:</span> $${orden.pendiente?.toFixed(2)}</p>
          <p class="text-gray-700"><span class="font-bold">Fecha:</span> ${fechaFormateada}</p>
        </div>
      `;
      
      if (mesa.estado === 'ocupada') {
        contenido.innerHTML += `
          <div class="grid grid-cols-4 gap-2">
            <button id="cobrarOrdenBtn" 
                    class="bg-[#25D366] hover:bg-[#1DA851] text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
              <i class="fas fa-money-bill-wave mr-2"></i> Cobrar
            </button>
            <button id="cobroParcialMesaBtn" 
                    class="bg-[#FFD700] hover:bg-[#E6C200] text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
              <i class="fas fa-hand-holding-usd mr-2"></i> Parcial
            </button>
            <button id="desocuparMesaBtn" 
                    class="bg-[#FF6B6B] hover:bg-[#D35D5D] text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
              <i class="fas fa-door-open mr-2"></i> Desocupar
            </button>
            <button id="cancelarModalBtn" 
                    class="bg-gray-400 hover:bg-gray-500 text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
              <i class="fas fa-times mr-2"></i> Cancelar
            </button>
          </div>
        `;
        
        // Agregar event listeners
        setTimeout(() => {
          const cobrarOrdenBtn = this.el.nativeElement.querySelector('#cobrarOrdenBtn');
          const cobroParcialMesaBtn = this.el.nativeElement.querySelector('#cobroParcialMesaBtn');
          const desocuparMesaBtn = this.el.nativeElement.querySelector('#desocuparMesaBtn');
          const cancelarModalBtn = this.el.nativeElement.querySelector('#cancelarModalBtn');
          
          if (cobrarOrdenBtn && orden.id) {
            cobrarOrdenBtn.addEventListener('click', () => {
              this.marcarComoPagada(orden.id!);
            });
          }
          
          if (cobroParcialMesaBtn && orden.id) {
            cobroParcialMesaBtn.addEventListener('click', () => {
              this.abrirCobroParcial(orden);
            });
          }
          
          if (desocuparMesaBtn && orden.id) {
            desocuparMesaBtn.addEventListener('click', () => {
              this.desocuparMesa(orden.id!);
            });
          }
          
          if (cancelarModalBtn) {
            cancelarModalBtn.addEventListener('click', () => {
              this.cerrarDetallesOrden();
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
    this.ordenItems.push({ id: uuidv4(), nombre: '', precio: 0, cobrado: false });
  }

  eliminarItem(index: number): void {
    if (this.ordenItems.length > 1) {
      this.ordenItems.splice(index, 1);
      this.recalcularTotal();
    }
  }

  // Recalcula el total en base a los precios capturados
  recalcularTotal(): void {
    this.ordenTotal = this.ordenItems
      .reduce((sum, item) => sum + (Number(item.precio) || 0), 0);
  }

  limpiarFormulario(): void {
    this.clienteNombre = '';
    this.ordenTotal = 0;
    this.ordenItems = [ { id: uuidv4(), nombre: '', precio: 0, cobrado: false } ];
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

    // Filtrar items con nombre y precio válidos
    const items = this.ordenItems
      .filter(i => i.nombre.trim() !== '' && i.precio > 0)
      .map(i => ({ ...i, cobrado: false }));

    if (items.length === 0) {
      return; // Al menos un item válido requerido
    }

    // Recalcular total por si acaso
    this.ordenTotal = items.reduce((s, it) => s + it.precio, 0);

    const nuevaOrden: Orden = {
      cliente: this.clienteNombre,
      total: this.ordenTotal,
      items,
      notas: this.ordenNotas,
      fecha: new Date(),
      tipo: this.tipoOrdenActual,
      estado: this.tipoOrdenActual === 'mesa' ? 'ocupada' : 'pendiente',
      numeroOrden: this.siguienteNumeroOrden,
      pagado: 0,
      pendiente: this.ordenTotal
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
    
    // Construir el contenido del modal con acciones según estado
    contenido.innerHTML = `
      <h3 class="text-xl font-bold mb-4 text-${orden.tipo === 'llevar' ? '[#FF7F50]' : '[#25D366]'}">
        <i class="fas ${orden.tipo === 'llevar' ? 'fa-walking' : 'fa-whatsapp'} mr-2"></i>
        ${orden.tipo === 'llevar' ? 'Para llevar' : 'WhatsApp'} #${orden.numeroOrden}
      </h3>
      <div class="mb-4 bg-[#F0FFF4] p-3 rounded-lg border border-[#C6F6D5]">
        <p class="text-gray-700"><span class="font-bold">Cliente:</span> ${orden.cliente}</p>
        <p class="text-gray-700"><span class="font-bold">Total:</span> $${orden.total}</p>
        ${orden.notas ? `<p class="text-gray-700"><span class="font-bold">Notas:</span> ${orden.notas}</p>` : ''}
        <p class="text-gray-700"><span class="font-bold">Pedido:</span> ${orden.items.map(i => i.nombre).join(', ')}</p>
        <p class="text-gray-700"><span class="font-bold">Pendiente:</span> $${orden.pendiente?.toFixed(2)}</p>
        <p class="text-gray-700"><span class="font-bold">Fecha:</span> ${fechaFormateada}</p>
      </div>
      <div class="grid grid-cols-3 gap-2">
        ${orden.estado === 'pendiente'
          ? `<button id="cobrarVisible${orden.id}" onclick="document.querySelector('#cobrarOrden${orden.id}').click()"
                class="bg-[#25D366] hover:bg-[#1DA851] text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
             <i class="fas fa-money-bill-wave mr-2"></i> Cobrar
           </button>
          <button id="cobroParcialVisible${orden.id}" onclick="document.querySelector('#cobroParcial${orden.id}').click()"
                class="bg-[#FFD700] hover:bg-[#E6C200] text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
             <i class="fas fa-hand-holding-usd mr-2"></i> Cobro parcial
           </button>`
          : `<button id="completarVisible${orden.id}" onclick="document.querySelector('#completarOrden${orden.id}').click()"
                class="bg-[#4ECDC4] hover:bg-[#3AAFA9] text-white py-2 px-4 rounded-full flex items-center justify-center order-button">
             <i class="fas fa-check mr-2"></i> Completar
           </button>`}
        <button onclick="document.querySelector('#detallesOrdenModal').classList.add('hidden')" 
                class="bg-gray-400 hover:bg-gray-500 text-white py-2 px-4 rounded-full order-button">
          <i class="fas fa-times mr-2"></i> Cerrar
        </button>
      </div>
    `;
    
    // Crear botones ocultos para manejar Cobrar y Completar
    if (orden.estado === 'pendiente') {
      const cobrarBtnHidden = document.createElement('button');
      cobrarBtnHidden.id = `cobrarOrden${orden.id}`;
      cobrarBtnHidden.style.display = 'none';
      cobrarBtnHidden.addEventListener('click', () => this.marcarComoPagada(orden.id!));
      this.el.nativeElement.appendChild(cobrarBtnHidden);

      // Botón oculto para cobrar parcialmente
      const cobrarParcialBtnHidden = document.createElement('button');
      cobrarParcialBtnHidden.id = `cobroParcial${orden.id}`;
      cobrarParcialBtnHidden.style.display = 'none';
      cobrarParcialBtnHidden.addEventListener('click', () => this.abrirCobroParcial(orden));
      this.el.nativeElement.appendChild(cobrarParcialBtnHidden);
    }
    const completarBtn = document.createElement('button');
    completarBtn.id = `completarOrden${orden.id}`;
    completarBtn.style.display = 'none';
    completarBtn.addEventListener('click', () => this.completarOrden(orden.id!));
    this.el.nativeElement.appendChild(completarBtn);
    
    // Mostrar el modal
    modal.classList.remove('hidden');
    // Enfocar el botón Completar en el modal de WhatsApp
    setTimeout(() => {
      const completarVisible = this.el.nativeElement.querySelector(`#completarVisible${orden.id}`);
      if (completarVisible) {
        completarVisible.focus();
      }
    }, 0);
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
      const ordenActual = this.obtenerOrdenPorId(ordenId);
      if (!ordenActual) return;
      const montoPendiente = ordenActual.pendiente ?? (ordenActual.total - (ordenActual.pagado || 0));
      if (montoPendiente <= 0) return; // Nada que cobrar

      const ordenRef = doc(this.firestore, 'ZonaYummyOrdenes', ordenId);

      await updateDoc(ordenRef, {
        estado: 'pagada',
        pagado: (ordenActual.pagado || 0) + montoPendiente,
        pendiente: 0
      });
      // Actualizar estadísticas sumando solo lo cobrado
      this.totalGanancias += montoPendiente;
      
      // Cerrar modal
      this.cerrarDetallesOrden();
    } catch (error) {
      console.error('Error al marcar como pagada la orden:', error);
    }
  }

  async cobrarParcial(ordenId: string): Promise<void> {
    const ordenActual = this.obtenerOrdenPorId(ordenId);
    if (!ordenActual) return;

    const pendiente = ordenActual.pendiente ?? (ordenActual.total - (ordenActual.pagado || 0));
    const input = prompt(`Monto a cobrar (pendiente $${pendiente.toFixed(2)})`, pendiente.toFixed(2));
    if (!input) return;
    const monto = parseFloat(input);
    if (isNaN(monto) || monto <= 0 || monto > pendiente) {
      alert('Monto inválido.');
      return;
    }

    try {
      const ordenRef = doc(this.firestore, 'ZonaYummyOrdenes', ordenId);
      const nuevoPagado = (ordenActual.pagado || 0) + monto;
      const nuevoPendiente = pendiente - monto;

      const updates: any = {
        pagado: nuevoPagado,
        pendiente: nuevoPendiente
      };
      if (nuevoPendiente <= 0) {
        updates.estado = 'pagada';
      }

      await updateDoc(ordenRef, updates);

      // Actualizar estadísticas localmente
      this.totalGanancias += monto;

      // Cerrar modal
      this.cerrarDetallesOrden();
    } catch (error) {
      console.error('Error en cobro parcial:', error);
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

  // Agregar método para eliminar todas las órdenes del historial para debug
  async eliminarTodasOrdenes(): Promise<void> {
    try {
      const deletes = this.historialOrdenes
        .filter(o => o.id)
        .map(o => deleteDoc(doc(this.firestore, 'ZonaYummyOrdenes', o.id!)));
      await Promise.all(deletes);
    } catch (error) {
      console.error('Error al eliminar todas las órdenes del historial:', error);
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

  /* =====================================================
     COBRO PARCIAL (UI + lógica de selección de items)
     ===================================================== */

  abrirCobroParcial(orden: Orden): void {
    this.ordenEnCobroParcial = orden;
    this.itemsSeleccionados.clear();
    this.modoMontoEspecifico = false;
    this.montoEspecifico = 0;
    this.cobroParcialVisible = true;
  }

  alternarItem(itemId: string, checked: boolean): void {
    if (checked) {
      this.itemsSeleccionados.add(itemId);
    } else {
      this.itemsSeleccionados.delete(itemId);
    }
  }

  confirmarCobroParcial(): void {
    if (!this.ordenEnCobroParcial) return;

    let montoCobro = 0;
    let itemsPagados: string[] = [];

    if (this.modoMontoEspecifico) {
      if (this.montoEspecifico <= 0 || this.montoEspecifico > this.getPendiente(this.ordenEnCobroParcial)) {
        alert('Monto inválido');
        return;
      }
      montoCobro = this.montoEspecifico;
    } else {
      if (this.itemsSeleccionados.size === 0) return;
      this.ordenEnCobroParcial.items.forEach(it => {
        if (!it.cobrado && this.itemsSeleccionados.has(it.id)) {
          montoCobro += it.precio;
          itemsPagados.push(it.id);
        }
      });
    }

    if (montoCobro === 0) return;

    // Persistir en Firestore
    const ordenId = this.ordenEnCobroParcial.id!;
    const ordenRef = doc(this.firestore, 'ZonaYummyOrdenes', ordenId);
    const pagosCol = collection(this.firestore, 'ZonaYummyOrdenes', ordenId, 'pagos');

    const batchOps: Promise<any>[] = [];
    batchOps.push(addDoc(pagosCol, {
      fecha: new Date(),
      monto: montoCobro,
      tipoPago: this.modoMontoEspecifico ? 'monto' : 'items',
      itemsPagados
    }));

    // Actualizar items cobrados y montos acumulados
    const nuevosItems = this.ordenEnCobroParcial.items.map(it => {
      if (itemsPagados.includes(it.id)) {
        return { ...it, cobrado: true };
      }
      return it;
    });

    const nuevoPagado = (this.ordenEnCobroParcial.pagado || 0) + montoCobro;
    const nuevoPendiente = Math.max(this.ordenEnCobroParcial.total - nuevoPagado, 0);

    batchOps.push(updateDoc(ordenRef, {
      items: nuevosItems,
      pagado: nuevoPagado,
      pendiente: nuevoPendiente,
      estado: nuevoPendiente === 0 ? 'pagada' : 'pendiente'
    }));

    Promise.all(batchOps).then(() => {
    // Actualizar estado local de la orden para reflejar ítems cobrados inmediatamente
      if (this.ordenEnCobroParcial) {
        this.ordenEnCobroParcial.items = nuevosItems;
        this.ordenEnCobroParcial.pagado = nuevoPagado;
        this.ordenEnCobroParcial.pendiente = nuevoPendiente;
      }
      this.totalGanancias += montoCobro;
      this.cobroParcialVisible = false;
      this.cerrarDetallesOrden();
    }).catch(err => {
      console.error('Error cobrando parcialmente', err);
      alert('Error al guardar el cobro parcial: ' + err.message);
      this.cancelarCobroParcial();
    });
  }

  cancelarCobroParcial(): void {
    this.cobroParcialVisible = false;
  }

  loadPlatillos(): void {
    this.platillosService.getPlatillos().subscribe({
      next: (data) => { this.platillos = data; },
      error: (error) => console.error('Error al cargar platillos:', error)
    });
  }
} 