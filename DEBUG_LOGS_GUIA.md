# 🔍 Guía de Logs de Debugging

## 📜 Sistema de Scroll

### Logs al Iniciar
```
🎬 CONFIGURANDO listener de scroll...
✅ Listener de scroll agregado
✅ Listener de beforeunload agregado
```
**Significado**: El sistema de scroll se configuró correctamente.

### Logs al Hacer Scroll
```
📜 Evento scroll detectado, posición actual: 1234
⏰ Timeout completado, guardando scroll...
🔵 GUARDANDO posición de scroll: 1234
✅ Scroll guardado en localStorage
```
**Significado**: El scroll se está detectando y guardando correctamente.

### Logs al Restaurar (al recargar página)
```
🔍 INTENTANDO restaurar posición de scroll...
📦 Valor guardado en localStorage: "1234"
📊 Posición parseada: 1234 Tipo: number
✅ Posición válida, aplicando scroll a: 1234
⏱️ Ejecutando scrollTo después del timeout...
✅ Scroll aplicado, posición actual: 1234
🗑️ Posición limpiada de localStorage
```
**Significado**: El scroll se está restaurando correctamente.

### Posibles Problemas del Scroll

#### ❌ No se detectan eventos de scroll
```
🎬 CONFIGURANDO listener de scroll...
✅ Listener de scroll agregado
(No aparecen logs "📜 Evento scroll detectado")
```
**Causa**: El CSS con `position: fixed` en body/html previene eventos de scroll en window.
**Solución**: Cambiar el listener de `window` a otro elemento scrolleable.

#### ❌ Se guarda pero no se restaura
```
🔍 INTENTANDO restaurar posición de scroll...
ℹ️ No hay posición guardada en localStorage
```
**Causa**: El scroll se limpia antes de poder restaurarse, o hay un problema de timing.
**Solución**: Revisar si hay algo que limpia localStorage antes de tiempo.

#### ❌ Se restaura pero vuelve a 0
```
✅ Scroll aplicado, posición actual: 1234
(Inmediatamente después)
✅ Scroll aplicado, posición actual: 0
```
**Causa**: El DOM no está completamente renderizado cuando se aplica el scroll.
**Solución**: Aumentar el timeout o esperar a otro evento del ciclo de vida.

---

## 🎯 Sistema de Burbuja Flotante

### Logs al Iniciar
```
Posición de burbuja cargada: 45.5
```
**Significado**: Se cargó la posición guardada anteriormente (45.5% del viewport).

### Logs al Hacer Click Normal
```
🖱️ MouseDown en burbuja
🖱️ MouseUp, hasMoved: false
👆 Click detectado, abriendo modal
🔄 toggleModal llamado, estado actual: false
✅ Modal ahora está: ABIERTO
```
**Significado**: Click funcionando correctamente, modal se abre.

### Logs al Hacer Drag
```
🖱️ MouseDown en burbuja
✊ Movimiento detectado, iniciando drag
📍 Moviendo burbuja a: 46.2%
📍 Moviendo burbuja a: 47.8%
📍 Moviendo burbuja a: 49.1%
🖱️ MouseUp, hasMoved: true
🏁 Finalizando drag
Posición de burbuja guardada: 49.1
```
**Significado**: Drag funcionando correctamente, posición guardada.

### Logs al Hacer Touch (Móvil)
```
👆 TouchStart en burbuja
✊ Movimiento touch detectado, iniciando drag
📍 Moviendo burbuja a: 52.3%
👆 TouchEnd, hasMoved: true
🏁 Finalizando drag
Posición de burbuja guardada: 52.3
```
**Significado**: Touch drag funcionando correctamente.

### Posibles Problemas de la Burbuja

#### ❌ No se abre el modal al hacer click
```
🖱️ MouseDown en burbuja
(No hay más logs)
```
**Causa**: El evento mouseUp no se está disparando, o hay un preventDefault mal colocado.
**Solución**: Verificar que no haya otros event listeners interfiriendo.

#### ❌ Se detecta movimiento cuando solo se hace click
```
🖱️ MouseDown en burbuja
✊ Movimiento detectado, iniciando drag
🖱️ MouseUp, hasMoved: true
```
**Causa**: El threshold de 5 pixeles es muy sensible, o hay vibración en el input.
**Solución**: Aumentar el threshold de 5 a 10 pixeles.

#### ❌ No se guarda la posición
```
🏁 Finalizando drag
(No aparece log "Posición de burbuja guardada")
```
**Causa**: Error en localStorage (lleno, deshabilitado, modo privado).
**Solución**: Verificar console.error para ver el error específico.

---

## 🧪 Cómo Usar Esta Guía

### 1. Abre la Consola del Navegador
- Chrome/Edge: F12 → Tab "Console"
- Firefox: F12 → Tab "Consola"
- Safari: Cmd+Option+C

### 2. Prueba el Scroll
1. **Haz scroll** en la página
2. **Busca en consola**: `📜 Evento scroll detectado`
3. **Espera 250ms** sin scrollear
4. **Busca**: `🔵 GUARDANDO posición de scroll`
5. **Recarga la página** (F5)
6. **Busca**: `🔍 INTENTANDO restaurar posición de scroll`

### 3. Prueba la Burbuja
1. **Haz click normal** en la burbuja
2. **Busca en consola**: `👆 Click detectado, abriendo modal`
3. **Cierra el modal**
4. **Arrastra la burbuja** verticalmente
5. **Busca**: `✊ Movimiento detectado, iniciando drag`
6. **Suelta**
7. **Busca**: `Posición de burbuja guardada`
8. **Recarga la página**
9. **Busca**: `Posición de burbuja cargada`

---

## 📊 Interpretación de Emojis

| Emoji | Significado |
|-------|-------------|
| 🎬 | Inicialización / Setup |
| ✅ | Operación exitosa |
| 📜 | Evento de scroll |
| 🔵 | Guardando datos |
| 🔍 | Buscando / Intentando cargar |
| 📦 | Datos en localStorage |
| 📊 | Datos procesados |
| ⏱️ | Timeout / Espera |
| 🗑️ | Limpieza de datos |
| 🖱️ | Evento de mouse |
| 👆 | Evento de touch / Click |
| ✊ | Drag iniciado |
| 📍 | Actualización de posición |
| 🏁 | Finalización |
| 🔄 | Toggle / Cambio de estado |
| ⚠️ | Advertencia |
| ❌ | Error |

---

## 🔧 Solución Rápida de Problemas

### Problema: El scroll no se guarda

**Verificar:**
1. ¿Aparece `🎬 CONFIGURANDO listener de scroll`?
   - ❌ No → El componente no se está inicializando
   - ✅ Sí → Continuar

2. ¿Aparece `📜 Evento scroll detectado` al hacer scroll?
   - ❌ No → El CSS está bloqueando el scroll en window
   - ✅ Sí → Continuar

3. ¿Aparece `🔵 GUARDANDO posición de scroll`?
   - ❌ No → El timeout no se está completando
   - ✅ Sí → Continuar

4. ¿Aparece `✅ Scroll guardado en localStorage`?
   - ❌ No → Problema con localStorage
   - ✅ Sí → El guardado funciona

### Problema: El modal no se abre

**Verificar:**
1. ¿Aparece `🖱️ MouseDown en burbuja` al hacer click?
   - ❌ No → El evento no se está capturando
   - ✅ Sí → Continuar

2. ¿Aparece `🖱️ MouseUp, hasMoved: false`?
   - ❌ No → El mouseUp no se dispara
   - ✅ Sí → Continuar

3. ¿Aparece `👆 Click detectado, abriendo modal`?
   - ❌ No → La lógica de detección de click falló
   - ✅ Sí → Continuar

4. ¿Aparece `🔄 toggleModal llamado`?
   - ❌ No → toggleModal no se está llamando
   - ✅ Sí → Continuar

5. ¿Aparece `✅ Modal ahora está: ABIERTO`?
   - ❌ No → Error en toggleModal
   - ✅ Sí → El modal debería estar visible

---

## 🐛 Reporte de Bug

Si encuentras un problema, copia estos logs de la consola:

```
=== INICIO DE LOGS ===
[Copia todos los logs relevantes aquí]
=== FIN DE LOGS ===
```

Incluye también:
- ✅ Navegador y versión
- ✅ Dispositivo (Desktop/Móvil)
- ✅ Pasos para reproducir
- ✅ Comportamiento esperado
- ✅ Comportamiento actual

---

## 💡 Tips

### Filtrar Logs
En la consola del navegador, puedes filtrar logs escribiendo:
- `scroll` - Ver solo logs de scroll
- `burbuja` o `MouseDown` - Ver solo logs de burbuja
- `modal` - Ver solo logs del modal

### Limpiar Consola
- Chrome/Edge/Firefox: Click en el icono 🚫 o Ctrl+L
- O escribe: `console.clear()`

### Ver localStorage
1. F12 → Tab "Application" (Chrome) o "Almacenamiento" (Firefox)
2. Expandir "Local Storage"
3. Click en tu dominio
4. Buscar:
   - `taskTracker_scrollPosition`
   - `currentTaskInfo_bubblePosition`

---

## 🎯 Próximos Pasos

Una vez que veas los logs y determines el problema:

1. **Si el scroll no se detecta**: Necesitamos cambiar de `window.addEventListener` a un listener en el elemento scrolleable correcto.

2. **Si el modal no se abre**: Revisaremos la lógica de detección de click vs drag.

3. **Si todo funciona**: ¡Perfecto! Podemos quitar los logs o dejarlos para debugging futuro.

