import { assertFiniteVector, type Vector2 } from "../model/vector";
import type { PerceptionSource } from "../perception/memory";

/**
 * Guard finite state machine (lab spec docs/lab-astar-fsm/spec.md).
 * Pure domain code: events and time are injected, nothing depends on Phaser.
 */

export type GuardStateName = "patrol" | "investigate" | "chase" | "search" | "return";

export type GuardEvent =
  | { readonly type: "player-seen"; readonly position: Vector2 }
  | { readonly type: "vision-lost" }
  | { readonly type: "sound-heard"; readonly position: Vector2 }
  | { readonly type: "route-failed"; readonly reason: string }
  | { readonly type: "destination-reached" }
  | { readonly type: "tick" };

export type GuardEventType = GuardEvent["type"];

/** Raw observations gathered by the application layer in one update. */
export interface GuardObservations {
  readonly visiblePlayerPosition: Vector2 | null;
  readonly heardSoundPosition: Vector2 | null;
  readonly routeFailure: string | null;
  readonly destinationReached: boolean;
}

/** Read-only context consulted by guards. */
export interface GuardContext {
  readonly timeMs: number;
  readonly lastKnownPosition: Vector2 | null;
  readonly lastKnownSource: PerceptionSource | null;
  readonly patrolPointCount: number;
}

export interface GuardTimings {
  readonly searchDurationMs: number;
  /** Upgrade 1: pause at each reached patrol point. 0 (default) disables it. */
  readonly patrolPauseMs?: number;
}

export interface GuardBrain {
  readonly state: GuardStateName;
  readonly previousState: GuardStateName | null;
  readonly lastEvent: GuardEventType | null;
  /** World position for investigate and chase; null otherwise. */
  readonly target: Vector2 | null;
  readonly patrolIndex: number;
  readonly enteredAtMs: number;
  readonly searchEndsAtMs: number | null;
  /** Upgrade 1: end of the pause at a patrol point; null when not pausing. */
  readonly pauseEndsAtMs: number | null;
  readonly failedPatrolAttempts: number;
  readonly stalled: boolean;
}

export type TransitionKind = "transition" | "update" | "ignored";

export interface TransitionRecord {
  readonly timeMs: number;
  readonly rule: string | null;
  readonly kind: TransitionKind;
  readonly from: GuardStateName;
  readonly event: GuardEventType;
  readonly eventPosition: Vector2 | null;
  readonly guard: string;
  readonly to: GuardStateName;
  readonly actions: readonly string[];
}

export interface GuardStepResult {
  readonly brain: GuardBrain;
  readonly record: TransitionRecord;
}

export const GUARD_STATES: readonly GuardStateName[] = [
  "patrol",
  "investigate",
  "chase",
  "search",
  "return",
];

export function initialGuardBrain(): GuardBrain {
  return {
    state: "patrol",
    previousState: null,
    lastEvent: null,
    target: null,
    patrolIndex: 0,
    enteredAtMs: 0,
    searchEndsAtMs: null,
    pauseEndsAtMs: null,
    failedPatrolAttempts: 0,
    stalled: false,
  };
}

/**
 * Arbitration: exactly one event per update, by explicit priority.
 * Vision beats loss of vision, which beats sound, route failure, arrival and time.
 */
export function selectGuardEvent(
  state: GuardStateName,
  observations: GuardObservations,
): GuardEvent {
  if (observations.visiblePlayerPosition) {
    return { type: "player-seen", position: observations.visiblePlayerPosition };
  }
  if (state === "chase") {
    return { type: "vision-lost" };
  }
  if (observations.heardSoundPosition) {
    return { type: "sound-heard", position: observations.heardSoundPosition };
  }
  if (observations.routeFailure) {
    return { type: "route-failed", reason: observations.routeFailure };
  }
  if (observations.destinationReached) {
    return { type: "destination-reached" };
  }
  return { type: "tick" };
}

export function stepGuard(
  brain: GuardBrain,
  event: GuardEvent,
  context: GuardContext,
  timings: GuardTimings,
): GuardStepResult {
  validateInputs(event, context, timings);
  const time = context.timeMs;
  const eventPosition = "position" in event ? { ...event.position } : null;
  const withEvent: GuardBrain = { ...brain, lastEvent: event.type };

  const record = (
    rule: string | null,
    kind: TransitionKind,
    guard: string,
    to: GuardStateName,
    actions: readonly string[],
  ): TransitionRecord => ({
    timeMs: time,
    rule,
    kind,
    from: brain.state,
    event: event.type,
    eventPosition,
    guard,
    to,
    actions,
  });

  const enter = (
    to: GuardStateName,
    changes: Partial<GuardBrain>,
  ): GuardBrain => ({
    ...withEvent,
    state: to,
    previousState: brain.state,
    enteredAtMs: time,
    target: null,
    searchEndsAtMs: null,
    pauseEndsAtMs: null,
    stalled: false,
    ...changes,
  });
  const pauseMs = timings.patrolPauseMs ?? 0;
  const pauseUntil = pauseMs > 0 ? time + pauseMs : null;

  const ignore = (guard: string): GuardStepResult => ({
    brain: withEvent,
    record: record(null, "ignored", guard, brain.state, []),
  });

  switch (event.type) {
    case "player-seen": {
      if (brain.state === "chase") {
        return {
          brain: { ...withEvent, target: { ...event.position } },
          record: record("T2", "update", "-", "chase", ["renovar objetivo"]),
        };
      }
      return {
        brain: enter("chase", { target: { ...event.position } }),
        record: record("T1", "transition", "-", "chase", ["objetivo=posicion vista", "calcular ruta"]),
      };
    }

    case "vision-lost": {
      if (brain.state !== "chase") {
        return ignore("vision-lost fuera de persecucion");
      }
      if (context.lastKnownPosition) {
        return {
          brain: enter("investigate", { target: { ...context.lastKnownPosition } }),
          record: record("T3", "transition", "hay posicion conocida", "investigate", [
            "ir a ultima posicion vista",
          ]),
        };
      }
      return {
        brain: enter("search", { searchEndsAtMs: time + timings.searchDurationMs }),
        record: record("T4", "transition", "sin posicion conocida", "search", [
          "iniciar temporizador",
        ]),
      };
    }

    case "sound-heard": {
      if (brain.state === "chase") {
        return ignore("persecucion tiene prioridad sobre sonido");
      }
      if (brain.state === "investigate") {
        return {
          brain: { ...withEvent, target: { ...event.position } },
          record: record("T6", "update", "-", "investigate", ["actualizar destino"]),
        };
      }
      return {
        brain: enter("investigate", { target: { ...event.position } }),
        record: record("T5", "transition", "-", "investigate", ["ir a posicion del sonido"]),
      };
    }

    case "route-failed": {
      if (brain.state === "investigate" || brain.state === "chase") {
        return {
          brain: enter("search", { searchEndsAtMs: time + timings.searchDurationMs }),
          record: record("T8", "transition", "-", "search", [
            `recuperacion: ${event.reason}`,
            "buscar en el lugar",
          ]),
        };
      }
      if (brain.state === "patrol" || brain.state === "return") {
        const attempts = brain.failedPatrolAttempts + 1;
        if (attempts < context.patrolPointCount) {
          return {
            brain: {
              ...withEvent,
              patrolIndex: nextPatrolIndex(brain.patrolIndex, context.patrolPointCount),
              failedPatrolAttempts: attempts,
            },
            record: record("T12", "update", "quedan puntos sin probar", brain.state, [
              "saltar al punto siguiente",
            ]),
          };
        }
        return {
          brain: { ...withEvent, failedPatrolAttempts: attempts, stalled: true },
          record: record("T13", "update", "ningun punto alcanzable", brain.state, [
            "detenerse: sin patrulla alcanzable",
          ]),
        };
      }
      return ignore("sin ruta activa en busqueda");
    }

    case "destination-reached": {
      if (brain.state === "investigate") {
        return {
          brain: enter("search", { searchEndsAtMs: time + timings.searchDurationMs }),
          record: record("T7", "transition", "-", "search", ["iniciar temporizador", "girar"]),
        };
      }
      if (brain.state === "return") {
        return {
          brain: enter("patrol", {
            patrolIndex: nextPatrolIndex(brain.patrolIndex, context.patrolPointCount),
            failedPatrolAttempts: 0,
            pauseEndsAtMs: pauseUntil,
          }),
          record: record("T10", "transition", "-", "patrol", [
            "continuar circuito",
            ...(pauseUntil === null ? [] : [`pausa hasta ${pauseUntil} ms`]),
          ]),
        };
      }
      if (brain.state === "patrol") {
        if (brain.pauseEndsAtMs !== null) {
          return ignore("pausa en curso");
        }
        return {
          brain: {
            ...withEvent,
            patrolIndex: nextPatrolIndex(brain.patrolIndex, context.patrolPointCount),
            failedPatrolAttempts: 0,
            pauseEndsAtMs: pauseUntil,
          },
          record: record("T11", "update", "-", "patrol", [
            "avanzar al punto siguiente",
            ...(pauseUntil === null ? [] : [`pausa hasta ${pauseUntil} ms`]),
          ]),
        };
      }
      return ignore(`llegada sin efecto en ${brain.state}`);
    }

    case "tick": {
      if (brain.state === "search" && brain.searchEndsAtMs !== null) {
        if (time >= brain.searchEndsAtMs) {
          return {
            brain: enter("return", { failedPatrolAttempts: 0 }),
            record: record("T9", "transition", "tiempo agotado", "return", [
              "ir al punto de patrulla pendiente",
            ]),
          };
        }
        return ignore("temporizador vigente");
      }
      if (brain.state === "patrol" && brain.pauseEndsAtMs !== null) {
        if (time >= brain.pauseEndsAtMs) {
          return {
            brain: { ...withEvent, pauseEndsAtMs: null },
            record: record("T14", "update", "fin de pausa", "patrol", ["continuar hacia el punto"]),
          };
        }
        return ignore("pausa en curso");
      }
      return ignore("sin evento");
    }
  }
}

/** Returns human-readable violations; an empty list means all invariants hold. */
export function checkGuardInvariants(brain: GuardBrain, context: GuardContext): string[] {
  const violations: string[] = [];

  if (!GUARD_STATES.includes(brain.state)) {
    violations.push(`estado desconocido: ${String(brain.state)}`);
  }
  if (
    brain.state === "chase"
    && (context.lastKnownPosition === null || context.lastKnownSource !== "vision")
  ) {
    violations.push("I1: Perseguir sin posicion conocida de origen visual");
  }
  if (
    brain.state === "search"
    && (
      brain.searchEndsAtMs === null
      || !Number.isFinite(brain.searchEndsAtMs)
      || brain.searchEndsAtMs < brain.enteredAtMs
    )
  ) {
    violations.push("I2: Buscar sin temporizador finito y no negativo");
  }
  if (
    (brain.state === "patrol" || brain.state === "return")
    && (
      !Number.isInteger(brain.patrolIndex)
      || brain.patrolIndex < 0
      || brain.patrolIndex >= context.patrolPointCount
    )
  ) {
    violations.push("I3: indice de patrulla fuera de los puntos configurados");
  }
  if (
    brain.state === "investigate"
    && (
      brain.target === null
      || context.lastKnownPosition === null
      || brain.target.x !== context.lastKnownPosition.x
      || brain.target.y !== context.lastKnownPosition.y
    )
  ) {
    violations.push("I4: Investigar con un objetivo que no viene de la memoria");
  }

  return violations;
}

function nextPatrolIndex(index: number, count: number): number {
  return count > 0 ? (index + 1) % count : 0;
}

function validateInputs(event: GuardEvent, context: GuardContext, timings: GuardTimings): void {
  if (!Number.isFinite(context.timeMs)) {
    throw new Error("Guard time must be finite.");
  }
  if (!Number.isInteger(context.patrolPointCount) || context.patrolPointCount <= 0) {
    throw new Error("Guard needs at least one patrol point.");
  }
  if (!Number.isFinite(timings.searchDurationMs) || timings.searchDurationMs < 0) {
    throw new Error("Search duration must be finite and non-negative.");
  }
  if (
    timings.patrolPauseMs !== undefined
    && (!Number.isFinite(timings.patrolPauseMs) || timings.patrolPauseMs < 0)
  ) {
    throw new Error("Patrol pause must be finite and non-negative.");
  }
  if ("position" in event) {
    assertFiniteVector(event.position);
  }
}
