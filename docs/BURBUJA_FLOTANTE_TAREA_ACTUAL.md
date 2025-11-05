# 🔵 Burbuja Flotante de Tarea Actual

## 📋 Descripción

Se ha transformado el componente `current-task-info` de un banner completo que ocupaba mucho espacio en una burbuja flotante minimalista y elegante que muestra información en tiempo real sobre la tarea actual o próxima.

## ✨ Características

### 🎯 Burbuja Flotante
- **Ubicación**: Lado derecho de la pantalla, centrada verticalmente
- **Tamaño**: 80px × 80px (70px en móviles)
- **Animación**: Efecto pulse suave cada 2 segundos
- **Interactividad**: Hover con escala 1.1x

### 🎨 Estados Visuales

#### Con Tarea Actual (Verde)
- **Color**: Gradiente verde (#10b981 → #059669)
- **Icono**: Play circle (▶️)
- **Muestra**: Minutos restantes de la tarea actual
- **Label**: "RESTANTE"

#### Sin Tarea Actual (Azul/Índigo)
- **Color**: Gradiente azul (#6366f1 → #4f46e5)
- **Icono**: Reloj (🕐)
- **Muestra**: Tiempo hasta la próxima tarea
- **Label**: "PRÓXIMA"

#### Sin Tareas
- **Muestra**: "--"
- **Label**: "SIN TAREAS"

### 📊 Formato de Tiempo en la Burbuja

**Con tarea actual:**
- Menos de 60 min: `45m`, `12m`, `1m`
- 60+ minutos: `2:30`, `1:15`, etc.

**Próxima tarea:**
- Menos de 60 min: `45m`
- Menos de 24h: `5h`
- 24h o más: `2d`

### 💬 Modal Expandido

Al hacer **click en la burbuja**, se abre un modal completo con:

#### Sección 1: Tarea Actual
- Emoji y nombre
- Proyecto asociado
- Tiempo transcurrido
- Tiempo restante
- Prioridad (badge de color)
- Barra de progreso animada

#### Sección 2: Siguiente Tarea
- Emoji y nombre
- Proyecto asociado
- Tiempo hasta que comience
- Duración estimada
- Horario (inicio - fin)

#### Características del Modal
- Fondo semi-transparente (backdrop)
- Click fuera para cerrar
- Botón X para cerrar
- Animaciones suaves (fade in + slide up)
- Scroll habilitado si el contenido es largo
- Previene scroll del body mientras está abierto
- Responsive en móviles

## 🎭 Interacciones

### Hover sobre la Burbuja
- Escala aumenta a 1.1x
- Sombra más pronunciada
- Transición suave (0.3s cubic-bezier)

### Tooltip
Muestra información rápida al pasar el mouse:
- Con tarea actual: `"Tarea actual: [nombre]\nClick para ver detalles"`
- Sin tarea: `"Próxima tarea: [nombre]\nClick para ver detalles"`
- Sin tareas: `"No hay tareas programadas\nClick para ver detalles"`

## 📱 Responsive

### Desktop (>768px)
- Burbuja: 80px × 80px
- Posición: 20px del borde derecho
- Icono: 20px
- Tiempo: 14px

### Móvil (≤768px)
- Burbuja: 70px × 70px
- Posición: 15px del borde derecho
- Icono: 18px
- Tiempo: 12px
- Label: 7px

## 🔄 Actualización en Tiempo Real

- **Intervalo**: Actualiza cada 30 segundos
- **Detección automática**: Cambia entre "tarea actual" y "próxima tarea"
- **Reactivo**: Responde a cambios en las tareas via `@Input()`

## 🛡️ Manejo de Estados

### Sin tareas programadas
- Burbuja muestra "--"
- Modal muestra mensaje informativo
- Color azul/índigo

### Transición de tareas
- Detección automática cuando termina la tarea actual
- Cambio suave de color (verde → azul)
- Cambio de icono (play → clock)

### Tarea vencida
- Si la tarea actual ya pasó su hora de fin, se muestra como completada
- Busca automáticamente la siguiente tarea pendiente

## 🎨 Código de Colores

### Prioridades (en el modal)
- **Low**: Verde #10b981
- **Medium**: Naranja #f59e0b
- **High**: Rojo #ef4444
- **Critical**: Rojo oscuro #dc2626

### Animaciones
```css
pulse: 2s infinite
fadeIn: 0.2s ease-out
slideUp: 0.3s ease-out
hover scale: 0.3s cubic-bezier(0.4, 0, 0.2, 1)
```

## 🚀 Beneficios

### Antes
- ❌ Ocupaba ~200px de altura
- ❌ Siempre visible
- ❌ No se podía ocultar
- ❌ Reducía espacio útil

### Después
- ✅ Solo 80px de diámetro flotante
- ✅ No ocupa espacio en el flujo del documento
- ✅ Información siempre accesible con un click
- ✅ Más espacio para las tarjetas de tareas
- ✅ Experiencia visual más limpia
- ✅ Animaciones elegantes

## 🔧 Implementación Técnica

### z-index Hierarchy
- Burbuja flotante: `z-index: 1000`
- Modal backdrop: `z-index: 2000`

### Posicionamiento
```css
position: fixed;
right: 20px;
top: 50%;
transform: translateY(-50%);
```

### Prevención de Scroll
Cuando el modal está abierto:
```typescript
document.body.style.overflow = 'hidden';
```

Al cerrar o destruir el componente:
```typescript
document.body.style.overflow = '';
```

## 📝 Logs de Consola

El componente mantiene logs para debugging:
- "Actualizando información de tareas..."
- Hora actual en ISO
- Total de tareas
- Detalles de cada tarea evaluada
- Tarea actual encontrada
- Siguiente tarea encontrada

## 🎯 Casos de Uso

1. **Usuario trabajando**: Ve de un vistazo cuánto tiempo le queda
2. **Entre tareas**: Ve cuándo comienza la siguiente
3. **Planificación**: Click para ver detalles completos
4. **Móvil**: Burbuja más pequeña pero igualmente funcional
5. **Sin distracciones**: La burbuja no interrumpe el flujo visual

## ⚡ Performance

- **Actualización ligera**: Solo cada 30 segundos
- **No re-renderiza todo**: Solo actualiza los valores necesarios
- **Animaciones optimizadas**: CSS con GPU acceleration
- **Cleanup apropiado**: Limpia intervals y estilos al destruirse

## 🎨 Personalización Futura Posible

- Permitir arrastrar la burbuja a otra posición
- Cambiar tamaño de la burbuja en settings
- Sonido de notificación cuando empieza/termina una tarea
- Integración con notificaciones del navegador
- Modo "focus" que oculta la burbuja temporalmente

