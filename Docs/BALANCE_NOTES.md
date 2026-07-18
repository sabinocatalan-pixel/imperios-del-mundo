# Notas vivas de balance

> Registrar números, evidencia y decisiones. No ajustar automáticamente por un benchmark roto.

## Línea base vigente

- Fecha de referencia: 2026-07-18.
- Estado: Fase 3B funcionalmente completa; 3C no iniciada.
- Suite: **35/35**.
- Partida objetivo: 5–15 min.
- Batalla normal: 60–210 s; benchmark de media 60–180 s.
- Batalla boss: objetivo 75–130 s; corte de seguridad 180 s.
- Spawn de monstruo: desde ronda 6, base `0.07`, Aleatoriedad Viva, máximo uno activo.
- Saqueo: cada dos rondas.
- IA cazadora: `DeseoCazar ≥ 0.55`, requisitos compartidos y daño persistente.

## Benchmarks

| Métrica | Rango objetivo | Fuente |
|---|---:|---|
| Uso de una unidad | ≤60% | Modo Balance |
| Winrate de duelo por héroe | ≤65% | Modo Balance |
| Ataques exitosos tras 3E | 40–60% | Telemetría futura |
| Impacto de una reliquia | ≤5 puntos de winrate | Comparativa 3C |
| Turno IA | <1 s móvil medio | Medición 3G |
| Victoria humana candidata | Fácil 70% / Normal 50% / Difícil 30% | Calibración 3G |

## Propuestas pendientes — no implementadas

- 3C: efectos y número de slots de reliquia.
- 3F: matriz 6×6; candidato `1.5× / 0.75×`.
- 3D: crecimiento, mantenimiento, mejoras y activables.
- 3E: costes/PV de torres y penalización de base.
- 3G: nueva curva de decisión sin bonos ocultos adicionales.

## Plantilla de decisión

### AAAA-MM-DD — título

- **Fase / versión:**
- **Problema observado:**
- **Datos:** muestra, dificultad, duración, composición y resultado.
- **Cambio propuesto:**
- **Impacto esperado:**
- **Riesgo:**
- **Aprobación:** pendiente/aprobado/rechazado.
- **Resultado posterior:**

## Reglas

1. Mecánica → Balance → Claridad → Estética.
2. Un ajuste por experimento; no mover varios números a la vez.
3. Registrar también decisiones de no cambiar.
4. Separar percepción manual de evidencia telemétrica.
5. Ningún benchmark provoca un ajuste automático.
