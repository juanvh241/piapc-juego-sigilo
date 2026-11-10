# Spec — Upgrade 2: Cono de visión visible y reactivo

Estado: Aprobado por Juan Martin Vianco Hail el 2026-11-10, sin cambios
Commit inicial: `3b1744d` (rama `upgrades`)

- **Problema:** el cono siempre es azul y solo se vuelve verde cuando ve al jugador. No comunica el nivel de amenaza del guardia.
- **Intención:** que el jugador lea el peligro de un vistazo. El color del cono indica el estado y el cono se intensifica cuando el jugador está visible.
- **Objetivo:** estilo del cono derivado del estado de la FSM y del resultado de visión, sin cambiar la detección.

## Alcance

- Función pura `coneStyle(estado, visible)` en `src/game/presentation/coneStyle.ts` (sin importar Phaser).
- Mapeo de color:

| Estado | Color |
|---|---|
| Patrullar | Azul `#6b8afd` |
| Regresar | Violeta `#a98bf0` |
| Investigar | Amarillo `#e5b454` |
| Buscar | Naranja `#e58f54` |
| Perseguir | Rojo `#e16969` |

- **Opacidad:** 0,16 en reposo y 0,32 si el jugador está visible.
- **Borde:** la línea del borde se dibuja solo en Investigar, Buscar y Perseguir.
- `GameScene` dibuja el cono con ese estilo, con el mismo alcance y ángulo que usa la percepción.

## Fuera de alcance

- Cambiar el alcance, el ángulo o la oclusión reales.
- Agregar sombras o raycast visual de oclusión.

## Restricciones

- La presentación no decide la conducta.
- Geometría tomada de `LAB_GUARD_CONFIG`.

## Casos

- **Caso normal:** al pasar de Patrullar a Investigar, el cono cambia de azul a amarillo con borde.
- **Caso límite:** jugador visible en Perseguir: rojo con opacidad 0,32. Jugador ocluido dentro del cono: no se intensifica, porque `visible` es falso.

## Criterios de aceptación

- **U2-AC1:** `coneStyle` devuelve el color, la opacidad y el borde de la tabla para los 5 estados × visible/no visible (10 casos probados).
- **U2-AC2:** el cono dibujado usa `visionRange` y `fieldOfViewRadians` de `LAB_GUARD_CONFIG`, los mismos de la percepción, verificado en el código.
- **U2-AC3:** ninguna prueba de percepción ni de la FSM cambia.

## Evidencia prevista

- Prueba unitaria de `coneStyle`.
- Revisión del diff.
- Prueba en el juego: colores en cada estado.
