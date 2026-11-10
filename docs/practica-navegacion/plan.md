# Plan — práctica de navegación
Estado: Aprobado (2026-11-10, Juan Martin Vianco Hail)
Variante: A
Spec: spec.md

| Incremento | Trabajo | Archivos reales | Criterios | Comprobación |
|---|---|---|---|---|
| 1 | Configurar/ajustar dominio y probar caso normal/límite de mi variante | `src/domain/navigation/search.ts`; `tests/navigation/practicaNavegacion.test.ts` | A-AC1, A-AC2, A-01, A-02, A-04 | `npx vitest run tests/navigation` |
| 2 | Conectar con consumidor existente y probar contrato anterior | `src/application/simulation/navigationDemo.ts`; `tests/navigation/practicaNavegacion.test.ts` | A-AC3, A-03, BASE-AC5 | `npx vitest run tests/navigation` |
| 3 | Validación final, diff y cierre de evidencia | `docs/practica-navegacion/evidencia.md` | BASE-AC1 a BASE-AC6 | `npm run validate`; `git diff --stat bb94dde` |

Referencia previa: comparación y casos comunes BASE-01 a BASE-04 completados.
Riesgos:
1. Que `totalCost` siga contando pasos aunque cambie la prioridad. Se detecta con la ruta directa de costo 16.
2. Que el parámetro nuevo cambie el caso unitario o el guardia del juego. Se detecta con las pruebas existentes de A* y del controlador.
Detenerse si: faltan permisos, hay cambios ajenos, conflicto de contrato,
regresión nueva o se requiere dependencia/UI/refactorización fuera del alcance.
No crear commits ni publicar automáticamente.
