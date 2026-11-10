# Spec — Upgrade 1: Patrulla con pausas y mirada direccional

Estado: Aprobado por Juan Martin Vianco Hail el 2026-11-10, sin cambios
Commit inicial: `3b1744d` (rama `upgrades`)

- **Problema:** el guardia recorre la patrulla sin detenerse. Su ritmo es constante y el jugador no tiene momentos para anticipar hacia dónde va a mirar.
- **Intención:** que la patrulla tenga ritmo legible. Al llegar a cada punto, el guardia se detiene y mira a un lado y al otro antes de seguir. El jugador puede leer la pausa y planificar.
- **Objetivo:** pausa de 1500 ms en cada punto de patrulla, con barrido de la mirada.

## Alcance

- Agregar a la FSM (`src/domain/behavior/guardFsm.ts`) un fin de pausa en Patrullar: al llegar a un punto (T10 y T11), `pauseEndsAtMs = t + 1500`.
- El controlador (`guardController.ts`) no pide ruta mientras dura la pausa. Gira la mirada −45° durante la primera mitad y +45° durante la segunda, respecto de la dirección de llegada, y al terminar la restaura.
- HUD: "pausa X.Xs" mientras dura.

## Fuera de alcance

- Cambiar los puntos de patrulla, la velocidad, la percepción o los otros estados.

## Restricciones

- Dominio sin Phaser.
- Tiempo inyectado.
- Sin dependencias nuevas.

## Casos

- **Caso normal:** el guardia llega a P1, queda quieto 1500 ms con la mirada en −45° y luego +45°, y después sigue hacia P2.
- **Caso límite:** si ve al jugador durante la pausa, pasa a Perseguir de inmediato. La pausa se descarta y no reaparece al volver a patrullar a mitad de camino.

## Criterios de aceptación

- **U1-AC1:** durante la pausa, la posición no cambia y no se calcula ruta. La pausa termina en t = llegada + 1500, en el límite exacto.
- **U1-AC2:** la mirada barre −45° y luego +45°, y vuelve a la dirección de llegada al terminar.
- **U1-AC3:** la visión durante la pausa produce Perseguir (T1) en esa misma actualización.
- **U1-AC4:** las secuencias y trazas anteriores de la FSM siguen pasando. Si alguna cambia de tiempos por la pausa, se registra el motivo.

## Evidencia prevista

- Pruebas de dominio y del controlador con tiempo inyectado.
- Prueba en el juego: observar la pausa y la mirada en P1.
