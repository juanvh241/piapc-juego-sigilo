# Spec TP-01 — Generador de sótanos

Estado: Aprobada (2026-11-10, Juan Martin Vianco Hail) · GDD: [../GDD.md](../GDD.md)

## Objetivo

Que cada partida y cada tecla **G** produzcan un sótano distinto y siempre jugable. Las rutas del matón y del jugador tienen que adaptarse a obstáculos que cambian, no a un mapa fijo.

## Comportamiento esperado

- **Cuadrícula:** 30 x 20 celdas, con borde de paredes.
- **Estructura laberíntica** (revisión del 2026-11-10; ver abajo):
  - **Laberinto:** se arma con un recorrido en profundidad aleatorio. El ancho de los pasillos es un parámetro: 2 celdas en la versión actual, elegida tras la prueba humana (1 en la versión anterior; ver revisión 2).
  - **Atajos:** se rompe al azar un 18 % de las paredes que separan dos pasillos. Eso crea ciclos, es decir, varios caminos entre dos puntos.
  - **Cámaras:** se abren 5 o 6 cámaras más amplias (4 a 6 x 3 a 5 celdas), una por sector de una grilla de 3 x 2 elegida al azar. Se mezclan con el laberinto, de modo que no hace falta ir de habitación en habitación por pasillos.
- **Objetos:**
  - **Cajas:** 4 a 8, dentro de las cámaras. Son obstáculos.
  - **Vidrios:** 15 a 25, en celdas libres de cámaras y pasillos. Se pueden pisar.
  - **Cuchillo:** en una cámara distinta de la del jugador.
  - **Puerta de salida:** en la cámara más lejana al inicio del jugador.
- **Posiciones iniciales:** el jugador empieza en una celda libre de una cámara. El matón empieza en otra cámara, a al menos 12 pasos del jugador.
- **Validación con BFS:**
  - Desde el inicio del jugador se debe poder llegar al cuchillo, al matón y a la puerta.
  - **Hay al menos dos caminos distintos hasta el cuchillo:** si se bloquean las celdas intermedias del camino más corto, el cuchillo sigue siendo alcanzable.
  - Nada se superpone: ni personajes ni objetos sobre paredes o cajas, ni dos objetos en la misma celda.
  - Si falla, se descarta y se genera otro, con un máximo de 50 intentos. Si se agotan, se usa un sótano fijo de respaldo y se informa en el HUD.
- **Azar inyectable:** el generador recibe la fuente de azar, para poder reproducirlo en las pruebas. El HUD muestra el número de semilla como dato informativo.
- **Pureza:** la función generadora no depende de Phaser.

## Fuera de alcance

- Salas de forma irregular, varias plantas, decoración y editor de niveles.
- Guardar mapas.

## Cómo comprobarlo

- **Jugando:** presionar G varias veces. El sótano cambia (laberinto, cámaras, cajas, vidrios), siempre se ven cuchillo, puerta y matón en lugares válidos y se puede caminar hasta ellos por más de un camino.
- **Prueba automática:** con 200 semillas, todos los sótanos cumplen la validación, incluida la de dos caminos al cuchillo. Las cantidades están dentro de los rangos y ningún objeto queda sobre una pared o una caja.
- **Caso problemático:** una prueba fuerza un generador que siempre falla y comprueba que se usa el mapa de respaldo, con aviso, sin bloquear el juego.

## Revisión tras la prueba humana (2026-11-10)

La primera versión usaba 6 salas rectangulares unidas por pasillos. Al jugar, Juan observó que se sentía como "cubículos" y que siempre había que ir de habitación en habitación. Decidió pasar a una estructura más desordenada y laberíntica, con varios caminos para llegar al cuchillo. Se reemplazaron las salas y pasillos por un laberinto con atajos y cámaras, y se agregó la regla verificable de dos caminos al cuchillo.

## Revisión 2 tras la prueba humana (2026-11-10)

Con el laberinto, Juan observó que los pasillos de 1 celda eran demasiado estrechos y pidió probar un espacio más amplio para moverse. Se agregó el parámetro `corridorWidth` y se probó con 2 celdas. Si la prueba no convence, se vuelve a 1 sin otros cambios: el resto de las reglas y validaciones es igual.

**Resultado:** Juan probó la versión de 2 celdas y decidió conservarla ("así quedó mejor"). La versión de 1 celda sigue disponible con el parámetro y tiene su prueba de validez.
