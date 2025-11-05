# 🎯 Burbuja Flotante Draggable con Posición Persistente

## 📋 Descripción

La burbuja flotante de tarea actual ahora es **completamente movible verticalmente** mediante drag and drop, y **recuerda su posición** entre sesiones usando localStorage.

## ✨ Características Implementadas

### 🖱️ Drag and Drop
- ✅ Arrastrar con mouse (desktop)
- ✅ Arrastrar con touch (móviles/tablets)
- ✅ Movimiento vertical suave
- ✅ Limites: 5% - 95% del viewport (no se sale de la pantalla)
- ✅ Cursor cambia a "move" y "grabbing"
- ✅ Efecto visual de escala al arrastrar

### 💾 Persistencia
- ✅ Guarda automáticamente la posición al soltar
- ✅ Carga la posición guardada al iniciar
- ✅ Usa localStorage (persiste entre sesiones)
- ✅ Key: `currentTaskInfo_bubblePosition`
- ✅ Validación de posición (5% - 95%)

### 🎨 Indicador Visual
- ✅ Indicador "⋮⋮" en la parte superior de la burbuja
- ✅ Aparece más visible en hover
- ✅ Indica claramente que es arrastrable

## 🎮 Cómo Usar

### Desktop (Mouse)
1. **Hover sobre la burbuja** → Cursor cambia a "move" (↕️)
2. **Click y mantener** presionado en la burbuja
3. **Arrastrar verticalmente** hacia arriba o abajo
4. **Soltar** → La posición se guarda automáticamente
5. **Click normal** → Abre el modal (si no estás arrastrando)

### Móvil (Touch)
1. **Mantener presionado** sobre la burbuja
2. **Deslizar** verticalmente hacia arriba o abajo
3. **Soltar** → La posición se guarda automáticamente
4. **Tap normal** → Abre el modal (si no estás arrastrando)

## 🔧 Implementación Técnica

### Propiedades Agregadas

```typescript
// Posición vertical (% del viewport)
bubbleTopPosition: number = 50; // Default: 50% (centrado)

// Estado de drag
isDragging: boolean = false;

// Tracking de inicio de drag
private dragStartY: number = 0;
private dragStartTop: number = 0;
```

### Métodos Principales

#### `onBubbleMouseDown(event: MouseEvent)`
- Inicia el drag con mouse
- Previene comportamiento default
- Registra listeners de mousemove y mouseup

#### `onBubbleTouchStart(event: TouchEvent)`
- Inicia el drag con touch
- Maneja un solo touch (ignora multi-touch)
- Previene scroll del navegador durante drag

#### `startDrag(clientY: number)`
- Marca el inicio del drag
- Guarda posición inicial del mouse/touch
- Guarda posición inicial de la burbuja

#### `onDragMove(clientY: number)`
- Calcula el desplazamiento
- Convierte pixeles a porcentaje del viewport
- Aplica límites (5% - 95%)
- Actualiza posición en tiempo real

#### `endDrag()`
- Finaliza el drag
- Guarda la nueva posición en localStorage
- Limpia event listeners

#### `saveBubblePosition()`
- Guarda la posición en localStorage
- Key: `currentTaskInfo_bubblePosition`
- Log para debugging

#### `loadBubblePosition()`
- Carga la posición desde localStorage
- Valida que esté entre 5% y 95%
- Se ejecuta en ngOnInit

#### `onBubbleContentClick(event: Event)`
- Solo abre modal si NO se está arrastrando
- Previene conflicto entre drag y click

### Estilos CSS

#### Estado Normal
```css
.floating-bubble {
  cursor: move;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  touch-action: none;
}
```

#### Estado Dragging
```css
.floating-bubble.dragging {
  cursor: grabbing;
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  animation: none;
  transition: none;
}
```

#### Indicador de Drag
```css
.drag-indicator {
  position: absolute;
  top: 5px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}
```

### Posicionamiento Dinámico

La burbuja usa binding de estilo inline para la posición:

```html
<div class="floating-bubble"
     [style.top.%]="bubbleTopPosition">
```

El `top` se calcula como porcentaje del viewport, y el `transform: translateY(-50%)` centra la burbuja en ese punto.

## 📊 Límites y Validaciones

### Rango Permitido
- **Mínimo**: 5% del viewport (evita que se corte arriba)
- **Máximo**: 95% del viewport (evita que se corte abajo)
- **Default**: 50% (centrado verticalmente)

### Validación al Cargar
```typescript
if (typeof position === 'number' && position >= 5 && position <= 95) {
  this.bubbleTopPosition = position;
}
```

### Restricción durante Drag
```typescript
newTop = Math.max(5, Math.min(95, newTop));
```

## 🎯 Comportamiento Inteligente

### Diferenciación entre Drag y Click
El componente detecta si el usuario está arrastrando o haciendo click:

1. **Durante drag**: `isDragging = true`
2. **Al soltar después de mover**: No abre modal
3. **Click sin mover**: `isDragging` permanece false, abre modal

Esto previene que se abra el modal accidentalmente al arrastrar.

### Touch Events con Prevención de Scroll
```typescript
document.addEventListener('touchmove', handler, { passive: false });
```

Al usar `passive: false`, podemos llamar `preventDefault()` para evitar que el navegador haga scroll mientras arrastramos la burbuja.

## 🔄 Flujo de Eventos

### Inicio de Drag (Mouse)
```
mousedown → startDrag() → addEventListener('mousemove')
```

### Durante Drag
```
mousemove → onDragMove() → actualiza bubbleTopPosition
```

### Fin de Drag
```
mouseup → endDrag() → saveBubblePosition() → removeEventListeners
```

### Inicio de Drag (Touch)
```
touchstart → startDrag() → addEventListener('touchmove')
```

### Durante Drag (Touch)
```
touchmove → preventDefault() → onDragMove() → actualiza posición
```

### Fin de Drag (Touch)
```
touchend → endDrag() → saveBubblePosition() → removeEventListeners
```

## 💾 Persistencia en LocalStorage

### Estructura de Datos
```json
{
  "currentTaskInfo_bubblePosition": 45.5
}
```

### Cuando se Guarda
- Al terminar un drag (mouseup/touchend)
- Solo si la posición cambió

### Cuando se Carga
- En `ngOnInit()`
- Al iniciar el componente
- Si no hay posición guardada, usa default (50%)

### Limpieza
- No se limpia automáticamente
- Persiste entre sesiones del navegador
- Se puede limpiar manualmente desde DevTools

## 🎨 Estados Visuales

### Normal
- Cursor: `move` (↕️)
- Animación: pulse 2s infinite
- Escala: 1.0

### Hover
- Cursor: `move` (↕️)
- Escala: 1.1
- Indicador más visible

### Dragging
- Cursor: `grabbing` (✊)
- Escala: 1.1
- Sin animación (para mejor seguimiento)
- Sin transición (movimiento instantáneo)
- Sombra más pronunciada

## 📱 Responsive

### Desktop (>768px)
- Burbuja: 80px × 80px
- Posición: 20px del borde derecho
- Totalmente funcional

### Móvil (≤768px)
- Burbuja: 60px × 60px (del CSS anterior)
- Posición: 10px del borde derecho
- Touch drag completamente funcional
- Previene scroll durante drag

## 🐛 Manejo de Errores

### Try-Catch en Save/Load
```typescript
try {
  localStorage.setItem(...);
} catch (error) {
  console.error('Error al guardar...', error);
}
```

Protege contra:
- LocalStorage lleno
- LocalStorage deshabilitado
- Errores de JSON.parse
- Modo privado/incógnito con restricciones

## ⚡ Performance

### Optimizaciones
- ✅ No usa polling, solo eventos
- ✅ Transiciones deshabilitadas durante drag
- ✅ Animaciones pausadas durante drag
- ✅ Event listeners se limpian después de usar
- ✅ Validación de posición eficiente

### Memoria
- ✅ Event listeners removidos en cleanup
- ✅ Sin memory leaks
- ✅ Variables privadas para evitar exposición

## 🔍 Debugging

### Console Logs
```
Posición de burbuja guardada: 45.5
Posición de burbuja cargada: 45.5
```

### Chrome DevTools
1. **Inspeccionar** la burbuja flotante
2. **Verificar** el estilo inline `top: XX%`
3. **Ver** localStorage: Application → Local Storage
4. **Editar** manualmente la posición en DevTools

### Testing
```javascript
// En la consola del navegador:
localStorage.getItem('currentTaskInfo_bubblePosition')
// → "45.5"

localStorage.setItem('currentTaskInfo_bubblePosition', '20')
// Recargar página para ver efecto
```

## 🎯 Casos de Uso

1. **Usuario alto**: Prefiere la burbuja arriba (10-20%)
2. **Usuario bajo**: Prefiere la burbuja abajo (80-90%)
3. **Múltiples tareas**: Mueve la burbuja para no obstruir contenido
4. **Dispositivo horizontal**: Ajusta posición según orientación
5. **Preferencia personal**: Cada usuario puede personalizarla

## 🚀 Mejoras Futuras Posibles

### Funcionalidades Adicionales
- [ ] Drag horizontal (izquierda/derecha)
- [ ] Snap a posiciones predefinidas
- [ ] Animación al soltar (ease-out)
- [ ] Doble tap para resetear posición
- [ ] Gesture de "sacudir" para centrar
- [ ] Modo "siempre centrado" en configuración
- [ ] Múltiples posiciones guardadas por dispositivo

### UI/UX
- [ ] Haptic feedback en móviles
- [ ] Sonido sutil al mover
- [ ] Trail/rastro visual durante drag
- [ ] Indicador de límites al acercarse a bordes
- [ ] Tutorial interactivo al primer uso

## 📝 Notas Adicionales

### Compatibilidad con Scroll Cache
✅ **Compatible**: Esta funcionalidad NO interfiere con el sistema de guardar posición de scroll del task-tracker que ya existía.

Ambos sistemas usan keys diferentes en localStorage:
- Scroll: `taskTracker_scrollPosition`
- Burbuja: `currentTaskInfo_bubblePosition`

### Accesibilidad
⚠️ **Considerar**: Agregar navegación por teclado para usuarios que no usen mouse/touch.

### Testing Recomendado
1. ✅ Arrastrar en diferentes dispositivos
2. ✅ Verificar límites (arriba/abajo)
3. ✅ Comprobar que se guarda la posición
4. ✅ Recargar página y verificar que carga
5. ✅ Verificar que click normal sigue funcionando
6. ✅ Probar con touch en móvil real

