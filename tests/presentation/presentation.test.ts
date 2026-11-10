import { describe, expect, it } from "vitest";
import type { GuardStateName, TransitionRecord } from "../../src/domain/behavior/guardFsm";
import { ALERT_FLASH_MS, ALERT_SHAKE_MS, shouldTriggerAlert } from "../../src/game/presentation/alertImpact";
import { alertLevel, updateAlertMeter } from "../../src/game/presentation/alertMeter";
import { coneStyle } from "../../src/game/presentation/coneStyle";

describe("upgrade 2: reactive cone style", () => {
  const expected: ReadonlyArray<[GuardStateName, number, boolean]> = [
    ["patrol", 0x6b8afd, false],
    ["return", 0xa98bf0, false],
    ["investigate", 0xe5b454, true],
    ["search", 0xe58f54, true],
    ["chase", 0xe16969, true],
  ];

  it.each(expected)("U2-AC1: %s -> colour, outline and alpha for visible / not visible", (state, color, outline) => {
    expect(coneStyle(state, false)).toEqual({ fillColor: color, fillAlpha: 0.16, outline });
    expect(coneStyle(state, true)).toEqual({ fillColor: color, fillAlpha: 0.32, outline });
  });
});

function record(partial: Partial<TransitionRecord>): TransitionRecord {
  return {
    timeMs: 0,
    rule: "T1",
    kind: "transition",
    from: "patrol",
    event: "player-seen",
    eventPosition: { x: 0, y: 0 },
    guard: "-",
    to: "chase",
    actions: [],
    ...partial,
  };
}

describe("upgrade 4: alert impact trigger", () => {
  it("U4-AC1: triggers only on a real transition into Perseguir (T1)", () => {
    expect(shouldTriggerAlert(record({}), null, 0)).toBe(true);
    expect(shouldTriggerAlert(record({ rule: "T2", kind: "update" }), null, 0)).toBe(false);
    expect(shouldTriggerAlert(record({ rule: "T3", to: "investigate", event: "vision-lost" }), null, 0)).toBe(false);
    expect(shouldTriggerAlert(record({ rule: "T5", to: "investigate", event: "sound-heard" }), null, 0)).toBe(false);
    expect(shouldTriggerAlert(record({ rule: null, kind: "ignored", to: "patrol" }), null, 0)).toBe(false);
  });

  it("U4-AC2: 1000 ms cooldown at the exact limit", () => {
    expect(shouldTriggerAlert(record({}), 5000, 5999)).toBe(false);
    expect(shouldTriggerAlert(record({}), 5000, 6000)).toBe(true);
  });

  it("U4-AC3: both effects last less than one second", () => {
    expect(ALERT_SHAKE_MS).toBeLessThan(1000);
    expect(ALERT_FLASH_MS).toBeLessThan(1000);
  });
});

describe("upgrade 8: alert meter", () => {
  it("U8-AC1: seen for 0.5 s goes 0 -> 100 and is capped", () => {
    expect(updateAlertMeter(0, "patrol", true, 250)).toBe(50);
    expect(updateAlertMeter(50, "chase", true, 250)).toBe(100);
    expect(updateAlertMeter(100, "chase", false, 10_000)).toBe(100);
  });

  it("U8-AC1: investigate/search approach 60 from both sides", () => {
    expect(updateAlertMeter(0, "investigate", false, 500)).toBe(30);
    expect(updateAlertMeter(50, "search", false, 1000)).toBe(60);
    expect(updateAlertMeter(100, "search", false, 1000)).toBe(75);
    expect(updateAlertMeter(62, "search", false, 1000)).toBe(60);
  });

  it("U8-AC1: patrol/return decay at 25/s and never go below 0", () => {
    expect(updateAlertMeter(60, "return", false, 1000)).toBe(35);
    expect(updateAlertMeter(10, "patrol", false, 10_000)).toBe(0);
  });

  it("U8-AC2: level thresholds (34 and 66 are suspicion)", () => {
    expect(alertLevel(0)).toBe("calm");
    expect(alertLevel(33.9)).toBe("calm");
    expect(alertLevel(34)).toBe("suspicion");
    expect(alertLevel(66)).toBe("suspicion");
    expect(alertLevel(66.1)).toBe("alert");
    expect(alertLevel(100)).toBe("alert");
  });

  it("rejects negative or non-finite deltas", () => {
    expect(() => updateAlertMeter(0, "patrol", false, -1)).toThrow();
    expect(() => updateAlertMeter(0, "patrol", false, Number.NaN)).toThrow();
  });
});
