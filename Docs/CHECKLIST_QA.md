# Checklist acumulativo de QA

## Puerta común para cualquier bloque

- [ ] Alcance coincide con su documento `FASE_*.md`.
- [ ] Un commit lógico con mensaje en español.
- [ ] Sin dependencias/runtime externos nuevos.
- [ ] `npm.cmd run build` correcto.
- [ ] `npm.cmd test` 100% verde.
- [ ] `git diff --check` sin errores.
- [ ] `git status --short` entendido; sin cambios accidentales.
- [ ] Guardado anterior carga y guardado nuevo hace round-trip.
- [ ] Jugador e IA usan las mismas reglas.
- [ ] UI móvil, safe areas, botones ≥44 px y movimiento reducido.
- [ ] Resumen explica causalmente eventos importantes.
- [ ] Sin push, tag o publicación antes de aprobación.

## Cierre 3B — referencia actual

- [x] Cuatro monstruos, máximo uno activo y spawn desde ronda 6.
- [x] Mapa, leyenda, panel, saqueo y desafío visibles.
- [x] Batalla boss, retirada, PV persistente y límite 180 s.
- [x] Dos patrones por jefe con aviso.
- [x] IA cazadora y recompensa inerte.
- [x] Tutorial ligero y preferencia persistente.
- [x] Suite **35/35**.
- [ ] Publicación/tag de 3B autorizados y verificados en CI.

## QA manual móvil 3B

- [ ] Ayuda `?`: encabezado sin desbordar.
- [ ] Hoja inferior desplazable y cierre fijo.
- [ ] “No volver a mostrar” persiste tras recarga.
- [ ] Marcador/leyenda/panel no se superponen.
- [ ] Patrones legibles con `SET.fx` activado y reducido.
- [ ] Jefe dura aproximadamente 75–130 s; nunca supera 180 s.
- [ ] Guardar/cargar conserva amenaza, saqueos, PV, intentos y recompensa.

## Plantilla para fases futuras

- [ ] Migración desde última versión publicada.
- [ ] Pruebas unitarias de reglas y límites.
- [ ] Prueba de simetría IA/jugador.
- [ ] Prueba de no duplicación/reentrada.
- [ ] Regresión de batalla normal, boss, 2J y escenarios.
- [ ] Modo Balance registra las nuevas decisiones.
- [ ] Tutorial actualizado sin prometer funciones inexistentes.
- [ ] Sesión manual de 5–15 min y rendimiento móvil.
- [ ] Decisión publicar/corregir registrada.

## Feature freeze y 4A

- [ ] 3C–3G publicadas.
- [ ] Una semana sin bugs críticos.
- [ ] Telemetría en rangos.
- [ ] Freeze aprobado por Gabriel.
- [ ] Inventario visual y presupuesto de assets aprobados.
