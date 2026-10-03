import { describe, expect, it } from "vitest";
import {
  proficiencyBonus, abilityModifier, skillModifier, exhaustionEffects,
  resolveResource, rechargeResources, rollHitDie, applyDamage, applyHeal, applyLongRest,
} from "../static/rules.js";

describe("proficiencyBonus", () => {
  it.each([
    [1, 2], [4, 2],
    [5, 3], [8, 3],
    [9, 4], [12, 4],
    [13, 5], [16, 5],
    [17, 6], [20, 6],
  ])("level %i -> +%i", (level, expected) => {
    expect(proficiencyBonus(level)).toBe(expected);
  });
});

describe("abilityModifier", () => {
  it.each([
    [1, -5], [8, -1], [9, -1], [10, 0], [11, 0], [12, 1], [20, 5],
  ])("score %i -> %i", (score, expected) => {
    expect(abilityModifier(score)).toBe(expected);
  });
});

describe("skillModifier", () => {
  it("adds rank * proficiency to the ability modifier", () => {
    expect(skillModifier(3, 0, 2)).toBe(3);       // untrained
    expect(skillModifier(3, 1, 2)).toBe(5);       // proficient
    expect(skillModifier(3, 2, 2)).toBe(7);       // expertise
  });
});

describe("exhaustionEffects", () => {
  it("has no effect at 0", () => {
    expect(exhaustionEffects(0)).toEqual({ d20Penalty: 0, speedPenalty: 0, dead: false });
  });
  it("scales linearly through levels 1-5", () => {
    expect(exhaustionEffects(3)).toEqual({ d20Penalty: 6, speedPenalty: 15, dead: false });
  });
  it("is dead at level 6", () => {
    expect(exhaustionEffects(6)).toEqual({ d20Penalty: 12, speedPenalty: 30, dead: true });
  });
});

describe("resolveResource (bardic inspiration)", () => {
  it.each([
    [1, "d6", "long"],
    [5, "d8", "short"],
    [10, "d10", "short"],
    [15, "d12", "short"],
  ])("level %i -> %s, %s rest", (level, die, reset) => {
    const r = resolveResource({ auto: "bardic", used: 0 }, { level, chaMod: 3 });
    expect(r.die).toBe(die);
    expect(r.reset).toBe(reset);
  });

  it("max uses is at least 1 even with a negative CHA modifier", () => {
    const r = resolveResource({ auto: "bardic", used: 0 }, { level: 1, chaMod: -1 });
    expect(r.max).toBe(1);
  });

  it("beguiling magic is always one use per long rest", () => {
    const r = resolveResource({ auto: "beguiling", used: 0 }, { level: 20, chaMod: 5 });
    expect(r).toMatchObject({ max: 1, reset: "long" });
  });
});

describe("rechargeResources", () => {
  const context = { level: 1, chaMod: 0 }; // bardic resets "long" at this level
  const resources = [
    { name: "Second Wind", used: 1, reset: "short" },
    { name: "Channel Divinity", used: 1, reset: "long" },
    { name: "Bardic Inspiration", used: 1, auto: "bardic" },
  ];

  it("short rest only recharges short-reset resources", () => {
    const after = rechargeResources(resources, "short", context);
    expect(after.find((r) => r.name === "Second Wind").used).toBe(0);
    expect(after.find((r) => r.name === "Channel Divinity").used).toBe(1);
    expect(after.find((r) => r.name === "Bardic Inspiration").used).toBe(1);
  });

  it("long rest recharges everything", () => {
    const after = rechargeResources(resources, "long", context);
    expect(after.every((r) => r.used === 0)).toBe(true);
  });
});

describe("rollHitDie", () => {
  it("adds the constitution modifier to the roll, floored at 0", () => {
    expect(rollHitDie(8, 3, () => 0)).toEqual({ roll: 1, gained: 4 });
    expect(rollHitDie(8, 3, () => 0.999)).toEqual({ roll: 8, gained: 11 });
    expect(rollHitDie(8, -5, () => 0)).toEqual({ roll: 1, gained: 0 });
  });
});

describe("applyDamage", () => {
  it("absorbs with temp HP before current HP", () => {
    expect(applyDamage({ current: 10, max: 10, temp: 5 }, 3)).toEqual({ current: 10, max: 10, temp: 2 });
    expect(applyDamage({ current: 10, max: 10, temp: 5 }, 8)).toEqual({ current: 7, max: 10, temp: 0 });
  });
  it("floors current HP at 0", () => {
    expect(applyDamage({ current: 5, max: 10, temp: 0 }, 20)).toEqual({ current: 0, max: 10, temp: 0 });
  });
});

describe("applyHeal", () => {
  it("clamps to max HP", () => {
    expect(applyHeal({ current: 8, max: 10, temp: 0 }, 5).hp.current).toBe(10);
  });
  it("clears death saves only when healing up from 0", () => {
    expect(applyHeal({ current: 0, max: 10, temp: 0 }, 1).clearDeathSaves).toBe(true);
    expect(applyHeal({ current: 1, max: 10, temp: 0 }, 1).clearDeathSaves).toBe(false);
    expect(applyHeal({ current: 0, max: 10, temp: 0 }, 0).clearDeathSaves).toBe(false);
  });
});

describe("applyLongRest", () => {
  it("resets HP, slots, hit dice, exhaustion, concentration and resources together", () => {
    const char = {
      level: 5,
      abilities: { cha: 14 },
      hp: { current: 2, max: 30, temp: 4 },
      deathSaves: { success: 2, fail: 1 },
      slots: { 1: { max: 4, used: 4 }, 2: { max: 2, used: 1 } },
      hitDice: { die: "d8", used: 3 },
      exhaustion: 2,
      concentration: "Bless",
      resources: [{ name: "Bardic Inspiration", used: 1, auto: "bardic" }],
    };
    const patch = applyLongRest(char);
    expect(patch.hp).toEqual({ current: 30, max: 30, temp: 0 });
    expect(patch.deathSaves).toEqual({ success: 0, fail: 0 });
    expect(patch.slots[1].used).toBe(0);
    expect(patch.slots[2].used).toBe(0);
    expect(patch.hitDice.used).toBe(0);
    expect(patch.exhaustion).toBe(1);
    expect(patch.concentration).toBe("");
    expect(patch.resources[0].used).toBe(0);
  });

  it("never reduces exhaustion below 0", () => {
    const char = {
      level: 1, abilities: { cha: 10 }, hp: { current: 1, max: 1, temp: 0 },
      deathSaves: { success: 0, fail: 0 }, slots: {}, hitDice: { die: "d8", used: 0 },
      exhaustion: 0, concentration: "", resources: [],
    };
    expect(applyLongRest(char).exhaustion).toBe(0);
  });
});
