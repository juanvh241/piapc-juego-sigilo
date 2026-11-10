# Evidencia — Upgrade 1: Patrulla con pausas y mirada

- **Versión inicial:** `3b1744d`. Árbol limpio; `npm run validate`: 81/81 pruebas y build OK.
- **Versión final:** el commit informado en la entrega (rama `upgrades` integrada a `main`).
- **Herramienta:** Claude Code (modelo Claude Opus 5.5). Spec y plan aprobados por Juan Martin Vianco Hail el 2026-11-10, antes de escribir código.

## Registro breve

1. **Incremento 1 (dominio):**
   - `pauseEndsAtMs` en `GuardBrain`; T10 y T11 inician la pausa.
   - Nueva regla de actualización T14: fin de pausa en t = llegada + 1500.
   - Una llegada repetida durante la pausa se ignora.
   - `npx vitest run tests/behavior`: 20/20.
   - **Desvío del plan:** las pruebas quedaron en `tests/behavior/patrolPause.test.ts` y no dentro de `guardFsm.test.ts`. El alcance no cambia.
2. **Incremento 2 (controlador y HUD):**
   - Sin ruta mientras dura la pausa.
   - Mirada a −45° la primera mitad y a +45° la segunda, y restauración al final.
   - HUD "pausa X.Xs -> Pn".
   - Primera ejecución de `tests/application/patrolPause.test.ts`: **1 fallo**, `expected Set{-135} to deeply equal Set{225}`. **Causa:** error de la prueba, que comparaba 180 + 45 = 225° con −135°, la misma dirección. Se normalizaron los ángulos a (−180, 180] sin cambiar el criterio. Resultado: 2/2.
3. **Validación final:** `npm run validate`: 14 archivos y 107/107 pruebas; build OK (exit 0).

## Diff

- `src/domain/behavior/guardFsm.ts`: pausa, T14 y validación de `patrolPauseMs`.
- `src/application/simulation/guardController.ts`: sin ruta en pausa, barrido de mirada y `rotate`.
- `src/application/simulation/labGuard.ts`: `patrolPauseMs: 1500` y `patrolLookRadians: π/4`.
- `src/game/scenes/GameScene.ts`: línea de pausa en el HUD.

## Matriz criterio → evidencia

| Criterio | Comprobación | Resultado real | Estado |
|---|---|---|---|
| U1-AC1 | `patrolPause.test.ts`, en dominio y controlador | Pausa de t+1500; T14 en el límite exacto (ignorado a 2499 ms, fin a 2500 ms). En P1 (llegada t=5750 ms), la posición y la cantidad de búsquedas no cambian durante 1500 ms; al terminar se calcula la ruta a P2 y el guardia se mueve | Cumple |
| U1-AC2 | `U1-AC1/AC2` del controlador | Llegada con mirada a 180°: primera mitad a 135°, segunda mitad a −135° (equivale a 225°); al terminar vuelve a 180° | Cumple |
| U1-AC3 | Dominio y controlador | Jugador visible a los 500 ms, durante la pausa en P0: T1 en t=500 y `pauseEndsAtMs` en null | Cumple |
| U1-AC4 | Suite completa | Las secuencias de las trazas no cambian. Diferencias registradas: T10 agrega la acción "pausa hasta…"; en dos regresiones del jugador quieto, la primera detección pasa de 200 a 1700 ms y de 250 a 1750 ms, porque durante la pausa en P0 el guardia mira hacia otro lado. Ninguna prueba se modificó para ocultarlo | Cumple |
| Visual | Prueba humana, 2026-11-10 | Juan observó la pausa y la mirada en los puntos de patrulla y la línea "pausa" del HUD | Cumple |

## Revisión y decisión

- **Límite:** la pausa también ocurre en P0 al empezar la partida, porque el guardia "llega" a su punto inicial. Se considera aceptable.
- **Límite:** la mirada salta de −45° a +45°, sin interpolación suave.
- **Límite:** durante la pausa, el cono gira y puede detectar al jugador en un ángulo donde antes no lo veía. Es la intención de diseño, pero cambia la dificultad.
- **Decisión humana:** **integrar**.
