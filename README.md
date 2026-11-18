# MULTIPLICA RACING 🏎️

Videojuego 3D de conducción para aprender las tablas de multiplicar (niños de ~7 años).
El coche avanza solo; en cada bifurcación en Y hay una multiplicación y dos resultados.
Eliges la carretera correcta en **5 segundos** (sin cronómetro visible) o el coche cae por el precipicio.

Tecnologías: Vite · TypeScript · Three.js · HTML/CSS. Sin recursos externos: gráficos, texturas y sonido se generan por código.

## Ponerlo en marcha (Visual Studio Code)

1. Instala [Node.js](https://nodejs.org) 20 o superior.
2. En VS Code: *Archivo → Abrir carpeta…* y elige esta carpeta.
3. Abre la terminal (`Ctrl+ñ`) y ejecuta:
   ```bash
   npm install
   npm run dev
   ```
4. Abre **http://localhost:5173** en Chrome. Pulsa JUGAR, elige una tabla y conduce.

**Probar en el móvil** (mismo wifi): `npm run dev -- --host` y abre en el móvil la dirección "Network" que aparezca.

## Controles
- Ordenador: flechas ← → (o A / D), o clic en la mitad izquierda/derecha de la pantalla.
- Móvil: dos botones grandes IZQUIERDA / DERECHA.
- El juego se pausa solo si la pestaña pierde el foco.

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Pruebas automáticas de la lógica (25) |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run preview` | Sirve `dist/` para probar la versión final |

## Publicar en GitHub y Netlify
```bash
git init
git add .
git commit -m "Multiplica Racing"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/multiplica-racing.git
git push -u origin main
```
En Netlify: *Add new site → Import from Git* y elige el repositorio. `netlify.toml` ya configura
`npm run build` y la carpeta `dist`. (Alternativa: ejecuta `npm run build` y arrastra `dist/` a Netlify Drop.)

## Estructura
```
src/game/config.ts          velocidad, tiempo de decisión (16 u/s × 5 s = 80 u), geometría
src/game/multiplication.ts  generador de multiplicaciones y respuestas
src/game/track.ts           trazado de la carretera y de la Y (matemática pura)
src/game/clock.ts           reloj de juego (tope de dt, pausa) y plazo de decisión
src/game/sim.ts             estados de partida, elección, acierto/fallo, caída, victoria
src/game/score.ts           puntuación
src/game/input.ts           teclado, ratón y táctil
src/game/audio.ts           sonido y música sintetizados (WebAudio)
src/game/game.ts            máquina de estados y bucle principal
src/game/world/             escena 3D: carretera, coche, carteles, decorado, cielo, cámara
src/ui/                     HTML/CSS: menús, marcadores, confeti
```

## Ajustar la dificultad
En `src/game/config.ts`: `decisionTime` (segundos para elegir) y `speed`. La distancia de la
bifurcación se calcula sola. Si cambias `speed` o `decisionTime`, revisa `fogFar` y `cutU`:
el final de la rama equivocada debe quedar oculto por la niebla al llegar al vértice
(`npm test` lo comprueba).

## Notas
- `window.__multiplicaRacing` existe solo para pruebas automáticas en navegador.
