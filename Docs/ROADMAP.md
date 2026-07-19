# Roadmap operativo — Imperios del Mundo IV

> Gobernanza: `AGENTS.md`, `CLAUDE.md` y `PLAN-MAESTRO.md` de esta carpeta.

## Estado de referencia

- Fase 3B publicada como `v5.7.0-fase3B`.
- Fase 3C publicada como `v5.8.0-fase3C`.
- Fase 3F publicada como `v5.9.0-fase3F` (`3a85cbd`).
- Build correcto, suite vigente **47/47** y GitHub Pages verificado con HTTP 200.
- 3D Recursos/Población, 3E Bases/Torres y 3G IA/Dificultad siguen pendientes.
- 4A no está autorizada: el trabajo visual fuerte espera al cierre de mecánicas.

## Regla de oro

> **Mecánica → Balance → Claridad → Estética.**

No se embellece una regla todavía inestable. Cada fase define primero su mecánica, valida números, explica causalmente el resultado y solo entonces recibe polish visual.

## Orden aprobado

1. **3B Monstruos míticos** — publicada.
2. **3C Reliquias** — publicada.
3. **3F Counters** — publicada; matriz táctica congelada y medible.
4. **3D Recursos y población** — pendiente; dar propósito económico a recursos existentes.
5. **3E Bases y torres** — pendiente; construir defensa sobre counters y economía definidos.
6. **3G IA y dificultad** — pendiente; enseñar a la IA a usar las reglas cerradas.
7. **Feature freeze** — sin mecánicas nuevas; corrección, telemetría y estabilización.
8. **4A Visual Polish** — claridad y presentación final sin alterar reglas.

## Puertas entre fases

| Paso | Entrada mínima | Salida obligatoria |
|---|---|---|
| 3D | Counters 3F publicados | Economía útil sin aumentar la partida más de 15% |
| 3E | Costes y counters estables | Ataques exitosos en rango 40–60% |
| 3G | Sistemas 3C–3E cerrados | IA menor de 1 s/turno móvil y dificultad calibrada |
| Feature freeze | 3C–3G publicadas | Al menos una semana sin bugs críticos y telemetría en rango |
| 4A | Freeze firmado | Presentación mejorada sin alterar reglas |

## Base que 3F deja para 3G

- Matriz declarativa 6×6 consultable por cualquier sistema.
- Matchups favorables, desfavorables, neutrales e inalcanzables medibles.
- Detección de unidades que no pueden atacar la composición rival.
- Daño a estructuras desglosado por tipo.
- Composiciones y resultados observables en Modo Balance.
- Señales para que la IA futura reclute counters y responda mejor, sin recursos ocultos ni trampas.

3F no cambia la IA estratégica: solamente deja datos estables para que 3G pueda tomar decisiones explicables.

## Control de cambios

Toda desviación del orden debe registrar fecha, decisión, responsable, motivo, impacto en guardados/pruebas y nueva puerta de aprobación.
