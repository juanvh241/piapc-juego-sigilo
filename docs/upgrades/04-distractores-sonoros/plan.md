# Plan — Upgrade 7: Distractores sonoros

Estado: Aprobado por Juan Martin Vianco Hail el 2026-11-10, sin cambios

| Incremento | Trabajo | Archivos previstos | Validación |
|---|---|---|---|
| 1 | `throwDistraction` con validaciones y pruebas | `src/application/simulation/distraction.ts`, `tests/application/distraction.test.ts` | `npx vitest run tests/application` |
| 2 | Integración: prueba con el controlador y clic en la escena | `tests/application/distraction.test.ts`, `src/game/scenes/GameScene.ts`, `index.html` (texto de controles) | `npm run validate` y prueba en el juego |

**Riesgos:**
- Que el clic se confunda con el antiguo "mover al guardia": se documenta el cambio en el texto de controles.
- Que el guardia vaya hacia el jugador y no hacia el ruido: lo cubre U7-AC2.

**Detenerse si:** hace falta cambiar la FSM o la percepción.
