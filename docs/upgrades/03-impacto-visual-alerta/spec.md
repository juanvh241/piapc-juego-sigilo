# Spec — Upgrade 4: Impacto visual extremo de alerta

Estado: Aprobado por Juan Martin Vianco Hail el 2026-11-10, sin cambios
Commit inicial: `3b1744d` (rama `upgrades`)

- **Problema:** cuando el guardia descubre al jugador, solo cambia un texto y un color. El momento de detección pasa desapercibido.
- **Intención:** que la detección resulte clara e inmediata.
- **Objetivo:** al entrar en Perseguir, una sacudida de cámara única y un destello rojo que terminan y devuelven la cámara a su posición normal en menos de un segundo.

## Alcance

- Función pura `shouldTriggerAlert(registro, últimoDisparoMs, ahoraMs)` en `src/game/presentation/alertImpact.ts`.
- **Dispara** solo con una transición real hacia Perseguir (regla T1).
- **No dispara** con actualizaciones dentro de Perseguir (T2).
- **Enfriamiento** de 1000 ms, para que una pérdida y recuperación rápida de la visión no repita el efecto.
- `GameScene` ejecuta `cameras.main.shake(250 ms, 0.006)` y `cameras.main.flash(150 ms, rojo)`.

## Fuera de alcance

- Cambiar la detección, la navegación o la FSM.
- Sonido, partículas o zoom.

## Restricciones

- Sin dependencias.
- El efecto no altera la posición lógica del guardia ni del jugador.

## Casos

- **Caso normal:** Patrullar → Perseguir dispara un shake y un flash, que terminan antes de 1 s.
- **Caso límite:** Perseguir → Investigar → Perseguir dentro de 1000 ms no vuelve a disparar. Después de 1000 ms sí.

## Criterios de aceptación

- **U4-AC1:** dispara en T1 y no en T2, T3, T5 ni otras reglas, ni en registros ignorados.
- **U4-AC2:** respeta el enfriamiento en el límite exacto: no dispara a 999 ms y sí a 1000 ms.
- **U4-AC3:** la duración total del efecto es de 250 ms (shake) y 150 ms (flash), ambos menores a 1 s. La cámara vuelve a la posición normal: Phaser restaura el desplazamiento al terminar el shake; se comprueba jugando.

## Evidencia prevista

- Prueba unitaria del disparador.
- Registro `[alerta]` en la consola.
- Prueba en el juego.
