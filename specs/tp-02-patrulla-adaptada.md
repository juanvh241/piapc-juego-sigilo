# Spec TP-02 — Patrulla adaptada al sótano

Estado: Aprobada (2026-11-10, Juan Martin Vianco Hail) · Depende de: TP-01

## Objetivo

Que la ronda del matón se calcule sobre cada sótano generado, no sobre puntos fijos.

## Comportamiento esperado

- **Puntos de patrulla:** el generador elige como puntos los centros libres de 3 o 4 cámaras (incluida la del matón) que el matón pueda alcanzar desde su inicio. Se evita la sala del jugador cuando hay alternativas.
- **Rutas:** se calculan en el momento con el algoritmo y la navegación elegidos (TP-03), usando la FSM existente: Patrullar, pausas y mirada.
- **Generar otro sótano (G):** reinicia al matón con los puntos nuevos.
- **Si un punto queda inalcanzable:** se salta, con el comportamiento T12/T13 ya existente.

## Fuera de alcance

- Coordinación entre varios matones.
- Patrullas aleatorias en cada vuelta.

## Cómo comprobarlo

- **Jugando con el modo demostración (V):** se ven los puntos P0 a P3 y la ruta. Al presionar G, los puntos y la ruta cambian y el matón recorre la ronda nueva sin atravesar paredes ni cajas.
- **Prueba automática:** con 100 semillas, todos los puntos de patrulla son transitables y alcanzables desde el inicio del matón, y hay de 3 a 4 puntos.
