# Spec TP-06 — Oscuridad, modo demostración y niveles

Estado: Aprobada (2026-11-10, Juan Martin Vianco Hail) · Depende de: TP-01 a TP-05

## Objetivo

Que la poca luz genere riesgo, porque los vidrios no se ven de lejos, y que haya progresión entre niveles. Además, que la IA se pueda observar en la presentación.

## Comportamiento esperado

- **Oscuridad:** se cubre la escena con negro, salvo los círculos de luz.
  - Luz del jugador: radio de 96 px en el nivel 1 y de 72 px en el nivel 2.
  - Fuera de las luces no se dibujan vidrios. Las paredes y las cajas se ven tenues.
- **Luces guía** (revisión del 2026-11-10, decidida tras la prueba humana; ver abajo):
  - **Matón:** lleva una luz de 56 px, así que siempre se sabe dónde está, incluso neutralizado.
  - **Cuchillo:** brilla con una luz de 40 px hasta que se toma, como guía mínima.
  - **Puerta:** brilla con una luz de 40 px una vez que está abierta.
  - Un objeto dentro de cualquier luz se dibuja. La conducta del matón no cambia: su luz es solo visual.
- **Opacidad:** la oscuridad cubre con un 94 % de opacidad y las paredes conservan sus tonos oscuros originales: la visibilidad general es baja y las luces guía orientan.
- **Modo demostración (V):** quita la oscuridad y muestra cono, ruta, nodos explorados, puntos de patrulla y memoria del matón. No cambia la conducta.
- **Niveles:**
  - **Nivel 1:** valores de TP-01.
  - **Nivel 2:** 30 a 40 vidrios y luz de 72 px.
  - Al escapar del nivel 2 aparece "GANASTE". La tecla G o R vuelve a empezar.
  - El nivel actual se muestra en el HUD.
- **Ajuste por nivel:** la oscuridad y la cantidad de vidrios salen de un parámetro de nivel que recibe el generador. Sin código duplicado.

## Fuera de alcance

- Sombras proyectadas por paredes.
- Linterna con batería.
- Más de 2 niveles.
- Un segundo matón (extra solo si sobra tiempo; requeriría otra spec).

## Cómo comprobarlo

- **Jugando:**
  - En el nivel 1 se ve poco alrededor y los vidrios aparecen al acercarse.
  - V muestra todo y vuelve a ocultarlo.
  - Escapar lleva al nivel 2, con más vidrios y menos luz.
  - Escapar del nivel 2 muestra GANASTE.
- **Prueba automática:** los parámetros del nivel 2 producen sótanos válidos con 30 a 40 vidrios (100 semillas).
- **Prueba automática de las luces:** el matón y el cuchillo quedan iluminados aunque estén lejos del jugador; el cuchillo deja de brillar al tomarlo y la puerta brilla solo abierta.

## Revisión tras la prueba humana (2026-11-10)

En la primera prueba, Juan observó que, con la oscuridad original (94 % de opacidad y solo la luz del jugador), era imposible saber dónde estaba el matón y hacia dónde ir. Decidió:
- agregar luces guía al matón y al cuchillo;
- bajar la opacidad de la oscuridad;
- aclarar las paredes.

En una segunda prueba, Juan prefirió la visibilidad general original: se volvió al 94 % de opacidad y a las paredes oscuras, y se mantuvieron las luces guía.

Se agregó la luz de la puerta abierta para guiar la salida. El riesgo de los vidrios se mantiene: siguen ocultos fuera de las luces.
