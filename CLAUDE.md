# Multiplica Racing: instrucciones para Claude

Videojuego 3D de conducción para aprender las tablas de multiplicar (niños de unos 7 años).
Stack: Vite · TypeScript · Three.js · HTML/CSS. Sin recursos externos: gráficos y sonido se generan por código.
Para el uso y la descripción general, ver [README.md](README.md).

## Idioma y trato
- Responder, comentar el código, escribir commits y documentación en español.
- La persona que lleva el proyecto no es programadora: explicar las decisiones en lenguaje claro y sin jerga innecesaria.

## Reglas de trabajo
- **Pensar antes de tocar:** en tareas difíciles (lógica compleja, varios archivos, fallos raros) enseñar primero un plan corto y no editar hasta que se apruebe.
- **Cambios pequeños y claros:** se pueden hacer directamente.
- **No reescribir código que funciona** si no se ha pedido. Cambios acotados, un commit por corrección.
- **Nada inventado:** antes de usar una librería o versión, comprobar la documentación oficial. No inventar opciones de configuración ni nombres de archivos.
- **Antes de cambiar la dificultad** (`speed`, `decisionTime` en `src/game/config.ts`), revisar `fogFar` y `cutU`: `npm test` comprueba que el final de la rama equivocada quede oculto por la niebla.
- **Siempre:** `npm test` y `npm run build` tienen que pasar antes de dar un cambio por bueno.

## Comandos
- `npm install`: instalar dependencias (usa el `package-lock.json`).
- `npm run dev -- --port 5180`: servidor de desarrollo en http://localhost:5180.
- `npm test`: 25 pruebas de la lógica.
- `npm run build`: comprueba tipos y genera `dist/`.

## Aprendido
- **El puerto 5173 puede estar ocupado** por otra aplicación ajena a este proyecto. Por eso el juego se arranca en el puerto 5180 (ver comando arriba).
- **Git:** el repositorio se creó con un primer commit "versión inicial". El usuario de Git de este repositorio es local y genérico; no tiene datos personales.
- **Avisos LF/CRLF** al hacer `git add` en Windows: son informativos, no cambian el contenido.
- **`npm audit`:** los 5 avisos "high" están solo en herramientas de desarrollo (Vite/Vitest). Las dependencias que se publican no tienen vulnerabilidades. No usar `npm audit fix --force` sin revisarlo antes.
- **Carpetas generadas** (`node_modules/`, `dist/`) están en `.gitignore`; no subirlas ni editarlas a mano.
- **Publicación:** repositorio `galletin500/multiplica-racing` en GitHub; Netlify publica `multiplica-racing.netlify.app` en cada `git push` a `main`. Subir cambios publica en la web en vivo: confirmar antes.
- **Icono y app instalable:** fuentes en `public/icons/icon.svg`; los PNG se generaron con Chrome sin interfaz. Manifiesto en `public/manifest.webmanifest`. Guía de instalación en `src/ui/instalar.ts`. Para probar la versión móvil en el ordenador, Chrome sin interfaz no baja de unos 500 px de ancho: meter la página en un marco de 390 px.
- **Copia de seguridad inicial:** `multiplica-racing-copia-inicial` en el Escritorio, junto a esta carpeta (sin `node_modules` ni `dist`).
