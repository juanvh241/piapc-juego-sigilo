# Spec — Upgrade 8: Medidor de alerta y estados del nivel

Estado: Aprobado por Juan Martin Vianco Hail el 2026-11-10, sin cambios
Commit inicial: `3b1744d` (rama `upgrades`)

- **Problema:** el peligro solo se lee en el texto del HUD. No hay una señal continua de cuán cerca está el jugador de ser descubierto ni de cuánto falta para que el nivel se calme.
- **Intención:** consecuencias visibles del peligro. Una barra de alerta que sube rápido cuando el jugador es visto y baja despacio, con tres estados del nivel.
- **Objetivo:** medidor de 0 a 100, derivado de la FSM y de la visión, con los estados CALMA, SOSPECHA y ALERTA.

## Alcance

Función pura `updateAlertMeter(valor, estadoGuardia, visible, deltaMs)` en `src/game/presentation/alertMeter.ts`. Las reglas se aplican en este orden:

| Situación | Efecto en el medidor |
|---|---|
| Jugador visible o guardia en Perseguir | Sube 200/s hasta 100 |
| Investigar o Buscar | Se acerca a 60: sube 60/s si está debajo y baja 25/s si está arriba |
| Patrullar o Regresar | Baja 25/s hasta 0 |

| Estado del nivel | Rango |
|---|---|
| CALMA | Menos de 34 |
| SOSPECHA | 34 a 66 |
| ALERTA | Más de 66 |

`GameScene` dibuja una barra arriba a la izquierda, con el color del estado del nivel y su nombre. Durante ALERTA, el borde del escenario se tiñe de rojo.

## Fuera de alcance

- Que el medidor cambie la conducta del guardia: solo informa.
- Game over o puntaje.

## Restricciones

- Sin Phaser en la función pura.
- `deltaMs` inyectado.
- El valor siempre queda en [0, 100].

## Casos

- **Caso normal:** ver al jugador durante 0,5 s lleva de 0 a 100: ALERTA. Al perderlo, en Buscar baja hacia 60: SOSPECHA. Al volver a patrullar, baja hasta 0: CALMA.
- **Caso límite:**
  - Un `deltaMs` enorme no supera 100 ni baja de 0.
  - `deltaMs` negativo o no finito: error.
  - Los umbrales exactos 34 y 66 caen en SOSPECHA.

## Criterios de aceptación

- **U8-AC1:** las tasas y los topes de la tabla se cumplen con tiempos inyectados.
- **U8-AC2:** los estados del nivel respetan los umbrales exactos.
- **U8-AC3:** el medidor no modifica la FSM: las pruebas de conducta no cambian.

## Evidencia prevista

- Pruebas unitarias.
- Prueba en el juego: barra y colores en cada estado.
