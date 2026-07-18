# CLAUDE.md — Manual Maestro del Proyecto "Imperios del Mundo"

> **Instrucción para Claude Code:** Este archivo es tu fuente de verdad. Léelo completo antes de tocar código. Trabaja SOLO la fase activa indicada en la sección 6. No avances de fase sin aprobación explícita de Gabriel.

---

## 1. Contexto del proyecto

**Imperios del Mundo** es un juego de gran estrategia en HTML/JS/CSS puro (un solo archivo, sin frameworks ni backend), creado por Gabriel Catalán con Claude como planner. Combina:

- **Mapa mundial** estilo *World Conqueror*: 21 territorios, 6 imperios, economía por turnos (oro/comida/ciencia/fe/cultura), épocas, diplomacia, misiones, campaña de 5 escenarios.
- **Batallas en vivo** estilo *Age of War*: unidades que avanzan por carriles, triángulo de contraataques (🗡>🏹>🛡>🗡 a ×1.5/×0.66), economía híbrida (ingreso pasivo + recompensa por baja), poder especial cada 30s, campeones, torretas, épocas que cambian unidades y cielo.
- **Meta-progresión**: sistema de legado con códigos Base64 (victorias desbloquean bonos permanentes).
- **Multijugador local**: 2 jugadores en el mismo dispositivo, con batallas PvP de controles divididos.
- **Sonido y música procedurales** con Web Audio (sin archivos de audio).

**Plataformas objetivo:** iPhone (principal), Android, laptop Windows. Todo táctil-primero (botones ≥44px, safe areas, pinch-zoom en mapa, devicePixelRatio ≤2).

**Rol de cada quien (pipeline SKILL_v2 de Gabriel):**
- Claude (chat) = Planner + Revisor. Diseña mecánicas, balance y fases.
- **Claude Code (tú) = Ejecutor.** Implementas exactamente lo que dice este manual, fase por fase.
- Gabriel = Aprobador humano. Puertas de aprobación obligatorias (sección 4).

---

## 2. Estado actual del código

- Archivo fuente: `imperios-del-mundo-5.html` (colócalo en la raíz del repo; ~2,500 líneas, un solo archivo).
- **Funciona y está probado** (suite jsdom pasó: turnos 1P/2P, PvP, IA con especial/campeón, diplomacia, guardado v3, escenarios, legado). NO reescribas lógica de juego en Fase 0; solo reorganiza.
- Estructura interna actual del `<script>` (en este orden):
  1. `SET` (ajustes) + audio procedural (`tone`, `noiseBurst`, `SFX`, música)
  2. `LEGACY` + `SCENARIOS` (campaña)
  3. Datos: `FACTIONS`, `TERR`, `ADJ`, `SEAROUTES`, `CONTINENTS`, `ERAS`, `UNIT_NAMES`, `SPECIALS`, `CHAMPS`
  4. Estado global: `T` (territorios), `F` (facciones), `player`, `humans[]`, `round`, `phase`, `pacts`, `rel`, `missions`, `pendingOffer`
  5. Mapa SVG: `buildMap`, zoom/paneo (`vb`, gestos pointer), `flashTerr`, `arrowFX`
  6. Render de paneles: `render`, `renderRes`, `renderTerr`, `renderEmp`
  7. Confeti (canvas propio)
  8. Economía/eventos: `incomePhase`, plagas, misioneros
  9. Combate auto (IA vs IA): `autoBattle`; fin de juego: `checkEnd`, `endGame`
  10. Turnos: `startRound`, `beginHumanTurn`, `endHumanTurn`, `aiTurns`, ofertas (`maybeShowOffer`, `resolveOffer`)
  11. Motor de batalla: `openBattle`, `B.S` (pools por bando "1"/"-1"), `spawnUnit`, `spawnChamp`, `useSpecial`, `enemyAI`, `bloop`, dibujo (`drawBG`, `drawStick`, `drawBase`, `drawCorpse`, `drawBattle`), `finishBattle`, `fitBattleCanvas`
  12. Guardado: `saveGame`/`loadGame` (v3, Base64) y legado (`legacyCode`/`loadLegacy`, prefijo `LEG1.`)
  13. Modales/ajustes + `buildMap();reset();`

**Convenciones vigentes que debes respetar:**
- Todo en **español** (UI, logs, comentarios, commits).
- Sin dependencias externas en runtime (nada de CDN en el juego final).
- El producto distribuible es **UN solo archivo HTML** autocontenido.
- `matchMedia`, canvas y audio siempre con guardas defensivas (ya existen; no las quites).

---

## 3. Reglas de seguridad (tolerancia cero — política de Gabriel)

1. Si en el futuro hubiera credenciales/API keys: `.env` + `.gitignore` desde el primer commit. Nunca hardcodear.
2. `.gitignore` incluye desde el inicio: `node_modules/`, `.env`, `dist/` (opcional), archivos temporales.
3. Errores silenciosos a `error_log.txt` si se crea tooling con logging; nunca exponer rutas de carpetas en mensajes de usuario.
4. Cambios pequeños e incrementales: un commit por tarea, nunca "mega-commits".
5. Nada se publica (GitHub Pages, repos públicos, dominios) sin aprobación explícita de Gabriel.

## 4. Puertas de aprobación humana (DETENTE y pregunta a Gabriel antes de)

- Crear repos remotos o hacer `git push` a cualquier remoto.
- Publicar en GitHub Pages / Netlify / cualquier hosting.
- Instalar dependencias nuevas de npm más allá de las listadas en este manual.
- Borrar archivos o reescribir módulos completos fuera de la fase activa.
- Cualquier operación con credenciales, pagos o datos reales.

---

## 5. Arquitectura objetivo (Fase 0)

```
imperios-del-mundo/
├── CLAUDE.md                  ← este manual
├── imperios-del-mundo-5.html  ← fuente original (NO borrar; referencia)
├── package.json               ← scripts: build, test, dev
├── .gitignore
├── build.js                   ← concatena src/ → dist/imperios.html
├── src/
│   ├── index.template.html    ← esqueleto HTML con marcadores <!--INJECT:css--> y <!--INJECT:js-->
│   ├── styles.css             ← todo el CSS actual
│   ├── 01-config-audio.js     ← SET, audio, SFX, música
│   ├── 02-datos.js            ← FACTIONS, TERR, ADJ, CONTINENTS, ERAS, etc.
│   ├── 03-legado-campania.js  ← LEGACY, SCENARIOS, misiones
│   ├── 04-estado.js           ← reset, startGame, startScenario, helpers ($, log, rel, pacts)
│   ├── 05-mapa.js             ← buildMap, zoom/paneo, flashTerr, arrowFX
│   ├── 06-paneles.js          ← render, renderTerr, renderEmp, mkBtn
│   ├── 07-economia.js         ← incomePhase, plagas, checkEnd, endGame, autoBattle
│   ├── 08-turnos.js           ← startRound, beginHumanTurn, endHumanTurn, aiTurns, ofertas
│   ├── 09-batalla.js          ← todo el motor de batalla y su dibujo
│   ├── 10-guardado.js         ← saveGame/loadGame, legacyCode/loadLegacy
│   ├── 11-modales.js          ← ajustes, misiones, diplomacia, confeti
│   └── 99-main.js             ← buildMap(); reset();
├── test/
│   └── juego.test.js          ← suite jsdom (ver sección 7)
└── dist/
    └── imperios.html          ← ARTEFACTO FINAL (un solo archivo, generado)
```

- `build.js` (Node puro, sin dependencias): lee `index.template.html`, inyecta `styles.css` dentro de `<style>` y los `src/*.js` en orden numérico dentro de `<script>`, escribe `dist/imperios.html`. El resultado debe ser **byte-a-byte funcionalmente equivalente** al HTML original.
- Los `src/*.js` comparten scope global (se concatenan); NO conviertas a módulos ES ni cambies nombres de funciones/variables en Fase 0.

---

## 6. FASES DE TRABAJO

### ✅ FASE ACTIVA: **FASE 0 — Migración a repositorio modular**

Tareas (en orden, un commit por tarea):
1. `git init` + `.gitignore` + commit inicial con `imperios-del-mundo-5.html` y este `CLAUDE.md`.
2. Crear `package.json` con scripts: `"build": "node build.js"`, `"test": "node test/juego.test.js"`. Única devDependency permitida: `jsdom`.
3. Extraer CSS a `src/styles.css` y crear `src/index.template.html` con los marcadores de inyección. Commit.
4. Dividir el `<script>` en los archivos `src/01…99` respetando el orden y sin cambiar UNA sola línea de lógica (solo cortar/pegar + comentario de cabecera por archivo). Commit por cada 2-3 módulos.
5. Escribir `build.js`. Commit.
6. Portar la suite de pruebas (sección 7) a `test/juego.test.js`, apuntando a `dist/imperios.html`. Commit.
7. `npm run build && npm run test` → **todas las pruebas en verde**. Commit final de fase con tag `v5.0.0-fase0`.

**Criterios de aceptación Fase 0:**
- `dist/imperios.html` abre en navegador y se comporta idéntico al original (verificación manual de Gabriel).
- Suite jsdom completa en verde.
- Ningún cambio de lógica, textos ni balance.

### 🔜 FASE 1 — PWA instalable (NO iniciar sin aprobación)

1. `manifest.webmanifest`: nombre "Imperios del Mundo", `display: standalone`, orientación `any`, tema `#0B1D26`, íconos 192/512 (genéralos como PNG desde un SVG simple: corona dorada 👑 sobre fondo `#0B1D26`; sin material con copyright).
2. `sw.js`: service worker cache-first del HTML único (estrategia simple: precache `dist/imperios.html` + manifest + íconos; versionar cache con constante `CACHE_V`).
3. En el juego: registrar SW solo si `location.protocol==='https:'` o `localhost` (guardas defensivas); meta tags iOS (`apple-mobile-web-app-capable`, `apple-touch-icon`).
4. **Guardado automático con localStorage** (la PWA sí lo permite, a diferencia del artifact de claude.ai): autoguardar `saveGame()` al inicio de cada ronda y el legado al terminar partidas, con try/catch y manteniendo los códigos manuales como respaldo/exportación.
5. Servidor local de prueba: `npx serve dist` (pedir aprobación si requiere instalar `serve`).
6. **Publicación en GitHub Pages: SOLO con aprobación de Gabriel** (puerta de la sección 4).

**Criterios de aceptación Fase 1:** instalable desde Safari iOS ("Añadir a pantalla de inicio") y Chrome Android; funciona offline tras primera carga; autoguardado restaura la partida al reabrir.

### 📋 FASE 2 — Balance y dificultad (backlog, requiere diseño previo con Claude chat)
- Dificultad "Pesadilla": IA con ingreso ×1.5, ataques en frentes múltiples por ronda, coordinación entre IAs contra el líder.
- Telemetría local de balance: duración media de batalla (objetivo 60–180 s), tasa de uso por unidad; si una unidad supera 60% de uso, proponer ajuste (no aplicar sin aprobación).

### 📋 FASE 3 — Contenido (backlog)
- 5 escenarios nuevos de campaña; eventos aleatorios de mapa (rebeliones, edad de oro, descubrimientos); rutas navales con batallas propias.

---

## 7. Suite de pruebas (portar tal cual a jsdom)

Stubs necesarios en `beforeParse`: `matchMedia=()=>({matches:false})` y `HTMLCanvasElement.prototype.getContext` como Proxy que devuelve funciones vacías (y `createLinearGradient` → objeto con `addColorStop`). Ejecutar asserts vía `window.eval` (las `let` top-level no cuelgan de `window`).

Casos mínimos (todos existen hoy y pasan):
1. 1P: `startGame(1.0)` → `clickTerr` elige facción → `phase==="play"`.
2. Ataque: seleccionar territorio propio → vecino enemigo → `inBattle && B.mode==="attack"`; multiplicadores `counterMult` = 1.5 y 0.66; `finishBattle(true)` transfiere el territorio y cumple misión `conq1`.
3. Regresión anti-crash: eliminar todos los territorios de una facción a mitad de `aiTurns` → no lanza excepción y la ronda avanza.
4. Guardado: `loadGame(saveGame())===true`; legado: `loadLegacy(legacyCode())===true`.
5. Escenarios: desbloqueo secuencial; "Cerco del Dragón" arranca solo con CHN; objetivo cumplido → `¡Escenario superado!` y `LEGACY.scen.s3===true`.
6. 2P: `setPickMode(2)` → dos `clickTerr` → `humans.length===2`; `endHumanTurn()` rota al segundo humano; ataque humano→humano abre `B.pvp===true` con 8+ `btnRefs`; `spawnUnit`/`useSpecial` funcionan para ambos bandos.
7. IA de batalla: con `cool.spec=0`, `cool.champ=0`, `time>12` y 3 unidades del jugador, `enemyAI(0.1)` lanza especial y despliega campeón.
8. Diplomacia: `pendingOffer` tipo `demand` → `maybeShowOffer()` muestra modal → `resolveOffer(true)` transfiere oro y sube relación.

Cualquier cambio futuro debe mantener esta suite en verde y añadir pruebas nuevas para lo que toque.

## 8. Entorno de Gabriel
- Máquina: Lenovo ThinkBook 16 ("bosh"), Windows 11 Pro. Node instalado. Git disponible.
- Rutas Windows: usa `path.join`, nunca separadores hardcodeados.
- Al terminar cada fase, genera un resumen corto para que Gabriel lo pegue en el chat de Claude (planner) para revisión: qué se hizo, commits, resultado de pruebas, y dudas.

## 9. Formato de cierre de sesión de trabajo
Cuando Gabriel indique que la sesión terminó, responde con:
```
---TAREA CERRADA---
Resumen: [qué se hizo]
Próximo paso: [qué sigue]
```
