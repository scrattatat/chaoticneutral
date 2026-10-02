"use strict";

// ---------------------------------------------------------------- rules data (D&D 2024 / 5.5e)
const ABILITIES = [
  ["str", "Strength"], ["dex", "Dexterity"], ["con", "Constitution"],
  ["int", "Intelligence"], ["wis", "Wisdom"], ["cha", "Charisma"],
];
const SKILLS = [
  ["acrobatics", "Acrobatics", "dex"], ["animal", "Animal Handling", "wis"],
  ["arcana", "Arcana", "int"], ["athletics", "Athletics", "str"],
  ["deception", "Deception", "cha"], ["history", "History", "int"],
  ["insight", "Insight", "wis"], ["intimidation", "Intimidation", "cha"],
  ["investigation", "Investigation", "int"], ["medicine", "Medicine", "wis"],
  ["nature", "Nature", "int"], ["perception", "Perception", "wis"],
  ["performance", "Performance", "cha"], ["persuasion", "Persuasion", "cha"],
  ["religion", "Religion", "int"], ["sleight", "Sleight of Hand", "dex"],
  ["stealth", "Stealth", "dex"], ["survival", "Survival", "wis"],
];

const DEFAULT_CHARACTER = () => ({
  name: "", class: "", subclass: "", level: 1, race: "", size: "Medium", background: "", alignment: "", xp: 0,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  saves: {},            // { str: true, ... }
  skills: {},           // { stealth: 1 (proficient) | 2 (expertise) }
  ac: 10, initMisc: 0, speed: "30 ft", inspiration: false,
  hp: { current: 8, max: 8, temp: 0 },
  hitDice: { die: "d8", used: 0 },
  deathSaves: { success: 0, fail: 0 },
  conditions: "",
  concentration: "",    // name of the spell you're concentrating on
  turnPlan: "",         // "Plan for next turn" box on the My Turn tab
  exhaustion: 0,        // 2024: levels 1–6, −2 per level to d20 tests and −5 ft speed per level
  attacks: [],
  proficiencies: "",
  speciesTraits: [],    // { name, source, desc }
  features: [],         // class features: { name, source, level, desc }
  feats: [],            // { name, type, desc }
  languages: ["Common"],
  spellAbility: "",
  slots: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => [l, { max: 0, used: 0 }])),
  spells: [],
  resources: [],        // limited-use features: { name, max, used, reset: "short"|"long", die, auto? }
  coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  inventory: [],
  traits: { personality: "", ideals: "", bonds: "", flaws: "" },
  appearance: "", backstory: "", misc: "",
  settings: { trackXp: true, trackWeight: true, currencyMode: "default", theme: "tidepool" },
});

// Spell "level": C = cantrip, 1–9, S = cast via a species trait (no slot).
const SPELL_LEVELS = ["C", "1", "2", "3", "4", "5", "6", "7", "8", "9", "S"];
const spellOrder = (lvl) => { const i = SPELL_LEVELS.indexOf(String(lvl ?? "")); return i === -1 ? 99 : i; };

// Row fields for the editable lists. `label` is the column heading; lists with
// `details` get an expandable Markdown section per row for full rules text.
const LISTS = {
  attacks: {
    details: true,
    fields: [
      { key: "name", label: "Weapon / cantrip", ph: "Name" },
      { key: "bonus", label: "Hit", ph: "+5", cls: "short" },
      { key: "damage", label: "Damage", ph: "1d4+3 piercing" },
      { key: "mastery", label: "Mastery", ph: "—", cls: "short2", title: "Weapon Mastery property (only if your class has Weapon Mastery)" },
      { key: "notes", label: "Properties", ph: "Finesse, Light…", cls: "grow" },
    ],
  },
  spells: {
    details: true,
    fields: [
      { key: "level", label: "Lvl", type: "select", options: ["", ...SPELL_LEVELS], cls: "short", title: "C = cantrip, S = species trait" },
      { key: "name", label: "Spell", ph: "Spell" },
      { key: "time", label: "Casting time", ph: "Action", cls: "short2" },
      { key: "range", label: "Range", ph: "60 ft", cls: "short2" },
      { key: "notes", label: "Summary", ph: "Components, duration, effect…", cls: "grow" },
    ],
  },
  inventory: {
    details: true,
    fields: [
      { key: "equipped", label: "Eq.", type: "checkbox", title: "Equipped / attuned" },
      { key: "qty", label: "Qty", ph: "1", type: "number", cls: "short" },
      { key: "name", label: "Item", ph: "Item" },
      { key: "weight", label: "lb", ph: "lb", type: "number", cls: "short col-weight" },
      { key: "notes", label: "Notes", ph: "Notes", cls: "grow" },
    ],
  },
};

// ---------------------------------------------------------------- helpers
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const num = (v) => (Number.isFinite(+v) ? +v : 0);
const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);
const modOf = (score) => Math.floor((num(score) - 10) / 2);

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}
function deepMerge(base, over) {
  if (over == null || typeof over !== "object" || Array.isArray(over)) return over ?? base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = base && typeof base[k] === "object" && !Array.isArray(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}
function debounce(fn, ms) {
  let t;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...args); }, ms); };
  d.flush = (...args) => { if (t) { clearTimeout(t); t = null; return fn(...args); } };
  d.pending = () => t != null;
  return d;
}
function confirmDialog(msg) {
  const dlg = $("#confirm-dialog");
  $("#confirm-msg").textContent = msg;
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener("close", () => resolve(dlg.returnValue === "ok"), { once: true }));
}

const status = (text, cls = "") => {
  const el = $("#save-status");
  el.textContent = text;
  el.className = "save-status " + cls;
};

// ---------------------------------------------------------------- character
let char = DEFAULT_CHARACTER();

// The sheet on disk as this tab last loaded or saved it. Before saving we check
// the file still matches, so this tab never overwrites a change made elsewhere
// (another tab, or someone editing data/character.json directly).
let lastSynced = null;
let saveConflict = false;

async function handleSaveConflict() {
  saveConflict = true;
  status("Not saving: this sheet was changed outside this tab. Reload to continue.", "err");
  const ok = await confirmDialog(
    "This character sheet was changed outside this tab (another tab, or an edit to the file). " +
    "Reload to get the latest version? Your most recent change in this tab will be discarded.");
  if (ok) location.reload();
}

const saveCharacter = debounce(async () => {
  if (saveConflict) return handleSaveConflict();
  try {
    const onDisk = await DB.getCharacter(UID, CHAR_ID);
    if (lastSynced !== null && JSON.stringify(onDisk) !== lastSynced) return handleSaveConflict();
    const snapshot = JSON.stringify(char);
    await DB.saveCharacter(UID, CHAR_ID, JSON.parse(snapshot));
    lastSynced = snapshot;
    status("Saved", "ok");
  } catch (e) {
    status("Save failed: " + e.message, "err");
  }
}, 400);

function changed() {
  recordUndo();
  status("Saving…");
  saveCharacter();
  recalc();
}

// --- undo / redo (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y)
// `committed` is the character as of the last change. Every discrete change
// (click, pip, button) is its own undo step; typing in the same field is
// grouped into one step until you pause for a moment or move to another field.
const UNDO_LIMIT = 200;
const TYPING_GROUP_MS = 1500;
let undoStack = [];
let redoStack = [];
let committed = null;
let typingEl = null;
let lastTypeAt = 0;

function isTextField(el) {
  if (!el || el.id === "hp-amount" || el.id === "turn-hp-amount") return false;
  return el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["checkbox", "button", "radio"].includes(el.type));
}

function recordUndo() {
  const el = document.activeElement;
  const typing = isTextField(el);
  const now = Date.now();
  const sameBurst = typing && el === typingEl && now - lastTypeAt < TYPING_GROUP_MS;
  if (!sameBurst && committed !== null) {
    undoStack.push(committed);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack = [];
  }
  typingEl = typing ? el : null;
  lastTypeAt = now;
  committed = JSON.stringify(char);
}

function renderAll() {
  bindAll();
  paintSkillPips();
  renderSlots();
  renderDeathSaves();
  renderExhaustion();
  renderResources();
  renderAllEntries();
  renderLanguages();
  for (const name of Object.keys(LISTS)) renderList(name);
  renderTurn();
  recalc();
}

function stepHistory(from, to, label, verb) {
  if (!from.length) return status(`Nothing to ${verb}`);
  to.push(JSON.stringify(char));
  committed = from.pop();
  char = JSON.parse(committed);
  typingEl = null;
  renderAll();
  saveCharacter();
  status(`${label} (${undoStack.length} more to undo)`, "ok");
}
const undo = () => stepHistory(undoStack, redoStack, "Undone", "undo");
const redo = () => stepHistory(redoStack, undoStack, "Redone", "redo");

function setupUndo() {
  committed = JSON.stringify(char);
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    const isUndo = key === "z" && !e.shiftKey;
    const isRedo = (key === "z" && e.shiftKey) || key === "y";
    if (!isUndo && !isRedo) return;
    // Text boxes keep the browser's own undo for what you're typing,
    // and the session notes editor isn't part of the character.
    if (isTextField(document.activeElement) || !$("#tab-notes").hidden) return;
    e.preventDefault();
    isUndo ? undo() : redo();
  });
}

const prof = () => 2 + Math.floor((Math.max(1, num(char.level)) - 1) / 4);
const abilityMod = (ab) => modOf(char.abilities[ab]);
const skillMod = (key, ab) => abilityMod(ab) + (char.skills[key] || 0) * prof();

function recalc() {
  const calc = {
    prof: fmtMod(prof()),
    initiative: fmtMod(abilityMod("dex") + num(char.initMisc) + featBonus("initiative")),
    initNote: featBonusNote("initiative"),
    passive: 10 + skillMod("perception", "wis"),
    level: num(char.level),
    spellDC: char.spellAbility ? 8 + prof() + abilityMod(char.spellAbility) : "—",
    spellAtk: char.spellAbility ? fmtMod(prof() + abilityMod(char.spellAbility)) : "—",
    hpMax: num(char.hp.max),
    ac: char.ac,
    speed: char.speed,
    weight: +char.inventory.reduce((s, it) => s + num(it.weight) * (it.qty === "" || it.qty == null ? 1 : num(it.qty)), 0).toFixed(2),
  };
  calc.nameOrUnnamed = char.name || "this character";
  for (const el of $$("[data-calc]")) el.textContent = calc[el.dataset.calc];
  document.body.classList.toggle("no-xp", char.settings.trackXp === false);
  document.body.classList.toggle("no-weight", char.settings.trackWeight === false);
  document.body.classList.toggle("corporate-card", char.settings.currencyMode === "corporate");
  $$("#feats .entry").forEach((d, i) => { $(".entry-auto", d).textContent = char.feats[i] ? featAutoText(char.feats[i]) : ""; });

  for (const [ab] of ABILITIES) {
    $(`#mod-${ab}`).textContent = fmtMod(abilityMod(ab));
    $(`#save-${ab}`).textContent = fmtMod(abilityMod(ab) + (char.saves[ab] ? prof() : 0));
  }
  for (const [key, , ab] of SKILLS) $(`#skill-${key}`).textContent = fmtMod(skillMod(key, ab));

  const { current, max, temp } = char.hp;
  const pct = max > 0 ? Math.max(0, Math.min(100, (num(current) / num(max)) * 100)) : 0;
  for (const fill of [$("#hp-fill"), $("#turn-hp-fill")]) {
    fill.style.width = pct + "%";
    fill.classList.toggle("low", pct <= 25);
    fill.classList.toggle("mid", pct > 25 && pct <= 50);
    fill.dataset.temp = num(temp) > 0 ? `+${temp} temp` : "";
  }

  if (JSON.stringify(char.resources.map(resolveResource)) !== resourceSig && !document.activeElement?.closest("#resources")) {
    renderResources();
  }

  const ex = num(char.exhaustion);
  const note = $("#exhaustion-note");
  note.textContent = ex >= 6 ? "Dead" : ex > 0 ? `−${2 * ex} to d20 tests, −${5 * ex} ft speed` : "";
  note.className = ex >= 6 ? "dead" : ex > 0 ? "bad" : "";

  const title = char.name || "Character Sheet";
  $("#title").textContent = title;
  document.title = char.name ? `${char.name} — ${[char.class, char.level].filter(Boolean).join(" ")}` : "Character Sheet";
}

function readInput(el) {
  if (el.type === "checkbox") return el.checked;
  if (el.type === "number") return el.value === "" ? "" : +el.value;
  return el.value;
}
function writeInput(el, v) {
  if (el.type === "checkbox") el.checked = !!v;
  else el.value = v ?? "";
}

function bindAll() {
  for (const el of $$("[data-bind]")) {
    writeInput(el, getPath(char, el.dataset.bind));
    if (el.dataset.bound) continue;
    el.dataset.bound = "1";
    el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => {
      setPath(char, el.dataset.bind, readInput(el));
      changed();
    });
  }
}

// --- abilities / saves / skills
function buildStatic() {
  $("#abilities").innerHTML = ABILITIES.map(([ab, label]) => `
    <div class="ability">
      <span class="ab-label" title="${label}">${ab.toUpperCase()}</span>
      <span class="ab-mod" id="mod-${ab}"></span>
      <input type="number" min="1" max="30" data-bind="abilities.${ab}" aria-label="${label} score">
    </div>`).join("");

  $("#saves").innerHTML = ABILITIES.map(([ab, label]) => `
    <label class="check-row">
      <input type="checkbox" data-bind="saves.${ab}">
      <span class="val" id="save-${ab}"></span>
      <span>${label}</span>
    </label>`).join("");

  $("#skills").innerHTML = SKILLS.map(([key, label, ab]) => `
    <div class="check-row">
      <button class="pip-btn" data-skill="${key}" aria-label="${label} proficiency"></button>
      <span class="val" id="skill-${key}"></span>
      <span>${label} <small class="muted">${ab.toUpperCase()}</small></span>
    </div>`).join("");

  $("#skills").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-skill]");
    if (!btn) return;
    const key = btn.dataset.skill;
    char.skills[key] = ((char.skills[key] || 0) + 1) % 3;
    paintSkillPips();
    changed();
  });
}
function paintSkillPips() {
  for (const btn of $$("[data-skill]")) {
    const lvl = char.skills[btn.dataset.skill] || 0;
    btn.className = "pip-btn " + ["", "prof", "expert"][lvl];
    btn.title = ["Not proficient", "Proficient", "Expertise"][lvl];
  }
}

// --- pips (spell slots, death saves). `filled` pips come first; clicking the
// last filled pip empties it, clicking an empty one fills up to it.
function pips(count, filled, onSet, cls = "") {
  const wrap = document.createElement("span");
  wrap.className = "pips " + cls;
  for (let i = 0; i < count; i++) {
    const b = document.createElement("button");
    b.className = "pip" + (i < filled ? " on" : "");
    b.addEventListener("click", () => onSet(i < filled ? i : i + 1));
    wrap.append(b);
  }
  return wrap;
}

function renderDeathSaves() {
  for (const kind of ["success", "fail"]) {
    const host = $(`#ds-${kind}`);
    host.replaceChildren(pips(3, char.deathSaves[kind], (n) => {
      char.deathSaves[kind] = n;
      renderDeathSaves();
      changed();
    }, kind));
  }
}

function renderExhaustion() {
  $("#exhaustion").replaceChildren(pips(6, num(char.exhaustion), (n) => {
    char.exhaustion = n;
    renderExhaustion();
    changed();
  }));
}

// --- feats
// Known feats fill in their rules text when you type the name, and can feed
// numbers into the sheet (e.g. Alert adds your proficiency bonus to Initiative).
const FEAT_TYPES = ["Origin", "General", "Fighting Style", "Epic Boon", "Other"];
const FEAT_LIBRARY = {
  alert: {
    type: "Origin",
    desc: "**Initiative Proficiency.** When you roll Initiative, you can add your Proficiency Bonus to the roll.\n\n" +
      "**Initiative Swap.** Immediately after you roll Initiative, you can swap your Initiative with the Initiative " +
      "of one willing ally in the same combat. You can't make this swap if you or the ally has the Incapacitated condition.",
    bonus: { initiative: () => prof() },
  },
};
const featInfo = (f) => FEAT_LIBRARY[String(f.name || "").trim().toLowerCase()];
const featBonus = (stat) => char.feats.reduce((sum, f) => sum + (featInfo(f)?.bonus?.[stat]?.() || 0), 0);
const featBonusNote = (stat) => char.feats
  .filter((f) => featInfo(f)?.bonus?.[stat])
  .map((f) => `${fmtMod(featInfo(f).bonus[stat]())} ${f.name.trim()}`)
  .join(", ");
const featAutoText = (f) => {
  const b = featInfo(f)?.bonus;
  return b ? Object.entries(b).map(([stat, fn]) => `${fmtMod(fn())} ${stat}`).join(", ") : "";
};

// --- expandable entry lists (feats, class features)
// Each entry is { name, desc, ...extra fields }. Collapsed it shows the name and
// a tag; expanded it shows the description as Markdown, with an Edit mode.
const ENTRY_LISTS = {
  feats: {
    host: "#feats",
    noun: "feat",
    namePh: "Feat name (e.g. Alert)",
    fields: [{ key: "type", kind: "select", options: FEAT_TYPES }],
    blank: () => ({ name: "", type: "Origin", desc: "" }),
    tag: (f) => f.type || "",
    auto: featAutoText,
    known: featInfo,
  },
  features: {
    host: "#class-features",
    noun: "feature",
    namePh: "Feature name (e.g. Jack of All Trades)",
    fields: [
      { key: "source", kind: "text", ph: "Bard, College of Glamour…" },
      { key: "level", kind: "number", ph: "Lvl", cls: "short", title: "Level gained" },
    ],
    blank: () => ({ name: "", source: String(char.class || "").trim(), level: num(char.level) || 1, desc: "" }),
    tag: (f) => [f.source, f.level !== "" && f.level != null ? `Lv ${f.level}` : ""].filter(Boolean).join(" · "),
    sort: (a, b) => num(a.level) - num(b.level),
  },
  speciesTraits: {
    host: "#species-traits",
    noun: "trait",
    namePh: "Trait name (e.g. Amphibious)",
    fields: [{ key: "source", kind: "text", ph: "Species or subrace" }],
    blank: () => ({ name: "", source: String(char.race || "").trim(), desc: "" }),
    tag: (f) => f.source || "",
  },
};
// Which entries are expanded / being edited. UI-only state, not saved or undone.
const entryUi = Object.fromEntries(Object.keys(ENTRY_LISTS).map((k) => [k, { open: new Set(), editing: new Set() }]));

function renderEntries(key) {
  const cfg = ENTRY_LISTS[key];
  const ui = entryUi[key];
  const items = char[key];
  const host = $(cfg.host);
  host.replaceChildren();

  items.forEach((item, idx) => {
    const det = document.createElement("details");
    det.className = "entry";
    det.open = ui.open.has(idx);
    det.addEventListener("toggle", () => (det.open ? ui.open.add(idx) : ui.open.delete(idx)));

    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="entry-name"></span><span class="entry-tag"></span><span class="entry-auto"></span>`;
    const paintSummary = () => {
      $(".entry-name", summary).textContent = item.name || `New ${cfg.noun}`;
      const tag = cfg.tag(item);
      $(".entry-tag", summary).textContent = tag;
      $(".entry-tag", summary).hidden = !tag;
      $(".entry-auto", summary).textContent = cfg.auto?.(item) || "";
    };
    paintSummary();
    det.append(summary);

    const body = document.createElement("div");
    body.className = "entry-body";
    const actions = document.createElement("div");
    actions.className = "entry-actions";
    const btn = (label, cls, onClick) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (cls) b.className = cls;
      b.addEventListener("click", onClick);
      actions.append(b);
    };

    if (ui.editing.has(idx)) {
      const form = document.createElement("div");
      form.className = "entry-edit";
      const name = document.createElement("input");
      name.className = "entry-name-input";
      name.placeholder = cfg.namePh;
      name.value = item.name || "";
      form.append(name);

      const fieldEls = {};
      for (const f of cfg.fields) {
        let el;
        if (f.kind === "select") {
          el = document.createElement("select");
          el.innerHTML = f.options.map((o) => `<option>${o}</option>`).join("");
        } else {
          el = document.createElement("input");
          el.type = f.kind;
          if (f.ph) el.placeholder = f.ph;
        }
        if (f.cls) el.className = f.cls;
        if (f.title) el.title = f.title;
        writeInput(el, item[f.key]);
        el.addEventListener(f.kind === "select" ? "change" : "input", () => {
          item[f.key] = readInput(el);
          paintSummary();
          changed();
        });
        fieldEls[f.key] = el;
        form.append(el);
      }

      const desc = document.createElement("textarea");
      desc.rows = 6;
      desc.placeholder = `What the ${cfg.noun} does. Markdown works: **bold**, lists…`;
      desc.value = item.desc || "";
      desc.addEventListener("input", () => { item.desc = desc.value; changed(); });
      form.append(desc);

      name.addEventListener("input", () => {
        item.name = name.value;
        const known = cfg.known?.(item);
        if (known && !desc.value.trim()) {
          desc.value = item.desc = known.desc;
          for (const f of cfg.fields) {
            if (known[f.key] !== undefined) writeInput(fieldEls[f.key], (item[f.key] = known[f.key]));
          }
        }
        paintSummary();
        changed();
      });

      body.append(form);
      btn("Done", "primary", () => {
        ui.editing.delete(idx);
        if (cfg.sort) {
          const before = JSON.stringify(items);
          items.sort(cfg.sort);
          if (JSON.stringify(items) !== before) { ui.open.clear(); changed(); }
        }
        renderEntries(key);
      });
      btn("Remove", "danger ghost", () => {
        items.splice(idx, 1);
        ui.open.clear();
        ui.editing.clear();
        renderEntries(key);
        changed();
      });
    } else {
      const text = document.createElement("div");
      text.className = "md";
      text.innerHTML = item.desc?.trim() ? renderMarkdown(item.desc) : `<p class="muted">No description yet.</p>`;
      body.append(text);
      btn("Edit", "", () => { ui.editing.add(idx); renderEntries(key); });
    }
    body.append(actions);
    det.append(body);
    host.append(det);
  });

  const add = document.createElement("button");
  add.textContent = `+ Add ${cfg.noun}`;
  add.addEventListener("click", () => {
    items.push(cfg.blank());
    const idx = items.length - 1;
    ui.open.add(idx);
    ui.editing.add(idx);
    renderEntries(key);
    changed();
    $$(".entry-name-input", host).at(-1)?.focus();
  });
  const wrap = document.createElement("div");
  wrap.className = "list-actions";
  wrap.append(add);
  host.append(wrap);
}
const renderAllEntries = () => Object.keys(ENTRY_LISTS).forEach(renderEntries);

// --- languages
// Suggestions only (2024 PHB standard + rare languages, plus the elemental
// dialects); you can type anything.
const LANGUAGE_SUGGESTIONS = [
  "Common", "Common Sign Language", "Draconic", "Dwarvish", "Elvish", "Giant", "Gnomish",
  "Goblin", "Halfling", "Orc", "Abyssal", "Celestial", "Deep Speech", "Druidic", "Infernal",
  "Primordial", "Aquan", "Auran", "Ignan", "Terran", "Sylvan", "Thieves' Cant", "Undercommon",
];

function renderLanguages() {
  const host = $("#languages");
  host.replaceChildren();
  $("#language-options").innerHTML = LANGUAGE_SUGGESTIONS
    .filter((l) => !char.languages.some((k) => k.toLowerCase() === l.toLowerCase()))
    .map((l) => `<option value="${l}">`).join("");

  const chips = document.createElement("div");
  chips.className = "chips";
  char.languages.forEach((lang, idx) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = lang;
    const x = document.createElement("button");
    x.className = "icon ghost";
    x.textContent = "×";
    x.title = `Remove ${lang}`;
    x.addEventListener("click", () => { char.languages.splice(idx, 1); renderLanguages(); changed(); });
    chip.append(x);
    chips.append(chip);
  });
  if (!char.languages.length) chips.innerHTML = `<span class="muted">No languages yet.</span>`;

  const row = document.createElement("div");
  row.className = "chip-add";
  const input = document.createElement("input");
  input.placeholder = "Add a language…";
  input.setAttribute("list", "language-options");
  const add = document.createElement("button");
  add.textContent = "Add";
  const commit = () => {
    const lang = input.value.trim();
    if (!lang) return;
    if (!char.languages.some((k) => k.toLowerCase() === lang.toLowerCase())) {
      char.languages.push(lang);
      changed();
    }
    renderLanguages();
    $("#languages .chip-add input").focus();
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); });
  add.addEventListener("click", commit);
  row.append(input, add);
  host.append(chips, row);
}

// --- limited-use features (Bardic Inspiration, Channel Divinity, Second Wind…)
// A resource with `auto: "bardic"` derives its max, die and recharge from the
// 2024 Bard rules: uses = CHA mod (min 1); d6/d8/d10/d12 at levels 1/5/10/15;
// Font of Inspiration (level 5+) recharges it on a short rest too.
const AUTO_RESOURCES = {
  bardic: () => {
    const lvl = num(char.level);
    return {
      max: Math.max(1, abilityMod("cha")),
      die: lvl >= 15 ? "d12" : lvl >= 10 ? "d10" : lvl >= 5 ? "d8" : "d6",
      reset: lvl >= 5 ? "short" : "long",
    };
  },
};
// College of Glamour (level 3): one use per long rest, added automatically
// to characters who have the Beguiling Magic feature (see ensureAutoResources).
AUTO_RESOURCES.beguiling = () => ({ max: 1, reset: "long", die: "" });
const resolveResource = (r) => ({ ...r, ...(AUTO_RESOURCES[r.auto]?.() ?? {}) });
let resourceSig = "";

function renderResources() {
  const host = $("#resources");
  host.replaceChildren();
  resourceSig = JSON.stringify(char.resources.map(resolveResource));

  char.resources.forEach((raw, idx) => {
    const r = resolveResource(raw);
    const max = Math.max(0, Math.min(20, num(r.max)));
    const left = Math.max(0, max - num(raw.used));
    const row = document.createElement("div");
    row.className = "res-row";

    const name = document.createElement("input");
    name.className = "res-name";
    name.value = raw.name || "";
    name.placeholder = "Feature";
    name.addEventListener("input", () => { raw.name = name.value; changed(); });

    const setLeft = (n) => { raw.used = max - n; renderResources(); changed(); };
    const use = document.createElement("button");
    use.textContent = r.die ? `Use (${r.die})` : "Use";
    use.disabled = left === 0;
    use.addEventListener("click", () => {
      window.fx?.(raw.auto === "bardic" ? "note" : "star", use);
      setLeft(left - 1);
      status(`${raw.name || "Feature"} used${r.die ? ` — grants a ${r.die}` : ""}, ${left - 1} left`, "ok");
    });

    const count = document.createElement("span");
    count.className = "res-count";
    count.textContent = `${left}/${max}`;

    row.append(name, pips(max, left, setLeft, "res"), count, use);

    // Font of Inspiration: spend a spell slot to regain a use.
    if (raw.auto === "bardic" && num(char.level) >= 5 && left < max) {
      const lvl = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((l) => num(char.slots[l].max) - num(char.slots[l].used) > 0);
      if (lvl) {
        const regain = document.createElement("button");
        regain.className = "ghost";
        regain.textContent = `+1 for a level ${lvl} slot`;
        regain.title = "Font of Inspiration: expend a spell slot to regain one use";
        regain.addEventListener("click", () => {
          char.slots[lvl].used = num(char.slots[lvl].used) + 1;
          raw.used = num(raw.used) - 1;
          renderSlots(); renderResources(); changed();
          status(`Spent a level ${lvl} slot to regain ${raw.name}`, "ok");
        });
        row.append(regain);
      }
    }

    const opts = document.createElement("span");
    opts.className = "res-opts";
    if (raw.auto) {
      opts.innerHTML = `<span class="muted" title="Worked out from your class features">auto · ${r.reset} rest</span>`;
    } else {
      const maxIn = document.createElement("input");
      maxIn.type = "number"; maxIn.min = 0; maxIn.max = 20; maxIn.className = "short";
      maxIn.title = "Max uses"; maxIn.value = raw.max ?? 1;
      maxIn.addEventListener("change", () => { raw.max = num(maxIn.value); renderResources(); changed(); });
      const reset = document.createElement("select");
      reset.innerHTML = `<option value="short">short rest</option><option value="long">long rest</option>`;
      reset.value = raw.reset || "long";
      reset.addEventListener("change", () => { raw.reset = reset.value; changed(); });
      const die = document.createElement("input");
      die.className = "short"; die.placeholder = "die"; die.title = "Die (optional)"; die.value = raw.die || "";
      die.addEventListener("change", () => { raw.die = die.value; renderResources(); changed(); });
      opts.append(maxIn, die, reset);
    }
    const del = document.createElement("button");
    del.className = "icon danger ghost";
    del.textContent = "×";
    del.title = "Remove";
    del.addEventListener("click", () => { char.resources.splice(idx, 1); renderResources(); changed(); });
    opts.append(del);
    row.append(opts);
    host.append(row);
  });

  const actions = document.createElement("div");
  actions.className = "list-actions";
  const add = document.createElement("button");
  add.textContent = "+ Add feature";
  add.addEventListener("click", () => {
    char.resources.push({ name: "", max: 1, used: 0, reset: "long" });
    renderResources(); changed();
    $$(".res-name", host).at(-1)?.focus();
  });
  actions.append(add);
  if (!char.resources.some((r) => r.auto === "bardic")) {
    const bard = document.createElement("button");
    bard.textContent = "+ Bardic Inspiration";
    bard.addEventListener("click", () => {
      char.resources.push({ name: "Bardic Inspiration", used: 0, auto: "bardic" });
      renderResources(); changed();
    });
    actions.append(bard);
  }
  host.append(actions);
}

// Returns true if it added anything.
function ensureAutoResources() {
  const hasFeature = char.features.some((f) => /^beguiling magic$/i.test(String(f.name || "").trim()));
  if (!hasFeature || char.resources.some((r) => r.auto === "beguiling")) return false;
  char.resources.push({ name: "Beguiling Magic", used: 0, auto: "beguiling" });
  return true;
}

function rechargeResources(kind) {
  for (const raw of char.resources) {
    if (kind === "long" || resolveResource(raw).reset === "short") raw.used = 0;
  }
}

// Slot levels you have no slots at are hidden; "Edit slots" shows all nine
// with their max inputs (UI-only state).
let editingSlots = false;

function renderSlots() {
  if (char.resources.some((r) => r.auto)) queueMicrotask(renderResources); // slot-dependent buttons
  const host = $("#slots");
  host.replaceChildren();
  host.classList.toggle("editing", editingSlots);
  for (let lvl = 1; lvl <= 9; lvl++) {
    const slot = char.slots[lvl];
    if (!editingSlots && !num(slot.max)) continue;
    const row = document.createElement("div");
    row.className = "slot-row";
    row.innerHTML = `<span class="slot-lvl">${lvl}</span>`;
    const setAvail = (n) => { slot.used = slot.max - n; renderSlots(); changed(); };
    if (editingSlots) {
      const label = document.createElement("label");
      label.className = "tiny";
      label.innerHTML = `max <input type="number" min="0" max="9" value="${slot.max || 0}">`;
      $("input", label).addEventListener("input", (e) => {
        slot.max = Math.max(0, Math.min(9, num(e.target.value)));
        slot.used = Math.min(slot.used, slot.max);
        row.querySelector(".pips").replaceWith(pips(slot.max, slot.max - slot.used, setAvail));
        changed();
      });
      row.append(label);
    }
    row.append(pips(slot.max, slot.max - slot.used, setAvail));
    host.append(row);
  }
  if (!host.children.length) {
    host.innerHTML = `<p class="muted">No spell slots yet.</p>`;
  }
  const toggle = document.createElement("button");
  toggle.className = "slots-toggle";
  toggle.textContent = editingSlots ? "Done" : "Edit slots";
  if (editingSlots) toggle.classList.add("primary");
  toggle.addEventListener("click", () => { editingSlots = !editingSlots; renderSlots(); });
  host.append(toggle);
}

// --- editable lists (attacks, spells, inventory)
const openDetails = { attacks: new Set(), spells: new Set(), inventory: new Set() }; // UI-only

function listInput(f) {
  let el;
  if (f.type === "select") {
    el = document.createElement("select");
    el.innerHTML = f.options.map((o) => `<option value="${o}">${o || "–"}</option>`).join("");
  } else {
    el = document.createElement("input");
    el.type = f.type || "text";
    if (f.ph) el.placeholder = f.ph;
  }
  if (f.title) el.title = f.title;
  if (f.cls) el.className = f.cls;
  return el;
}

function renderList(name) {
  const cfg = LISTS[name];
  const host = $(`#list-${name}`);
  const items = char[name];
  host.replaceChildren();
  host.className = `list list-${name}`;

  if (items.length) {
    const head = document.createElement("div");
    head.className = "list-row list-head";
    if (cfg.details) head.append(Object.assign(document.createElement("span"), { className: "list-toggle-spacer" }));
    for (const f of cfg.fields) {
      const h = document.createElement("span");
      h.className = `col-${f.type || "text"} ${f.cls || ""}`;
      h.textContent = f.label;
      if (f.title) h.title = f.title;
      head.append(h);
    }
    head.append(Object.assign(document.createElement("span"), { className: "list-del-spacer" }));
    host.append(head);
  }

  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "list-row";
    const detail = document.createElement("div");
    detail.className = "list-detail";

    if (cfg.details) {
      const tog = document.createElement("button");
      tog.className = "icon ghost list-toggle";
      const paintTog = () => {
        const open = openDetails[name].has(idx);
        tog.textContent = open ? "▾" : "▸";
        tog.title = open ? "Hide details" : "Show details";
        tog.classList.toggle("has-detail", !!item.desc?.trim());
        detail.hidden = !open;
      };
      tog.addEventListener("click", () => {
        openDetails[name].has(idx) ? openDetails[name].delete(idx) : openDetails[name].add(idx);
        paintTog();
      });
      row.append(tog);
      paintTog();
    }

    for (const f of cfg.fields) {
      const input = listInput(f);
      writeInput(input, item[f.key]);
      input.addEventListener(input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input", () => {
        item[f.key] = readInput(input);
        changed();
      });
      row.append(input);
    }

    const del = document.createElement("button");
    del.className = "icon danger ghost";
    del.textContent = "×";
    del.title = "Remove";
    del.addEventListener("click", () => { items.splice(idx, 1); openDetails[name].clear(); renderList(name); changed(); });
    row.append(del);
    host.append(row);

    if (cfg.details) {
      // Rendered Markdown; click Edit to change it.
      const view = document.createElement("div");
      view.className = "md";
      const edit = document.createElement("button");
      edit.textContent = "Edit details";
      const paintView = () => {
        view.innerHTML = item.desc?.trim() ? renderMarkdown(item.desc) : `<p class="muted">No details yet.</p>`;
      };
      paintView();
      edit.addEventListener("click", () => {
        const ta = document.createElement("textarea");
        ta.rows = 6;
        ta.value = item.desc || "";
        ta.placeholder = "Full rules text. Markdown works: **bold**, lists…";
        ta.addEventListener("input", () => { item.desc = ta.value; changed(); });
        const done = document.createElement("button");
        done.textContent = "Done";
        done.className = "primary";
        done.addEventListener("click", () => { paintView(); ta.replaceWith(view); done.replaceWith(edit); });
        view.replaceWith(ta);
        edit.replaceWith(done);
        ta.focus();
      });
      detail.append(view, edit);
      host.append(detail);
    }
  });

  const actions = document.createElement("div");
  actions.className = "list-actions";
  const add = document.createElement("button");
  add.textContent = "+ Add";
  add.addEventListener("click", () => {
    items.push({});
    renderList(name);
    changed();
    $$(".list-row", host).at(-1)?.querySelector("input:not([type=checkbox])")?.focus();
  });
  actions.append(add);
  if (name === "spells") {
    const sort = document.createElement("button");
    sort.textContent = "Sort by level";
    sort.addEventListener("click", () => {
      items.sort((a, b) => spellOrder(a.level) - spellOrder(b.level) || String(a.name || "").localeCompare(b.name || ""));
      openDetails.spells.clear();
      renderList(name);
      changed();
    });
    actions.append(sort);
  }
  host.append(actions);
}

// --- HP actions
function hpAmount() {
  const v = num($("#hp-amount").value);
  $("#hp-amount").value = "";
  return Math.max(0, v);
}
function damage(n) {
  const hp = char.hp;
  const fromTemp = Math.min(num(hp.temp), n);
  hp.temp = num(hp.temp) - fromTemp;
  hp.current = Math.max(0, num(hp.current) - (n - fromTemp));
}
function heal(n) {
  const hp = char.hp;
  if (num(hp.current) === 0 && n > 0) char.deathSaves = { success: 0, fail: 0 };
  hp.current = Math.min(num(hp.max), num(hp.current) + n);
}

function setupHp() {
  $("#btn-damage").addEventListener("click", () => {
    const n = hpAmount();
    damage(n); bindAll(); changed();
    if (n > 0) window.fx?.("hurt", $(".hp-card"));
    concentrationCheck(n);
  });
  $("#btn-heal").addEventListener("click", (e) => {
    const n = hpAmount();
    heal(n); bindAll(); renderDeathSaves(); changed();
    if (n > 0) window.fx?.("heal", e.currentTarget);
  });
  $("#hp-amount").addEventListener("keydown", (e) => {
    if (e.key === "Enter") (e.shiftKey ? $("#btn-heal") : $("#btn-damage")).click();
  });

  $("#btn-short-rest").addEventListener("click", () => {
    const level = num(char.level);
    if (num(char.hitDice.used) >= level) return status("No hit dice left", "err");
    const sides = parseInt(String(char.hitDice.die).replace(/\D/g, ""), 10) || 8;
    const roll = 1 + Math.floor(Math.random() * sides);
    const gained = Math.max(0, roll + abilityMod("con"));
    char.hitDice.used = num(char.hitDice.used) + 1;
    heal(gained);
    bindAll();
    changed();
    status(`Hit die: rolled ${roll} ${fmtMod(abilityMod("con"))} CON → healed ${gained}`, "ok");
  });

  $("#btn-rest").addEventListener("click", () => {
    rechargeResources("short");
    renderResources(); changed();
    status("Short rest: short-rest features recharged. Spend hit dice to heal.", "ok");
  });

  $("#btn-long-rest").addEventListener("click", async () => {
    if (!(await confirmDialog("Long rest: restore HP, spell slots and all hit dice, clear death saves, and reduce exhaustion by 1?"))) return;
    char.hp.current = num(char.hp.max);
    char.hp.temp = 0;
    char.deathSaves = { success: 0, fail: 0 };
    for (const s of Object.values(char.slots)) s.used = 0;
    char.hitDice.used = 0;
    char.exhaustion = Math.max(0, num(char.exhaustion) - 1);
    char.concentration = "";
    rechargeResources("long");
    bindAll(); renderSlots(); renderDeathSaves(); renderExhaustion(); renderResources(); changed();
    status("Long rest complete", "ok");
  });
}

// ---------------------------------------------------------------- my turn
// Everything you can do on your turn in one view: spells, attacks, features and
// resources grouped by what they cost (action / bonus action / reaction), with
// buttons that spend the slot or use, plus a plan box and a quick session log.
//
// What you've used this turn and the round counter are UI state kept in this
// browser (localStorage), not part of the sheet, so they aren't undone or saved.
const ECON = [["action", "Action"], ["bonus", "Bonus action"], ["reaction", "Reaction"], ["move", "Movement"]];
const ECON_GROUPS = [...ECON.filter(([k]) => k !== "move"), ["other", "Longer casting / out of combat"]];
// Things every creature can do (2024 rules), shown under the matching group.
const BASIC_ACTIONS = {
  action: ["Attack", "Dash", "Disengage", "Dodge", "Help", "Hide", "Influence", "Magic", "Ready", "Search", "Study", "Utilize"],
  reaction: ["Opportunity Attack"],
};
const LOG_HEADING = "## What happened";

let turn = { used: {}, round: 0, slotCast: false, concDC: 0 };
const turnOpen = new Set(); // expanded rows, UI-only
let turnMsg = "";            // rules reminder shown in the tracker until the next turn
const turnKey = () => `turn:${CHAR_ID}`;
function loadTurnState() {
  try { Object.assign(turn, JSON.parse(localStorage.getItem(turnKey()) || "{}")); } catch {}
}
function saveTurnState() {
  try { localStorage.setItem(turnKey(), JSON.stringify(turn)); } catch {}
}
const spendEcon = (kind) => { if (kind !== "other") turn.used[kind] = true; };

function el(tag, cls = "", text = "") {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

// Spell casting time → group. "Bonus Action", "Reaction", "Action / ritual", "1 minute".
function econOf(time) {
  const t = String(time || "").toLowerCase();
  return /bonus/.test(t) ? "bonus" : /reaction/.test(t) ? "reaction" : /action/.test(t) ? "action" : "other";
}
// Features, traits and feats only show up if their text says what they cost.
function featureEcon(desc) {
  const t = String(desc || "").toLowerCase();
  if (/\bbonus action\b/.test(t)) return "bonus";
  if (/\b(as a|use your|take a) reaction\b/.test(t)) return "reaction";
  if (/\b(as an|as a magic|take the \w+) action\b/.test(t)) return "action";
  return null;
}
const isConcentration = (sp) => /concentration/i.test(`${sp.notes || ""} ${sp.desc || ""}`);
const isRitual = (sp) => /ritual/i.test(`${sp.time || ""} ${String(sp.desc || "").split("\n")[0]}`);
const slotLeft = (lvl) => num(char.slots[lvl]?.max) - num(char.slots[lvl]?.used);
const resMax = (raw) => Math.max(0, Math.min(20, num(resolveResource(raw).max)));
const resLeft = (raw) => Math.max(0, resMax(raw) - num(raw.used));
// A resource named after this spell ("Merfolk's Breath (Water Breathing)"),
// or one that a feature's text spends ("expend a use of Bardic Inspiration").
const resourceNaming = (name) => char.resources.find((r) => r.name && name && r.name.toLowerCase().includes(name.toLowerCase()));
const resourceIn = (desc, self) => char.resources.find((r) =>
  r.name && r.name !== self && String(desc || "").toLowerCase().includes(r.name.toLowerCase()));

function turnItems() {
  const items = [];
  const seen = new Set();
  for (const a of char.attacks) {
    const sig = JSON.stringify([a.name, a.bonus, a.damage]);
    if (!a.name || seen.has(sig)) continue;
    seen.add(sig);
    items.push({ kind: "attack", econ: "action", rank: 0, name: a.name, desc: a.desc, badge: "weapon",
      summary: [a.bonus && `${a.bonus} to hit`, a.damage, a.mastery && `Mastery: ${a.mastery}`, a.notes].filter(Boolean).join(" · ") });
  }
  for (const sp of char.spells) {
    if (!sp.name) continue;
    const lvl = String(sp.level || "");
    items.push({ kind: "spell", sp, econ: econOf(sp.time), rank: 1 + spellOrder(lvl), name: sp.name, desc: sp.desc,
      badge: lvl === "C" ? "cantrip" : lvl === "S" ? "trait" : lvl ? `lvl ${lvl}` : "spell",
      summary: [sp.range, sp.notes].filter(Boolean).join(" · ") });
  }
  for (const [key, badge] of [["features", "feature"], ["speciesTraits", "trait"], ["feats", "feat"]]) {
    for (const f of char[key]) {
      const econ = featureEcon(f.desc);
      if (!f.name || !econ) continue;
      items.push({ kind: "feature", econ, rank: 20, name: f.name, desc: f.desc, badge, res: resourceIn(f.desc, f.name),
        summary: [f.source, firstSentence(f.desc)].filter(Boolean).join(" · ") });
    }
  }
  for (const raw of char.resources) {
    if (raw.auto !== "bardic") continue;
    const r = resolveResource(raw);
    items.push({ kind: "resource", econ: "bonus", rank: 19, name: raw.name || "Bardic Inspiration", res: raw, badge: r.die,
      summary: `Give a creature within 60 ft a ${r.die} to add to one d20 test in the next hour` });
  }
  return items;
}
const firstSentence = (md) => String(md || "").replace(/[*_]/g, "").split(/(?<=\.)\s|\n/)[0].slice(0, 140);

function renderTurn() {
  renderTurnTracker();
  renderTurnSlots();
  renderTurnLists();
  renderTurnResources();
}

function renderTurnTracker() {
  const econ = $("#turn-econ");
  econ.replaceChildren();
  for (const [k, label] of ECON) {
    const b = el("button", "econ-btn" + (turn.used[k] ? " used" : ""), label);
    b.title = turn.used[k] ? `${label} used, click to get it back` : `${label} available, click to mark used`;
    b.addEventListener("click", () => { turn.used[k] = !turn.used[k]; saveTurnState(); renderTurn(); });
    econ.append(b);
  }

  const conc = $("#turn-conc");
  conc.replaceChildren();
  conc.className = "turn-conc" + (turn.concDC ? " check" : char.concentration ? " on" : "");
  if (char.concentration) {
    conc.append(el("span", "", "Concentrating on "), el("strong", "", char.concentration));
    if (turn.concDC) {
      conc.append(el("span", "", ` · took damage: CON save DC ${turn.concDC}`));
      const kept = el("button", "ok", "Kept it");
      kept.addEventListener("click", () => {
        turnLog(`Kept concentration on ${char.concentration} (CON save DC ${turn.concDC})`);
        turn.concDC = 0; saveTurnState(); renderTurn();
      });
      conc.append(kept);
    }
    const drop = el("button", "ghost danger", turn.concDC ? "Lost it" : "Drop");
    drop.addEventListener("click", () => {
      turnLog(turn.concDC ? `Lost concentration on ${char.concentration} (failed CON save DC ${turn.concDC})`
        : `Dropped concentration on ${char.concentration}`);
      char.concentration = ""; turn.concDC = 0; saveTurnState(); renderTurn(); changed();
    });
    conc.append(drop);
  } else {
    conc.append(el("span", "muted", "Not concentrating"));
  }

  $("#turn-msg").textContent = turnMsg;
  $("#turn-msg").hidden = !turnMsg;
  $("#turn-round").textContent = turn.round ? `Round ${turn.round}` : "Not in combat";
  $("#turn-next").textContent = turn.round ? "Next turn" : "Start combat";
  $("#turn-end").hidden = !turn.round;
}

function renderTurnSlots() {
  const host = $("#turn-slots");
  host.replaceChildren();
  for (let lvl = 1; lvl <= 9; lvl++) {
    const slot = char.slots[lvl];
    if (!num(slot.max)) continue;
    const row = el("div", "slot-row");
    row.append(el("span", "slot-lvl", String(lvl)));
    row.append(pips(num(slot.max), slotLeft(lvl), (n) => {
      const diff = n - slotLeft(lvl);
      slot.used = num(slot.max) - n;
      turnLog(`${diff < 0 ? "Spent" : "Recovered"} ${Math.abs(diff)} level ${lvl} slot${Math.abs(diff) === 1 ? "" : "s"} (${n}/${num(slot.max)} left)`);
      turnChanged();
    }));
    row.append(el("span", "res-count", `${slotLeft(lvl)}/${num(slot.max)}`));
    host.append(row);
  }
  if (!host.children.length) host.innerHTML = `<p class="muted">No spell slots. Set them on the Spells tab.</p>`;
}

function renderTurnLists() {
  const host = $("#turn-lists");
  host.replaceChildren();
  const items = turnItems().sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  for (const [econ, label] of ECON_GROUPS) {
    const group = items.filter((it) => it.econ === econ);
    const basics = BASIC_ACTIONS[econ] || [];
    if (!group.length && !basics.length) continue;
    const card = el("div", "card turn-group" + (turn.used[econ] ? " spent" : ""));
    card.dataset.econ = econ;
    const h = el("h2", "", label);
    if (turn.used[econ]) h.append(el("small", "", "used this turn"));
    card.append(h);
    for (const it of group) card.append(turnRow(it));
    if (basics.length) {
      const b = el("div", "turn-basics");
      b.append(el("span", "muted", econ === "reaction" ? "Anyone can: " : "Anyone can also: "), el("span", "", basics.join(" · ")));
      card.append(b);
    }
    host.append(card);
  }
}

function turnRow(it) {
  const key = `${it.kind}:${it.name}`;
  const row = el("div", "turn-item");
  const head = el("div", "ti-head");
  const main = el("button", "ti-main ghost");
  main.title = it.desc ? "Show the full text" : "";
  const title = el("span", "ti-title");
  title.append(el("span", "entry-tag", it.badge || it.kind), el("span", "ti-name", it.name));
  if (it.sp && isConcentration(it.sp)) title.append(el("span", "ti-flag conc", "conc."));
  if (it.sp && isRitual(it.sp)) title.append(el("span", "ti-flag", "ritual"));
  if (it.sp?.time && it.econ === "other") title.append(el("span", "ti-flag", it.sp.time));
  main.append(title);
  if (it.summary) main.append(el("span", "ti-summary", it.summary));
  const ctrl = el("div", "ti-ctrl");
  head.append(main, ctrl);
  row.append(head);

  const desc = el("div", "ti-desc md");
  desc.hidden = !turnOpen.has(key);
  if (it.desc?.trim()) {
    desc.innerHTML = renderMarkdown(it.desc);
    main.addEventListener("click", () => { turnOpen.has(key) ? turnOpen.delete(key) : turnOpen.add(key); desc.hidden = !desc.hidden; });
  } else {
    main.disabled = true;
  }
  row.append(desc);

  const button = (label, cls, onClick, disabled = false) => {
    const b = el("button", cls, label);
    b.disabled = disabled;
    b.addEventListener("click", () => onClick(b));
    ctrl.append(b);
    return b;
  };

  if (it.kind === "spell") {
    const lvl = String(it.sp.level || "");
    const slotLvl = parseInt(lvl, 10);
    if (lvl === "S") {
      const res = resourceNaming(it.name);
      if (res) {
        ctrl.append(el("span", "res-count", `${resLeft(res)}/${resMax(res)}`));
        button("Cast", "primary", (b) => useResource(res, it, b), resLeft(res) === 0);
      } else {
        button("Cast", "primary", (b) => castSpell(it, 0, b));
      }
    } else if (slotLvl >= 1) {
      const avail = [];
      for (let l = slotLvl; l <= 9; l++) if (slotLeft(l) > 0) avail.push(l);
      let pick = null;
      if (avail.length > 1) {
        pick = el("select", "upcast");
        pick.title = "Slot level (pick a higher one to upcast)";
        pick.innerHTML = avail.map((l) => `<option value="${l}">lvl ${l} slot (${slotLeft(l)})</option>`).join("");
        ctrl.append(pick);
      }
      if (isRitual(it.sp)) button("Ritual", "ghost", (b) => castSpell(it, 0, b, true)).title = "Cast as a ritual: +10 minutes, no slot";
      button(avail.length ? "Cast" : "No slots", "primary", (b) => castSpell(it, pick ? +pick.value : avail[0], b), !avail.length);
    } else {
      button("Cast", "primary", (b) => castSpell(it, 0, b));
    }
  } else if (it.res) {
    ctrl.append(el("span", "res-count", `${resLeft(it.res)}/${resMax(it.res)}`));
    button("Use", "primary", (b) => useResource(it.res, it, b), resLeft(it.res) === 0);
  } else {
    button(it.kind === "attack" ? "Attack" : "Use", "primary", (b) => {
      spendEcon(it.econ);
      turnLog(it.kind === "attack" ? `Attacked with ${it.name}` : `Used ${it.name}`);
      window.fx?.("star", b);
      saveTurnState(); renderTurn();
    });
  }
  return row;
}

// Cast a spell. `slot` 0 = no slot (cantrip, ritual, species trait).
function castSpell(it, slot, anchor, ritual = false) {
  const notes = [];
  if (slot) {
    char.slots[slot].used = num(char.slots[slot].used) + 1;
    // 2024 rules: only one spell per turn can use a spell slot.
    if (turn.slotCast && turn.round) notes.push("heads up: you already spent a slot this turn (one per turn)");
    turn.slotCast = true;
  }
  if (!ritual) spendEcon(it.econ);
  if (isConcentration(it.sp)) {
    if (char.concentration && char.concentration !== it.name) notes.push(`dropped ${char.concentration}`);
    char.concentration = it.name;
    turn.concDC = 0;
  }
  const how = ritual ? " as a ritual" : slot ? ` (lvl ${slot} slot)` : "";
  turnLog(`Cast ${it.name}${how}`);
  turnMsg = notes.length ? `Cast ${it.name}: ${notes.join("; ")}` : "";
  status(`Cast ${it.name}${how}`, "ok");
  window.fx?.("note", anchor);
  saveTurnState();
  turnChanged();
  if (slot && !ritual) offerBeguilingMagic(it);
}

// ---- Beguiling Magic (College of Glamour): right after you cast an Enchantment or
// Illusion spell with a spell slot, a creature within 60 ft makes a WIS save or is
// Charmed or Frightened for 1 minute. 1/long rest; a Bardic Inspiration use restores it.
const SCHOOLS = /\b(abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)\b/i;
const spellSchool = (sp) => (String(sp.desc || "").split("\n")[0].match(SCHOOLS)?.[1] || "").toLowerCase();

function offerBeguilingMagic(it) {
  const beguile = char.resources.find((r) => r.auto === "beguiling");
  const school = spellSchool(it.sp);
  if (!beguile || !["enchantment", "illusion"].includes(school)) return;
  const bardic = char.resources.find((r) => r.auto === "bardic");
  const restore = resLeft(beguile) === 0;
  if (restore && !(bardic && resLeft(bardic) > 0)) return; // no way to use it right now

  const dlg = $("#beguile-dialog");
  $("#beguile-spell").textContent = `${it.name} (${school[0].toUpperCase() + school.slice(1)})`;
  $("#beguile-dc").textContent = char.spellAbility ? 8 + prof() + abilityMod(char.spellAbility) : "—";
  const cost = $("#beguile-cost");
  cost.hidden = !restore;
  if (restore) cost.textContent = `You've used it since your last long rest. Using it now spends 1 Bardic Inspiration to restore it (${resLeft(bardic)} left).`;
  dlg.returnValue = "";
  dlg.showModal();
  dlg.addEventListener("close", () => {
    const pick = dlg.returnValue; // "Charmed" | "Frightened" | "" (not now)
    if (pick !== "Charmed" && pick !== "Frightened") return;
    if (restore) bardic.used = num(bardic.used) + 1;
    else beguile.used = num(beguile.used) + 1;
    turnLog(`Beguiling Magic after ${it.name}: WIS save DC ${$("#beguile-dc").textContent} or ${pick} for 1 minute` +
      (restore ? " (restored with Bardic Inspiration)" : ""));
    status(`Beguiling Magic: ${pick}`, "ok");
    turnChanged();
  }, { once: true });
}

function useResource(raw, it, anchor) {
  raw.used = num(raw.used) + 1;
  spendEcon(it.econ);
  const die = resolveResource(raw).die;
  if (it.sp && isConcentration(it.sp)) char.concentration = it.name;
  turnLog(`${it.kind === "spell" ? "Cast" : "Used"} ${it.name}${die ? ` (${die})` : ""}`);
  status(`${it.name}: ${resLeft(raw)} use${resLeft(raw) === 1 ? "" : "s"} of ${raw.name} left`, "ok");
  window.fx?.(raw.auto === "bardic" ? "note" : "star", anchor);
  saveTurnState();
  turnChanged();
}

function renderTurnResources() {
  const host = $("#turn-resources");
  host.replaceChildren();
  for (const raw of char.resources) {
    const r = resolveResource(raw);
    const max = resMax(raw);
    const row = el("div", "res-row");
    row.append(el("span", "res-name", raw.name || "Feature"));
    row.append(pips(max, resLeft(raw), (n) => {
      const diff = n - resLeft(raw);
      raw.used = max - n;
      turnLog(`${diff < 0 ? "Used" : "Regained"} ${Math.abs(diff)} ${raw.name || "feature"} (${n}/${max} left)`);
      turnChanged();
    }, "res"));
    row.append(el("span", "res-count", `${resLeft(raw)}/${max}${r.die ? " " + r.die : ""}`));
    host.append(row);
  }
  if (!host.children.length) host.innerHTML = `<p class="muted">None yet. Add them on the Sheet tab.</p>`;
}

function turnChanged() {
  renderTurn();
  renderSlots();
  renderResources();
  changed();
}

function concentrationCheck(damageTaken) {
  if (!char.concentration || damageTaken <= 0) return;
  turn.concDC = Math.min(30, Math.max(10, Math.floor(damageTaken / 2)));
  saveTurnState();
  renderTurnTracker();
}

// ---- session log: appends "- R2: text" under "## What happened" in the newest note.
let logFile = null;

function sectionBounds(lines, heading) {
  const start = lines.findIndex((l) => l.trim().toLowerCase() === heading.toLowerCase());
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && /^#{1,2}\s/.test(l));
  if (end === -1) end = lines.length;
  return [start, end];
}

function appendToSection(content, heading, line) {
  const lines = content.split("\n");
  const b = sectionBounds(lines, heading);
  if (!b) return content.replace(/\n*$/, "\n\n") + `${heading}\n${line}\n`;
  let [start, at] = b;
  while (at > start + 1 && !lines[at - 1].trim()) at--;            // before trailing blank lines
  if (at > start + 1 && lines[at - 1].trim() === "-") lines.splice(--at, 1); // replace the template's empty bullet
  lines.splice(at, 0, line);
  return lines.join("\n");
}

function sectionTail(content, heading, n) {
  const lines = content.split("\n");
  const b = sectionBounds(lines, heading);
  return b ? lines.slice(b[0] + 1, b[1]).filter((l) => l.trim() && l.trim() !== "-").slice(-n) : [];
}

function paintLog(content) {
  const body = $("#turn-log-body");
  const tail = content == null ? [] : sectionTail(content, LOG_HEADING, 8);
  body.innerHTML = tail.length ? renderMarkdown(tail.join("\n"))
    : `<p class="muted">${logFile ? "Nothing logged yet this session." : "No session notes yet. Adding a line starts Session 1."}</p>`;
  body.scrollTop = body.scrollHeight;
}

async function loadTurnLog() {
  await loadNoteList();
  logFile = notes[0]?.file ?? null;
  const label = $("#turn-log-note");
  label.replaceChildren();
  if (logFile) {
    const a = el("a", "", notes[0].title);
    a.href = `#notes/${encodeURIComponent(logFile)}`;
    a.title = "Open this note";
    label.append(a);
  }
  const fresh = el("button", "ghost tiny-btn", "+ new session");
  fresh.title = "Start a new session note and log into it";
  fresh.addEventListener("click", async () => {
    try { logFile = (await createSessionNote()).file; await loadTurnLog(); } catch (e) { status("Couldn't create note: " + e.message, "err"); }
  });
  label.append(fresh);
  if (!logFile) return paintLog(null);
  try {
    paintLog((await DB.getNote(UID, CHAR_ID, logFile)).content);
  } catch (e) {
    status("Couldn't read the session note: " + e.message, "err");
  }
}

// Serialised so quick successive lines don't overwrite each other.
let logQueue = Promise.resolve();
function appendLog(text) {
  const line = `- ${turn.round ? `R${turn.round}: ` : ""}${text}`;
  logQueue = logQueue.then(async () => {
    const created = !logFile;
    if (created) logFile = (await createSessionNote()).file;
    await saveNote.flush(); // the Sessions tab might have unsaved typing in this note
    const next = appendToSection((await DB.getNote(UID, CHAR_ID, logFile)).content, LOG_HEADING, line);
    await DB.saveNote(UID, CHAR_ID, logFile, next);
    if (currentNote === logFile) { $("#note-text").value = next; renderPreview(); }
    if (created) await loadTurnLog();
    else paintLog(next);
  }).catch((e) => status("Couldn't add to the session note: " + e.message, "err"));
  return logQueue;
}
// Everything done on the My Turn tab is logged to the session note.
const turnLog = (text) => appendLog(text);

function setupTurn() {
  loadTurnState();

  const hpAmt = () => { const v = Math.max(0, num($("#turn-hp-amount").value)); $("#turn-hp-amount").value = ""; return v; };
  $("#turn-damage").addEventListener("click", () => {
    const n = hpAmt();
    damage(n); bindAll(); changed();
    if (n > 0) { window.fx?.("hurt", $(".turn-vitals")); turnLog(`Took ${n} damage`); }
    concentrationCheck(n);
  });
  $("#turn-heal").addEventListener("click", (e) => {
    const n = hpAmt();
    heal(n); bindAll(); renderDeathSaves(); changed();
    if (n > 0) { window.fx?.("heal", e.currentTarget); turnLog(`Healed ${n}`); }
  });
  $("#turn-hp-amount").addEventListener("keydown", (e) => {
    if (e.key === "Enter") (e.shiftKey ? $("#turn-heal") : $("#turn-damage")).click();
  });

  $("#turn-next").addEventListener("click", () => {
    Object.assign(turn, { used: {}, slotCast: false, round: turn.round + 1 });
    turnMsg = "";
    saveTurnState(); renderTurn();
    if (turn.round === 1) turnLog("Combat started");
    status(turn.round === 1 ? "Combat started: round 1" : `Round ${turn.round}: action, bonus action, reaction and movement refreshed`, "ok");
  });
  $("#turn-end").addEventListener("click", () => {
    turnLog(`Combat ended after ${turn.round} round${turn.round === 1 ? "" : "s"}`);
    Object.assign(turn, { used: {}, slotCast: false, round: 0, concDC: 0 });
    turnMsg = "";
    saveTurnState(); renderTurn();
  });

  $("#turn-log-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#turn-log-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    appendLog(text);
  });

  // The sheet fields shown on this tab (data-bind handles saving; this just logs).
  const logField = (bind, describe) => {
    const input = $(`#tab-turn [data-bind="${bind}"]`);
    let before = getPath(char, bind);
    input.addEventListener("focus", () => { before = getPath(char, bind); });
    input.addEventListener("change", () => {
      const after = getPath(char, bind);
      if (after !== before) turnLog(describe(after, before));
      before = after;
    });
  };
  logField("hp.current", (v) => `HP set to ${v}/${num(char.hp.max)}`);
  logField("hp.temp", (v) => `Temp HP set to ${num(v)}`);
  logField("inspiration", (v) => (v ? "Gained Heroic Inspiration" : "Used Heroic Inspiration"));
  logField("conditions", (v) => (String(v).trim() ? `Conditions: ${String(v).trim()}` : "Conditions cleared"));
}

// ---------------------------------------------------------------- theme
const THEMES = [
  ["tidepool", "Tidepool (pixel)"],
  ["hexlight", "Hexlight (pixel)"],
  ["solarized-dark", "Solarized Dark"],
  ["solarized-light", "Solarized Light"],
  ["parchment", "Parchment"],
];

// The theme is saved per character (char.settings.theme), so each character
// keeps its own look. localStorage only holds the *last* theme seen, as a
// best-guess to paint before this character's data has loaded (see the inline
// script in index.html) — it's corrected here as soon as char is available.
function setupTheme() {
  const picker = $("#theme-picker");
  picker.innerHTML = THEMES.map(([id, label]) => `<option value="${id}">${label}</option>`).join("");
  if (!THEMES.some(([id]) => id === char.settings.theme)) char.settings.theme = THEMES[0][0];
  document.documentElement.dataset.theme = char.settings.theme;
  try { localStorage.setItem("theme", char.settings.theme); } catch {}
  picker.value = char.settings.theme;
  picker.addEventListener("change", () => {
    char.settings.theme = picker.value;
    document.documentElement.dataset.theme = picker.value;
    try { localStorage.setItem("theme", picker.value); } catch {}
    changed();
  });
}

// ---------------------------------------------------------------- tabs
function showTab(hash) {
  let [name, ...rest] = hash.split("/");
  if (!$(`#tab-${name}`)) name = "sheet";
  for (const p of $$(".tab-panel")) p.hidden = p.id !== `tab-${name}`;
  for (const t of $$(".tab")) t.classList.toggle("active", t.dataset.tab === name);
  if (name === "turn") {
    bindAll();
    renderTurn();
    loadTurnLog();
  }
  if (name === "notes") {
    loadNoteList();
    const file = decodeURIComponent(rest.join("/"));
    if (file && file !== currentNote) openNote(file);
  }
  const want = name === "notes" && currentNote ? `#notes/${encodeURIComponent(currentNote)}` : "#" + name;
  if (location.hash !== want && !(name === "notes" && rest.length)) history.replaceState(null, "", want);
}

// ---------------------------------------------------------------- session notes
let notes = [];
let currentNote = null;

const saveNote = debounce(async (file, content) => {
  try {
    await DB.saveNote(UID, CHAR_ID, file, content);
    status("Note saved", "ok");
    loadNoteList();
  } catch (e) {
    status("Note save failed: " + e.message, "err");
  }
}, 600);

async function loadNoteList() {
  try {
    notes = await DB.listNotes(UID, CHAR_ID);
  } catch (e) {
    return status("Couldn't load notes: " + e.message, "err");
  }
  notes.sort((a, b) =>
    String(b.date).localeCompare(String(a.date)) || num(b.session) - num(a.session) || b.mtime - a.mtime);
  renderNoteList();
}

function renderNoteList() {
  const q = $("#note-filter").value.toLowerCase();
  const ul = $("#note-list");
  ul.replaceChildren();
  for (const n of notes) {
    if (q && !`${n.title} ${n.file} ${n.date}`.toLowerCase().includes(q)) continue;
    const li = document.createElement("li");
    li.className = n.file === currentNote ? "active" : "";
    li.innerHTML = `<span class="note-title"></span><span class="note-date muted"></span>`;
    $(".note-title", li).textContent = n.title;
    $(".note-date", li).textContent = [n.session && `#${n.session}`, n.date].filter(Boolean).join(" · ");
    li.addEventListener("click", () => openNote(n.file));
    ul.append(li);
  }
  if (!ul.children.length) ul.innerHTML = `<li class="muted empty">No sessions yet</li>`;
}

async function openNote(file) {
  saveNote.flush();
  try {
    const { content } = await DB.getNote(UID, CHAR_ID, file);
    currentNote = file;
    history.replaceState(null, "", `#notes/${encodeURIComponent(file)}`);
    $("#note-empty").hidden = true;
    $("#note-editor").hidden = false;
    $("#note-file").textContent = file;
    $("#note-text").value = content;
    renderPreview();
    renderNoteList();
  } catch (e) {
    status("Couldn't open note: " + e.message, "err");
  }
}

function renderPreview() {
  $("#note-preview").innerHTML = renderMarkdown($("#note-text").value);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Creates the next numbered session note from the template and returns
// { file, content }. Doesn't open it.
async function createSessionNote() {
  await loadNoteList();
  const n = Math.max(0, ...notes.map((x) => num(x.session))) + 1;
  const date = today();
  const file = `${date} Session ${n}.md`;
  const who = char.name ? `\ncharacter: "[[${char.name}]]"` : "";
  const content = `---
session: ${n}
date: ${date}
title: Session ${n}${who}
tags:
  - dnd
  - session
---
# Session ${n}

## Recap
-

## What happened
-

## NPCs
-

## Loot & XP
-

## Open threads
- [ ]
`;
  await DB.createNote(UID, CHAR_ID, file, content);
  await loadNoteList();
  return { file, content };
}

async function newNote() {
  try {
    const { file, content } = await createSessionNote();
    await openNote(file);
    const ta = $("#note-text");
    ta.focus();
    const pos = content.indexOf("## Recap\n- ") + "## Recap\n- ".length;
    ta.setSelectionRange(pos, pos);
  } catch (e) {
    status("Couldn't create note: " + e.message, "err");
  }
}

function setupNotes() {
  $("#btn-new-note").addEventListener("click", newNote);
  $("#note-filter").addEventListener("input", renderNoteList);
  $("#note-text").addEventListener("input", () => {
    renderPreview();
    status("Saving…");
    saveNote(currentNote, $("#note-text").value);
  });
  // Tab inserts two spaces instead of leaving the editor (handy for nested lists).
  $("#note-text").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    document.execCommand("insertText", false, "  ");
  });
  $("#btn-delete-note").addEventListener("click", async () => {
    if (!currentNote) return;
    if (!(await confirmDialog(`Delete "${currentNote}"? This permanently removes the note.`))) return;
    try {
      saveNote.flush();
      await DB.deleteNote(UID, CHAR_ID, currentNote);
      currentNote = null;
      history.replaceState(null, "", "#notes");
      $("#note-editor").hidden = true;
      $("#note-empty").hidden = false;
      loadNoteList();
    } catch (e) {
      status("Delete failed: " + e.message, "err");
    }
  });
  for (const b of $$(".seg button")) {
    b.addEventListener("click", () => {
      for (const o of $$(".seg button")) o.classList.toggle("active", o === b);
      $(".note-panes").className = "note-panes " + b.dataset.view;
      if (b.dataset.view !== "preview") $("#note-text").focus();
    });
  }
}

// ---------------------------------------------------------------- characters
// Each character is its own file on the server with its own session notes.
// Which one is open comes from ?c=<id>, else the last one opened in this browser,
// else the most recently edited. Switching characters reloads the page.
let UID = null;
let CHAR_ID = null;
let characters = [];

async function pickCharacter() {
  characters = await DB.listCharacters(UID);
  let id = new URLSearchParams(location.search).get("c");
  if (!characters.some((c) => c.id === id)) {
    try { id = localStorage.getItem("character"); } catch {}
  }
  if (!characters.some((c) => c.id === id)) {
    id = [...characters].sort((a, b) => b.mtime - a.mtime)[0]?.id;
  }
  if (!id) {
    id = (await DB.createCharacter(UID, DEFAULT_CHARACTER())).id;
    characters = await DB.listCharacters(UID);
  }
  CHAR_ID = id;
  try { localStorage.setItem("character", id); } catch {}
  const url = new URL(location.href);
  url.searchParams.set("c", id);
  history.replaceState(null, "", url);
}

async function openCharacter(id, hash = location.hash) {
  await Promise.all([saveCharacter.flush(), saveNote.flush()]);
  try { localStorage.setItem("character", id); } catch {}
  const url = new URL(location.href);
  url.searchParams.set("c", id);
  url.hash = hash;
  location.href = url.toString();
}

function renderCharacterMenu() {
  const menu = $("#char-menu");
  menu.replaceChildren();
  const current = characters.find((c) => c.id === CHAR_ID);
  if (current) Object.assign(current, { name: char.name, class: char.class, level: char.level });
  const label = (c) => c.name?.trim() || "Unnamed character";
  const sub = (c) => [String(c.class || "").trim(), c.level && `Lv ${c.level}`].filter(Boolean).join(" · ");

  for (const c of [...characters].sort((a, b) => label(a).localeCompare(label(b)))) {
    const item = document.createElement("button");
    item.className = "char-item" + (c.id === CHAR_ID ? " current" : "");
    item.setAttribute("role", "menuitem");
    item.innerHTML = `<span class="char-item-name"></span><span class="char-item-sub muted"></span>`;
    $(".char-item-name", item).textContent = label(c);
    $(".char-item-sub", item).textContent = sub(c);
    item.addEventListener("click", () => (c.id === CHAR_ID ? closeCharacterMenu() : openCharacter(c.id)));
    menu.append(item);
  }
  const sep = document.createElement("hr");
  const add = document.createElement("button");
  add.className = "char-action";
  add.textContent = "+ New character";
  // Ask for the name first: it becomes the character's id and notes folder name.
  add.addEventListener("click", (e) => {
    e.stopPropagation();
    const form = document.createElement("form");
    form.className = "char-new";
    form.innerHTML = `<input placeholder="New character's name" required><button class="primary">Create</button>`;
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = $("input", form).value.trim();
      if (!name) return;
      const { id } = await DB.createCharacter(UID, { ...DEFAULT_CHARACTER(), name });
      openCharacter(id, "#sheet");
    });
    add.replaceWith(form);
    $("input", form).focus();
  });
  const del = document.createElement("button");
  del.className = "char-action danger";
  del.textContent = `Delete ${label(current || {})}…`;
  del.addEventListener("click", async () => {
    closeCharacterMenu();
    const ok = await confirmDialog(`Delete ${label(current || {})}? Their sheet and session notes are moved to trash, not erased.`);
    if (!ok) return;
    saveCharacter.flush(); // no-op if nothing pending
    await DB.deleteCharacter(UID, CHAR_ID);
    const next = characters.find((c) => c.id !== CHAR_ID);
    if (next) return openCharacter(next.id, "#sheet");
    try { localStorage.removeItem("character"); } catch {}
    location.href = location.pathname + "#sheet"; // no characters left: a fresh one is created
  });
  menu.append(sep, add, del);
}

function closeCharacterMenu() {
  $("#char-menu").hidden = true;
  $("#char-menu-btn").setAttribute("aria-expanded", "false");
}

function setupCharacterMenu() {
  const btn = $("#char-menu-btn");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = $("#char-menu");
    if (!menu.hidden) return closeCharacterMenu();
    renderCharacterMenu();
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".char-menu")) closeCharacterMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCharacterMenu(); });
}

// ---------------------------------------------------------------- boot
async function init() {
  buildStatic();
  try {
    await pickCharacter();
    const saved = await DB.getCharacter(UID, CHAR_ID);
    lastSynced = JSON.stringify(saved);
    if (saved) char = deepMerge(DEFAULT_CHARACTER(), saved);
  } catch (e) {
    status("Couldn't load character: " + e.message, "err");
  }
  // Feats and class features used to be free-text boxes; keep old text as an entry.
  if (!Array.isArray(char.feats)) {
    const old = String(char.feats || "").trim();
    char.feats = old ? [{ name: "Feats", type: "Other", desc: old }] : [];
  }
  if (!Array.isArray(char.features)) {
    const old = String(char.features || "").trim();
    char.features = old ? [{ name: "Class features", source: "", level: "", desc: old }] : [];
  }
  if (ensureAutoResources()) saveCharacter();
  for (const sp of char.spells) {
    if (sp.level === 0 || sp.level === "0") sp.level = "C";
    else if (typeof sp.level === "number") sp.level = String(sp.level);
  }
  if (!Array.isArray(char.speciesTraits)) {
    const old = String(char.speciesTraits || "").trim();
    char.speciesTraits = old ? [{ name: "Species traits", source: "", desc: old }] : [];
  }
  bindAll();
  paintSkillPips();
  renderSlots();
  renderDeathSaves();
  renderExhaustion();
  renderResources();
  renderAllEntries();
  renderLanguages();
  setupTheme();
  setupCharacterMenu();
  $("#btn-settings").addEventListener("click", () => $("#settings-dialog").showModal());
  for (const name of Object.keys(LISTS)) renderList(name);
  setupHp();
  setupNotes();
  setupTurn();
  setupUndo();
  recalc();

  for (const t of $$(".tab")) t.addEventListener("click", () => showTab(t.dataset.tab));
  window.addEventListener("hashchange", () => showTab(location.hash.slice(1)));
  showTab(location.hash.slice(1) || "sheet");

  window.addEventListener("beforeunload", (e) => {
    if (saveCharacter.pending() || saveNote.pending()) {
      saveCharacter.flush();
      saveNote.flush();
      e.preventDefault();
    }
  });
}

// ---------------------------------------------------------------- sign-in
function setupLoginForm() {
  const phoneForm = $("#login-phone-form");
  const codeForm = $("#login-code-form");
  const errEl = $("#login-error");

  phoneForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    try {
      await Auth.sendCode($("#login-phone").value.trim());
      phoneForm.hidden = true;
      codeForm.hidden = false;
      $("#login-code").focus();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  codeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    try {
      await Auth.confirmCode($("#login-code").value.trim());
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  // Reload rather than tearing down in-page state: init() wires up event
  // listeners once and isn't designed to run twice in the same page load.
  $("#btn-sign-out").addEventListener("click", async () => {
    await Promise.all([saveCharacter.flush(), saveNote.flush()]);
    await Auth.signOut();
    location.reload();
  });
}

setupLoginForm();
Auth.onReady((user) => {
  document.body.classList.toggle("signed-in", !!user);
  if (!user) return;
  UID = user.uid;
  init();
});
