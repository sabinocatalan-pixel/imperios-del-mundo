# Checklist acumulativo de QA

## Puerta común para cualquier bloque

- [ ] Alcance coincide con su documento de fase.
- [ ] Un commit lógico con mensaje en español.
- [ ] Sin dependencias/runtime externos nuevos.
- [ ] `npm.cmd run build` correcto.
- [ ] `npm.cmd test` 100% verde.
- [ ] `git diff --check` sin errores.
- [ ] `git status --short` entendido.
- [ ] Guardado anterior carga y guardado nuevo hace round-trip.
- [ ] Jugador e IA usan las mismas reglas.
- [ ] UI móvil, safe areas, botones de al menos 44 px y movimiento reducido.
- [ ] Resumen explica causalmente eventos importantes.
- [ ] Sin push, tag o publicación antes de aprobación.

## Cierre 3F — `v5.9.0-fase3F`

- [x] Matriz declarativa completa de 36 cruces.
- [x] Valores `×1.50`, `×0.75`, `×1.00` y `×0.00` aplicados.
- [x] Reglas especiales de sanador, asedio, aérea y héroe verificadas.
- [x] Duelo, boss y salpicadura secundaria excluidos correctamente.
- [x] Reliquias y veteranía sin multiplicación duplicada.
- [x] Botones con “Vence a / Débil contra / No alcanza”.
- [x] Indicadores `▲/▼` y banner causal único por matchup.
- [x] Ayuda rápida actualizada.
- [x] Modo Balance registra matchups, bajas, estructuras, composiciones y unidades sin objetivo.
- [x] Exportación JSON válida y datos anteriores compatibles.
- [x] Build correcto.
- [x] Suite **47/47**.
- [x] Auditoría de contenido interno limpia.
- [x] GitHub Pages verificado con HTTP 200.
- [x] Prueba manual en PC aprobada.
- [x] Prueba móvil aceptable: los controles no se rompen.
- [x] Tag y publicación verificados por CI.

### Observación móvil no bloqueante

Los botones contienen bastante información, pero permanecen utilizables. Una fase visual futura podrá compactarlos si la evidencia móvil lo justifica, sin cambiar la matriz ni el balance.

## Próximas puertas

- [ ] 3D valida economía, reclutamiento y duración de partida.
- [ ] 3E valida defensa territorial y respuesta antiaérea.
- [ ] 3G consume las señales de 3F sin bonos ocultos.
- [ ] Feature freeze aprobado antes de 4A.
