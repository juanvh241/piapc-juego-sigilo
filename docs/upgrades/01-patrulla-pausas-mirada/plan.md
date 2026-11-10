# Plan — Upgrade 1: Patrulla con pausas y mirada

Estado: Aprobado por Juan Martin Vianco Hail el 2026-11-10, sin cambios

| Incremento | Trabajo | Archivos previstos | Validación |
|---|---|---|---|
| 1 | Pausa en el dominio: `pauseEndsAtMs` en T10 y T11; Tick ignorado mientras dura | `src/domain/behavior/guardFsm.ts`, `tests/behavior/guardFsm.test.ts` | `npx vitest run tests/behavior` |
| 2 | Controlador: sin ruta durante la pausa; barrido de mirada; HUD | `src/application/simulation/guardController.ts`, `src/game/scenes/GameScene.ts`, `tests/application/guardController.test.ts` | `npx vitest run tests/application`, luego `npm run validate` |

**Riesgos:**
- Las trazas existentes pueden cambiar de tiempo, porque Regresar llega a un punto y ahora pausa.
- Un barrido mal calculado puede dejar la mirada torcida.

**Detenerse si:** hay que tocar percepción o navegación, aparece una regresión no explicada o la pausa obliga a cambiar el contrato de otro estado.
