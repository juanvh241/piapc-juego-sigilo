# Evidencia — Upgrade 7: Distractores sonoros interactivos

- **Versión inicial:** `3b1744d`. **Versión final:** el commit informado en la entrega.
- **Herramienta:** Claude Code (modelo Claude Opus 5.5). Spec y plan aprobados por Juan Martin Vianco Hail el 2026-11-10.

## Registro breve

1. **Incremento 1:** `throwDistraction` en `src/application/simulation/distraction.ts`, con validaciones de enfriamiento, celda bloqueada y alcance. El sonido se centra en la celda elegida.
2. **Incremento 2:**
   - Prueba de integración con `updateGuard` y el mapa real.
   - En `GameScene`, el clic izquierdo lanza el distractor. Hay marcador amarillo, mensaje en el HUD y registro `[distractor]` en la consola.
   - `index.html` muestra "Distractor: clic".
3. **Validación:** `npx vitest run tests/application/distraction.test.ts`: 6/6. `npm run validate`: 107/107; build OK.

## Diff

- `src/application/simulation/distraction.ts` (nuevo).
- `tests/application/distraction.test.ts` (nuevo).
- `src/game/scenes/GameScene.ts`: clic, marcador y mensaje.
- `index.html`: texto de controles.

## Matriz criterio → evidencia

| Criterio | Comprobación | Resultado real | Estado |
|---|---|---|---|
| U7-AC1 | 4 pruebas de reglas | Celda libre a 4 casillas: aceptada y centrada. 6 casillas (192 px): aceptada. 7 casillas: `fuera-de-alcance`. Pared (18,15): `celda-bloqueada`. A 1999 ms: `enfriamiento`; a 2000 ms: aceptada | Cumple |
| U7-AC2 | "the guard investigates the distraction cell, not the player" | Jugador escondido en (22,13) y ruido en (25,17). Transiciones `T5@100, T7@950`; memoria `sound` en (25,17); el guardia llega a (25,17) | Cumple |
| U7-AC3 | "outside the guard's hearing radius" | Ruido en (5,2), lejos del guardia: ninguna transición | Cumple |
| Visual | Prueba humana, 2026-11-10 | Juan atrajo al guardia con un clic y vio los mensajes de rechazo | Cumple |

## Revisión y decisión

- **Cambio de controles:** el clic izquierdo, que antes no tenía uso, ahora lanza distractores.
- **Límite:** el ruido no necesita línea de visión desde el jugador. Se puede arrojar por encima de una pared si la celda está a 6 casillas o menos.
- **Límite:** como el sonido sigue activo 800 ms, posterga la llegada del guardia (límite ya registrado en el laboratorio de FSM).
- **Decisión humana:** **integrar**.
