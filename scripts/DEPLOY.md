# Deploy aislado de clientes

`npm run deploy` funciona desde la terminal y desde el botón de admin_cursor.
El despliegue no cambia el modo dev/prod, la configuración activa de Nginx ni PM2.
Requiere Linux (renameat2), Python 3.11+, Node/npm, rsync y acceso al destino.

Cada ejecución captura las fuentes locales, incluidos cambios sin commit,
configuración local y archivos manuales de public. Instala dependencias con
`npm ci --include=dev` exclusivamente en la copia privada. Los package-lock.json
se versionan; no se usa npm install como fallback. Git, node_modules, builds y
cachés no se copian. Los enlaces simbólicos en fuentes se rechazan para evitar
que el build termine leyendo un proyecto dev fuera de la captura.

La configuración está en deploy.config.json:

- localProjects: nombres de repositorios hermanos que se capturan y se instalan.
  Los clientes Vite ya incluyen edalxgoam_components; la galería no se incluye a sí
  misma. Se preserva la distribución de carpetas. No se compila la galería para
  desplegar un consumidor: se compilan las fuentes que importa el cliente.
- sourceSubdir: raíz del cliente dentro del repositorio (por defecto `.`).
- outputDir: resultado del build, relativo al cliente (por defecto `dist`).
- webRoot: ruta que sirve Nginx; WEB_ROOT permite usar un destino alternativo.
- publicMode: `move` para Vite, que omite su copia automática solo durante deploy;
  `native` para Angular/CRA, que mantienen su tratamiento de public.
- publicTemplates: archivos transformados por el framework que no se comparan
  byte a byte con public, como index.html de CRA.
- requiredPublic: patrones que deben tener al menos un archivo. Vacío permite
  desplegar clientes sin APK; los APK añadidos después se incorporan automáticamente.
- excludePublic: exportaciones antiguas que no deben publicarse. Solo se eliminan
  de la copia privada; nunca del directorio original.
- keepReleases: versiones conservadas, con un mínimo de dos.

Todos los archivos públicos no transformados se verifican por SHA-256. Los APK
van de public/apk a /apk en el sitio, sin compilarlos ni incluirlos en Git.
También se admiten APK en la raíz de public y otros subdirectorios. Se reemplazan
los archivos correspondientes al activar cada versión. Cambios posteriores a la
captura se incorporan en el siguiente deploy. Los assets generados se validan
antes de modificar producción; la ausencia de index.html o sus recursos aborta.

Las versiones se guardan junto al destino, en <nombre-destino>-releases. Nginx
sigue usando la misma ruta, que pasa a ser un enlace a la versión activa. El primer
deploy intercambia atómicamente el directorio anterior con un enlace y conserva
el directorio como legacy-*. Después, cada deploy reemplaza el enlace de una sola
vez. Los fallos previos a la activación conservan la producción anterior. El
bloqueo por destino rechaza una segunda ejecución desde cualquier pestaña o CLI.

Se conserva además el código JS/CSS de la compilación anterior para las pestañas
ya abiertas. Pestañas de versiones aún más antiguas pueden necesitar recargar.
El respaldo legacy inicial no se elimina automáticamente. deploy-info.json
identifica la versión, lockfiles y hashes públicos.

En dev, Vite/CRA/Angular siguen ejecutándose con sus dependencias originales. Al
apagar dev, admin_cursor restaura Nginx y este encuentra el enlace con la última
versión. En producción, la activación del enlace actualiza inmediatamente el
contenido servido sin recargar Nginx.

Los alias de los consumidores Vite apuntan a la copia capturada de
edalxgoam_components durante el deploy. React y las dependencias compartidas que
el consumidor instala se resuelven desde el consumidor; las demás se resuelven
con las dependencias del proyecto compartido. Esto no convierte APIs de React 19
en compatibles con React 18. Angular y CRA conservan sus compiladores y sus
restricciones de importación: agregar una dependencia local al deploy no adapta
componentes React para Angular ni elimina el límite src de CRA. El cliente antiguo
actualmente utiliza componentes copiados dentro de src. Su build y sus pasos
prebuild se ejecutan únicamente en la copia privada.

Cada repositorio lleva la misma implementación y pruebas, junto con su configuración.
Para probar otro destino: `WEB_ROOT=/tmp/client-preview/dist npm run deploy`.
Pruebas: `python3 -m unittest discover -s scripts/tests -v` (rsync real, build simulado).
Para revertir, crear un enlace temporal a una versión conservada y reemplazar el
actual con `mv -Tf`, manteniendo el bloqueo .<nombre-destino>.deploy.lock.
