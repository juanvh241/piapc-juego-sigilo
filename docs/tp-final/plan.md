# Plan de implementación — Escapa del Sótano

Estado: Aprobado (2026-11-10, Juan Martin Vianco Hail) · Specs: `specs/tp-01` a `tp-07` (aprobadas el 2026-11-10)

Cada spec se implementa por separado y se valida antes de pasar a la siguiente. Hay dos pruebas humanas en el juego: una después de TP-03 y otra al final.

| Spec | Archivos | Cómo se implementa | Comprobación automática |
|---|---|---|---|
| TP-01 | `src/domain/model/random.ts`, `src/domain/level/basementGenerator.ts`, `tests/level/basementGenerator.test.ts` | Función pura con azar inyectado (mulberry32): 6 sectores, salas, árbol de pasillos más 1 o 2 extra, cajas, vidrios, cuchillo, puerta e inicios; validación con BFS; hasta 50 intentos y respaldo fijo | 200 semillas válidas; respaldo con generador forzado a fallar |
| TP-02 | `basementGenerator.ts` (elige los puntos de patrulla), `src/application/simulation/basementGuard.ts` (configuración del guardia por sótano) | Centros de 3 o 4 salas alcanzables por el matón | 100 semillas: puntos transitables y alcanzables |
| TP-03 | `src/domain/navigation/search.ts` (opción de heurística 0 = Dijkstra), `navigationDemo.ts` (`"dijkstra"`), `guardController.ts` (modo de navegación y costos del vidrio) | Dijkstra reutiliza A*; la ruta cautelosa pasa costos de entrada; BFS los ignora y se avisa | Franja de vidrio: Dijkstra y A* con igual costo, Dijkstra con igual o más expansiones; consumidor con `"dijkstra"` |
| (escena 1) | `src/game/scenes/GameScene.ts` | La escena usa el sótano generado: G (nuevo), Espacio (3 algoritmos), C (navegación) y V (mostrar ruta y patrulla) | `npm run validate` y **primera prueba humana** |
| TP-04 | `src/application/simulation/playerNoise.ts`, pruebas | Función pura de cadencia de pasos y entrada a vidrio; el ruido más fuerte del paso se envía como sonido | Cadencia, Shift, un ruido por entrada e integración con T5 |
| TP-05 | `guardFsm.ts` (estado Neutralizado, regla T15), `src/application/simulation/takedown.ts`, `guardController.ts`, escena | Cuatro condiciones de E; captura a menos de 16 px en Perseguir; puerta con llave | Cada condición válida e inválida; Neutralizado ignora eventos; captura |
| TP-06 | `basementGenerator.ts` (parámetros de nivel), escena (oscuridad con máscara invertida y V) | El nivel recibe vidrios y radio de luz; los objetos fuera de la luz se ocultan | 100 semillas del nivel 2 con 30 a 40 vidrios |
| TP-07 | `README.md`, `docs/presentacion.md` | Texto y diagrama de la FSM | Seguir el README desde una copia limpia; **prueba humana final** |

**Compatibilidad:** `LAB_MAP` y las pruebas de los laboratorios anteriores se conservan; la escena pasa a usar el sótano.

**Detenerse si:** hace falta una dependencia nueva, falla una prueba anterior sin explicación o una spec resulta imposible tal como está escrita. En ese caso se consulta y se actualiza la spec.

**No crear commits ni subir cambios sin autorización.**
