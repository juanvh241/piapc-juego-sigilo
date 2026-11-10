# Escapa del Sótano

TP final integrador de **Programación de Inteligencia Artificial y Patrones de Comportamiento** (UNRaf, 2026): IA para NPC en un videojuego.

**Integrante:** Juan Martin Vianco Hail (trabajo individual).

Una mafia te secuestró y te encerró en un sótano oscuro. Un matón vigila el lugar y tiene la llave de la única salida. Tenés que encontrar un cuchillo, acercarte al matón sin que te vea ni te oiga, neutralizarlo por la espalda y escapar por la puerta. El juego tiene dos niveles generados al azar: el segundo trae más vidrios y menos luz.

El matón es un NPC con IA clásica: percibe con vista y oído, recuerda la última posición percibida, decide con una máquina de estados (FSM) y navega con BFS, Dijkstra o A*. Puede seguir la ruta directa o una ruta cautelosa que evita los vidrios.

## Requisitos y ejecución

Requiere **Node.js 22 o superior** y npm.

```bash
npm ci
npm run dev
```

Abrí la dirección que muestra Vite (por defecto http://localhost:5173).

Para la validación completa (tipos, pruebas automáticas y compilación):

```bash
npm run validate
```

## Controles

| Tecla | Acción |
|---|---|
| WASD o flechas | Moverse (los pasos hacen ruido) |
| Shift (mantener) | Caminar lento y en silencio. El vidrio suena igual |
| E | Neutralizar al matón: con el cuchillo, por la espalda, muy cerca y sin que te esté persiguiendo |
| Clic | Arrojar un objeto para distraer (hasta 6 celdas, cada 2 s) |
| **G** | **Generar otro sótano** |
| **Espacio** | **Cambiar el algoritmo de búsqueda:** BFS → Dijkstra → A* |
| **C** | **Cambiar la navegación:** ruta directa / ruta cautelosa |
| **V** | **Modo demostración:** quita la oscuridad y muestra cono, ruta, nodos explorados, patrulla, memoria y estado del matón |
| P / N | Pausa / avanzar un paso |
| R | Reiniciar el nivel (mismo sótano) |

## Qué observar

- **Escenarios variables:** cada vez que presionás G cambia el laberinto: pasillos, atajos, cámaras, cajas, vidrios, cuchillo y puerta. El generador comprueba con BFS que siempre se pueda ganar y que haya al menos dos caminos hasta el cuchillo. Con V se ve que la patrulla del matón se recalcula sobre el nuevo mapa.
- **Búsqueda:** con V activo, presioná Espacio y mirá la ruta y los nodos explorados. Dijkstra y A* encuentran el mismo costo, pero A* explora menos. BFS no admite costos.
- **Navegación:** con C, el matón rodea los vidrios (ruta cautelosa, con Dijkstra o A*) o los cruza (ruta directa). Con BFS en modo cauteloso, el HUD avisa que ignora costos.
- **Comportamiento:** el matón pasa por Patrullar, Investigar, Perseguir, Buscar y Regresar, y el estado terminal Neutralizado. El estado actual, el anterior y el último evento se ven en el HUD (modo V) y en la consola del navegador (`[fsm]`).

## Documentación

- [GDD](GDD.md)
- Specs del TP final:
  - [TP-01 Generador de sótanos](specs/tp-01-generador-sotano.md)
  - [TP-02 Patrulla adaptada](specs/tp-02-patrulla-adaptada.md)
  - [TP-03 Búsqueda y navegación](specs/tp-03-busqueda-y-navegacion.md)
  - [TP-04 Ruido del jugador](specs/tp-04-ruido-del-jugador.md)
  - [TP-05 Cuchillo y escape](specs/tp-05-cuchillo-y-escape.md)
  - [TP-06 Oscuridad y niveles](specs/tp-06-oscuridad-y-niveles.md)
  - [TP-07 README y presentación](specs/tp-07-readme-y-presentacion.md)
- [Plan de implementación](docs/tp-final/plan.md)
- [**Presentación**](docs/presentacion.md)
- Trabajos previos sobre el mismo proyecto:
  - [Laboratorio de A* y FSM](docs/lab-astar-fsm/)
  - [Práctica de navegación](docs/practica-navegacion/)
  - [Cinco mejoras](docs/upgrades/)
- [Arquitectura](docs/arquitectura.md), [especificación del producto](specs/01-producto.md) e [instrucciones para agentes](AGENTS.md).

## Arquitectura

| Capa | Ruta | Responsabilidad |
|---|---|---|
| Dominio | `src/domain/` | Grilla, búsquedas, percepción, memoria, FSM y generador. TypeScript puro, sin Phaser |
| Aplicación | `src/application/simulation/` | Controlador del matón, ruido, reglas de derribo, captura y escape, y niveles |
| Juego | `src/game/` | Escena Phaser: entrada, dibujo, oscuridad y HUD. No decide conductas |

## Créditos y uso de IA

- Base: plantilla **"Guardia de Sigilo"** de la cátedra PIAPC (prof. Nicolás Nocete), sobre la que se desarrollaron los laboratorios y este TP.
- Desarrollo asistido con **Claude Code** (modelo Claude Opus 5.5) como agente, con un proceso guiado por specs. Las specs, los planes y las decisiones fueron aprobados por el integrante, que probó cada parte jugando.
- Sin recursos externos: todo se dibuja por código.
