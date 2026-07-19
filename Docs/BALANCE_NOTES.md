# Notas vivas de balance

> Registrar números, evidencia y decisiones. Un benchmark roto genera una advertencia, nunca un ajuste automático.

## Línea base vigente

- Fecha de referencia: 2026-07-19.
- Versión pública: `v5.9.0-fase3F` (`3a85cbd`).
- Suite: **47/47**.
- Partida objetivo: 5–15 min.
- Batalla normal: 60–210 s; benchmark medio 60–180 s.
- Batalla boss: objetivo 75–130 s; corte de seguridad 180 s.
- Matriz counter: ventaja `×1.50`, desventaja `×0.75`, neutral `×1.00`, inalcanzable `×0.00`.
- Aérea contra estructura: `×0.75`; asedio contra estructura: `×1.00` hasta 3E.
- Héroe contra pesada: `×0.85`; distancia contra héroe: neutral.

## Benchmarks

| Métrica | Rango objetivo | Fuente |
|---|---:|---|
| Uso de una unidad | ≤60% | Modo Balance |
| Winrate de duelo por héroe | ≤65% | Modo Balance |
| Impacto de una reliquia | ≤5 puntos de winrate | Comparativa 3C |
| Ataques exitosos tras 3E | 40–60% | Telemetría futura |
| Turno IA | <1 s en móvil medio | Medición 3G |
| Victoria humana futura | Fácil ~75% / Normal ~50% / Difícil ~30% / Pesadilla 10–15% | Calibración 3G |

## Riesgos pendientes observados

- Difícil sigue sintiéndose fácil para un jugador avanzado; corresponde a 3G.
- Las unidades aéreas continúan mostrando daño alto; medir daño estructural y resultados antes de ajustar.
- Pachacútec sigue fuerte en duelos; separar percepción manual de una muestra suficiente.
- La IA puede desplegar unidades sin objetivo contra composiciones aéreas.
- Distancia cubre pesada y aérea; medir uso, daño y resultados con más partidas.
- No ajustar balance por intuición ni por una sola sesión.

## Base para 3G

3F expone datos suficientes para decisiones futuras explicables:

- matriz declarativa y restricciones de objetivo;
- matchups y multiplicador aplicado;
- unidades incapaces de atacar;
- daño estructural por tipo;
- composiciones y resultados;
- propietario jugador/IA y contexto de reliquia.

3G podrá usar estas señales para reclutar counters y responder a aérea, héroes y composiciones dominantes. Debe hacerlo con las mismas reglas, sin recursos ocultos, rubber-banding ni trampas.

## Decisión vigente

- **Fase / versión:** 3F / `v5.9.0-fase3F`.
- **Resultado:** publicada y estable.
- **Cambio posterior:** ninguno hasta reunir muestra suficiente o abrir la fase correspondiente.
- **Aprobación:** cierre manual y técnico aprobado.

## Reglas

1. Mecánica → Balance → Claridad → Estética.
2. Un ajuste por experimento.
3. Registrar también decisiones de no cambiar.
4. Separar percepción manual de evidencia telemétrica.
5. Ningún benchmark provoca un ajuste automático.
