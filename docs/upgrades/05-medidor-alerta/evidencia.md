# Evidencia — Upgrade 8: Medidor de alerta y estados del nivel

- **Versión inicial:** `3b1744d`. **Versión final:** el commit informado en la entrega.
- **Herramienta:** Claude Code (modelo Claude Opus 5.5). Spec y plan aprobados por Juan Martin Vianco Hail el 2026-11-10.

## Registro breve

1. **Incremento 1:** `updateAlertMeter` y `alertLevel` en `src/game/presentation/alertMeter.ts`, sin Phaser. Las pruebas están en `tests/presentation/presentation.test.ts` (archivo compartido; desvío registrado en el upgrade 2).
2. **Incremento 2:**
   - En `GameScene`, barra de 160 px arriba a la izquierda con etiqueta y valor.
   - Colores: verde en CALMA, amarillo en SOSPECHA y rojo en ALERTA.
   - Marco rojo del escenario durante ALERTA.
   - El valor se actualiza en cada paso con el estado de la FSM y la visión. Ninguna parte de la conducta lo lee.
3. **Validación final:** `npm run validate`: 107/107 pruebas; build OK.

## Diff

- `src/game/presentation/alertMeter.ts` (nuevo).
- `src/game/scenes/GameScene.ts`: barra, etiqueta y marco; el valor se reinicia con R.

## Matriz criterio → evidencia

| Criterio | Comprobación | Resultado real | Estado |
|---|---|---|---|
| U8-AC1 | 3 pruebas de tasas | Visible 250 ms: 0 → 50; otros 250 ms: 100; tope en 100. Investigar 500 ms desde 0: 30. Buscar: 50 → 60 y 100 → 75 en 1 s; 62 → 60. Regresar 1 s: 60 → 35. Patrullar 10 s desde 10: 0 | Cumple |
| U8-AC2 | Prueba de umbrales | 33,9: CALMA. 34 y 66: SOSPECHA. 66,1: ALERTA | Cumple |
| U8-AC3 | Revisión del diff y suite completa | `alertValue` solo lo leen `drawAlertMeter` y el HUD. Las pruebas de la FSM y del controlador pasan sin cambios | Cumple |
| Visual | Prueba humana, 2026-11-10 | Juan vio la barra pasar por CALMA, SOSPECHA y ALERTA, el marco rojo y la bajada lenta al esconderse | Cumple |

## Revisión y decisión

- **Límite:** el medidor es solo informativo. No hay consecuencia de juego, como game over o refuerzos, porque quedó fuera de alcance.
- **Límite:** las tasas (200/s, 60/s y 25/s) se eligieron por diseño y no se ajustaron con más jugadores.
- **Decisión humana:** **integrar**.
