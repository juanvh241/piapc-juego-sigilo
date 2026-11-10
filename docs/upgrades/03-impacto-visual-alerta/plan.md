# Plan — Upgrade 4: Impacto visual de alerta

Estado: Aprobado por Juan Martin Vianco Hail el 2026-11-10, sin cambios

| Incremento | Trabajo | Archivos previstos | Validación |
|---|---|---|---|
| 1 | Disparador puro con enfriamiento y sus pruebas | `src/game/presentation/alertImpact.ts`, `tests/presentation/alertImpact.test.ts` | `npx vitest run tests/presentation` |
| 2 | Ejecutar shake y flash en la escena, y registrar `[alerta]` | `src/game/scenes/GameScene.ts` | `npm run validate` y prueba en el juego |

**Riesgos:**
- Efecto repetido si el estado oscila.
- Molestia visual si dura demasiado.

**Detenerse si:** el efecto requiere cambiar la FSM o la detección.
