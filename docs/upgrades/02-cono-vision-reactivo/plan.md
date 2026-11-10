# Plan — Upgrade 2: Cono de visión reactivo

Estado: Aprobado por Juan Martin Vianco Hail el 2026-11-10, sin cambios

| Incremento | Trabajo | Archivos previstos | Validación |
|---|---|---|---|
| 1 | Función pura `coneStyle` y sus pruebas | `src/game/presentation/coneStyle.ts`, `tests/presentation/coneStyle.test.ts` | `npx vitest run tests/presentation` |
| 2 | Usar el estilo en `drawPerception` | `src/game/scenes/GameScene.ts` | `npm run validate` y prueba en el juego |

**Riesgos:**
- Que el dibujo use otro alcance que la percepción y engañe al jugador. Se controla tomando la geometría de la misma configuración.

**Detenerse si:** el cambio necesita tocar la percepción.
