# Fase 3E — Bases y torres

**Estado:** futura; depende de counters 3F y economía 3D cerrados.

## Objetivo

Dar identidad defensiva a los territorios sin crear partidas inmóviles: la base es un objetivo estratégico y la torre una inversión con coste de oportunidad.

## Diseño candidato

### Base

- Una base principal por imperio en territorio inicial.
- Bono económico pequeño y visible.
- Perderla no elimina al imperio; aplica una penalización temporal explicada.
- Reconquistarla elimina la penalización.

### Torres

- Máximo una por territorio.
- Coste en recursos definidos por 3D.
- PV y ataque propios dentro de la batalla territorial.
- Asedio como counter explícito.
- Sin producción de recursos; mantenimiento para evitar turtling.

Los valores candidatos del plan (+10% local, −25% global/3 rondas) **no son definitivos**. Deben entrar primero en `BALANCE_NOTES.md` y probarse.

## Bloques

1. Estado de base, pérdida y reconquista.
2. Construcción y coste de torre.
3. Torre en batalla y relación con asedio.
4. Indicadores mínimos de mapa e IA.
5. Anti-turtling, telemetría y QA.

## Criterios de aceptación

- Perder base duele sin eliminar prematuramente.
- Torre tiene coste, PV, daño, límite y counter visibles.
- IA construye y prioriza estructuras con las mismas reglas.
- Ataques exitosos se mantienen en 40–60% tras muestra suficiente.
- Mapa continúa legible en móvil.
- No se altera la matriz de 3F durante esta fase.
