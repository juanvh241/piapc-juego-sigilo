# GDD — Escapa del Sótano

**Estado:** Aprobado por Juan Martin Vianco Hail el 2026-11-10
**TP final integrador PIAPC (UNRaf): IA para NPC en un videojuego**
**Integrante:** Juan Martin Vianco Hail (individual)
**Repositorio:** https://github.com/juanvh241/piapc-juego-sigilo. Continúa el proyecto de clase "Guardia de Sigilo" y reutiliza su FSM, percepción y navegación.

## Idea

Una mafia secuestró al protagonista y lo encerró en un sótano oscuro. Un matón vigila el lugar y tiene la llave de la única salida. El jugador tiene que encontrar un cuchillo, acercarse al matón sin que lo vea ni lo oiga, neutralizarlo por la espalda y escapar por la puerta.

Es un juego de sigilo en vista cenital. Los gráficos son formas simples dibujadas por código: lo importante es que la IA se pueda observar.

## Escenario y objetivo

- Sótano en cuadrícula de 30 x 20 celdas, con salas y pasillos, cajas como obstáculos, vidrios rotos en el piso, un cuchillo y una puerta de salida.
- **Poca luz:** el jugador solo ve el entorno dentro de un radio de 3 celdas. Los vidrios, el cuchillo y el matón solo se ven cuando están dentro de ese radio. Un **modo demostración** (tecla V) revela todo para poder observar la IA en la presentación.
- **Objetivo:** tomar el cuchillo, neutralizar al matón por la espalda y llegar a la puerta, que se abre al obtener la llave.
- **Derrota:** si el matón alcanza al jugador, el nivel se reinicia.

## Interacción y controles

| Tecla | Acción |
|---|---|
| WASD o flechas | Moverse |
| Shift (mantener) | Caminar lento y en silencio |
| E | Neutralizar al matón (con cuchillo, por detrás y muy cerca) |
| Clic | Arrojar un objeto para distraer (alcance de 6 celdas) |
| G | Generar otro sótano |
| Espacio | Cambiar el algoritmo de búsqueda: BFS → Dijkstra → A* |
| C | Cambiar la navegación: ruta directa / ruta cautelosa |
| V | Modo demostración: mostrar todo el mapa |
| P / N / R | Pausa / avanzar un paso / reiniciar el nivel |

## NPC: el matón

- **Percepción:**
  - **Vista:** cono de 90° y alcance de 220 px, bloqueado por paredes y cajas.
  - **Oído:** escucha ruidos dentro de su radio:
    - vidrio pisado: radio grande;
    - pasos normales: radio chico;
    - objeto arrojado.
  - **Memoria:** recuerda la última posición percibida y su antigüedad.
- **Objetivos:** vigilar el sótano, investigar ruidos, atrapar al jugador y volver a su ronda.
- **Comportamiento (FSM):**
  - Patrullar → Investigar (ruido) → Buscar (temporizador) → Regresar → Patrullar.
  - Cualquier estado → Perseguir (lo ve).
  - Perseguir → Investigar (lo pierde de vista, va a la última posición vista).
  - Estado nuevo **Neutralizado**, terminal: se activa con la acción E válida. No percibe ni se mueve.
  - La vista tiene prioridad sobre el oído.
- **Captura:** si en Perseguir llega a menos de media celda del jugador, el nivel se reinicia.

## Búsqueda (seleccionable jugando)

| Algoritmo | Uso y límites |
|---|---|
| **BFS** | Ruta de menos pasos. Supone costos uniformes: **no** admite la ruta cautelosa e ignora el costo de los vidrios. El HUD lo avisa. |
| **Dijkstra** | Costo mínimo con costos por celda. Explora sin heurística. |
| **A*** | Costo mínimo con heurística Manhattan, admisible porque cada celda cuesta al menos 1. Explora menos que Dijkstra. |

Dijkstra se implementa reutilizando el A* existente con heurística 0.

## Navegación (seleccionable jugando)

| Alternativa | Qué cambia |
|---|---|
| **Ruta directa** | Todas las celdas cuestan 1: el matón toma el camino más corto, aunque pise vidrio. |
| **Ruta cautelosa** | Las celdas con vidrio cuestan 5: el matón las rodea si existe un camino razonable. Solo funciona con Dijkstra y A*. |

En los dos casos, el matón recorre la ruta por puntos de paso y la recalcula cuando cambia su destino.

## Escenarios variables

- **Generación (tecla G):**
  - Divide la cuadrícula en salas conectadas por pasillos.
  - Ubica cajas, entre 15 y 25 vidrios, el cuchillo, la puerta, el jugador y el matón en celdas libres.
- **Validación:** con BFS se comprueba que, desde el inicio del jugador, se puede llegar al cuchillo, al matón y a la puerta, y que el matón puede alcanzar todos sus puntos de patrulla. Si algo falla, el escenario se descarta y se genera otro.
- **Patrulla adaptada:** los puntos de patrulla son los centros de 3 o 4 salas del mapa generado. Las rutas entre ellos se calculan con el algoritmo y la navegación elegidos: no hay trayectoria fija.
- **Niveles:** el nivel 2 genera más vidrios y un radio de luz menor. Un segundo matón queda como extra, solo si sobra tiempo.

## Alcance y límites

**Entra:**
- 1 matón.
- 2 niveles generados.
- Cuchillo, vidrios, ruido de pasos y distractor.
- Oscuridad con modo demostración.
- 3 algoritmos de búsqueda y 2 navegaciones seleccionables.

**Queda afuera:** disparos, varias armas, puntaje, guardado, música, animaciones, arte elaborado y coordinación entre matones.

**Riesgo principal:** el generador de escenarios. Se valida con búsquedas y se prueba con muchos mapas generados en pruebas automáticas.

## Desarrollo

- Proceso spec-driven: GDD → specs en `specs/` → una spec por vez → probar jugando.
- Herramienta: Claude Code (modelo Claude Opus 5.5) como agente de desarrollo. La cátedra admite cualquier agente; OpenCode era una sugerencia. Las decisiones y las pruebas en el juego son mías.
