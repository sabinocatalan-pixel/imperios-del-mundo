# Fase 4A — Visual Polish y claridad táctica

**Estado:** bloqueada. No iniciar antes del feature freeze aprobado.

## Condiciones de entrada

1. 3C, 3F, 3D, 3E y 3G publicadas y estables.
2. Al menos una semana sin bugs críticos.
3. Telemetría dentro de rangos acordados.
4. Feature freeze firmado: ninguna mecánica nueva durante 4A.

## Objetivo

Dar identidad visual coherente y hacer legibles todas las reglas congeladas sin cambiar fórmulas, balance ni comportamiento de IA.

## Inventario preliminar

- Mapa: océano, relieve, fronteras, selección, amenazas y estructuras.
- Unidades: silueta por rol/época, legibilidad de bando y veteranía.
- Monstruos: presencia temática y telegráficos coherentes.
- Bases/torres: nivel, estado y daño visibles.
- Combate: daño, curación, ventaja, resistencia y estados.
- HUD: jerarquía de recursos, alertas, cooldowns y límites.
- Recompensas: reliquias y propietario fáciles de reconocer.
- Tutorial: capturas/diagramas solo si las reglas finales lo requieren.

## Clasificación

- **Diseño:** paleta, tipografía, iconografía y prototipos antes de código.
- **Visual seguro:** CSS, SVG, animación, layout, tooltips y feedback sin cambiar estado.
- **No pertenece a 4A:** counters, stats, economía, torres funcionales, reliquias o IA.

## Criterios de aceptación

- Una identidad consistente en mapa, batalla, paneles, ayuda y menús.
- El jugador puede reconocer ventaja, amenaza, estructura y recompensa sin abrir menús adicionales.
- Carga objetivo <3 s en móvil medio y PWA offline intacta.
- `prefers-reduced-motion`, `SET.fx`, safe areas y controles ≥44 px respetados.
- Suite lógica 100% verde y QA visual por pantalla/tamaño.

## Control de alcance

Un sprint por pantalla. Assets nuevos deben tener presupuesto de peso y procedencia segura. Cualquier solicitud que cambie una regla vuelve a la fase mecánica correspondiente.
