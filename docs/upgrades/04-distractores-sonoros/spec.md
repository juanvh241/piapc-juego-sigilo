# Spec — Upgrade 7: Distractores sonoros interactivos

Estado: Aprobado por Juan Martin Vianco Hail el 2026-11-10, sin cambios
Commit inicial: `3b1744d` (rama `upgrades`)

- **Problema:** el jugador solo puede hacer ruido donde está parado (Q). Así no puede usar el sonido para planificar y alejar al guardia.
- **Intención:** dar al jugador una herramienta activa: arrojar un ruido lejos para atraer al guardia y pasar por otro lado.
- **Objetivo:** con un clic, crear un evento sonoro en la celda elegida si está dentro del alcance de lanzamiento. El guardia lo investiga mediante la FSM existente (T5).

## Alcance

- Función pura `throwDistraction(jugador, clic, mapa, tamañoCelda, ahoraMs, últimoLanzamientoMs)` en `src/application/simulation/distraction.ts`.
- Devuelve un `SoundEvent` centrado en la celda elegida (radio 190, 800 ms) o un rechazo con motivo:
  - `fuera-de-alcance`: más de 192 px, es decir 6 celdas.
  - `celda-bloqueada`
  - `enfriamiento`: menos de 2000 ms desde el último lanzamiento.
- `GameScene`: clic izquierdo para lanzar, marcador amarillo en el punto de caída y texto breve en el HUD con el resultado.

## Fuera de alcance

- Cambiar la FSM, el radio de oído o la percepción.
- Proyectiles con física, inventario o límite de usos.

## Restricciones

- El sonido pasa por el mismo camino que Q (`withSoundEvent`) y el guardia solo reacciona si lo oye.
- Sin dependencias.

## Casos

- **Caso normal:** un clic a 4 celdas, en un pasillo libre dentro del radio de oído del guardia, crea el sonido. El guardia pasa a Investigar hacia esa celda, no hacia el jugador.
- **Casos límite:**
  - Clic sobre una pared: rechazo `celda-bloqueada`.
  - Clic a 7 celdas: `fuera-de-alcance`.
  - Segundo clic a los 1999 ms: `enfriamiento`; a los 2000 ms se acepta.

## Criterios de aceptación

- **U7-AC1:** las validaciones de alcance, celda bloqueada y enfriamiento devuelven el motivo correcto, incluidos los límites exactos (192 px y 2000 ms).
- **U7-AC2:** en una prueba de integración con el controlador y el mapa real, el guardia investiga la posición del distractor y su memoria registra sonido en esa celda.
- **U7-AC3:** si el distractor cae fuera del radio de oído del guardia, no hay transición.

## Evidencia prevista

- Pruebas unitarias y de integración.
- Prueba en el juego: atraer al guardia con un clic.
