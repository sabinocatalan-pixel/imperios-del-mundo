# Fase 3F — Counters de unidades

**Estado:** futura; iniciar solo después de publicar y estabilizar 3C.

## Objetivo

Hacer que la composición del ejército importe y que el jugador comprenda, antes y durante el combate, por qué una unidad tiene ventaja.

## Modelo candidato

- Triángulo principal: melee vence a distancia; distancia vence a pesada; pesada vence a melee.
- Aérea caza retaguardia y es vulnerable a distancia.
- Asedio es fuerte contra estructuras y vulnerable a melee/aérea.
- Sanador no ataca y queda fuera del triángulo.
- Multiplicador candidato: `1.5×` favorable y `0.75×` desfavorable.

La matriz **6×6 exacta debe aprobarse primero en `BALANCE_NOTES.md`**. No se cambia `counterMult()` hasta que cada cruce tenga resultado definido, incluida veteranía y héroes.

## Bloques

1. Matriz declarativa y casos sin efecto.
2. Aplicación centralizada al daño.
3. Tooltip “Fuerte vs / Débil vs”.
4. Indicador verde/rojo en batalla y ayuda compacta.
5. Simulaciones espejo, ejército mixto y calibración.

## Fuera de alcance

- Añadir tipos de unidad.
- Cambiar héroes, monstruos, economía o mapa.
- Alterar torres antes de 3E.
- Polish visual general de 4A.

## Criterios de aceptación

- Matriz completa y sin ambigüedades.
- Misma regla para IA y jugador.
- Ninguna unidad globalmente por encima de 60% o debajo de 40% de victoria tras muestra suficiente.
- Composición mixta sigue siendo viable.
- Sanador conserva rol de soporte y asedio su rango mínimo.
- Batallas boss y normales pasan regresión.

## Riesgos

Combate binario, doble aplicación con reglas actuales, invisibilidad del multiplicador y conflicto con veteranía. Cada ajuste numérico se registra con evidencia en `BALANCE_NOTES.md`.
