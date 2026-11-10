# Spec — Laboratorio de A* y FSM

Estado: Aprobada por Juan Martin Vianco Hail el 2026-11-10, sin cambios
Repositorio: https://github.com/juanvh241/piapc-juego-sigilo
Commit inicial: `485f0b3` (rama de trabajo `lab-astar-fsm`)
Herramienta: Claude Code (modelo Claude Opus 5.5), con revisión y aprobación de Juan Martin Vianco Hail.

## Fuentes consultadas

- `AGENTS.md`, `specs/01-producto.md`, `docs/arquitectura.md`, `docs/hitos.md`, `docs/h3-percepcion-movimiento.md` y `docs/permisos-recomendados.md`.
- Código: `src/domain/navigation/search.ts`, `pathFollower.ts`, `src/domain/perception/memory.ts`, `perception.ts`, `src/application/simulation/*.ts` y `src/game/scenes/GameScene.ts`.
- Lecturas de la cátedra: "Máquinas de estados finitos y jerárquicas" y "Caso integrador de un guardia de sigilo".

## Punto de partida comprobado

- `npm run validate` en `485f0b3`: 6 archivos y 39 pruebas aprobadas; build con código 0.
- A* y BFS ya existen en `search.ts`. Devuelven estado, ruta, costo, nodos expandidos, frontera máxima y nodos explorados.
- La percepción (visión con oclusión, sonido y memoria) existe, pero no cambia la conducta: el guardia solo va adonde se hace clic (límite de H3).
- No existe `src/domain/behavior/`: la FSM (hito H4) está pendiente.

## Objetivo

Verificar A* con pruebas adicionales e incorporar una FSM con los estados Patrullar, Investigar, Perseguir, Buscar y Regresar. Percepción, decisión, búsqueda y locomoción quedan en capas separadas. El resultado debe ser trazable y reproducible.

## Alcance

1. Pruebas adicionales de A*: ruta cardinal continua, desempate reproducible y comparación con BFS en el mapa del laboratorio.
2. FSM pura en `src/domain/behavior/`, sin Phaser ni tiempo real: recibe eventos y tiempo inyectados.
3. Controlador en `src/application/simulation/` que traduce percepción y movimiento en eventos y decide cuándo calcular rutas con A*.
4. Integración en `GameScene`: el guardia actúa solo y muestra su estado en pantalla.
5. Telemetría: estado actual y anterior, último evento, causa, memoria y ruta. Registro estructurado de transiciones.
6. Pausa (P) y avance de un paso (N) para demostraciones.

## Fuera de alcance

- Captura del jugador y zona de salida.
- Árboles de comportamiento, utilidad, GOAP y HFSM.
- Arte, animaciones, sonido real y dependencias nuevas.
- Cambios a los algoritmos de búsqueda o percepción. Solo se agregan pruebas.

## Parámetros

| Parámetro | Valor |
|---|---|
| Puntos de patrulla, en orden | P0 (27,17) → P1 (12,17) → P2 (12,12) → P3 (27,5) → P0 |
| Duración de Buscar | 3000 ms |
| Giro durante Buscar | 90° cada 750 ms |
| Recálculo en persecución | Solo si la celda objetivo cambió y pasaron al menos 250 ms desde el último cálculo |

## Eventos y arbitraje

En cada actualización, el controlador junta las observaciones y la FSM procesa **un solo evento**, el de mayor prioridad:

1. `JugadorVisto(p)`: la visión devuelve `visible`.
2. `VisiónPerdida`: el estado es Perseguir y la visión ya no es `visible`.
3. `SonidoOído(p)`: el sonido está activo y dentro del radio.
4. `RutaFallida`: A* devolvió un estado distinto de `success` para el destino pedido.
5. `DestinoAlcanzado`: el seguimiento completó la ruta actual.
6. `Tick(t)`: paso de tiempo, usado por el temporizador de Buscar.

Así, la visión le gana al sonido por arbitraje explícito y no por el orden de las llamadas.

## Tabla de transiciones

| # | Origen | Evento | Guarda | Destino | Acciones |
|---|---|---|---|---|---|
| T1 | Patrullar, Investigar, Buscar, Regresar | `JugadorVisto(p)` | — | Perseguir | Objetivo = última posición conocida; calcular ruta |
| T2 | Perseguir | `JugadorVisto(p)` | — | Perseguir (actualiza) | Renovar objetivo; recalcular según la política de 250 ms |
| T3 | Perseguir | `VisiónPerdida` | Hay posición conocida | Investigar | Ir a la última posición vista, no a la real |
| T4 | Perseguir | `VisiónPerdida` | No hay posición conocida | Buscar | Iniciar temporizador en el lugar |
| T5 | Patrullar, Buscar, Regresar | `SonidoOído(p)` | — | Investigar | Ir a la posición del sonido |
| T6 | Investigar | `SonidoOído(p)` | — | Investigar (actualiza) | Cambiar destino solo si cambió la celda |
| T7 | Investigar | `DestinoAlcanzado` | — | Buscar | Temporizador hasta t + 3000 ms; girar |
| T8 | Investigar, Perseguir | `RutaFallida` | — | Buscar | Recuperación: buscar en el lugar |
| T9 | Buscar | `Tick(t)` | t ≥ fin del temporizador | Regresar | Ir al punto de patrulla pendiente |
| T10 | Regresar | `DestinoAlcanzado` | — | Patrullar | Continuar el circuito desde el punto siguiente |
| T11 | Patrullar | `DestinoAlcanzado` | — | Patrullar (actualiza) | Avanzar al punto siguiente |
| T12 | Patrullar, Regresar | `RutaFallida` | Quedan puntos sin probar | Igual (actualiza) | Saltar al punto siguiente |
| T13 | Patrullar, Regresar | `RutaFallida` | Ningún punto alcanzable | Igual (detenido) | Quedarse quieto e informar "sin patrulla alcanzable" |

Cualquier combinación que no figura en la tabla se ignora y queda registrada como "evento ignorado". Por ejemplo: `SonidoOído` en Perseguir o `Tick` en Buscar antes de que termine el temporizador.

## Políticas

- **Reentrada:** las transiciones al mismo estado (T2, T6, T11 y T12) actualizan datos sin repetir las acciones de entrada. No reinician el temporizador ni se registran como transición nueva.
- **Una transición por actualización:** nunca se ejecutan dos estados en el mismo cuadro.
- **Temporizadores:** el tiempo se inyecta. En el límite exacto (t = fin), Buscar termina.
- **Rutas activas:** al salir de un estado se descarta la ruta anterior. Ninguna ruta se recalcula en cada cuadro sin motivo.
- **Reinicio (R):** restaura estado, memoria, ruta, temporizadores, índice de patrulla y registro.

## Invariantes

Se comprueban en las pruebas después de cada evento:

1. En Perseguir existe una posición conocida en memoria, de origen visual.
2. En Buscar, el fin del temporizador es finito y posterior o igual al momento de entrada.
3. En Patrullar y Regresar, el índice de patrulla pertenece a los puntos configurados.
4. En Investigar, el objetivo es una posición que vino de la memoria de percepción.
5. Ninguna ruta asignada al guardia contiene celdas bloqueadas, y cada paso es a una celda vecina cardinal.
6. El estado mostrado en pantalla es el mismo que usa el controlador para mover al guardia.

## Criterios de aceptación

- **AC1:** A* pasa las pruebas de inicio igual a objetivo, extremos inválidos, destino inaccesible, ruta que evita bloqueos, mismo costo que BFS y desempate reproducible.
- **AC2:** las pruebas automatizadas de la FSM cubren estas secuencias:
  - Patrullar → Investigar → Buscar → Regresar → Patrullar.
  - Cualquier estado activo → Perseguir.
  - Perseguir → Investigar al perder la visión.
- **AC3:** las pruebas cubren guarda falsa, sonido y visión simultáneos, destino inaccesible, evento repetido, reinicio durante la persecución y el límite exacto del temporizador.
- **AC4:** las invariantes se cumplen después de cada evento en todas las pruebas de secuencia.
- **AC5:** hay dos trazas reproducibles, caso normal y caso límite, generadas por una prueba de integración con el mapa real y tiempo controlado.
- **AC6:** en el juego, la persona ve estado actual y anterior, evento, causa, memoria y ruta, y lo que muestra coincide con lo que hace el guardia.
- **AC7:** `npm run validate` termina con código 0, sin dependencias nuevas, y `src/domain/` sigue sin importar Phaser.

## Decisiones humanas (aprobadas el 2026-11-10)

1. Aprobar los puntos de patrulla y los tiempos de la tabla de parámetros.
2. Aprobar que, ante una ruta imposible, el guardia busque en el lugar (T8) en vez de quedarse quieto.
3. Aprobar que se quite el clic para mover al guardia. Con la FSM decidiendo, el clic contradiría el estado mostrado. La tecla Espacio para alternar BFS y A* se conserva.
