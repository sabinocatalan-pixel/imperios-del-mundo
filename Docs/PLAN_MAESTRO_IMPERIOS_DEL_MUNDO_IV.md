# PLAN MAESTRO — IMPERIOS DEL MUNDO IV
**Documento de planificación estratégica pre-desarrollo**
Versión 1.0 · Estado base: Fase 3B completa (build OK, tests 35/35) · 3C no iniciada

---

## 1. DIAGNÓSTICO DEL ESTADO ACTUAL

### Fortalezas
- **Núcleo jugable completo:** mapa, territorios, turnos, economía, batallas en tiempo real, 6 tipos de unidad, héroes, coaliciones. El juego "existe" de punta a punta.
- **3B sólida y publicable:** monstruos míticos con reglas claras, IA cazadora sin trampas, tutorial integrado, tests verdes. Es un hito real.
- **Infraestructura madura:** guardado v5, Modo Balance con telemetría, codebase modular. Esto permite iterar por fases sin reescrituras.
- **Disciplina de proceso:** fases cerradas, criterios de aceptación, tests. Es el mayor activo del proyecto.

### Debilidades (por gravedad)
| # | Problema | Gravedad | Tipo |
|---|----------|----------|------|
| 1 | Recompensa de bosses inerte (loop 3B sin cierre) | Alta | Diseño incompleto |
| 2 | Counters de unidades difusos → combate poco legible | Alta | Balance/claridad |
| 3 | Población sin utilidad real → recurso decorativo | Alta | Diseño |
| 4 | Recursos (fe, cultura, ciencia) con propósito débil | Media-alta | Diseño |
| 5 | Bases y torres sin rol definido | Media | Diseño |
| 6 | IA competente pero sin profundidad estratégica | Media | IA |
| 7 | Dificultad sin curva configurable clara | Media | UX/Balance |
| 8 | Claridad táctica insuficiente (qué gana a qué, por qué perdí) | Media | UX |
| 9 | Visual funcional pero no memorable | Baja* | Estética |

\* Baja **hoy**. Se vuelve alta cuando las mecánicas estén congeladas (ver sección 10).

### Diagnóstico en una frase
> El juego tiene **cuerpo completo pero sistemas a medio conectar**: población, recursos y recompensas existen pero no importan; el combate funciona pero no se entiende. Pulir lo visual ahora sería pintar una casa con tuberías abiertas.

---

## 2. DECISIÓN ESTRATÉGICA

### Respuesta a la pregunta central
**NO pasar a 4A todavía. Primero cerrar mecánicas.** Razones:

1. **El polish visual congela decisiones.** Cada pantalla que embellezcas sobre mecánicas inestables la vas a rehacer. Torres, counters y reliquias cambiarán paneles, iconografía, tooltips y layout del mapa. Hacer 4A ahora = pagar el trabajo dos veces.
2. **La claridad táctica ES mecánica antes que visual.** "No entiendo por qué perdí" no se arregla con mejores gráficos; se arregla con counters explícitos y feedback de reglas. 4A solo puede comunicar reglas que ya existen.
3. **3B dejó una deuda explícita:** la recompensa inerte. Publicar contenido nuevo sin cerrar ese loop entrena al jugador a ignorar los bosses.
4. **La IA y la dificultad dependen de reglas finales.** Ajustar IA antes de counters/torres = re-balancear dos veces.

### Regla de oro para todo el roadmap
> **Mecánica → Balance → Claridad → Estética.** En ese orden, siempre.

### Qué se publica ya
**3B se publica ahora tal como está.** Está completa, testeada y aporta valor. La recompensa inerte se comunica en el tutorial como "Reliquia (próximamente equipable)" — es honesto y genera expectativa.

---

## 3. ROADMAP RECOMENDADO

Mantengo tu nomenclatura de fases, pero el **orden de ejecución** cambia: counters (3F) se adelanta porque bases/torres e IA dependen de reglas de combate finales.

```
PUBLICAR 3B (ya)
   │
   ▼
3C  Reliquias equipables        ← cierra loop de bosses (1ª prioridad)
   │
   ▼
3F  Counters de unidades        ← regla base del combate (se adelanta)
   │
   ▼
3D  Recursos y población        ← economía con propósito
   │
   ▼
3E  Bases y torres              ← usa counters + economía ya definidos
   │
   ▼
3G  IA y dificultad             ← ajusta IA sobre reglas congeladas
   │
   ▼
CONGELAR MECÁNICAS (feature freeze)
   │
   ▼
4A  Visual Polish + Claridad táctica
   │
   ▼
PUBLICACIÓN MAYOR (v6)
```

**Publicaciones intermedias:** después de 3C y después de 3F+3D (paquete "economía y combate"). No acumular más de dos fases sin publicar.

---

## 4. FICHAS POR FASE

### FASE 3C — Reliquias equipables
- **Objetivo:** que derrotar un boss otorgue una reliquia equipable con efecto real y visible.
- **Problema que resuelve:** loop de 3B sin cierre; bosses sin motivación mecánica.
- **Sistemas que toca:** recompensa existente (ya inerte, lista), héroes, panel de imperio, guardado (migración v5→v5.1), tutorial.
- **Qué NO tocar:** patrones de bosses, IA cazadora, economía, combate base, mapa.
- **Riesgos:** power creep (una reliquia que rompa el balance); migración de guardado.
- **Criterios de aceptación:**
  - 4 reliquias (una por boss) equipables desde panel.
  - Efecto visible en tooltip y en telemetría del Modo Balance.
  - Guardados v5 antiguos cargan sin error.
  - Ninguna reliquia altera winrate >5% en Modo Balance.
- **Pruebas:** equipar/desequipar, persistencia tras recarga, migración de save, 4 partidas de balance con y sin reliquias.
- **Prioridad:** **MÁXIMA.**

### FASE 3F — Counters de unidades *(adelantada)*
- **Objetivo:** matriz de counters simple, explícita y visible en el juego.
- **Problema que resuelve:** combate ilegible; composiciones de ejército sin decisiones.
- **Sistemas que toca:** cálculo de daño (multiplicadores), tooltips de unidad, pantalla de batalla (indicador de ventaja), tutorial.
- **Qué NO tocar:** tipos de unidad existentes (no añadir ni quitar), héroes, bosses, mapa, economía.
- **Riesgos:** multiplicadores demasiado fuertes que hagan el combate binario; conflicto con veteranía.
- **Criterios de aceptación:**
  - Matriz completa 6×6 documentada en BALANCE_NOTES.md.
  - Multiplicadores visibles en tooltip ("Fuerte vs / Débil vs").
  - Indicador de ventaja en pantalla de batalla.
  - Ninguna unidad con winrate global >60% o <40% en telemetría.
- **Pruebas:** batallas espejo por par de unidades, ejércitos mixtos vs mono-unidad, regresión de duelos de héroes.
- **Prioridad:** **ALTA** (2ª).

### FASE 3D — Recursos y población
- **Objetivo:** que los 5 recursos y la población tengan un uso claro, distinto y con decisiones.
- **Problema que resuelve:** recursos acumulables sin propósito; población decorativa.
- **Sistemas que toca:** economía por turno, reclutamiento (población como límite), panel de recursos, IA económica básica (que use los nuevos sinks).
- **Qué NO tocar:** combate (recién congelado en 3F), bosses, mapa, tipos de unidad.
- **Riesgos:** convertir la economía en microgestión pesada (anti mobile-first); romper la curva de las primeras 6 rondas.
- **Criterios de aceptación:**
  - Cada recurso tiene ≥1 sink activo y decisión asociada (ver sección 6).
  - Población limita reclutamiento y crece/decrece con reglas visibles.
  - Partida estándar sigue durando lo mismo ±15%.
  - Tutorial actualizado.
- **Pruebas:** partidas completas con foco en cada recurso, verificar que IA no colapsa económicamente, regresión de saqueo de bosses.
- **Prioridad:** **ALTA** (3ª).

### FASE 3E — Bases y torres
- **Objetivo:** defensa territorial con identidad: la base como corazón del imperio, torres como inversión defensiva con contrapartida.
- **Problema que resuelve:** territorios indiferenciados; defensa pasiva sin decisiones; snowball del atacante.
- **Sistemas que toca:** territorios, batalla (torres participan bajo reglas de counters de 3F), economía (coste con recursos de 3D), mapa visual, IA (atacar/defender estructuras).
- **Qué NO tocar:** matriz de counters, reliquias, bosses, tipos de unidad.
- **Riesgos:** turtling (defensa tan fuerte que nadie ataca); sobrecarga visual del mapa.
- **Criterios de aceptación:**
  - Torres con coste, PV, daño y counter definido (asedio las derriba con ventaja).
  - Perder la base tiene consecuencia clara y comunicada.
  - % de ataques exitosos en telemetría se mantiene entre 40–60%.
- **Pruebas:** asedio vs torre, partida full defensiva vs full ofensiva, IA construyendo y atacando torres.
- **Prioridad:** **MEDIA-ALTA** (4ª).

### FASE 3G — IA y dificultad
- **Objetivo:** IA que use bien todos los sistemas nuevos + 3 niveles de dificultad sin bonos ocultos.
- **Problema que resuelve:** IA que ignora reliquias/counters/torres; dificultad única.
- **Sistemas que toca:** solo capa de decisión de la IA y selector de dificultad. Cero cambios de reglas.
- **Qué NO tocar:** ninguna regla de juego. Esta fase es 100% comportamiento.
- **Riesgos:** IA "lista" que se vuelve lenta en móvil; dificultad alta que se sienta injusta.
- **Criterios de aceptación:**
  - Dificultad = mejor toma de decisiones, nunca recursos extra ocultos (coherente con tu filosofía de 3B).
  - IA compone ejércitos según counters, equipa reliquias, construye torres.
  - Fácil: jugador nuevo gana ~70%. Normal: ~50%. Difícil: ~30% (telemetría).
  - Turno de IA <1s en móvil medio.
- **Pruebas:** IA vs IA por nivel (winrates esperados), tiempos de turno, regresión completa.
- **Prioridad:** **MEDIA** (5ª).

### FASE 4A — Visual Polish + Claridad táctica
- **Objetivo:** salto estético fuerte + comunicación impecable de todas las reglas ya congeladas.
- **Problema que resuelve:** aspecto funcional pero genérico; información táctica dispersa.
- **Sistemas que toca:** solo capa de presentación (CSS, iconografía, animaciones, layout, tooltips, feedback de combate). Cero lógica.
- **Qué NO tocar:** ninguna regla, fórmula ni comportamiento de IA.
- **Riesgos:** peso de assets (PWA debe seguir rápida); scope creep estético infinito.
- **Criterios de aceptación:**
  - Identidad visual coherente (paleta, iconos, tipografía) en todas las pantallas.
  - Todo estado de juego legible sin abrir menús: counters, torres, reliquias, boss.
  - Lighthouse/PWA: carga <3s en móvil medio, sin regresión de rendimiento.
  - Tests siguen 100% verdes (nada de lógica tocada).
- **Pruebas:** visual QA por pantalla, rendimiento móvil, test de comprensión ("¿qué unidad reclutarías contra esto?" respondible solo mirando).
- **Prioridad:** **ALTA, pero al final.**

---

## 5. PROPUESTA 3C — RELIQUIAS EQUIPABLES

**Filosofía:** pocas, temáticas, con trade-off, sin power creep.

| Reliquia | Boss | Efecto propuesto | Trade-off |
|----------|------|------------------|-----------|
| Perla del Abismo | Kraken | +25% defensa en territorios costeros | Solo activa en costa |
| Escama de Amaru | Amaru | Héroe regenera PV entre batallas | Sin efecto en duelo de campeones |
| Aliento del Long | Long/Dragón | +15% daño de la primera oleada de ataque | Solo al atacar, no al defender |
| Ankh de Anubis | Anubis | Revive 20% de tropas perdidas tras defensa exitosa | Solo defensa, 1 vez por ronda |

**Reglas de sistema:**
- 1 reliquia equipada por imperio (slot único; el inventario guarda las demás). Simple, mobile-first, decisión real de "cuál uso ahora".
- Equipable/intercambiable solo al inicio de tu turno (evita micro en batalla).
- Al perder tu base (futuro 3E): la reliquia equipada es saqueable → sinergia entre fases.
- UI: nuevo bloque en panel de imperio + icono junto al nombre en el mapa.

**Por qué así:** slot único evita stacking y el problema de balance combinatorio; los trade-offs hacen que la elección dependa de tu situación, no de "cuál es mejor".

---

## 6. PROPUESTA — RECURSOS Y POBLACIÓN

**Principio:** cada recurso responde una pregunta distinta. Si dos recursos responden lo mismo, uno sobra.

| Recurso | Pregunta que responde | Sink principal propuesto |
|---------|----------------------|--------------------------|
| Oro | ¿Cuánto ejército mantengo? | Reclutamiento + **mantenimiento por turno** de tropas |
| Comida | ¿Cuánto crece mi imperio? | Consumo de población; excedente = crecimiento, déficit = decrecimiento |
| Ciencia | ¿Qué desbloqueo? | 3–5 mejoras simples por rama (ej: +counter, +torre nivel 2, +cap población) |
| Fe | ¿Qué momento decisivo compro? | "Milagros": 2–3 activables caros de un solo uso (ej: sanar ejército, pausar saqueo del boss 1 ronda) |
| Cultura | ¿Cómo gano sin guerra total? | Presión de frontera: territorios vecinos con cultura muy superior pueden cambiar de bando pacíficamente |

**Población (el cambio clave):**
- **Población = techo de tropas.** No puedes reclutar por encima de tu población disponible. De golpe, población importa.
- Crece con excedente de comida; baja con hambruna, saqueos de boss y pérdidas territoriales.
- Territorios aportan población según tamaño → conquistar deja de ser solo "más casillas" y pasa a ser "más capacidad militar".
- **Regla de simplicidad:** todo visible en una sola línea del panel: `Población 42/60 · Tropas 38`.

**Qué NO hacer:** felicidad, impuestos variables, edificios de población, migraciones. Eso es microgestión anti-móvil.

---

## 7. PROPUESTA — BASES Y TORRES

**Base (corazón del imperio):**
- 1 por imperio, en territorio inicial. Otorga bonus económico pasivo pequeño (+10% producción del territorio).
- **Perderla no elimina, pero duele:** −25% producción global durante 3 rondas + reliquia equipada saqueada. Reconquistarla elimina la penalización.
- Evita eliminación temprana frustrante y da un objetivo estratégico claro a los ataques.

**Torres:**
- Construibles en cualquier territorio propio (máx. 1 por territorio; simple y legible en mapa).
- Coste: oro + ciencia (sink de 3D). PV propios, atacan como unidad a distancia en la batalla del territorio.
- **Counter explícito:** el asedio les hace daño multiplicado (cierra el círculo con 3F: el asedio, hoy la unidad más situacional, gana identidad).
- Nivel 2 desbloqueable por ciencia (opcional, si el balance lo pide).

**Anti-turtling:** las torres no generan recursos y su mantenimiento cuesta oro → defenderse en exceso te empobrece. La telemetría (ataques exitosos 40–60%) vigila esto.

---

## 8. PROPUESTA — COUNTERS DE UNIDADES

**Modelo:** triángulo principal + reglas especiales para aérea, sanador y asedio. Multiplicador estándar **1.5× / 0.75×** (visible, fácil de comunicar, no binario).

```
        Melee
       ↗     ↘
  Pesada  ←  Distancia
```
- **Melee** vence a **Distancia** (la alcanza y la destroza).
- **Distancia** vence a **Pesada** (la castiga antes del choque).
- **Pesada** vence a **Melee** (la aplasta en el choque).

**Reglas especiales:**
| Unidad | Fuerte vs | Débil vs |
|--------|-----------|----------|
| Aérea | Asedio y Sanador (caza retaguardia) | Distancia (antiaérea natural) |
| Asedio | Torres y Bases (1.5×+) | Melee y Aérea |
| Sanador | — (no ataca / soporte) | Todo; prioridad de la IA cazadora |

**Comunicación (tan importante como la regla):**
- Tooltip de cada unidad: dos líneas, "Fuerte vs X · Débil vs Y", con iconos.
- En batalla: flecha o brillo verde/rojo sobre enfrentamientos con ventaja.
- Tutorial: una sola pantalla con el triángulo.

**Por qué 1.5×:** suficiente para que la composición importe, insuficiente para que una mala composición sea derrota automática — la veteranía y los héroes siguen pudiendo voltear batallas.

---

## 9. PROPUESTA — IA Y DIFICULTAD

**Principio innegociable (ya lo aplicaste en 3B):** la dificultad nunca da recursos ocultos. Difícil = IA que decide mejor.

**Tres niveles:**
| Nivel | Comportamiento |
|-------|----------------|
| Fácil | IA actual + errores deliberados: composiciones subóptimas, no prioriza counters, ignora reliquias |
| Normal | IA actual + usa counters al componer ejércitos + equipa reliquias razonablemente |
| Difícil | Todo lo anterior + evalúa timing de ataques (ataca cuando tienes déficit de comida o boss activo cerca), construye torres en frontera, coordina mejor coaliciones |

**Mejoras de decisión (sin trampas, por orden de impacto):**
1. Composición por counters: mirar el ejército defensor y reclutar lo que le gana.
2. Economía consciente: no reclutar por encima de lo que el oro de mantenimiento soporta.
3. Oportunismo: atacar territorios recién saqueados por el boss.
4. Uso de milagros de fe en momentos correctos (defensa de base, batalla grande).

**Restricción técnica:** cada mejora se mide en tiempo de turno. Presupuesto: <1s en móvil medio. Si una heurística lo excede, se simplifica o se descarta.

---

## 10. CUÁNDO HACER 4A

**Disparador correcto:** 4A empieza cuando se cumplan TODAS:
1. 3C–3G publicadas y estables (≥1 semana sin bugs críticos reportados/detectados).
2. Telemetría de balance dentro de rangos (winrates de unidades 40–60%, dificultades calibradas).
3. **Feature freeze firmado por ti:** ninguna mecánica nueva entra hasta terminar 4A.

**Por qué el freeze es obligatorio:** 4A es la fase más cara de rehacer. Cada icono, animación y layout asume reglas fijas. Si entra una mecánica a mitad de 4A, pagas doble.

**Qué SÍ puede adelantarse antes de 4A (micro-polish barato):** los tooltips e indicadores de counters (3F) y la línea de población (3D) ya son "claridad táctica" — se hacen dentro de sus fases porque son parte de la mecánica, no del polish.

---

## 11. DOCUMENTOS RECOMENDADOS

Crear en `/docs` del repo. Cada FASE_*.md es el prompt-fuente para Codex: bloques pequeños salen de ahí.

| Documento | Contenido | Cuándo |
|-----------|-----------|--------|
| `ROADMAP.md` | Secciones 2–4 de este plan, actualizado al cerrar cada fase | Ya |
| `FASE_3C_RELIQUIAS.md` | Sección 5 + criterios de aceptación + lista de sprints | Ya (fase inmediata) |
| `FASE_3F_COUNTERS.md` | Sección 8 + matriz 6×6 completa con números | Al cerrar 3C |
| `FASE_3D_RECURSOS_POBLACION.md` | Sección 6 + fórmulas de crecimiento | Al cerrar 3F |
| `FASE_3E_BASES_TORRES.md` | Sección 7 + costes y PV concretos | Al cerrar 3D |
| `FASE_3G_IA_DIFICULTAD.md` | Sección 9 + heurísticas por nivel | Al cerrar 3E |
| `FASE_4A_VISUAL_POLISH.md` | Sección 10 + inventario de pantallas a pulir | Tras feature freeze |
| `CHECKLIST_QA.md` | Checklist de regresión acumulativo: se le añade una sección por fase cerrada (saves, tests, rendimiento móvil, tutorial actualizado) | Ya, crece por fase |
| `BALANCE_NOTES.md` | Números vivos: matriz de counters, costes, winrates de telemetría, decisiones de balance con fecha y motivo | Ya, se actualiza siempre |

**Regla:** ningún prompt a Codex sin su FASE_*.md escrito primero. El documento es el contrato; el código, la ejecución.

---

## 12. PLAN POR SPRINTS (10–30 min c/u)

Formato: cada sprint = 1 prompt a Codex + verificación tuya. Nunca dos sistemas en un sprint.

### 3C — Reliquias (6 sprints)
1. Modelo de datos: reliquia, inventario, slot equipado + migración save v5→v5.1. *(20–30 min)*
2. Lógica de equipar/desequipar al inicio de turno. *(15 min)*
3. Efectos de las 4 reliquias conectados al combate/economía. *(30 min)*
4. UI: bloque en panel de imperio + icono en mapa + tooltips. *(20–30 min)*
5. Telemetría de reliquias en Modo Balance + tutorial. *(15–20 min)*
6. Tests + QA de regresión + partidas de balance. *(30 min)*

### 3F — Counters (5 sprints)
1. Matriz de multiplicadores en config central (números en BALANCE_NOTES.md primero). *(15 min)*
2. Aplicación en cálculo de daño. *(20 min)*
3. Tooltips "Fuerte vs / Débil vs". *(15 min)*
4. Indicador de ventaja en batalla + pantalla de tutorial. *(20–30 min)*
5. Batallas espejo de prueba + ajuste de números + regresión héroes. *(30 min)*

### 3D — Recursos y población (7 sprints)
1. Población como techo de tropas + línea de UI. *(20 min)*
2. Crecimiento/decrecimiento por comida. *(20 min)*
3. Mantenimiento de tropas en oro. *(15 min)*
4. Mejoras de ciencia (3–5, config declarativa). *(30 min)*
5. Milagros de fe (2–3 activables). *(30 min)*
6. Presión cultural de frontera. *(30 min)*
7. IA usa los nuevos sinks (mínimo viable) + regresión completa. *(30 min)*

### 3E — Bases y torres (5 sprints)
1. Base: bonus, penalización por pérdida, reconquista. *(25 min)*
2. Torres: construcción, coste, límite 1/territorio. *(20 min)*
3. Torres en batalla + counter de asedio. *(25 min)*
4. Visual en mapa + IA construye/ataca torres. *(30 min)*
5. Balance anti-turtling con telemetría + regresión. *(30 min)*

### 3G — IA y dificultad (5 sprints)
1. Selector de dificultad + persistencia. *(15 min)*
2. Composición por counters (Normal+). *(30 min)*
3. Economía consciente + oportunismo (Difícil). *(30 min)*
4. Errores deliberados (Fácil) + reliquias/milagros en IA. *(25 min)*
5. Calibración IA vs IA + presupuesto de tiempo de turno + regresión. *(30 min)*

### 4A — Visual (estimación inicial, detallar tras freeze)
1. Definir identidad: paleta, tipografía, set de iconos. *(30 min, decisión tuya)*
2–N. Un sprint por pantalla: mapa → batalla → paneles → tutorial → menús. *(20–30 min c/u)*
Final. QA visual + rendimiento PWA móvil. *(30 min)*

**Total estimado 3C–3G: ~28 sprints ≈ 11–13 horas de ejecución efectiva.**

---

## 13. RECOMENDACIÓN FINAL

| Decisión | Acción |
|----------|--------|
| **Hacer ahora** | 1) Publicar 3B. 2) Escribir ROADMAP.md, FASE_3C_RELIQUIAS.md, CHECKLIST_QA.md y BALANCE_NOTES.md. 3) Ejecutar sprints de 3C. |
| **Publicar** | 3B ya. Luego 3C sola. Luego paquete 3F+3D. Luego 3E+3G. |
| **No tocar todavía** | Nada visual más allá de tooltips funcionales. Nada de 3D gráfico, multiplayer online ni reescrituras (fuera de alcance por diseño). No añadir unidades ni bosses nuevos hasta cerrar 3G. |
| **Siguiente fase inmediata** | **3C Reliquias.** Es pequeña, cierra la deuda de 3B, no toca sistemas frágiles y da una publicación rápida con valor visible. |
| **Rediseño visual fuerte** | Solo tras cerrar 3G + 1 semana de estabilidad + telemetría en rango + feature freeze firmado. Estimación realista: después de ~28 sprints de mecánicas. |

> **Resumen ejecutivo:** publica 3B hoy, cierra el loop de los bosses con 3C esta semana, congela el combate con counters, dale propósito a la economía, levanta las torres, enseña a la IA a usar todo — y recién entonces hazlo hermoso. Un juego claro y balanceado con gráficos simples retiene; un juego bonito y confuso, no.

---
*Documento generado como contrato de planificación. Toda desviación del roadmap debe registrarse en ROADMAP.md con fecha y motivo.*
