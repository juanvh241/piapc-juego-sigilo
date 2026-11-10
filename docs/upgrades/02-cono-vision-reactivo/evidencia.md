# Evidencia — Upgrade 2: Cono de visión visible y reactivo

- **Versión inicial:** `3b1744d`. **Versión final:** el commit informado en la entrega.
- **Herramienta:** Claude Code (modelo Claude Opus 5.5). Spec y plan aprobados por Juan Martin Vianco Hail el 2026-11-10.

## Registro breve

1. **Incremento 1:** función pura `coneStyle` en `src/game/presentation/coneStyle.ts`, sin Phaser. `npx vitest run tests/presentation`: pasa.
   - **Desvío del plan:** las pruebas de los upgrades 2, 4 y 8 comparten `tests/presentation/presentation.test.ts`, en lugar de un archivo por upgrade.
2. **Incremento 2:**
   - `GameScene.drawPerception` usa `coneStyle(estado, visible)` y dibuja borde en Investigar, Buscar y Perseguir.
   - El color del guardia usa la misma tabla (`CONE_COLORS`).
3. **Validación final:** `npm run validate`: 107/107 pruebas; build OK.

## Diff

- `src/game/presentation/coneStyle.ts` (nuevo).
- `src/game/scenes/GameScene.ts`: estilo del cono y colores del guardia unificados.

## Matriz criterio → evidencia

| Criterio | Comprobación | Resultado real | Estado |
|---|---|---|---|
| U2-AC1 | `presentation.test.ts`, "upgrade 2" (5 estados × visible/no visible = 10 casos) | Colores y bordes según la tabla de la spec; opacidad 0,16 en reposo y 0,32 visible | Cumple |
| U2-AC2 | Revisión del código de `drawPerception` | El arco usa `LAB_GUARD_CONFIG.visionRange` y `LAB_GUARD_CONFIG.fieldOfViewRadians`, los mismos valores que recibe `updatePerceptionSimulation` en el controlador | Cumple |
| U2-AC3 | Suite completa | Las pruebas de percepción y de la FSM no se modificaron y pasan | Cumple |
| Visual | Prueba humana, 2026-11-10 | Juan comprobó el cambio de color por estado, el borde en alerta y la mayor intensidad al ser visto | Cumple |

## Revisión y decisión

- **Límite:** el cono no dibuja la oclusión: se ve "atravesando" paredes, aunque la detección real sí las respeta. Mostrarla requeriría un raycast visual, fuera de alcance.
- **Límite:** los colores no se probaron con daltonismo.
- **Decisión humana:** **integrar**.
