# Spec TP-07 — README y presentación

Estado: Aprobada (2026-11-10, Juan Martin Vianco Hail) · Depende de: TP-01 a TP-06

## Objetivo

Que la cátedra pueda ejecutar y entender el prototipo sin ayuda, y que la presentación cubra lo que pide la consigna.

## Comportamiento esperado

- **`README.md`:**
  - Integrante.
  - Descripción del juego.
  - Requisitos: Node 22 o superior.
  - Instalación y ejecución: `npm ci` y `npm run dev`.
  - Validación: `npm run validate`.
  - Controles, incluidos los de algoritmo, navegación, nuevo escenario y modo demostración.
  - Enlaces al GDD, a las specs y a la presentación.
  - Créditos: el proyecto continúa la plantilla "Guardia de Sigilo" de la cátedra.
- **`docs/presentacion.md`:** presentación breve con estas secciones:
  1. Idea y demostración.
  2. Escenarios generados y sus reglas.
  3. Búsqueda (BFS, Dijkstra y A*) y sus diferencias.
  4. Navegación directa y cautelosa.
  5. IA del matón: percepción, memoria, FSM con diagrama y transiciones.
  6. Desarrollo con agente: una spec de ejemplo y una corrección propia.
  7. Conclusiones y limitaciones.

## Fuera de alcance

- Video.
- Diapositivas con diseño elaborado.
- Informe técnico extenso.

## Cómo comprobarlo

- Seguir el README desde una copia limpia del repositorio: instalar, ejecutar, jugar y validar sin pasos faltantes.
- Revisar que la presentación cubra las siete secciones de la consigna.
