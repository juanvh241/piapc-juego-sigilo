# Spec TP-05 — Cuchillo, neutralización, captura y escape

Estado: Aprobada (2026-11-10, Juan Martin Vianco Hail) · Depende de: TP-01, TP-02

## Objetivo

Darle al jugador un objetivo completo: tomar el cuchillo, neutralizar al matón por la espalda, obtener la llave y escapar. El jugador también puede perder si lo atrapan.

## Comportamiento esperado

- **Cuchillo:** se toma al pasar por su celda. El HUD lo indica.
- **Neutralizar (E):** solo funciona si se cumplen las cuatro condiciones:
  1. El jugador tiene el cuchillo.
  2. Está a 40 px o menos del matón.
  3. Está **detrás**: fuera del cono de visión del matón.
  4. El matón **no** está en Perseguir.

  Si falta alguna, el HUD dice cuál.
- **Si la neutralización es válida:**
  - La FSM pasa al estado nuevo **Neutralizado** (regla T15). Es terminal: no percibe, no navega y no transiciona.
  - La puerta se abre ("tenés la llave").
- **Captura:** si el matón está en Perseguir y llega a menos de 16 px del jugador, aparece "TE ATRAPARON" y se reinicia el mismo sótano.
- **Escape:** con la puerta abierta, al entrar en su celda aparece "ESCAPASTE" y se pasa al nivel siguiente (TP-06).
- **Invariante nueva:** un matón Neutralizado no se mueve ni cambia de estado ante ningún evento.

## Fuera de alcance

- Combate frontal, animaciones de ataque, cuerpos, varias armas y puntaje.

## Cómo comprobarlo

- **Jugando:**
  - Tomar el cuchillo, acercarse por detrás con Shift y presionar E: el matón queda neutralizado, la puerta se abre y al llegar aparece ESCAPASTE.
  - Presionar E de frente o sin cuchillo: aparece el motivo y no pasa nada.
  - Dejarse atrapar: se reinicia el nivel.
- **Pruebas automáticas:**
  - Cada condición de E, con su caso válido y uno inválido por condición.
  - Neutralizado ignora todos los eventos.
  - Captura solo en Perseguir y a menos de 16 px.
  - La puerta solo deja escapar después de neutralizar.
