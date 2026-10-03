// Pure D&D 2024 (5.5e) rules math: no DOM, no char-object closures, no
// direct Math.random() calls (rollHitDie takes an injectable rng). Each
// function takes plain data in and returns plain data out, so it can be
// imported both by app.js (as a module) and by the test suite in tests/.

export function proficiencyBonus(level) {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}

export function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

export function skillModifier(abilityMod, rank, profBonus) {
  return abilityMod + (rank || 0) * profBonus;
}

// Magnitudes (positive numbers): the caller prefixes its own minus sign for
// display. Exhaustion levels 1-5 scale linearly; level 6 is dead.
export function exhaustionEffects(level) {
  const lvl = Math.max(0, level);
  return { d20Penalty: 2 * lvl, speedPenalty: 5 * lvl, dead: lvl >= 6 };
}

// A resource with `auto: "bardic"` derives its max, die and recharge from
// the 2024 Bard rules: uses = CHA mod (min 1); d6/d8/d10/d12 at levels
// 1/5/10/15; Font of Inspiration (level 5+) recharges it on a short rest
// too. College of Glamour's Beguiling Magic (`auto: "beguiling"`) is
// simpler: one use per long rest.
const AUTO_RESOURCES = {
  bardic: ({ level, chaMod }) => ({
    max: Math.max(1, chaMod),
    die: level >= 15 ? "d12" : level >= 10 ? "d10" : level >= 5 ? "d8" : "d6",
    reset: level >= 5 ? "short" : "long",
  }),
  beguiling: () => ({ max: 1, reset: "long", die: "" }),
};

export function resolveResource(resource, context) {
  return { ...resource, ...(AUTO_RESOURCES[resource.auto]?.(context) ?? {}) };
}

export function rechargeResources(resources, kind, context) {
  return resources.map((raw) => {
    const resolved = resolveResource(raw, context);
    return kind === "long" || resolved.reset === "short" ? { ...raw, used: 0 } : raw;
  });
}

export function rollHitDie(sides, conMod, rng = Math.random) {
  const roll = 1 + Math.floor(rng() * sides);
  return { roll, gained: Math.max(0, roll + conMod) };
}

export function applyDamage(hp, n) {
  const amount = Math.max(0, n);
  const temp = Math.max(0, +hp.temp || 0);
  const current = Math.max(0, +hp.current || 0);
  const fromTemp = Math.min(temp, amount);
  return { ...hp, temp: temp - fromTemp, current: Math.max(0, current - (amount - fromTemp)) };
}

export function applyHeal(hp, n) {
  const amount = Math.max(0, n);
  const current = Math.max(0, +hp.current || 0);
  const max = +hp.max || 0;
  return {
    hp: { ...hp, current: Math.min(max, current + amount) },
    clearDeathSaves: current === 0 && amount > 0,
  };
}

// Full long-rest patch: HP/temp restored, death saves cleared, all spell
// slots and hit dice restored, exhaustion reduced by one, concentration
// dropped, and resources recharged per their own reset rule. The caller
// merges this onto `char` (e.g. Object.assign(char, applyLongRest(char))).
export function applyLongRest(char) {
  const slots = {};
  for (const [lvl, s] of Object.entries(char.slots)) slots[lvl] = { ...s, used: 0 };
  const level = Math.max(0, +char.level || 0);
  const chaMod = abilityModifier(+char.abilities?.cha || 10);
  return {
    hp: { ...char.hp, current: +char.hp.max || 0, temp: 0 },
    deathSaves: { success: 0, fail: 0 },
    slots,
    hitDice: { ...char.hitDice, used: 0 },
    exhaustion: Math.max(0, (+char.exhaustion || 0) - 1),
    concentration: "",
    resources: rechargeResources(char.resources || [], "long", { level, chaMod }),
  };
}
