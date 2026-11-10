import Phaser from "phaser";
import {
  initialGuardController,
  updateGuard,
  withAlgorithm,
  type GuardControllerState,
} from "../../application/simulation/guardController";
import { LAB_GUARD_CONFIG, SOUND_DURATION_MS, SOUND_RADIUS } from "../../application/simulation/labGuard";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  LAB_MAP,
  PATROL_POINTS,
  PLAYER_START,
  TILE_SIZE,
} from "../../application/simulation/labLevel";
import type { GuardStateName, TransitionRecord } from "../../domain/behavior/guardFsm";
import { cellCenter, isWalkable, worldToCell } from "../../domain/model/grid";
import type { SoundEvent, VisionReason, VisionResult } from "../../domain/perception/perception";
import type { SearchStatus } from "../../domain/navigation/search";
import { timeSinceLastPerception } from "../../domain/perception/memory";
import { throwDistraction, type DistractionRejection } from "../../application/simulation/distraction";
import {
  ALERT_FLASH_MS,
  ALERT_SHAKE_INTENSITY,
  ALERT_SHAKE_MS,
  shouldTriggerAlert,
} from "../presentation/alertImpact";
import { alertLevel, updateAlertMeter, type AlertLevel } from "../presentation/alertMeter";
import { CONE_COLORS, coneStyle } from "../presentation/coneStyle";

const PLAYER_SPEED = 190;
const STEP_MS = 100;
const STATUS_LABELS: Readonly<Record<SearchStatus, string>> = {
  success: "EXITO",
  unreachable: "INALCANZABLE",
  "invalid-start": "INICIO INVALIDO",
  "invalid-goal": "DESTINO INVALIDO",
};
const VISION_LABELS: Readonly<Record<VisionReason, string>> = {
  visible: "VISIBLE",
  "out-of-range": "FUERA DE RANGO",
  "outside-cone": "FUERA DEL CONO",
  occluded: "OCLUIDO",
  "invalid-facing": "DIRECCION INVALIDA",
};
const STATE_LABELS: Readonly<Record<GuardStateName, string>> = {
  patrol: "PATRULLAR",
  investigate: "INVESTIGAR",
  chase: "PERSEGUIR",
  search: "BUSCAR",
  return: "REGRESAR",
};
const EVENT_LABELS: Readonly<Record<TransitionRecord["event"], string>> = {
  "player-seen": "JugadorVisto",
  "vision-lost": "VisionPerdida",
  "sound-heard": "SonidoOido",
  "route-failed": "RutaFallida",
  "destination-reached": "DestinoAlcanzado",
  tick: "Tick",
};
// Presentation only: the colour follows the state, it never decides it (upgrade 2).
const STATE_COLORS: Readonly<Record<GuardStateName, number>> = CONE_COLORS;
const LEVEL_LABELS: Readonly<Record<AlertLevel, string>> = {
  calm: "CALMA",
  suspicion: "SOSPECHA",
  alert: "ALERTA",
};
const LEVEL_COLORS: Readonly<Record<AlertLevel, number>> = {
  calm: 0x73c991,
  suspicion: 0xe5b454,
  alert: 0xe16969,
};
const REJECTION_LABELS: Readonly<Record<DistractionRejection, string>> = {
  "fuera-de-alcance": "fuera de alcance",
  "celda-bloqueada": "celda bloqueada",
  enfriamiento: "esperando enfriamiento",
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private guard!: Phaser.GameObjects.Arc;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private moveUp!: Phaser.Input.Keyboard.Key;
  private moveDown!: Phaser.Input.Keyboard.Key;
  private moveLeft!: Phaser.Input.Keyboard.Key;
  private moveRight!: Phaser.Input.Keyboard.Key;
  private reset!: Phaser.Input.Keyboard.Key;
  private toggleAlgorithm!: Phaser.Input.Keyboard.Key;
  private emitSound!: Phaser.Input.Keyboard.Key;
  private togglePause!: Phaser.Input.Keyboard.Key;
  private stepOnce!: Phaser.Input.Keyboard.Key;
  private navigationGraphics!: Phaser.GameObjects.Graphics;
  private perceptionGraphics!: Phaser.GameObjects.Graphics;
  private targetMarker!: Phaser.GameObjects.Arc;
  private lastKnownMarker!: Phaser.GameObjects.Arc;
  private hud!: Phaser.GameObjects.Text;
  private guardState!: GuardControllerState;
  private simulationTimeMs = 0;
  private paused = false;
  private pendingSound: SoundEvent | null = null;
  private drawnRoute: object | null = null;
  // Upgrades 4, 7 and 8 (presentation and player input only).
  private lastAlertMs: number | null = null;
  private lastThrowMs: number | null = null;
  private throwNotice = "";
  private alertValue = 0;
  private alertGraphics!: Phaser.GameObjects.Graphics;
  private alertLabel!: Phaser.GameObjects.Text;
  private distractionMarker!: Phaser.GameObjects.Arc;

  public constructor() {
    super("GameScene");
  }

  public create(): void {
    // R restarts the scene: every mutable value is rebuilt here.
    this.guardState = initialGuardController(LAB_GUARD_CONFIG);
    this.simulationTimeMs = 0;
    this.paused = false;
    this.pendingSound = null;
    this.drawnRoute = null;
    this.lastAlertMs = null;
    this.lastThrowMs = null;
    this.throwNotice = "";
    this.alertValue = 0;
    this.cameras.main.setBackgroundColor("#10161c");
    this.drawGrid();

    const walls = this.physics.add.staticGroup();
    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      for (let x = 0; x < GRID_WIDTH; x += 1) {
        if (!isWalkable(LAB_MAP, { x, y })) {
          const center = cellCenter({ x, y }, TILE_SIZE);
          const wall = this.add.rectangle(center.x, center.y, TILE_SIZE, TILE_SIZE, 0x27333d);
          wall.setStrokeStyle(1, 0x3a4c58);
          walls.add(wall);
        }
      }
    }
    this.drawPatrolPoints();

    const spawn = cellCenter(PLAYER_START, TILE_SIZE);
    this.player = this.add.rectangle(spawn.x, spawn.y, 20, 20, 0xe5b454);
    this.player.setStrokeStyle(2, 0xffd98a);
    this.player.setDepth(4);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, walls);
    this.physics.resume();

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is unavailable.");
    }

    this.cursors = keyboard.createCursorKeys();
    this.moveUp = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.moveDown = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.moveLeft = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.moveRight = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.reset = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.toggleAlgorithm = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.emitSound = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.togglePause = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.stepOnce = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N);

    this.perceptionGraphics = this.add.graphics().setDepth(1);
    this.navigationGraphics = this.add.graphics().setDepth(2);
    this.guard = this.add
      .circle(this.guardState.position.x, this.guardState.position.y, 11, STATE_COLORS.patrol)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(4);
    this.targetMarker = this.add
      .circle(0, 0, 10, 0x000000, 0)
      .setStrokeStyle(3, 0x73c991)
      .setDepth(5)
      .setVisible(false);
    this.lastKnownMarker = this.add
      .circle(0, 0, 7, 0x000000, 0)
      .setStrokeStyle(2, 0xe16969)
      .setDepth(5)
      .setVisible(false);

    this.add
      .text(16, 14, "H4 / MAQUINA DE ESTADOS", {
        color: "#9eb4c2",
        fontFamily: "monospace",
        fontSize: "14px",
      })
      .setDepth(10);
    this.distractionMarker = this.add
      .circle(0, 0, 9, 0x000000, 0)
      .setStrokeStyle(3, 0xe5b454)
      .setDepth(5)
      .setVisible(false);
    this.alertGraphics = this.add.graphics().setDepth(9);
    this.alertLabel = this.add
      .text(16, 34, "", { color: "#d9e4ea", fontFamily: "monospace", fontSize: "12px" })
      .setDepth(10);
    this.input.on("pointerdown", this.handleDistraction, this);

    this.add
      .text(16, GRID_HEIGHT * TILE_SIZE - 14, "WASD mover | Q sonido | CLIC distractor | ESPACIO BFS/A* | P pausa | N paso | R reinicio", {
        color: "#9eb4c2",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setOrigin(0, 1)
      .setDepth(10);

    this.hud = this.add
      .text(GRID_WIDTH * TILE_SIZE - 16, 14, "", {
        align: "right",
        backgroundColor: "#10161ccc",
        color: "#d9e4ea",
        fontFamily: "monospace",
        fontSize: "13px",
        padding: { x: 8, y: 6 },
      })
      .setOrigin(1, 0)
      .setDepth(10);

    this.stepGuard(0);
  }

  public update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.reset)) {
      this.scene.restart();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.togglePause)) {
      this.paused = !this.paused;
      if (this.paused) {
        this.physics.pause();
      } else {
        this.physics.resume();
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.toggleAlgorithm)) {
      const next = this.guardState.algorithm === "astar" ? "bfs" : "astar";
      this.guardState = withAlgorithm(this.guardState, next);
    }
    if (Phaser.Input.Keyboard.JustDown(this.emitSound)) {
      this.pendingSound = {
        position: { x: this.player.x, y: this.player.y },
        radius: SOUND_RADIUS,
        emittedAtMs: this.simulationTimeMs,
        durationMs: SOUND_DURATION_MS,
      };
    }

    if (this.paused) {
      this.playerBody.setVelocity(0, 0);
      if (Phaser.Input.Keyboard.JustDown(this.stepOnce)) {
        this.stepGuard(STEP_MS);
      } else {
        this.render(null);
      }
      return;
    }

    const horizontal = Number(this.cursors.right.isDown || this.moveRight.isDown)
      - Number(this.cursors.left.isDown || this.moveLeft.isDown);
    const vertical = Number(this.cursors.down.isDown || this.moveDown.isDown)
      - Number(this.cursors.up.isDown || this.moveUp.isDown);
    const velocity = new Phaser.Math.Vector2(horizontal, vertical);
    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(PLAYER_SPEED);
    }
    this.playerBody.setVelocity(velocity.x, velocity.y);

    // Clamp long frames (tab switches) so the simulation stays controlled.
    this.stepGuard(Math.min(delta, 250));
  }

  private stepGuard(deltaMs: number): void {
    this.simulationTimeMs += deltaMs;
    const result = updateGuard(this.guardState, LAB_GUARD_CONFIG, {
      timeMs: this.simulationTimeMs,
      deltaMs,
      playerPosition: { x: this.player.x, y: this.player.y },
      newSound: this.pendingSound ? { ...this.pendingSound, emittedAtMs: this.simulationTimeMs } : null,
    });
    this.pendingSound = null;
    this.guardState = result.state;

    if (result.record.kind === "transition") {
      console.info("[fsm]", JSON.stringify(result.record));
    }
    // Upgrade 4: single shake + flash when the guard starts a chase.
    if (shouldTriggerAlert(result.record, this.lastAlertMs, this.simulationTimeMs)) {
      this.lastAlertMs = this.simulationTimeMs;
      this.cameras.main.shake(ALERT_SHAKE_MS, ALERT_SHAKE_INTENSITY);
      this.cameras.main.flash(ALERT_FLASH_MS, 225, 105, 105);
      console.info("[alerta]", JSON.stringify({ timeMs: this.simulationTimeMs, rule: result.record.rule }));
    }
    // Upgrade 8: alert meter follows state and vision; nothing reads it back.
    this.alertValue = updateAlertMeter(
      this.alertValue,
      result.state.brain.state,
      result.vision.visible,
      deltaMs,
    );
    if (result.violations.length > 0) {
      console.error("[fsm] invariante violada", result.violations);
    }
    this.render(result.vision);
  }

  private render(vision: VisionResult | null): void {
    const state = this.guardState;
    this.guard.setPosition(state.position.x, state.position.y);
    this.guard.setFillStyle(STATE_COLORS[state.brain.state]);
    if (vision) {
      this.drawPerception(vision);
      this.lastVision = vision;
    }
    if (this.drawnRoute !== state.route.result) {
      this.drawRoute();
      this.drawnRoute = state.route.result;
    }
    this.drawAlertMeter();
    const sound = state.perception.soundEvent;
    this.distractionMarker.setVisible(sound !== null && this.throwNotice.startsWith("ruido"));
    if (sound) {
      this.distractionMarker.setPosition(sound.position.x, sound.position.y);
    }
    this.updateHud();
  }

  /** Upgrade 7: left click throws a noise to the clicked cell. */
  private handleDistraction(pointer: Phaser.Input.Pointer): void {
    const result = throwDistraction({
      player: { x: this.player.x, y: this.player.y },
      target: { x: pointer.worldX, y: pointer.worldY },
      map: LAB_MAP,
      tileSize: TILE_SIZE,
      nowMs: this.simulationTimeMs,
      lastThrowMs: this.lastThrowMs,
    });
    if (result.accepted) {
      this.lastThrowMs = this.simulationTimeMs;
      this.pendingSound = result.sound;
      this.throwNotice = `ruido lanzado a ${cellText(result.sound.position)}`;
    } else {
      this.throwNotice = `distractor rechazado: ${REJECTION_LABELS[result.reason]}`;
    }
    console.info("[distractor]", JSON.stringify({ timeMs: this.simulationTimeMs, ...result }));
  }

  /** Upgrade 8: bar, level label and red frame during ALERTA. */
  private drawAlertMeter(): void {
    const level = alertLevel(this.alertValue);
    const width = 160;
    this.alertGraphics.clear();
    this.alertGraphics.fillStyle(0x1b252d, 0.9);
    this.alertGraphics.fillRect(16, 52, width, 8);
    this.alertGraphics.fillStyle(LEVEL_COLORS[level], 1);
    this.alertGraphics.fillRect(16, 52, (width * this.alertValue) / 100, 8);
    if (level === "alert") {
      this.alertGraphics.lineStyle(4, 0xe16969, 0.8);
      this.alertGraphics.strokeRect(2, 2, GRID_WIDTH * TILE_SIZE - 4, GRID_HEIGHT * TILE_SIZE - 4);
    }
    this.alertLabel.setText(`${LEVEL_LABELS[level]} ${Math.round(this.alertValue)}`);
    this.alertLabel.setColor(`#${LEVEL_COLORS[level].toString(16).padStart(6, "0")}`);
  }

  private lastVision: VisionResult | null = null;

  private drawGrid(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1b252d, 1);
    for (let x = 0; x <= GRID_WIDTH; x += 1) {
      graphics.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= GRID_HEIGHT; y += 1) {
      graphics.lineBetween(0, y * TILE_SIZE, GRID_WIDTH * TILE_SIZE, y * TILE_SIZE);
    }
  }

  private drawPatrolPoints(): void {
    PATROL_POINTS.forEach((point, index) => {
      const center = cellCenter(point, TILE_SIZE);
      this.add.rectangle(center.x, center.y, 10, 10, 0x000000, 0).setStrokeStyle(1, 0x6b8afd).setDepth(1);
      this.add
        .text(center.x + 7, center.y - 16, `P${index}`, { color: "#6b8afd", fontFamily: "monospace", fontSize: "10px" })
        .setDepth(1);
    });
  }

  private drawRoute(): void {
    const result = this.guardState.route.result;
    this.navigationGraphics.clear();
    if (!result) {
      this.targetMarker.setVisible(false);
      return;
    }
    this.navigationGraphics.fillStyle(0x3b819c, 0.18);
    for (const point of result.explored) {
      this.navigationGraphics.fillRect(point.x * TILE_SIZE + 3, point.y * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    }
    const goal = this.guardState.route.goal;
    if (goal) {
      const target = cellCenter(goal, TILE_SIZE);
      this.targetMarker
        .setPosition(target.x, target.y)
        .setStrokeStyle(3, result.status === "success" ? 0x73c991 : 0xe16969)
        .setVisible(true);
    }
    const first = result.path[0];
    if (!first) {
      return;
    }
    const start = cellCenter(first, TILE_SIZE);
    this.navigationGraphics.lineStyle(4, 0x62d0e8, 0.9);
    this.navigationGraphics.beginPath();
    this.navigationGraphics.moveTo(start.x, start.y);
    for (const point of result.path.slice(1)) {
      const center = cellCenter(point, TILE_SIZE);
      this.navigationGraphics.lineTo(center.x, center.y);
    }
    this.navigationGraphics.strokePath();
  }

  private drawPerception(vision: VisionResult): void {
    const state = this.guardState;
    this.perceptionGraphics.clear();
    const facingAngle = Math.atan2(state.facing.y, state.facing.x);
    // Upgrade 2: same range and angle as perception; only the style reacts.
    const half = LAB_GUARD_CONFIG.fieldOfViewRadians / 2;
    const style = coneStyle(state.brain.state, vision.visible);
    this.perceptionGraphics.fillStyle(style.fillColor, style.fillAlpha);
    this.perceptionGraphics.beginPath();
    this.perceptionGraphics.moveTo(state.position.x, state.position.y);
    this.perceptionGraphics.arc(
      state.position.x,
      state.position.y,
      LAB_GUARD_CONFIG.visionRange,
      facingAngle - half,
      facingAngle + half,
    );
    this.perceptionGraphics.closePath();
    this.perceptionGraphics.fillPath();
    if (style.outline) {
      this.perceptionGraphics.lineStyle(2, style.fillColor, 0.85);
      this.perceptionGraphics.strokePath();
    }

    const sound = state.perception.soundEvent;
    if (sound) {
      this.perceptionGraphics.lineStyle(2, 0xe5b454, 0.8);
      this.perceptionGraphics.strokeCircle(sound.position.x, sound.position.y, sound.radius);
    }
    const lastKnown = state.perception.memory.lastKnownPosition;
    this.lastKnownMarker.setVisible(lastKnown !== null);
    if (lastKnown) {
      this.lastKnownMarker.setPosition(lastKnown.x, lastKnown.y);
    }
  }

  private updateHud(): void {
    const state = this.guardState;
    const brain = state.brain;
    const last = state.log.at(-1);
    const route = state.route.result;
    const memory = state.perception.memory;
    const age = timeSinceLastPerception(memory, this.simulationTimeMs);
    const known = memory.lastKnownPosition
      ? `${memory.source} ${cellText(memory.lastKnownPosition)} hace ${((age ?? 0) / 1000).toFixed(1)}s`
      : "-";
    const extra = brain.state === "search" && brain.searchEndsAtMs !== null
      ? `buscar resta ${Math.max(0, (brain.searchEndsAtMs - this.simulationTimeMs) / 1000).toFixed(1)}s`
      : brain.stalled
        ? "SIN PATRULLA ALCANZABLE"
        : brain.state === "patrol" && brain.pauseEndsAtMs !== null
          ? `pausa ${Math.max(0, (brain.pauseEndsAtMs - this.simulationTimeMs) / 1000).toFixed(1)}s -> P${brain.patrolIndex}`
          : `patrulla -> P${brain.patrolIndex}`;

    this.hud.setText([
      `ESTADO ${STATE_LABELS[brain.state]}${this.paused ? "  [PAUSA]" : ""}`,
      `anterior ${brain.previousState ? STATE_LABELS[brain.previousState] : "-"}`,
      last
        ? `${(last.timeMs / 1000).toFixed(2)}s ${EVENT_LABELS[last.event]} [${last.guard}] ${last.rule ?? ""}`
        : "sin transiciones",
      `causa vision ${this.lastVision ? VISION_LABELS[this.lastVision.reason] : "-"}`,
      `memoria ${known}`,
      route
        ? `${state.algorithm === "astar" ? "A*" : "BFS"} ${STATUS_LABELS[route.status]} costo ${route.totalCost ?? "-"} exp ${route.expandedNodes}`
        : `${state.algorithm === "astar" ? "A*" : "BFS"} sin ruta`,
      extra,
      ...(this.throwNotice ? [this.throwNotice] : []),
    ]);
  }
}

function cellText(position: { readonly x: number; readonly y: number }): string {
  const cell = worldToCell(position, TILE_SIZE);
  return `(${cell.x},${cell.y})`;
}
