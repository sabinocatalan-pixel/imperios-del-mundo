# Fase 3G — IA y dificultad

**Estado:** futura; última fase mecánica antes del feature freeze.

## Objetivo

Conseguir que la IA utilice reliquias, counters, economía y estructuras ya cerrados, y que la dificultad provenga de mejores decisiones explicables.

## Principio de equidad

La IA usa las mismas reglas, costes, límites y efectos. Cualquier multiplicador heredado de dificultades actuales debe auditarse explícitamente; no se añaden bonos ocultos nuevos.

## Capas candidatas

| Nivel | Comportamiento propuesto |
|---|---|
| Fácil | Decisiones simples y errores deliberados visibles |
| Normal | Counters y reliquias razonables |
| Difícil | Timing, fronteras, economía y coordinación mejorados |
| Pesadilla | Mantener identidad vigente y revisar justicia con telemetría |

## Heurísticas por bloques

1. Composición según defensor y counters.
2. Presupuesto económico y mantenimiento.
3. Oportunismo sobre territorios debilitados.
4. Reliquias, torres y activables en momentos coherentes.
5. Calibración IA vs IA y rendimiento móvil.

## Presupuesto técnico

- Turno de IA objetivo: menos de 1 segundo en móvil medio.
- Heurísticas declarativas y acotadas; sin búsqueda exhaustiva.
- Cada decisión importante produce motivo causal reutilizable por Resumen.

## Criterios de aceptación

- IA usa todos los sistemas nuevos sin acceso privilegiado.
- Curva objetivo a validar: Fácil ~70%, Normal ~50%, Difícil ~30% de victoria humana; Pesadilla se calibra aparte.
- Ninguna dificultad rompe partidas 2J o escenarios.
- Tiempo de turno medido y registrado.
- Suite completa y sesiones largas sin bloqueo.
