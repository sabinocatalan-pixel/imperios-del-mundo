# Fase 3C — Reliquias equipables

**Estado:** no iniciada. Este documento es contrato de planificación, no evidencia de implementación.

## Objetivo

Convertir las cuatro recompensas inertes de 3B en decisiones equipables, visibles y moderadas, cerrando el ciclo `monstruo → victoria → recompensa útil`.

## Alcance propuesto

| Monstruo | Recompensa propuesta | Efecto candidato | Restricción |
|---|---|---|---|
| Kraken | Perla del Abismo | Defensa costera | Solo territorios costeros |
| Amaru | Escama de Amaru | Recuperación del héroe entre batallas | Sin efecto en duelo |
| Long | Aliento del Long | Primera oleada ofensiva mejorada | Solo al atacar |
| Anubis | Ankh de Anubis | Recuperación parcial tras defensa exitosa | Una vez por ronda |

Los nombres, porcentajes y el número de slots requieren aprobación antes de programar. La fuente estratégica propone **un slot equipado** para evitar combinaciones explosivas; cualquier cambio debe resolverse aquí antes del código.

## Sistemas permitidos

- Modelo declarativo de cuatro reliquias.
- Inventario por imperio y slot equipado.
- Equipar/desequipar solo al inicio del turno.
- Panel Imperio, tooltip e indicador compacto.
- Migración retrocompatible desde save v5.
- Telemetría de uso y resultado.
- IA con las mismas reglas de posesión y equipamiento.

## Fuera de alcance

- Nuevos monstruos o patrones.
- Cambios al spawn, saqueo o caza de 3B.
- Bases, saqueo de reliquias o counters futuros.
- Reliquias aleatorias adicionales.
- Rediseño visual fuerte.

## Sprints propuestos

1. Datos, inventario, slot y migración.
2. Reglas de equipar/desequipar.
3. Efectos aislados, uno por reliquia.
4. UI y explicación causal.
5. IA y Modo Balance.
6. Regresión, partidas comparativas y QA móvil.

## Criterios de aceptación

- Cuatro recompensas existentes se convierten sin duplicarse.
- Equipar y desequipar es reversible y persiste.
- Saves v5 sin inventario cargan correctamente.
- Efecto y restricción son visibles antes de equipar.
- Jugador e IA siguen idénticas reglas.
- Ninguna reliquia cambia el winrate más de 5 puntos porcentuales sin revisión.
- Tutorial actualizado y suite completa verde.

## Riesgos

Power creep, combinaciones con héroes/veteranía, atribución incorrecta a la IA, duplicación de recompensas y migración. Mitigación: un efecto por sprint, pruebas deterministas y telemetría antes de ajustar.
