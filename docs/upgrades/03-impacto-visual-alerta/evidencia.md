# Evidencia — Upgrade 4: Impacto visual extremo de alerta

- **Versión inicial:** `3b1744d`. **Versión final:** el commit informado en la entrega.
- **Herramienta:** Claude Code (modelo Claude Opus 5.5). Spec y plan aprobados por Juan Martin Vianco Hail el 2026-11-10.

## Registro breve

1. **Incremento 1:** `shouldTriggerAlert` en `src/game/presentation/alertImpact.ts`. Dispara solo con T1 hacia Perseguir y tiene un enfriamiento de 1000 ms. Las pruebas están en `tests/presentation/presentation.test.ts` (archivo compartido; desvío registrado en el upgrade 2).
2. **Incremento 2:** en `GameScene.stepGuard`, si corresponde, se ejecuta `cameras.main.shake(250, 0.006)` y `cameras.main.flash(150, 225, 105, 105)`, y se registra `[alerta]` en la consola con tiempo y regla.
3. **Validación final:** `npm run validate`: 107/107 pruebas; build OK.

## Diff

- `src/game/presentation/alertImpact.ts` (nuevo).
- `src/game/scenes/GameScene.ts`: disparo del efecto y registro.

## Matriz criterio → evidencia

| Criterio | Comprobación | Resultado real | Estado |
|---|---|---|---|
| U4-AC1 | "upgrade 4: triggers only on a real transition into Perseguir (T1)" | `true` con T1. `false` con T2, T3, T5 y registros ignorados | Cumple |
| U4-AC2 | "1000 ms cooldown at the exact limit" | Último disparo a 5000 ms: a 5999 ms no dispara; a 6000 ms sí | Cumple |
| U4-AC3 | Constantes probadas y prueba humana | Shake de 250 ms y flash de 150 ms, ambos menores a 1 s. Juan observó una sola sacudida y un destello al ser descubierto, y la cámara volvió a su lugar | Cumple |

## Revisión y decisión

- **Límite:** el efecto se basa en el reloj de la simulación. Si el juego está en pausa (P), el temporizador de la cámara de Phaser sigue corriendo y el efecto termina igual.
- **Límite:** no hay opción para desactivar la sacudida, algo deseable por accesibilidad.
- **Decisión humana:** **integrar**.
