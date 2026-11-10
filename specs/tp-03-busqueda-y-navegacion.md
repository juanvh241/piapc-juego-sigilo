# Spec TP-03 — Búsqueda y navegación seleccionables

Estado: Aprobada (2026-11-10, Juan Martin Vianco Hail) · Depende de: TP-01

## Objetivo

Poder elegir jugando entre 3 algoritmos de búsqueda y 2 alternativas de navegación, y observar cómo cambian las rutas del matón.

## Comportamiento esperado

- **Espacio:** cicla entre BFS, Dijkstra y A*.
  - Dijkstra reutiliza el A* existente con heurística 0. No se duplica el algoritmo.
- **Tecla C:** alterna entre ruta directa y ruta cautelosa.
  - **Directa:** todas las celdas cuestan 1.
  - **Cautelosa:** las celdas con vidrio cuestan 5 y el resto 1.
- **BFS y la ruta cautelosa:** BFS no admite costos. Si está seleccionada la ruta cautelosa, BFS calcula igual una ruta de menos pasos y el HUD avisa: "BFS ignora costos".
- **HUD:** muestra algoritmo, navegación, costo de la ruta, nodos expandidos y la ruta dibujada (en el modo demostración).
- **Recálculo:** al cambiar algoritmo o navegación, el matón recalcula su ruta en la siguiente actualización. Ya existe con `withAlgorithm`; se extiende a la navegación.

## Fuera de alcance

- Evasión local de obstáculos dinámicos.
- Más algoritmos, como DFS.

## Cómo comprobarlo

- **Jugando, con V activo:** en un sótano con vidrios entre el matón y su punto de patrulla:
  - Con A* o Dijkstra y navegación cautelosa, la ruta rodea los vidrios cuando el rodeo es razonable.
  - Con la ruta directa, los cruza.
  - Con BFS aparece el aviso.
- **Prueba automática:** en un mapa chico con una franja de vidrio, Dijkstra y A* cautelosos devuelven el mismo costo mínimo (el rodeo). Dijkstra expande igual o más nodos que A*. BFS devuelve la ruta de menos pasos.
- **Prueba automática:** el consumidor `calculateRoute` recibe el algoritmo `dijkstra` y los costos del vidrio.
