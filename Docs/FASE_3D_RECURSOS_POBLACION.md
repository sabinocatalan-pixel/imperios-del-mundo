# Fase 3D — Recursos y población

**Estado:** futura; iniciar después de cerrar 3F.

## Objetivo

Dar una pregunta estratégica distinta a oro, comida, ciencia, fe, cultura y población sin convertir el juego móvil en microgestión.

## Contrato de diseño

| Sistema | Pregunta | Sink candidato |
|---|---|---|
| Oro | ¿Cuánto ejército sostengo? | Reclutamiento y mantenimiento visible |
| Comida | ¿Cuánto crece mi imperio? | Crecimiento o reducción poblacional |
| Ciencia | ¿Qué desbloqueo? | Pocas mejoras declarativas |
| Fe | ¿Qué momento decisivo compro? | Milagros limitados y caros |
| Cultura | ¿Cómo progreso sin guerra total? | Presión fronteriza explicada |
| Población | ¿Cuál es mi capacidad militar? | Techo visible de tropas |

Las fórmulas, costes y umbrales se aprueban antes de implementar. La primera entrega debe limitarse a población + comida; no introducir todos los sinks en un solo commit.

## Bloques

1. Población como techo y línea `Población usada/capacidad`.
2. Crecimiento/decrecimiento por comida.
3. Mantenimiento de tropas en oro.
4. Mejoras de ciencia.
5. Activables de fe.
6. Presión cultural.
7. IA económica mínima y regresión completa.

## Límites de complejidad

No implementar felicidad, impuestos variables, migraciones, edificios poblacionales ni cadenas de producción. Máximo tres decisiones importantes por turno y una explicación causal por cambio relevante.

## Criterios de aceptación

- Cada recurso tiene al menos un uso activo y distinguible.
- La población limita reclutamiento con UI clara.
- IA no colapsa por mantenimiento o escasez.
- Saqueo de monstruos sigue respetando población mínima.
- Duración de partida permanece dentro de ±15% del referente.
- Save migra y tutorial se actualiza.
