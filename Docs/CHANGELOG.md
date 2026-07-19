# Changelog

## v5.9.0-fase3F — Counters de unidades

Publicada el 19 de julio de 2026.

### Añadido

- Matriz declarativa 6×6 para melee, distancia, pesada, sanador, asedio y aérea.
- Reglas especiales para héroe y daño a estructuras.
- Textos “Vence a / Débil contra / No alcanza” en controles de batalla.
- Indicadores `▲` y `▼` en golpes favorables y desfavorables.
- Banner causal mostrado una vez por matchup y batalla.
- Sección de counters en la ayuda rápida.
- Telemetría de ataques, daño promedio, bajas y resultados por matchup.
- Daño estructural desglosado por tipo.
- Registro de composiciones y unidades sin objetivo válido.
- Exportación JSON ampliada y retrocompatible en Modo Balance.

### Cambiado

- Desventaja del triángulo de counters de `×0.66` a `×0.75`.
- Aérea causa `×0.75` contra estructuras.
- La selección de objetivos consulta la matriz declarativa compartida.

### Conservado

- Asedio mantiene `×1.00` contra estructuras hasta 3E.
- Duelo de campeones y batalla boss quedan fuera de los counters normales.
- Salpicadura secundaria no duplica multiplicadores.
- Reliquias y veteranía mantienen su comportamiento.
- IA estratégica sin cambios; 3F solo deja señales para una fase posterior.

### Validación

- Build correcto.
- Suite **47/47**.
- QA manual en PC y móvil aprobado.
- CI y GitHub Pages verificados.
