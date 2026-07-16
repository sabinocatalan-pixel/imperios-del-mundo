# PLAN-MAESTRO.md — Imperios del Mundo · Expansión "Héroes, Mitos y Mundo Vivo"
**Versión 1.0 · Reemplaza y absorbe a ANEXO-FASE2.md · Documento agnóstico de agente**

> **Instrucción para el AGENTE EJECUTOR (Claude Code, Codex u otro):** Este documento es la fuente de verdad del proyecto junto con CLAUDE.md (gobernanza). Si eres un agente distinto a Claude Code, las reglas de CLAUDE.md te aplican igual: léelo primero. Ejecuta SOLO la fase/sub-fase que Gabriel te indique, en orden, un commit por tarea, manteniendo la suite de pruebas SIEMPRE en verde y agregando las pruebas nuevas de cada sub-fase. Nada del BACKLOG (sección 8) se implementa. Nada se publica, instala o borra sin aprobación explícita de Gabriel.

---

## 0. Reglas de gobernanza (obligatorias para cualquier agente)

1. **Repo:** `imperios-del-mundo` (GitHub: sabinocatalan-pixel). Módulos en `src/01…99-*.js` + `styles.css` + `index.template.html`; `build.js` concatena a `dist/imperios.html` (UN archivo autocontenido, sin frameworks ni CDNs). CI en `.github/workflows/deploy-pages.yml`: build + test + deploy a Pages **solo si la suite pasa**.
2. **Pruebas:** `test/juego.test.js` (jsdom). Hoy 10/10 en verde. Cada sub-fase AGREGA sus pruebas (numeradas abajo) y no puede romper las anteriores. Stubs necesarios: `matchMedia` y `getContext` (Proxy con `createLinearGradient`).
3. **Commits:** uno por tarea, mensajes en español. Cierre de sub-fase = suite verde + verificación manual de Gabriel + tag `v5.X.0-fase2X` (o fase que corresponda).
4. **Guardado:** el save sube de versión con cada fase (Fase 2 → v4, Fase 3 → v5…), SIEMPRE con migración retrocompatible desde la anterior. El legado (`LEG1.`) solo se extiende, nunca se rompe.
5. **Puertas de aprobación:** push a remotos nuevos, publicar, instalar dependencias (solo jsdom está permitida), borrar archivos, reescribir módulos fuera de la fase activa → DETENERSE y preguntar.
6. **Idioma:** todo en español (UI, logs, comentarios, commits).
7. **Regla de corte de complejidad:** si una mecánica requiere más de 2 pantallas nuevas o más de 3 reglas para entenderse, se manda al backlog y se reporta. El agente NO expande alcance por iniciativa propia.

## 1. Estado actual (no reimplementar)

Mapa mundial 21 territorios / 6 imperios · economía por turnos (🪙🌾🔬✨🎭) · 4 épocas · diplomacia con IA proactiva (pactos/alianzas/tributos/exigencias) · plagas · misiones · campaña de 5 escenarios · legado Base64 · 3 dificultades · multijugador local 2J con batallas PvP · batallas tiempo real estilo Age of War (triángulo 🗡>🏹>🛡 ×1.5/×0.66, ingreso pasivo + botín 70%, especial 30s, campeón cd60s, torretas, muerte súbita 150s) · IA con personalidades que usa las mismas herramientas del jugador · sonido/música procedural · PWA con autoguardado localStorage + códigos manuales · publicado en https://sabinocatalan-pixel.github.io/imperios-del-mundo/

## 2. Pilares de diseño (validar CADA decisión contra estos 7)

1. **Se entiende rápido** (≤3 reglas por mecánica).
2. **Cambia decisiones reales** o se recorta.
3. **No alarga la partida:** batalla 60–210 s, partida 5–15 min.
4. **Cero ayudas invisibles al jugador:** la IA juega con las mismas reglas; los mecanismos compensatorios (anti-rachas, anti-castigo) aplican a TODOS los imperios. La victoria depende de las decisiones y habilidad del jugador.
5. **Respeto cultural:** héroes históricos con rol estratégico/cultural digno; míticos con poder sobrenatural SIEMPRE contextualizado como mito/leyenda. Ningún héroe histórico como monstruo, caricatura ni poder mágico sin contexto. Sin política contemporánea real (usar arquetipos: "Cumbre mundial", "Embargo", "Revolución").
6. **Fatiga móvil:** máx. 3 decisiones importantes por turno · máx. 1 modal grande por ronda · máx. 1 banner narrativo por evento (3-4 s, legible) · los eventos importantes NUNCA pasan solo por el log pequeño.
7. **Explicación causal ("por qué pasó esto"):** todo evento importante (ataque IA, coalición, plaga, desbloqueo, veteranía, duelo) genera una línea causal en el Resumen del turno.

---

# FASE 2 — "Héroes, Duelos y Pesadilla" (ACTIVA · orden 2A→2F)

## 2A. Panteón de 24 héroes (8 jugables, 16 definidos y bloqueados)

**Reemplaza** la contratación aleatoria actual. El arma nv1-3 se conserva como mejora del héroe activo.

### Framework de presupuesto de poder
| Rareza | Presupuesto | Cantidad | Marco visual |
|---|---|---|---|
| Común | 6 pts | 8 | gris |
| Raro | 8 pts | 8 | azul |
| Legendario | 10 pts | 5 | dorado |
| Mítico | 12 pts | 3 | púrpura brillante |

Costos: stats altos 3 · buff táctico 2 · invocación 3 · buff global temporal 4 · área 4 · revivir 5 · permanente 6+ · limitación fuerte resta 1-2. **Techo: ningún héroe aporta >25% de ventaja en una batalla. Efectos permanentes cuestan más que efectos de batalla.**

### Límites duros
1 héroe activo por batalla (uno vivo a la vez, cd 60s) · 3 equipados por partida (1 activo + 2 consejo; consejo solo aporta su pasiva `consejo`, nunca combate) · máx. 1 mítico equipado · los héroes no producen recursos salvo pasivas `consejo` explícitas de bajo valor.

### Tipo de ataque y armas
Cada héroe tiene `tipoAtaque:"melee"|"ranged"`. El **arma nv1-3** (oro) mejora stats. Tres héroes tienen **arma alternativa desbloqueable** (por logro) que cambia o amplía su tipo — así el jugador redefine cómo pelea su héroe:
- Aníbal + *Jabalinas púnicas* (gana 3 batallas con Aníbal) → pasa a ranged rng 120.
- Tomoe Gozen + *Arco yumi* (10 bajas ranged con ella en campo) → alterna melee/ranged según distancia.
- Leónidas + *Lanza dory* (sobrevive 3 batallas completas) → +30 de alcance melee.

### Los 8 héroes jugables (implementar completos)
| Héroe | Región | Rareza | Tipo | Habilidad | Pts |
|---|---|---|---|---|---|
| Leónidas | Grecia | Común | melee | *Muro de Escudos* (pasiva): melee aliados +10% def mientras vive | 3+2+1=6 |
| Sun Tzu | China | Común | ranged | *El Arte de la Guerra* (pasiva): unidades cuestan −10% mientras está en campo (stats bajos) | 2+3+1=6 |
| Boudica | Britania | Común | melee | *Carga Furiosa* (activa cd25s): aliados +20% velocidad 6s | 3+3=6 |
| Ollantay | Andes | Común | melee | *Corazón Rebelde* (pasiva): al morir, tropas +15% daño 8s | 3+3=6 |
| Aníbal | Cartago | Raro | melee | *Flanqueo* (activa cd35s): invoca 2 melee adelantados | 3+3+2=8 |
| Tomoe Gozen | Japón | Raro | melee | *Danza de la Naginata* (pasiva): golpes con área pequeña | 4+4=8 |
| Pachacútec | Tahuantinsuyo | Legendario | melee | *Reorganización Imperial* (activa cd40s): cura 25% PV aliados + 10% def 10s. Consejo: +1🪙/ronda por territorio sudamericano | 3+5+2=10 |
| Amaru 🔒 | Andes (mito) | Mítico | ranged | *Renacer de la Serpiente* (1 vez/batalla): al morir renace con 50% PV + onda que aturde 1.5s. Desbloqueo: Fe ≥120 + ganar esa partida | 4+5+4−1=12 |

### Los 16 restantes (SOLO datos: `locked:true`, condición visible; habilidades se implementan cuando su fase de desbloqueo llegue — principalmente Campaña II)
**Comunes:** El Cid (gana 3 defensas) · Yi Sun-sin (usa ruta marítima para conquistar 5 veces) · Túpac Amaru II (gana una defensa estando bajo coalición) · Zenobia (controla Medio Oriente).
**Raros:** Saladino (3 pactos en una partida) · Shaka Zulú (África completa) · Juana de Arco (gana "Blitz Europeo" en Difícil) · Cuauhtémoc (defiende Mesoamérica 3 veces) · Gengis Kan (conquista 5 territorios en una partida) · Mansa Musa (acumula 300🪙).
**Legendarios:** Alejandro Magno (conquista total en Difícil) · Cleopatra (victoria cultural) · Naylamp (victoria controlando Perú + un costero) · Atahualpa ("Resistencia Andina" en Pesadilla).
**Míticos:** Inkarri (campaña completa en Pesadilla) · Quetzalcóatl (victoria religiosa en Difícil+).
Desbloqueos → `LEGACY.heroes`.

### UI: Panteón y Códice
Botón ⭐ en header → modal **Panteón**: rejilla de tarjetas (retrato estilizado + marco de rareza; bloqueados en silueta con condición; míticos muestran "???"). Tocar → **Ficha** de 3 capas: (1) vista rápida (nombre/región/rareza/rol/tipo/habilidad 1 línea); (2) **leyenda** 2-3 líneas en tono narrativo digno; (3) **nota cultural**: "Inspirado en la historia/mitología de [región]; representación lúdica y educativa, no documental." Pestaña **Códice**: enciclopedia coleccionable con las leyendas de los desbloqueados. Panel Imperio → "Equipar héroes".

**Pruebas 11-13:** límites de equipamiento (no 2 míticos, no 4 equipados) · pasiva de Sun Tzu solo activa con él vivo en campo · desbloqueo de Amaru llega al legado tras Fe≥120 + victoria.

## 2B. Duelo de Campeones (6–10 s, máx. 1 por batalla)

Disparo: dos héroes activos a ≤60px. Las unidades en radio 140px se pausan; banner "⚔ DUELO DE CAMPEONES" con nombres y **frase característica** de cada héroe (definir 1 por héroe); 3 intercambios animados; resolución:
```
PoderDuelo = ArmaNv*2 + RarezaPts(1/2/3/4) + PV%*3 + BonusDuelo + rand(-2..+2)
```
Perdedor queda al 30% de su PV (no muere en el duelo). Ganador recibe UNA recompensa moderada al azar: +15% daño aliado 12s · +20% PV propio · −8s al cd del especial · aturdir cercanos 2s. **Prohibido** que el duelo mate bases, aniquile tropas o decida la batalla. Línea causal: "⚔ X venció a Y en duelo: [recompensa] (energía Y baja)".

**Prueba 14:** un solo duelo por batalla, <10s, perdedor ≥1 PV, recompensa aplicada.

## 2C. Ritmo, formaciones y unidades aéreas ✈️

### Desgaste progresivo (visible con banner narrativo en cada umbral)
```
0–120s normal · 120s "Tensión de guerra": ingreso +10% ambos bandos
150s "Muerte súbita": bases/torretas reciben +20% daño
180s "Desgaste": unidades nuevas entran con −10% PV máx ("Las líneas de suministro se agotan")
210s Resolución forzada: gana mayor (PVbase%*2 + tropasVivas + dañoCausado/100)
```
Bases +15% PV respecto a hoy (no más).

### Formaciones — fin de la "fila de hormigas"
- Cada unidad recibe al crearse un **carril de profundidad** (offset vertical −12/0/+12 px y jitter ±4) → avanzan en frente de hasta 3, no en fila india.
- **Separación:** repulsión simple entre aliados del mismo tipo (distancia mínima 16px) para que no se apilen en un punto.
- **Enfrentamiento en arco:** hasta 3 melee pueden atacar al mismo objetivo (posicionados en arco); el 4º busca el siguiente enemigo.
- **Ranged mantiene distancia:** se detiene a 0.8×rng del enemigo más cercano y no avanza mientras tenga objetivo (deja de "caminar hacia la muerte").
- Sin control del jugador todavía (formación táctica previa → backlog).

### Unidades aéreas (4º tipo, botón ✈️)
| Época | Unidad | Stats base |
|---|---|---|
| Industrial | Biplano | costo 95 · PV bajo-medio · daño medio · cd 10s |
| Moderna | Caza | escala ×1.75 estándar |
Reglas: vuelan a GROUND−90 e **ignoran el bloqueo terrestre** · matriz ampliada: 🏹→✈️ **×1.5** (antiaéreo natural) · ✈️→🛡 **×1.5** · melee y heavy NO alcanzan aéreos · ✈️vs✈️ ×1 · torretas sí alcanzan · objetivo: prioriza heavy, luego base · **máx. 2 por bando en campo** · la IA los usa con las mismas reglas y límites.

**Prueba 15:** matriz aérea correcta · melee no golpea aéreo · límite de 2 · resolución forzada a 210s.

## 2D. Veteranía por regimiento (por imperio × tipo de unidad)

XP compartida: participar +2 · victoria +4 · baja enemiga de ese tipo +1. Derrota con muchas bajas: −20% de barra; barra en 0 = baja un nivel.
Niveles: Nv1 normal · **Nv2 (30 XP): +8% daño** · **Nv3 (80 XP): +15% daño** + rasgo menor (melee +5% def · ranged +10% alcance · heavy −10% cd de ataque · aéreo +10% velocidad).
**Rasgos visuales SOLO cosméticos:** Nv2 insignia/banderín del imperio · Nv3 penacho/estandarte dorado y trazo +10% — la ventaja es EXACTAMENTE la numérica declarada; el visual comunica estatus, jamás oculta bonos. IA con mismas reglas. Se guarda por partida (save v4), no en legado.

**Prueba 16:** XP sube tras batalla · Nv2 aplica +8% · derrota fuerte descuenta 20%.

## 2E. Pesadilla 💀, coalición visible, Resumen del turno y aleatoriedad viva

### Desbloqueo progresivo por dificultad (anti-abrumamiento; también protege al jugador nuevo sin favorecerlo)
| Dificultad | Contenido activo |
|---|---|
| Fácil | sin míticos, sin coalición, veteranía visual simple |
| Normal | héroes comunes y raros, coalición desactivada |
| Difícil | + legendarios, coalición, veteranía completa |
| Pesadilla 🔒 | + míticos, coalición reforzada, IA doble ataque (requiere ≥1 victoria en Difícil en el legado) |

### Pesadilla: IA ingreso ×1.5 · hasta 2 ataques por imperio/ronda · contra-selección 65% · usa especial y héroe apenas disponibles.

### Coalición anti-líder (Difícil/Pesadilla, desde ronda 8; aplica también si el líder es una IA)
```
PoderImperio  = territorios*3 + oro/50 + ciencia/30 + tropas*0.5 + bases*2 + (héroe?2:0)
AmenazaLider  = (PoderLider − PromedioResto) / PromedioResto
ProbCoalición = clamp((Amenaza−0.25)*0.8, 0, 0.75)          // solo si Amenaza>0.25
DeseoUnirse   = Amenaza*0.4 + (rel<0)*0.25 + vecino*0.15 + aggr*0.10 − pactoConLíder*0.25   // se une si >0.45
```
Al activarse: **banner narrativo a pantalla** ("🌍 Tu imperio domina el mundo. [miembros] forman una COALICIÓN para contenerte") + pactos automáticos entre miembros + prioridad de ataque al líder. Dura 3 rondas en Difícil y 4 en Pesadilla; los pactos automáticos duran lo mismo. Expira al completar esa duración o si Amenaza <0.15. Tras expirar entra en cooldown por 2 rondas; después solo puede reformarse si AmenazaLider >0.35.

### Aleatoriedad viva (sustituye tasas fijas; regirá eventos futuros)
```
ProbEvento = clamp(base + tensión*0.12 + escasez*0.10 + ventajaLíder*0.08
                   − repetición*0.15 − saturación*0.10, 0.05, 0.35)
tensión = guerrasRecientes/vivos · escasez = imperiosComida<5/vivos
repetición: mismo evento hace ≤2 rondas · saturación: eventos en últimas 3 rondas
AntiCastigo (TODOS los imperios): ×0.5 si sufrió 2 eventos negativos recientes · ×1.2 si es el líder
```

### Resumen del turno (obligatorio)
Panel compacto tras la fase IA (auto-cierra 5s o al tocar), 3-6 líneas causales: "🦅 Águila atacó Mesoamérica porque tu relación cayó al rechazar su tributo" · "☣ La plaga golpeó a los imperios con comida baja" · "🌍 Coalición: 3 rondas restantes" · "⭐ Desbloqueaste a Gengis Kan: 5 conquistas en una partida".

**Pruebas 17-18:** coalición activa/expira según fórmula · Pesadilla ejecuta 2 ataques/ronda · ProbEvento respeta clamp y anti-repetición.

## 2F. Modo Balance (panel de telemetría local — cierre de la fase)

Activación: `?debug=1` en la URL o 5 toques al título. Registra en localStorage (por partida y acumulado): duración media de batalla · uso y tasa de victoria por unidad y por héroe · daño medio por tipo · victorias por imperio/dificultad · duración de partida · eventos más frecuentes · resultado de duelos por héroe. Solo lectura + botón "copiar JSON" para pegárselo al planner. **Benchmarks:** batalla media 60–180s · ninguna unidad >60% de uso · ningún héroe >65% de winrate en duelo · Pesadilla ganable pero <35% de winrate del jugador experto. Si un benchmark se rompe, se REPORTA (no se auto-ajusta).

**Prueba 19:** telemetría registra una batalla y exporta JSON válido.

---

# FASE 3 — "Mundo Vivo" (NO iniciar sin aprobación; especificación pactada)

- **3A. Unidades de apoyo (5º y 6º rol — no todo pelea de frente):**
  **Sanador** (Chamán→Monje→Médico→Médico de campaña): no ataca; cura 4%/s a aliados en radio 70px; PV bajo; costo medio; **máx. 2 en campo**; prioridad de las IA enemigas al detectarlo.
  **Asedio/ataque indirecto** (Catapulta→Trebuchet→Mortero→Artillería): disparo en arco por encima de aliados, rng 260+, salpicadura pequeña, NO alcanza aéreos, muy débil si lo alcanza un melee; prioriza torretas y base. Ambos con la IA usándolos igual.
- **3B. Monstruos míticos neutrales:** Kraken (rutas marítimas), Amaru salvaje (Andes), Long/Dragón (Asia), Anubis (África). Aparecen con la fórmula de aleatoriedad viva desde ronda 6; saquean territorios (−pop/−oro) hasta ser derrotados en **batalla de jefe** (boss con barra grande, patrones simples de 2 ataques). Recompensa: **reliquia**.
- **3C. Reliquias:** máx. 2 equipadas por imperio; bonos moderados (+8-12%) con tema del monstruo; visibles en panel Imperio; la IA también puede cazar monstruos y equiparlas.
- **3D. Misterios/ruinas:** 1-2 ruinas por partida en territorios aleatorios; expedición cuesta 30🪙; resultado ponderado por la aleatoriedad viva: reliquia menor 25% · oro 30% · ciencia 20% · héroe dormido (progreso de desbloqueo) 10% · maldición (plaga local) 15%.
- **3E. Recursos estratégicos:** Caballos, Hierro, Pólvora, Uranio distribuidos en territorios fijos; controlar el recurso de tu época desbloquea la **variante mejorada** de una unidad (+15% del stat firma). Razón estratégica para querer territorios concretos; visible en el mapa con ícono.
- **3F. Eventos narrativos con arquetipos** (banner legible + Resumen del turno): Rebelión (pop alta+base baja se independiza como facción rebelde) · Edad de Oro · Descubrimiento · Caravana (decisión) · Desastre natural · Cumbre mundial · Embargo. Probabilidades SIEMPRE por aleatoriedad viva.
- **3G. Religiones con bendiciones activas:** gastar Fe en milagros con cooldown de rondas: Curar plaga (30✨) · Bendecir ejército antes de batalla +10% (25✨) · Maldecir territorio enemigo −tropas (40✨, baja relación) · Peregrinación +cultura (20✨). Atributo pasivo leve y distinto por religión de imperio.

# FASE 4 — "Eras y Doctrinas" (pactada, no iniciar)
Época Futura (5ª): Soldado de asalto/Dron francotirador/Mecha/Dron de combate aéreo + especial "Tormenta orbital". **Doctrinas** al avanzar de era (elección única entre 3): Militar (+10% daño, −5% oro) · Comercial (+15% oro, −5% daño) · Mística (+15% fe/cultura, milagros −20% costo). **Pueblos/rasgos por imperio** (militarista/comerciante/místico/navegante/erudito/resiliente): un rasgo pasivo leve y una unidad con sabor propio. **Mapas alternativos** (Pangea, Archipiélago) como presets de datos (TERR/ADJ/SEAROUTES alternos), seleccionables al crear partida, sin recargar.

# FASE 5 — "Campaña II: Mitos del Mundo" (pactada, no iniciar)
5-8 escenarios míticos que son la **vía principal de desbloqueo de los 16 héroes restantes y armas alternativas**: "La ira del Kraken" · "El retorno de Inkarri" · "La Coalición" (todos contra ti desde ronda 1) · "Rebelión Global" · "El Último Bastión" (1 territorio en Pesadilla) · "La Ruta de la Seda" (Gengis/Mansa Musa). Cada escenario indica qué desbloquea antes de jugarlo.

---

## 8. BACKLOG (ideas pactadas — NO implementar hasta nueva orden)
- **Ascenso de Élite de Regimientos:** cuando un regimiento Nv3 (80 XP) cumpla un logro específico podrá ascender a variante élite ("Arqueros de Guardia", "Guardia Imperial") con bono moderado y costo claro (ej. 100🪙+40🎭), máx. 1 élite por imperio al inicio, mismas reglas para IA. No usar el término "evolución". **Solo después de validar la veteranía Nv1-3 con telemetría.**
- Formación táctica previa a batalla (frente/flancos/retaguardia con trade-offs) · Naval simple (transporte, barco ligero, barco de guerra, asedio costero) · Cooperativo local 2J vs IA con refuerzo aliado limitado (1/batalla, cd60s) · Tutorial interactivo de primera partida con victoria guiada · Explicación causal ampliada (historial navegable) · Multijugador online: NO (requiere backend; fuera de alcance del proyecto).

## 9. Registro de decisiones (por qué)
- 8 héroes jugables primero y 24 definidos: validar antes de expandir; los 16 restantes dan propósito a Campaña II y logros.
- Sin política contemporánea real: envejece mal y genera conflicto; arquetipos dan el mismo sabor.
- Coalición y anti-castigo aplican a todos los imperios: mantener el pilar 4 (no servir al jugador; desafiarlo).
- Duelo nunca decide la batalla: el imperio (economía, tropas, territorio) es el protagonista; el héroe suma.
- Rasgos visuales de veteranía cosméticos: distinguir a quien lleva tiempo jugando sin romper equidad.
- Telemetría antes de re-balancear: los números se ajustan con datos del Modo Balance, no a ojo.
