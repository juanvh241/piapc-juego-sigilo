# Spec TP-04 — Ruido del jugador: pasos, sigilo y vidrios

Estado: Aprobada (2026-11-10, Juan Martin Vianco Hail) · Depende de: TP-01

## Objetivo

Que moverse tenga un costo de sigilo: el matón puede oír al jugador, que tiene que decidir entre ir rápido o en silencio y evitar los vidrios.

## Comportamiento esperado

- **Caminar normal** (190 px/s): emite un sonido de pasos de radio 70 px cada 350 ms mientras se mueve.
- **Caminar lento**, manteniendo Shift (90 px/s): no emite pasos.
- **Vidrio:** entrar en una celda con vidrio emite un sonido de radio 220 px, también caminando lento. Se emite una vez por cada entrada a la celda; quedarse parado encima no repite el ruido.
- **Percepción:** todos los ruidos usan el sistema de sonido existente, el mismo de Q y el distractor. El matón solo reacciona si el ruido entra en su radio, y la FSM decide (T5).
- **HUD:** indica "sigilo" o "pasos" y muestra un anillo breve en la posición del ruido.
- La lógica de cuándo hay ruido es una función pura, testeable y sin Phaser.

## Fuera de alcance

- Distintos tipos de suelo.
- Ruido de cajas.
- Volumen variable.

## Cómo comprobarlo

- **Jugando:**
  - Caminar normal cerca del matón, fuera de su vista: pasa a Investigar.
  - Repetirlo con Shift: no reacciona.
  - Pisar vidrio, aun con Shift: reacciona desde más lejos.
- **Pruebas automáticas:**
  - Cadencia de pasos con tiempo inyectado.
  - Sin pasos con Shift.
  - Un solo ruido por entrada a una celda con vidrio.
  - Integración: un ruido de vidrio dentro del radio provoca T5 en el controlador.
