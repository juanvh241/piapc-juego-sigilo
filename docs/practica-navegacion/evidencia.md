# Evidencia — práctica de navegación
Repositorio: https://github.com/juanvh241/piapc-juego-sigilo
Commit inicial: bb94dde1cdf6a5f5e858b65f1972a4e08cb89385
Commit de implementación: ver commit informado en la entrega
Versión de entrega: commit final informado por el estudiante en la plataforma.
Variante: A (terreno lento)
Herramienta/modelo o trabajo manual: Claude Code (modelo Claude Opus 5.5), con aprobación y revisión de Juan Martin Vianco Hail.
Cambios previos: el laboratorio de A* y FSM (commit `bb94dde`): FSM del guardia, controlador y pruebas. Se conservaron sin modificaciones.
Línea base: `npm run validate` en `bb94dde`: typecheck OK; 9 archivos y 70 pruebas aprobadas; build OK (exit 0). Sin fallos previos. Advertencia preexistente de tamaño de bloque en el build.

## Exploración mínima
| Capa | Ruta/símbolo | Capacidad comprobada |
|---|---|---|
| Búsqueda | `src/domain/navigation/search.ts` (`findPathBfs`, `findPathAStar`) | BFS y A* con estado, ruta, `totalCost`, `expandedNodes`, `maximumFrontier` y `explored`. A* sumaba costo fijo 1 (`current.cost + 1`) y calculaba `totalCost = path.length - 1`. |
| Seguimiento | `src/domain/navigation/pathFollower.ts` (`advanceAlongPath`) | Avanza por puntos de paso sin depender de Phaser. No se modificó. |
| Consumidor | `src/application/simulation/navigationDemo.ts` (`calculateRoute`) | Entrada de navegación de la aplicación. La usa `guardController.ts` para las rutas del guardia. |
| Pruebas | `tests/navigation/` | `search.test.ts`, `pathFollower.test.ts` y `astarVerification.test.ts` ya existían; se agregó `practicaNavegacion.test.ts`. |

Contraste y decisión humana: la exploración comprobó en el código que A* no aceptaba costos y que `totalCost` contaba pasos. Si solo se cambiaba la prioridad de búsqueda, una ruta por la franja informaría costo 4 en vez de 16. Se descartó agregar costos al `GridMap` o al controlador del guardia, porque tocaba más capas. **Juan decidió** usar como consumidor `calculateRoute` con un parámetro opcional `entryCosts`, que solo usa A*.

Spec/plan aprobados: el 2026-11-10, antes de modificar código (paso 3 y paso 5), sin ajustes.

## Comparación común — fixture libre 5x3
Vecinos y desempate reales: cuatro vecinos en orden arriba, derecha, abajo, izquierda (`gridGraph.ts`). BFS usa cola FIFO. A* desempata por menor f, luego menor h y luego orden de inserción.

| Algoritmo | Estado | Ruta | Pasos | Costo | Expandidos | Frontera máxima |
|---|---|---|---:|---:|---|---|
| BFS | success | (0,1) (1,1) (2,1) (3,1) (4,1) | 4 | 4 | 12 | 4 |
| A* | success | (0,1) (1,1) (2,1) (3,1) (4,1) | 4 | 4 | 5 | 9 |

Las métricas son las que ya devuelve el proyecto; no se agregó instrumentación. A* expandió menos nodos (5 contra 12), pero su frontera máxima fue mayor (9 contra 4), porque inserta vecinos que todavía no expandió. Un solo mapa no permite generalizar.

DFS: la traza es S,A,C,X,G y encuentra una ruta de 4 pasos, mientras BFS encuentra S,B,D,G con 3. DFS sigue una rama hasta el fondo antes de probar otras, así que llegar primero a la meta no demuestra que esa ruta sea la más corta (traza conceptual, no ejecutada).

Dijkstra: extraer S=0 descubre A=1 y B=3. Extraer A=1 descubre G=10. Extraer B=3 mejora G=6. Al extraer la entrada válida de G, la ruta es S-B-G con costo 6. No se termina al descubrir G por primera vez, porque ese valor (10) todavía puede mejorar: solo es definitivo cuando G sale de la cola con el menor costo. Las dos rutas tienen 2 acciones, así que BFS no distinguiría sus costos (traza conceptual, no ejecutada).

## Criterio → evidencia
| Criterio | Prueba/archivo y comando o reproducción | Observado | Cumple/pendiente |
|---|---|---|---|
| BASE-AC1 | Exploración de este documento; `git rev-parse HEAD`; `npm run validate` | Commit `bb94dde`, capas con rutas y línea base 70/70 | Cumple |
| BASE-AC2 | `practicaNavegacion.test.ts` "BASE-02"; `npx vitest run tests/navigation` | BFS y A*: 4 pasos, costo 4, ruta cardinal válida | Cumple |
| BASE-AC3 | `practicaNavegacion.test.ts` "BASE-04" (BFS y A*) | Inicio=meta: success, costo 0. Barrera: unreachable. (-1,1): invalid-start. (5,1): invalid-goal. Estados distintos entre sí | Cumple |
| BASE-AC4 | spec.md y plan.md (estado Aprobado); contraste y decisión de arriba | Aprobados antes del código; solo anexo A | Cumple |
| A-AC1 | "A-AC1"; `routeCost` | Directa: 4 pasos, costo 16. A* ponderado: (0,1) (0,0) (1,0) (2,0) (3,0) (4,0) (4,1), 6 pasos, costo 6, sin entrar en la franja | Cumple |
| A-AC2 | "A-AC2" (sin opción y con mapa de costos vacío) | 4 pasos, costo 4 | Cumple |
| A-AC3 | "A-AC3" (dos pruebas sobre `calculateRoute`) | Ponderado: costo 6 y rodeo. Unitario: resultado idéntico al de antes para A* y BFS | Cumple |
| BASE-AC5 | `npm run validate`; `git diff --stat bb94dde` | 81/81 pruebas, build OK; diff acotado a `search.ts`, `navigationDemo.ts`, una prueba nueva y docs | Cumple |
| BASE-AC6 | URL, commit de la entrega y los tres documentos | Los tres documentos van en el mismo commit que el código | Cumple al registrar la entrega |

Otros requisitos del anexo:
- **A-01:** BFS sigue unitario. Su ruta directa con la franja costaría 16 (prueba "A-01"); por eso no sirve como referencia del mínimo ponderado.
- **A-02:** se reutilizó el A* existente con Manhattan, sin implementar Dijkstra. Se rechazan costos menores a 1 o no finitos, que harían inválida la heurística (prueba "A-02").
- **A-04:** con la franja restaurada a costo 1, la búsqueda usa los datos nuevos y vuelve a 4 pasos y costo 4 (prueba "A-04"). No hay caché de costos.

## Registro mínimo de intervención
Prompts: se siguieron los pasos 1 a 8 de la guía con la variante A. Las únicas modificaciones fueron completar rutas y comandos y elegir el consumidor.
Decisión tras incremento 1: aceptar. `totalCost` suma los costos de entrada, la ruta directa vale 16 y el rodeo 6, y las pruebas unitarias anteriores de A* siguen pasando.
Decisión tras incremento 2: aceptar. `calculateRoute` obtiene costo 6 en modo ponderado y conserva el resultado unitario anterior. El guardia del juego no cambió: sus pruebas pasan sin modificaciones.
Validación final: `npm run validate`: typecheck OK; 10 archivos y 81 pruebas aprobadas; build OK (exit 0).
Diff revisado: `src/domain/navigation/search.ts` (parámetro opcional `entryCosts`, `routeCost` y validación de costos), `src/application/simulation/navigationDemo.ts` (opción `entryCosts`), `tests/navigation/practicaNavegacion.test.ts` y `docs/practica-navegacion/`. No hay cambios en FSM, percepción, controles ni dependencias.
Conclusión: cuando el terreno tiene costos distintos, conviene A* ponderado con Manhattan, porque minimiza el costo real y no la cantidad de pasos. Mientras todos los costos sean de al menos 1, la heurística sigue siendo admisible. BFS solo es adecuado con costos uniformes: ahí empata en costo con A*, aunque expande más nodos. DFS no garantiza la ruta más corta. Dijkstra daría el mismo mínimo que A* ponderado, pero sin heurística explora más.
Limitaciones:
- El modo ponderado se demuestra en el consumidor `calculateRoute` y sus pruebas. El guardia del juego no lo usa todavía, porque el mapa del laboratorio no tiene terreno lento y crearlo quedaba fuera de alcance.
- `GameScene` sigue mostrando "costo" como el `totalCost` del resultado, que en modo unitario es igual a los pasos.
