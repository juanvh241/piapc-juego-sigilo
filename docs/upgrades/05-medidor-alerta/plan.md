# Plan — Upgrade 8: Medidor de alerta

Estado: Aprobado por Juan Martin Vianco Hail el 2026-11-10, sin cambios

| Incremento | Trabajo | Archivos previstos | Validación |
|---|---|---|---|
| 1 | `updateAlertMeter` y `alertLevel`, con sus pruebas | `src/game/presentation/alertMeter.ts`, `tests/presentation/alertMeter.test.ts` | `npx vitest run tests/presentation` |
| 2 | Barra, etiqueta y borde rojo en la escena | `src/game/scenes/GameScene.ts` | `npm run validate` y prueba en el juego |

**Riesgos:**
- Que la barra quede pegada en ALERTA por oscilaciones de la visión. Lo mitiga la bajada lenta y se observa jugando.
- Que tape el HUD: se ubica arriba a la izquierda, debajo del título.

**Detenerse si:** el medidor necesita alimentar la FSM, porque eso sería un cambio de conducta fuera de alcance.
