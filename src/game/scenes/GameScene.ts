import Phaser from "phaser";
import { guardConfigFor } from "../../application/simulation/basementGuard";
import { throwDistraction, type DistractionRejection } from "../../application/simulation/distraction";
import { canEscape, checkTakedown, isCaught, type TakedownRejection } from "../../application/simulation/escapeRules";
import {
  initialGuardController,
  updateGuard,
  withAlgorithm,
  withNavigation,
  type GuardControllerConfig,
  type GuardControllerState,
  type NavigationMode,
} from "../../application/simulation/guardController";
import { SOUND_DURATION_MS, SOUND_RADIUS } from "../../application/simulation/labGuard";
import { GRID_HEIGHT, GRID_WIDTH, TILE_SIZE } from "../../application/simulation/labLevel";
import { LAST_LEVEL, levelConfig } from "../../application/simulation/levels";
import { ignoresCosts } from "../../application/simulation/navigationDemo";
import {
  initialPlayerNoise,
  SNEAK_SPEED,
  updatePlayerNoise,
  WALK_SPEED,
  type NoiseKind,
  type PlayerNoiseState,
} from "../../application/simulation/playerNoise";
import type { GuardStateName, TransitionRecord } from "../../domain/behavior/guardFsm";
import { generateBasement, type Basement } from "../../domain/level/basementGenerator";
import { cellCenter, cellKey, isWalkable, worldToCell } from "../../domain/model/grid";
import type { SearchAlgorithm, SearchStatus } from "../../domain/navigation/search";
import { timeSinceLastPerception } from "../../domain/perception/memory";
import type { SoundEvent, VisionReason, VisionResult } from "../../domain/perception/perception";
import {
  ALERT_FLASH_MS,
  ALERT_SHAKE_INTENSITY,
  ALERT_SHAKE_MS,
  shouldTriggerAlert,
} from "../presentation/alertImpact";
import { alertLevel, updateAlertMeter, type AlertLevel } from "../presentation/alertMeter";
import { CONE_COLORS, coneStyle } from "../presentation/coneStyle";
import { DARKNESS_ALPHA, isLit, lightSources } from "../presentation/lighting";

/**
 * "Escapa del Sótano" — GDD.md and specs/tp-01..tp-06.
 * Phaser only adapts input, time and drawing; decisions live in domain/application.
 */

interface SceneData {
  readonly level: number;
  readonly seed: number;
  readonly algorithm: SearchAlgorithm;
  readonly navigation: NavigationMode;
  readonly demo: boolean;
}

type Outcome = "caught" | "escaped" | "won";

const STEP_MS = 100;
const ALGORITHMS: readonly SearchAlgorithm[] = ["bfs", "dijkstra", "astar"];
const ALGORITHM_LABELS: Readonly<Record<SearchAlgorithm, string>> = { bfs: "BFS", dijkstra: "Dijkstra", astar: "A*" };
const NAVIGATION_LABELS: Readonly<Record<NavigationMode, string>> = { direct: "ruta directa", cautious: "ruta cautelosa" };
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
  neutralized: "NEUTRALIZADO",
};
const EVENT_LABELS: Readonly<Record<TransitionRecord["event"], string>> = {
  "player-seen": "JugadorVisto",
  "vision-lost": "VisionPerdida",
  "sound-heard": "SonidoOido",
  "route-failed": "RutaFallida",
  "destination-reached": "DestinoAlcanzado",
  tick: "Tick",
  neutralized: "Derribo",
};
const LEVEL_LABELS: Readonly<Record<AlertLevel, string>> = { calm: "CALMA", suspicion: "SOSPECHA", alert: "ALERTA" };
const LEVEL_COLORS: Readonly<Record<AlertLevel, number>> = { calm: 0x73c991, suspicion: 0xe5b454, alert: 0xe16969 };
const REJECTION_LABELS: Readonly<Record<DistractionRejection, string>> = {
  "fuera-de-alcance": "fuera de alcance",
  "celda-bloqueada": "celda bloqueada",
  enfriamiento: "esperando enfriamiento",
};
const TAKEDOWN_LABELS: Readonly<Record<TakedownRejection, string>> = {
  "sin-cuchillo": "necesitás el cuchillo",
  lejos: "estás demasiado lejos",
  "de-frente": "te vería: acercate por la espalda",
  persiguiendo: "te está persiguiendo",
  "ya-neutralizado": "ya está neutralizado",
};

export class GameScene extends Phaser.Scene {
  private run!: SceneData;
  private basement!: Basement;
  private guardConfig!: GuardControllerConfig;
  private guardState!: GuardControllerState;
  private lightRadius = 96;

  private player!: Phaser.GameObjects.Rectangle;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private guard!: Phaser.GameObjects.Arc;
  private knife!: Phaser.GameObjects.Rectangle;
  private door!: Phaser.GameObjects.Rectangle;
  private glassShards: Array<{ readonly key: string; readonly shape: Phaser.GameObjects.Graphics; readonly center: { x: number; y: number } }> = [];
  private patrolMarkers: Phaser.GameObjects.GameObject[] = [];
  private navigationGraphics!: Phaser.GameObjects.Graphics;
  private perceptionGraphics!: Phaser.GameObjects.Graphics;
  private noiseGraphics!: Phaser.GameObjects.Graphics;
  private darkness!: Phaser.GameObjects.Graphics;
  private lightShape!: Phaser.GameObjects.Graphics;
  private targetMarker!: Phaser.GameObjects.Arc;
  private lastKnownMarker!: Phaser.GameObjects.Arc;
  private hud!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private alertGraphics!: Phaser.GameObjects.Graphics;
  private alertLabel!: Phaser.GameObjects.Text;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private simulationTimeMs = 0;
  private paused = false;
  private pendingSound: SoundEvent | null = null;
  private pendingTakedown = false;
  private noiseState!: PlayerNoiseState;
  private lastNoise: { kind: NoiseKind; until: number } | null = null;
  private hasKnife = false;
  private doorOpen = false;
  private outcome: Outcome | null = null;
  private notice = "";
  private lastAlertMs: number | null = null;
  private lastThrowMs: number | null = null;
  private alertValue = 0;
  private lastVision: VisionResult | null = null;
  private drawnRoute: object | null = null;

  public constructor() {
    super("GameScene");
  }

  public create(data: Partial<SceneData> = {}): void {
    this.run = {
      level: data.level ?? 1,
      seed: data.seed ?? Math.floor(Math.random() * 1_000_000_000),
      algorithm: data.algorithm ?? "astar",
      navigation: data.navigation ?? "direct",
      demo: data.demo ?? false,
    };
    const level = levelConfig(this.run.level);
    this.lightRadius = level.lightRadius;
    this.basement = generateBasement(this.run.seed, level.basement);
    this.guardConfig = guardConfigFor(this.basement);
    this.guardState = withNavigation(
      initialGuardController(this.guardConfig, this.run.algorithm),
      this.run.navigation,
    );

    this.simulationTimeMs = 0;
    this.paused = false;
    this.pendingSound = null;
    this.pendingTakedown = false;
    this.noiseState = initialPlayerNoise(this.basement.playerStart);
    this.lastNoise = null;
    this.hasKnife = false;
    this.doorOpen = false;
    this.outcome = null;
    this.notice = this.basement.usedFallback ? "aviso: se usó el sótano de respaldo" : "";
    this.lastAlertMs = null;
    this.lastThrowMs = null;
    this.alertValue = 0;
    this.lastVision = null;
    this.drawnRoute = null;
    this.glassShards = [];
    this.patrolMarkers = [];

    this.cameras.main.setBackgroundColor("#0b0d10");
    this.buildBasement();
    this.buildActors();
    this.buildOverlay();
    this.bindInput();
    this.stepGuard(0);
  }

  public update(_time: number, delta: number): void {
    const k = this.keys;
    if (Phaser.Input.Keyboard.JustDown(k.R!)) {
      this.restartWith({});
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(k.G!)) {
      // After winning, G starts over from level 1.
      this.restartWith({ seed: this.newSeed(), level: this.outcome === "won" ? 1 : this.run.level });
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(k.V!)) {
      this.run = { ...this.run, demo: !this.run.demo };
      this.drawnRoute = null;
    }
    if (this.outcome) {
      this.render(null);
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(k.SPACE!)) {
      const next = ALGORITHMS[(ALGORITHMS.indexOf(this.guardState.algorithm) + 1) % ALGORITHMS.length]!;
      this.guardState = withAlgorithm(this.guardState, next);
      this.run = { ...this.run, algorithm: next };
    }
    if (Phaser.Input.Keyboard.JustDown(k.C!)) {
      const next: NavigationMode = this.guardState.navigation === "direct" ? "cautious" : "direct";
      this.guardState = withNavigation(this.guardState, next);
      this.run = { ...this.run, navigation: next };
    }
    if (Phaser.Input.Keyboard.JustDown(k.P!)) {
      this.paused = !this.paused;
      if (this.paused) this.physics.pause();
      else this.physics.resume();
    }
    if (Phaser.Input.Keyboard.JustDown(k.E!)) {
      this.tryTakedown();
    }

    if (this.paused) {
      this.playerBody.setVelocity(0, 0);
      if (Phaser.Input.Keyboard.JustDown(k.N!)) this.stepGuard(STEP_MS);
      else this.render(null);
      return;
    }

    const sneaking = k.SHIFT!.isDown;
    const horizontal = Number(this.cursors.right.isDown || k.D!.isDown) - Number(this.cursors.left.isDown || k.A!.isDown);
    const vertical = Number(this.cursors.down.isDown || k.S!.isDown) - Number(this.cursors.up.isDown || k.W!.isDown);
    const velocity = new Phaser.Math.Vector2(horizontal, vertical);
    if (velocity.lengthSq() > 0) velocity.normalize().scale(sneaking ? SNEAK_SPEED : WALK_SPEED);
    this.playerBody.setVelocity(velocity.x, velocity.y);

    const dt = Math.min(delta, 250);
    this.updateNoise(this.simulationTimeMs + dt, velocity.lengthSq() > 0, sneaking);
    this.stepGuard(dt);
    this.checkPickupsAndOutcome();
  }

  // ---------------------------------------------------------------- building

  private buildBasement(): void {
    const walls = this.physics.add.staticGroup();
    const crateKeys = new Set(this.basement.crates.map(cellKey));
    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      for (let x = 0; x < GRID_WIDTH; x += 1) {
        if (isWalkable(this.basement.map, { x, y })) {
          continue;
        }
        const center = cellCenter({ x, y }, TILE_SIZE);
        const crate = crateKeys.has(cellKey({ x, y }));
        const block = crate
          ? this.add.rectangle(center.x, center.y, TILE_SIZE - 6, TILE_SIZE - 6, 0x5b4632).setStrokeStyle(2, 0x8a6a48)
          : this.add.rectangle(center.x, center.y, TILE_SIZE, TILE_SIZE, 0x1f262d).setStrokeStyle(1, 0x2c363f);
        walls.add(block);
      }
    }
    this.wallsGroup = walls;

    for (const point of this.basement.glass) {
      const center = cellCenter(point, TILE_SIZE);
      const shape = this.add.graphics({ x: center.x, y: center.y }).setDepth(1);
      shape.fillStyle(0xbfe6f2, 0.85);
      shape.fillTriangle(-8, 4, -2, -6, 1, 5);
      shape.fillTriangle(3, -4, 9, -1, 4, 6);
      shape.fillTriangle(-4, 8, 2, 7, -1, 2);
      this.glassShards.push({ key: cellKey(point), shape, center });
    }

    const knife = cellCenter(this.basement.knife, TILE_SIZE);
    this.knife = this.add.rectangle(knife.x, knife.y, 18, 5, 0xdfe6ea).setAngle(-35).setDepth(2);
    const exit = cellCenter(this.basement.exit, TILE_SIZE);
    this.door = this.add.rectangle(exit.x, exit.y, TILE_SIZE - 4, TILE_SIZE - 4, 0x6b2b2b).setStrokeStyle(3, 0xe16969).setDepth(1);

    this.basement.patrolPoints.forEach((point, index) => {
      const center = cellCenter(point, TILE_SIZE);
      this.patrolMarkers.push(
        this.add.rectangle(center.x, center.y, 10, 10, 0x000000, 0).setStrokeStyle(1, 0x6b8afd).setDepth(3),
        this.add.text(center.x + 7, center.y - 16, `P${index}`, { color: "#6b8afd", fontFamily: "monospace", fontSize: "10px" }).setDepth(3),
      );
    });
  }

  private wallsGroup!: Phaser.Physics.Arcade.StaticGroup;

  private buildActors(): void {
    const spawn = cellCenter(this.basement.playerStart, TILE_SIZE);
    this.player = this.add.rectangle(spawn.x, spawn.y, 18, 18, 0xe5b454).setStrokeStyle(2, 0xffd98a).setDepth(6);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.wallsGroup);
    this.physics.resume();

    this.perceptionGraphics = this.add.graphics().setDepth(4);
    this.navigationGraphics = this.add.graphics().setDepth(3);
    this.noiseGraphics = this.add.graphics().setDepth(7);
    this.guard = this.add
      .circle(this.guardState.position.x, this.guardState.position.y, 11, CONE_COLORS.patrol)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(6);
    this.targetMarker = this.add.circle(0, 0, 10, 0x000000, 0).setStrokeStyle(3, 0x73c991).setDepth(5).setVisible(false);
    this.lastKnownMarker = this.add.circle(0, 0, 7, 0x000000, 0).setStrokeStyle(2, 0xe16969).setDepth(5).setVisible(false);
  }

  private buildOverlay(): void {
    // TP-06: darkness with an inverted geometry mask = a hole of light around the player.
    const width = GRID_WIDTH * TILE_SIZE;
    const height = GRID_HEIGHT * TILE_SIZE;
    this.darkness = this.add.graphics().setDepth(20);
    this.darkness.fillStyle(0x000000, DARKNESS_ALPHA);
    this.darkness.fillRect(0, 0, width, height);
    this.lightShape = this.make.graphics({}, false);
    const mask = this.lightShape.createGeometryMask();
    mask.setInvertAlpha(true);
    this.darkness.setMask(mask);

    this.alertGraphics = this.add.graphics().setDepth(30);
    const style = { color: "#d9e4ea", fontFamily: "monospace", fontSize: "12px" };
    this.statusText = this.add.text(16, 10, "", { ...style, color: "#9eb4c2" }).setDepth(31);
    this.alertLabel = this.add.text(16, 66, "", style).setDepth(31);
    this.hud = this.add
      .text(width - 12, 10, "", { ...style, align: "right", backgroundColor: "#0b0d10cc", padding: { x: 8, y: 6 } })
      .setOrigin(1, 0)
      .setDepth(31);
    this.banner = this.add
      .text(width / 2, height / 2, "", {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "34px",
        align: "center",
        backgroundColor: "#000000cc",
        padding: { x: 18, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(32)
      .setVisible(false);
    this.add
      .text(16, height - 10, "WASD mover | SHIFT sigilo | E derribar | CLIC distraer | G otro sótano | ESPACIO búsqueda | C navegación | V demostración | P/N pausa/paso | R reiniciar", {
        ...style,
        fontSize: "11px",
        color: "#7f95a3",
      })
      .setOrigin(0, 1)
      .setDepth(31);
  }

  private bindInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is unavailable.");
    }
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys("W,A,S,D,E,G,C,V,P,N,R,SPACE,SHIFT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointerdown", this.handleDistraction, this);
  }

  // ---------------------------------------------------------------- simulation

  private updateNoise(timeMs: number, moving: boolean, sneaking: boolean): void {
    const position = { x: this.player.x, y: this.player.y };
    const result = updatePlayerNoise(this.noiseState, {
      timeMs,
      moving,
      sneaking,
      cell: worldToCell(position, TILE_SIZE),
      position,
      glassKeys: this.basement.glassKeys,
    });
    this.noiseState = result.state;
    if (result.sound && result.kind) {
      // Loudest sound of the update wins: glass > thrown object > step.
      const current = this.pendingSound;
      if (!current || result.sound.radius >= current.radius) {
        this.pendingSound = result.sound;
      }
      this.lastNoise = { kind: result.kind, until: timeMs + 400 };
    }
  }

  private stepGuard(deltaMs: number): void {
    this.simulationTimeMs += deltaMs;
    const result = updateGuard(this.guardState, this.guardConfig, {
      timeMs: this.simulationTimeMs,
      deltaMs,
      playerPosition: { x: this.player.x, y: this.player.y },
      newSound: this.pendingSound ? { ...this.pendingSound, emittedAtMs: this.simulationTimeMs } : null,
      neutralize: this.pendingTakedown,
    });
    this.pendingSound = null;
    this.pendingTakedown = false;
    this.guardState = result.state;

    if (result.record.kind === "transition") {
      console.info("[fsm]", JSON.stringify(result.record));
    }
    if (result.violations.length > 0) {
      console.error("[fsm] invariante violada", result.violations);
    }
    if (shouldTriggerAlert(result.record, this.lastAlertMs, this.simulationTimeMs)) {
      this.lastAlertMs = this.simulationTimeMs;
      this.cameras.main.shake(ALERT_SHAKE_MS, ALERT_SHAKE_INTENSITY);
      this.cameras.main.flash(ALERT_FLASH_MS, 225, 105, 105);
    }
    this.alertValue = updateAlertMeter(this.alertValue, result.state.brain.state, result.vision.visible, deltaMs);
    this.render(result.vision);
  }

  private tryTakedown(): void {
    const check = checkTakedown({
      hasKnife: this.hasKnife,
      player: { x: this.player.x, y: this.player.y },
      guard: this.guardState.position,
      guardFacing: this.guardState.facing,
      guardState: this.guardState.brain.state,
      fieldOfViewRadians: this.guardConfig.fieldOfViewRadians,
    });
    if (check.ok) {
      this.pendingTakedown = true;
      this.doorOpen = true;
      this.notice = "matón neutralizado: tenés la llave, buscá la puerta";
      console.info("[derribo]", JSON.stringify({ timeMs: this.simulationTimeMs }));
    } else {
      this.notice = `no podés derribarlo: ${TAKEDOWN_LABELS[check.reason]}`;
    }
  }

  private checkPickupsAndOutcome(): void {
    const playerPosition = { x: this.player.x, y: this.player.y };
    const playerCell = worldToCell(playerPosition, TILE_SIZE);
    if (!this.hasKnife && cellKey(playerCell) === cellKey(this.basement.knife)) {
      this.hasKnife = true;
      this.knife.setVisible(false);
      this.notice = "tomaste el cuchillo";
    }
    if (isCaught(this.guardState.brain.state, this.guardState.position, playerPosition)) {
      this.finish("caught");
    } else if (canEscape(this.doorOpen, playerCell, this.basement.exit)) {
      this.finish(this.run.level >= LAST_LEVEL ? "won" : "escaped");
    }
  }

  private finish(outcome: Outcome): void {
    this.outcome = outcome;
    this.playerBody.setVelocity(0, 0);
    this.physics.pause();
    const text = outcome === "caught"
      ? "TE ATRAPARON\nreiniciando el nivel..."
      : outcome === "escaped"
        ? `ESCAPASTE DEL NIVEL ${this.run.level}\npasando al nivel ${this.run.level + 1}...`
        : "¡GANASTE!\nescapaste del sótano\nG o R para volver a empezar";
    this.banner.setText(text).setVisible(true);
    if (outcome === "caught") {
      this.time.delayedCall(1500, () => this.restartWith({}));
    } else if (outcome === "escaped") {
      this.time.delayedCall(1800, () => this.restartWith({ level: this.run.level + 1, seed: this.newSeed() }));
    }
  }

  private handleDistraction(pointer: Phaser.Input.Pointer): void {
    if (this.outcome) return;
    const result = throwDistraction({
      player: { x: this.player.x, y: this.player.y },
      target: { x: pointer.worldX, y: pointer.worldY },
      map: this.basement.map,
      tileSize: TILE_SIZE,
      nowMs: this.simulationTimeMs,
      lastThrowMs: this.lastThrowMs,
    });
    if (result.accepted) {
      this.lastThrowMs = this.simulationTimeMs;
      if (!this.pendingSound || result.sound.radius >= this.pendingSound.radius) {
        this.pendingSound = { ...result.sound, radius: SOUND_RADIUS, durationMs: SOUND_DURATION_MS };
      }
      this.notice = "objeto arrojado";
    } else {
      this.notice = `no se puede arrojar: ${REJECTION_LABELS[result.reason]}`;
    }
  }

  private restartWith(change: Partial<SceneData>): void {
    this.scene.restart({ ...this.run, ...change });
  }

  private newSeed(): number {
    return Math.floor(Math.random() * 1_000_000_000);
  }

  // ---------------------------------------------------------------- drawing

  private render(vision: VisionResult | null): void {
    const state = this.guardState;
    const demo = this.run.demo;
    const playerPosition = { x: this.player.x, y: this.player.y };
    const lights = lightSources({
      player: playerPosition,
      playerRadius: this.lightRadius,
      guard: state.position,
      knife: this.hasKnife ? null : cellCenter(this.basement.knife, TILE_SIZE),
      openDoor: this.doorOpen ? cellCenter(this.basement.exit, TILE_SIZE) : null,
    });
    const lit = (point: { x: number; y: number }) => demo || isLit(point, lights);

    this.guard.setPosition(state.position.x, state.position.y).setFillStyle(CONE_COLORS[state.brain.state]);
    this.guard.setVisible(lit(state.position));
    if (vision) {
      this.lastVision = vision;
    }
    this.drawPerception(this.lastVision);
    this.perceptionGraphics.setVisible(state.brain.state !== "neutralized" && lit(state.position));

    for (const shard of this.glassShards) {
      shard.shape.setVisible(lit(shard.center));
    }
    this.knife.setVisible(!this.hasKnife && lit(cellCenter(this.basement.knife, TILE_SIZE)));
    this.door.setFillStyle(this.doorOpen ? 0x2b6b3d : 0x6b2b2b).setStrokeStyle(3, this.doorOpen ? 0x73c991 : 0xe16969);

    // Demo-only observability (TP-02/TP-06): route, explored nodes, patrol points and memory.
    if (this.drawnRoute !== state.route.result) {
      this.drawRoute();
      this.drawnRoute = state.route.result;
    }
    this.navigationGraphics.setVisible(demo);
    this.targetMarker.setVisible(demo && this.targetMarker.visible);
    this.patrolMarkers.forEach((marker) => (marker as Phaser.GameObjects.Shape).setVisible(demo));
    const lastKnown = state.perception.memory.lastKnownPosition;
    this.lastKnownMarker.setVisible(demo && lastKnown !== null);
    if (lastKnown) this.lastKnownMarker.setPosition(lastKnown.x, lastKnown.y);

    this.darkness.setVisible(!demo);
    this.lightShape.clear();
    this.lightShape.fillStyle(0xffffff);
    for (const light of lights) {
      this.lightShape.fillCircle(light.x, light.y, light.radius);
    }

    this.drawNoise();
    this.drawAlertMeter();
    this.updateHud();
  }

  private drawPerception(vision: VisionResult | null): void {
    const state = this.guardState;
    this.perceptionGraphics.clear();
    if (state.brain.state === "neutralized") return;
    const facing = Math.atan2(state.facing.y, state.facing.x);
    const half = this.guardConfig.fieldOfViewRadians / 2;
    const style = coneStyle(state.brain.state, vision?.visible ?? false);
    this.perceptionGraphics.fillStyle(style.fillColor, style.fillAlpha);
    this.perceptionGraphics.beginPath();
    this.perceptionGraphics.moveTo(state.position.x, state.position.y);
    this.perceptionGraphics.arc(state.position.x, state.position.y, this.guardConfig.visionRange, facing - half, facing + half);
    this.perceptionGraphics.closePath();
    this.perceptionGraphics.fillPath();
    if (style.outline) {
      this.perceptionGraphics.lineStyle(2, style.fillColor, 0.85);
      this.perceptionGraphics.strokePath();
    }
  }

  private drawNoise(): void {
    this.noiseGraphics.clear();
    const sound = this.guardState.perception.soundEvent;
    if (sound) {
      this.noiseGraphics.lineStyle(2, 0xe5b454, 0.7);
      this.noiseGraphics.strokeCircle(sound.position.x, sound.position.y, sound.radius);
    }
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
      this.targetMarker.setPosition(target.x, target.y).setStrokeStyle(3, result.status === "success" ? 0x73c991 : 0xe16969).setVisible(true);
    }
    const first = result.path[0];
    if (!first) return;
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

  private drawAlertMeter(): void {
    const level = alertLevel(this.alertValue);
    this.alertGraphics.clear();
    this.alertGraphics.fillStyle(0x1b252d, 0.9);
    this.alertGraphics.fillRect(16, 82, 160, 8);
    this.alertGraphics.fillStyle(LEVEL_COLORS[level], 1);
    this.alertGraphics.fillRect(16, 82, (160 * this.alertValue) / 100, 8);
    if (level === "alert") {
      this.alertGraphics.lineStyle(4, 0xe16969, 0.8);
      this.alertGraphics.strokeRect(2, 2, GRID_WIDTH * TILE_SIZE - 4, GRID_HEIGHT * TILE_SIZE - 4);
    }
    this.alertLabel.setText(`${LEVEL_LABELS[level]} ${Math.round(this.alertValue)}`);
    this.alertLabel.setColor(`#${LEVEL_COLORS[level].toString(16).padStart(6, "0")}`);
  }

  private updateHud(): void {
    const noise = this.lastNoise && this.lastNoise.until >= this.simulationTimeMs
      ? (this.lastNoise.kind === "glass" ? "¡VIDRIO!" : "pasos")
      : this.keys.SHIFT!.isDown ? "sigilo" : "-";
    this.statusText.setText([
      `ESCAPA DEL SÓTANO · nivel ${this.run.level}/${LAST_LEVEL} · semilla ${this.basement.seed}${this.paused ? " · [PAUSA]" : ""}${this.run.demo ? " · [DEMOSTRACIÓN]" : ""}`,
      `cuchillo ${this.hasKnife ? "SÍ" : "no"} · llave ${this.doorOpen ? "SÍ" : "no"} · ruido ${noise}`,
      this.notice,
    ]);

    const state = this.guardState;
    const brain = state.brain;
    const route = state.route.result;
    const algorithm = ALGORITHM_LABELS[state.algorithm];
    const navigation = NAVIGATION_LABELS[state.navigation];
    const warning = state.navigation === "cautious" && ignoresCosts(state.algorithm) ? " (BFS ignora costos)" : "";
    const lines = [`${algorithm} · ${navigation}${warning}`];
    if (this.run.demo) {
      const memory = state.perception.memory;
      const age = timeSinceLastPerception(memory, this.simulationTimeMs);
      const last = state.log.at(-1);
      lines.push(
        `ESTADO ${STATE_LABELS[brain.state]} (antes ${brain.previousState ? STATE_LABELS[brain.previousState] : "-"})`,
        last ? `${(last.timeMs / 1000).toFixed(1)}s ${EVENT_LABELS[last.event]} [${last.guard}] ${last.rule ?? ""}` : "sin transiciones",
        `visión ${this.lastVision ? VISION_LABELS[this.lastVision.reason] : "-"}`,
        `memoria ${memory.lastKnownPosition ? `${memory.source} hace ${((age ?? 0) / 1000).toFixed(1)}s` : "-"}`,
        route ? `ruta ${STATUS_LABELS[route.status]} costo ${route.totalCost ?? "-"} exp ${route.expandedNodes}` : "sin ruta",
        brain.state === "patrol" && brain.pauseEndsAtMs !== null ? `pausa -> P${brain.patrolIndex}` : `patrulla -> P${brain.patrolIndex}`,
      );
    }
    this.hud.setText(lines);
  }
}
