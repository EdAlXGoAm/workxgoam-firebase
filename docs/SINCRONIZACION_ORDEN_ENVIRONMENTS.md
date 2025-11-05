# Sincronización del Orden de Environments entre Dispositivos

## 📋 Descripción General

Se ha implementado un sistema de sincronización del orden personalizado de los ambientes (environments) entre dispositivos, permitiendo guardar y cargar la configuración desde la base de datos Firebase.

## 🔧 Cambios Implementados

### 1. Modelo de Datos (`environment.model.ts`)
- **Campo agregado**: `customOrder?: number`
- Campo opcional para mantener compatibilidad hacia atrás
- Almacena el orden personalizado de cada environment

### 2. Servicio (`environment.service.ts`)
- ✅ **Sin cambios necesarios** - El método `updateEnvironment()` ya acepta `Partial<Environment>`, por lo que soporta el nuevo campo automáticamente
- Mantiene compatibilidad completa con la versión anterior

### 3. Componente (`task-tracker.component.ts`)

#### Nuevas Propiedades:
```typescript
isSavingOrderToDatabase: boolean = false;
isLoadingOrderFromDatabase: boolean = false;
orderSyncMessage: string = '';
orderSyncMessageType: 'success' | 'error' | 'info' = 'info';
```

#### Nuevos Métodos:

##### `saveOrderToDatabase()`
- Guarda el orden actual (de `environmentCustomOrder`) en la base de datos
- Actualiza el campo `customOrder` de cada environment
- Muestra feedback visual al usuario

##### `loadOrderFromDatabase()`
- Carga el orden desde la base de datos
- Pide confirmación antes de sobrescribir el orden local
- Aplica el orden cargado y lo guarda en localStorage
- Inicializa orden para environments nuevos que no tengan orden guardado

##### `showOrderSyncMessage()`
- Muestra mensajes de feedback al usuario
- Auto-oculta mensajes después de 4 segundos
- Tipos: success, error, info

### 4. Interfaz de Usuario (`board-view.ts`)

#### Nueva Sección de Sincronización Compacta
Integrada dentro del componente Board View, ubicada justo después de la línea del tiempo y antes de las tarjetas de environments:

**Botones:**
- **"Guardar"** (azul) - Guarda el orden actual en la base de datos
- **"Cargar"** (púrpura) - Carga el orden desde la base de datos

**Características:**
- Diseño compacto y discreto con fondo gris claro
- Estados de loading con spinners
- Mensajes de feedback con colores según el tipo
- Deshabilitación mientras se ejecuta una operación
- **Responsive optimizado:**
  - Desktop: Muestra iconos + texto ("Guardar" / "Cargar")
  - Móvil: Solo muestra emojis (💾 📥) para ahorrar espacio
- Solo aparece en la vista de tablero (Board)

## 🔄 Flujo de Uso

### Guardar Orden:
1. Usuario organiza los environments en el orden deseado usando las flechas ↑↓
2. Click en "Guardar en BD"
3. El sistema guarda el orden en Firebase
4. Mensaje de confirmación aparece

### Cargar Orden:
1. Usuario abre la aplicación en un nuevo dispositivo
2. Click en "Cargar de BD"
3. Confirmación de sobrescritura del orden local
4. El sistema carga y aplica el orden desde Firebase
5. Mensaje de confirmación aparece

## 🛡️ Compatibilidad

### Hacia Atrás:
- ✅ El campo `customOrder` es opcional
- ✅ Environments antiguos sin este campo funcionarán normalmente
- ✅ El sistema de orden local (localStorage) sigue funcionando
- ✅ No hay cambios breaking en el servicio

### Hacia Adelante:
- ✅ Nuevos environments se les asignará orden automáticamente
- ✅ El orden se puede sincronizar cuando el usuario lo desee
- ✅ Cada dispositivo mantiene su orden local hasta que se cargue de BD

## 🔐 Seguridad

- Las operaciones requieren usuario autenticado
- Solo se pueden modificar environments del usuario actual
- Validación en el servicio mediante `AuthService`

## 📝 Notas Técnicas

1. **Arquitectura de Componentes**:
   - Los botones están integrados dentro del `BoardViewComponent`
   - Nuevos @Input: `isSavingOrderToDatabase`, `isLoadingOrderFromDatabase`, `orderSyncMessage`, `orderSyncMessageType`
   - Nuevos @Output: `saveOrderToDatabase`, `loadOrderFromDatabase`
   - La lógica permanece en `TaskTrackerComponent` (parent)
   - Comunicación mediante eventos emitidos hacia arriba

2. **localStorage vs Base de Datos**:
   - localStorage: Orden local del dispositivo (rápido, automático)
   - Base de Datos: Orden sincronizable entre dispositivos (manual, explícito)

3. **Manejo de Conflicts**:
   - El último guardado sobrescribe
   - Usuario debe decidir conscientemente cuándo cargar/guardar

4. **Performance**:
   - Operaciones asíncronas no bloquean la UI
   - Estados de loading claros para el usuario
   - Timeouts configurados para mensajes de feedback

## 📱 Diseño Compacto y Optimizado

### Desktop (≥640px)
- Barra horizontal con fondo gris claro
- Texto completo: "Sincronizar orden:" + botones con texto
- Altura: ~40px (padding py-2)
- Botones: Iconos FontAwesome + texto descriptivo

### Móvil (<640px)
- Texto reducido: "Sincronizar:"
- Botones ultra-compactos: Solo emojis (💾 📥)
- Ahorra espacio visual crítico en pantallas pequeñas
- Tooltips disponibles al mantener presionado

### Ubicación Estratégica
- **Dentro del componente Board View**
- Justo después de la Línea del Tiempo integrada
- Justo antes de las tarjetas de environments
- Solo visible en vista Board (no en Timeline)
- No interfiere con el flujo de navegación
- Discreto pero accesible cuando se necesita
- Mantiene coherencia visual dentro del panel de tablero

## 🎯 Casos de Uso

1. **Multi-Dispositivo**: Usuario trabaja en computadora de escritorio y laptop
2. **Backup**: Usuario quiere respaldar su configuración de orden
3. **Compartir**: Configurar orden en un dispositivo y replicarlo en otros
4. **Restaurar**: Recuperar orden después de limpiar caché del navegador
5. **Móviles**: Diseño optimizado que no ocupa espacio innecesario en pantallas pequeñas

## ⚠️ Consideraciones

- Los usuarios deben hacer clic manualmente para sincronizar
- No hay sincronización automática en tiempo real (diseño intencional)
- Cada dispositivo mantiene independencia hasta que el usuario decida sincronizar
- Se recomienda guardar después de reorganizar environments importantes

