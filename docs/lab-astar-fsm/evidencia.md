# Evidencia — Laboratorio de A* y FSM

- **Repositorio:** https://github.com/juanvh241/piapc-juego-sigilo
- **Commit inicial:** `485f0b3`. Rama de trabajo: `lab-astar-fsm`.
- **Versión de entrega:** el commit final informado en la plataforma.
- **Entorno:** Windows 11, Node v24.20.0 (`.nvmrc` pide 22.6.0, `engines` admite >=22) y npm 11.
- **Herramienta:** Claude Code (modelo Claude Opus 5.5). Las decisiones humanas son de Juan Martin Vianco Hail.
- **Spec:** [spec.md](spec.md), aprobada el 2026-11-10 sin cambios.

## 1. Línea base

```text
$ git rev-parse --short HEAD     -> 485f0b3, árbol limpio, sin cambios previos
$ npm ci                         -> dependencias del archivo de bloqueo
$ npm run validate               -> typecheck OK; 6 archivos y 39 pruebas aprobadas; build OK (exit 0)
```

Fallos previos: ninguno. El build ya mostraba antes de este trabajo una advertencia de tamaño de bloque (más de 500 kB), y no se tocó.

## 2. Verificación de A*

Pruebas nuevas en `tests/navigation/astarVerification.test.ts`, que se suman a las existentes en `tests/navigation/search.test.ts`:

| Comprobación | Resultado observado |
|---|---|
| Inicio igual a objetivo | Ruta `[inicio]`, costo 0 (prueba existente) |
| Extremos inválidos | `(-1,1)` da `invalid-start`; `(5,1)` da `invalid-goal` |
| Destino inaccesible | Barrera completa en x=2 da `unreachable`, sin ruta y con costo `null` |
| Ruta que evita bloqueos | Ruta cardinal continua, sin celdas bloqueadas |
| Mismo costo que BFS | Igual costo en los tres pares del mapa del laboratorio |
| Desvío con desempate reproducible | Mapa 5x3 con (2,1) bloqueada: desvío superior de 6 pasos; dos ejecuciones idénticas |

**Corrección registrada:** mi primera predicción del desvío exacto, `...(3,0),(3,1),(4,1)`, fue refutada por la ejecución. El resultado real es `...(3,0),(4,0),(4,1)`, también válido y de costo 6. La expectativa se ajustó al resultado real, porque el criterio (costo óptimo y reproducibilidad) no cambia.

**Comparación en `LAB_MAP`** (salida de la prueba):

| Inicio → objetivo | Algoritmo | Estado | Costo | Expandidos | Frontera máxima |
|---|---|---|---:|---:|---:|
| (27,17) → (2,2) | BFS | success | 40 | 435 | 26 |
| (27,17) → (2,2) | A* | success | 40 | 41 | 73 |
| (27,17) → (12,12) | BFS | success | 30 | 286 | 22 |
| (27,17) → (12,12) | A* | success | 30 | 112 | 27 |
| (12,12) → (27,5) | BFS | success | 28 | 385 | 28 |
| (12,12) → (27,5) | A* | success | 28 | 93 | 32 |

A* expandió menos nodos en estos tres casos, pero no en todas las medidas: en el primero, su frontera máxima fue mayor (73 contra 26). Tres casos no permiten concluir que A* siempre expanda menos.

## 3. FSM

- **Diseño:** tabla de transiciones T1 a T13, arbitraje de eventos, políticas e invariantes, en [spec.md](spec.md).
- **Núcleo puro:** `src/domain/behavior/guardFsm.ts`, sin Phaser. Recibe eventos y tiempo inyectados.
- **Coordinación:** `src/application/simulation/guardController.ts` y `labGuard.ts`. El controlador traduce percepción y movimiento en eventos, consulta A* y mueve al guardia. No decide la conducta.
- **Escena:** `src/game/scenes/GameScene.ts` solo adapta entradas, tiempo y dibujo.

**Pruebas de secuencias y límites** (`tests/behavior/guardFsm.test.ts`, 15 pruebas). Comprueban las invariantes después de cada evento:

| Requisito del laboratorio | Prueba |
|---|---|
| Patrullar →(sonido) Investigar →(llegada) Buscar →(tiempo) Regresar →(llegada) Patrullar | `Patrullar -> Investigar -> Buscar -> Regresar -> Patrullar` |
| Cualquier estado activo →(visión) Perseguir | `any active state (...) -> Perseguir`, 4 casos |
| Perseguir →(pérdida con memoria) Investigar | `Perseguir -> Investigar goes to the last seen position` |
| Guarda falsa | `vision lost without memory` (T4) y `search timer` a 1 ms del límite |
| Sonido y visión simultáneos | `vision wins over a simultaneous sound` |
| Destino inaccesible | `unreachable investigation target` (T8) y `unreachable patrol points` (T12/T13) |
| Evento repetido | `repeated events update data without re-entering` |
| Reinicio durante persecución | `reset during a chase restores the complete initial state` |
| Límite exacto del temporizador | Transición en t = fin (4000 ms), no en 3999 ms |

## 4. Trazas reproducibles

Las trazas se generaron con `tests/application/guardController.test.ts`, sobre el mapa real, con tiempo inyectado cada 50 ms. La misma entrada produce la misma traza; hay una prueba que lo comprueba.

**Caso normal:** el jugador hace ruido detrás del guardia y luego queda lejos y oculto.

```text
t=  100 patrol --sound-heard(28,17)--> investigate {T5} | vision=outside-cone memoria=sound@28,17 ruta=success costo 1
t=  950 investigate --destination-reached--> search {T7} | memoria=sound@28,17
t= 3950 search --tick [tiempo agotado]--> return {T9} | ruta=success costo 16
t= 8450 return --destination-reached--> patrol {T10} | ruta=success costo 15
```

**Caso límite:** sonido y visión en el mismo instante; luego el jugador se esconde detrás de una pared.

```text
t=    0 patrol --player-seen(24,17)--> chase {T1} | vision=visible memoria=vision@24,17   (la visión le gana al sonido)
t= 1000 chase --vision-lost [hay posicion conocida]--> investigate {T3} | vision=occluded memoria=vision@24,17
t= 1050 investigate --destination-reached--> search {T7}
t= 4050 search --tick [tiempo agotado]--> return {T9}
t= 4900 return --destination-reached--> patrol {T10}
```

En el caso límite, la memoria conserva (24,17), donde fue visto, y no (20,13), donde está escondido. La FSM nunca lee la posición real.

**Recuperación ante destino inaccesible** (mapa 7x3 con una barrera):

```text
t=  100 patrol --sound-heard(5,1)--> investigate {T5} | ruta=unreachable
t=  950 investigate --route-failed--> search {T8} | acciones=recuperacion: unreachable; buscar en el lugar
t= 3950 search --tick--> return {T9}
t= 4000 return --destination-reached--> patrol {T10}
```

## 5. Prueba humana en el juego y depuración

Juan probó el juego (`npm run dev`) el 2026-11-10:
- Patrulla, sonido, persecución, pérdida detrás de una pared, oclusión y reinicio coincidieron con lo esperado.
- La pantalla mostró estado, estado anterior, evento, causa, memoria y ruta.

**Falla encontrada:** si el jugador se queda quieto mientras lo persiguen, a veces el guardia va hacia atrás y vuelve, trabado hasta que el jugador se mueve.

Depuración por evidencia:

1. **Hipótesis:** cada ruta nueva empieza por el centro de la celda actual. Si el guardia ya lo pasó, retrocede, gira y pierde la visión. Eso alterna Perseguir (T1) e Investigar (T3).
2. **Primera reproducción:** jugador quieto delante, en la misma fila. **No reprodujo:** el jugador nunca sale del cono.
3. **Segunda reproducción**, con la hipótesis refinada: jugador quieto al costado del recorrido, como en la captura de Juan. En la celda (21,18) hubo alternancia T1/T3 cada 150 ms durante los 8 s simulados. **Reproducido.**
4. **Corrección mínima** en `buildWaypoints` del controlador:
   - Se saltea el centro de la celda ocupada si la ruta continúa.
   - En Perseguir e Investigar, el último punto es la posición percibida exacta.
   - Cada tramo sigue dentro de dos celdas vecinas transitables (la invariante I5 se comprueba en cada paso).
5. **Prueba de regresión:** 5 posiciones del jugador quieto. Ningún cambio T1/T3 después de los 3 s y estado final Perseguir. Pasa. Las trazas normal, límite e inaccesible no cambiaron.
6. **Nueva prueba humana:** el 2026-11-10, Juan volvió a probar quedándose quieto durante la persecución, en distintas posiciones. El guardia ya no se traba.

## 6. Validación final

```text
$ npm run validate   -> typecheck OK; 9 archivos y 70 pruebas aprobadas; build OK (exit 0)
$ grep -rn phaser src/domain src/application   -> sin resultados: el dominio y la aplicación no dependen de Phaser
```

Dependencias nuevas: ninguna; `package.json` y `package-lock.json` sin cambios.

Archivos modificados:
- `src/application/simulation/labLevel.ts`: puntos de patrulla.
- `src/game/scenes/GameScene.ts`: la FSM reemplaza al clic; HUD; pausa y paso.
- `index.html`: textos H4 y controles.

Archivos nuevos:
- `src/domain/behavior/guardFsm.ts`
- `src/application/simulation/guardController.ts` y `labGuard.ts`
- Tres archivos de prueba y estos documentos.

## 7. Revisión de diseño y límites

**Por qué una FSM:**
- El guardia tiene pocos modos exclusivos.
- Las prioridades son claras: la visión gana a todo.
- Para el jugador importa la legibilidad: el color y el texto muestran el estado.
- Una tabla declarativa permite probar cada transición y cada guarda falsa.

**Qué justificaría migrar a otra técnica:** si se agregan variables cruzadas, como salud, aturdimiento, alarma o varios guardias coordinados, la tabla crecería por combinación. Una HFSM agruparía las transiciones globales, como "Incapacitado". Si hiciera falta elegir de forma continua entre varias opciones, convendría un sistema de utilidad.

**Límites conocidos (sin resolver):**
- **Sonido sostenido:** mientras el sonido sigue activo (800 ms), se vuelve a oír en cada actualización y, por prioridad, posterga el evento de llegada. En el caso normal, el guardia llega antes, pero recién pasa a Buscar a los 950 ms.
- **Pérdida breve al girar:** el cono sigue la dirección del movimiento. Al empezar una ruta que dobla, el guardia puede perder al jugador uno o dos pasos (T1 → T3 → T1 dentro de unos 300 ms), aunque después se estabiliza.
- **Sin captura:** alcanzar al jugador no tiene consecuencia, porque quedó fuera de alcance en la spec.
- **Un solo guardia** y geometría estática.

## Uso de IA

Claude Code (modelo Claude Opus 5.5) exploró el repositorio, redactó la spec, implementó y ejecutó las pruebas. Juan aprobó la spec y sus tres decisiones de diseño, probó el juego y encontró la falla de la sección 5, que se corrigió con reproducción y prueba de regresión. Dos afirmaciones del modelo resultaron refutadas por la ejecución y quedaron registradas: la ruta exacta del desempate y la primera reproducción de la falla. Ninguna afirmación del modelo se tomó como evidencia sin una prueba o ejecución.
