# Roadmap operativo — Imperios del Mundo IV

> Fuente: `PLAN_MAESTRO_IMPERIOS_DEL_MUNDO_IV.md`. Gobernanza: `AGENTS.md`, `CLAUDE.md` y `PLAN-MAESTRO.md` de esta carpeta.

## Estado de referencia

- Fase 3B funcionalmente completa y aprobada en prueba manual inicial.
- Build correcto y suite vigente: **35/35**.
- Fase 3C no iniciada: las recompensas de monstruos siguen siendo inertes.
- Fase 4A no autorizada: el rediseño visual fuerte espera al cierre de mecánicas.

## Regla de oro

> **Mecánica → Balance → Claridad → Estética.**

No se embellece una regla todavía inestable. Cada fase define primero su mecánica, valida números, explica causalmente el resultado y solo entonces recibe polish visual.

## Orden aprobado

1. **Publicar 3B** — monstruos míticos, IA cazadora, tutorial y recompensa inerte.
2. **3C Reliquias** — cerrar el ciclo de recompensa de los jefes.
3. **3F Counters** — congelar las reglas de composición y daño.
4. **3D Recursos y población** — dar propósito económico a recursos existentes.
5. **3E Bases y torres** — construir defensa sobre counters y economía ya definidos.
6. **3G IA y dificultad** — enseñar a la IA a usar las reglas congeladas.
7. **Feature freeze** — sin mecánicas nuevas; corrección, telemetría y estabilización.
8. **4A Visual Polish** — salto visual y claridad táctica final.

## Puertas entre fases

| Paso | Entrada mínima | Salida obligatoria |
|---|---|---|
| Publicar 3B | 35/35, QA manual móvil | Tag/push solo con autorización explícita |
| 3C | 3B publicada | Migración retrocompatible, efectos medidos, QA |
| 3F | 3C estable | Matriz completa documentada y comprensible |
| 3D | Counters congelados | Economía útil sin aumentar la partida >15% |
| 3E | Costes y counters estables | Ataques exitosos en rango 40–60% |
| 3G | Sistemas 3C–3E cerrados | IA <1 s/turno móvil y dificultad calibrada |
| Feature freeze | 3C–3G publicadas | ≥1 semana sin bugs críticos y telemetría en rango |
| 4A | Freeze firmado | Presentación mejorada sin alterar reglas |

## Política de publicaciones

- Publicar 3B antes de iniciar 3C.
- Publicar 3C como hito propio.
- Publicar 3F + 3D como paquete de combate/economía.
- Publicar 3E + 3G tras calibración.
- No acumular más de dos fases sin una publicación estable.

## Control de cambios

Toda desviación del orden debe registrar fecha, decisión, responsable, motivo, impacto en saves/pruebas y nueva puerta de aprobación.
