// Pixel-art sprites for the Tidepool theme, drawn from ASCII grids at load time.
// Each character in a grid is one pixel; "." is transparent. Sprites are exposed
// to CSS as --sprite-<name> custom properties, and window.fx() plays little
// effects (floating notes, hearts, shakes) when the Tidepool theme is active.
(function () {
  const PAL = {
    // mermaid
    h: "#ff6b8b", H: "#c94470", s: "#ffd3b0", p: "#ff9fb0", e: "#1b1e3c",
    k: "#c9a0ff", t: "#3fd0b0", T: "#1f8f86", f: "#8ff5dc",
    // bubbles
    b: "#9fe8ff", w: "#ffffff", l: "#cff5ff",
    // seaweed
    g: "#3fbf6f", G: "#2a8a55", L: "#7ee081",
    // clownfish
    y: "#ffb347", Y: "#e0782a",
    // crab
    r: "#ff5d73", R: "#c23a50",
    // icons
    o: "#ffd166", O: "#fff1a8", a: "#ff8fab", c: "#5ee6c4",
    m: "#c9a0ff", n: "#ffd166",
    d: "#7a4a2a", D: "#b06e3c",
    u: "#3d6fb6", U: "#5b9bd5", q: "#f3e3c3",
    z: "#ffb3c7", Z: "#ff8fab",
    // hexlight (spooky purple warlock)
    v: "#a855f7", V: "#4c1d95", i: "#e2c6ff", x: "#f5eaff", j: "#150a20",
  };

  const GRIDS = {
    mermaid: [
      ".....HHHH.......",
      "....HhhhhH......",
      "...Hhsssssh.....",
      "...hhsesesh.....",
      "...hhpsssph.....",
      "..hhh.sss.hh....",
      "..hh.sssss.h....",
      "..h.sskkkss.....",
      "...ss.sss.ss....",
      "......ttt.......",
      "......tttt......",
      ".......tTtt.....",
      ".......ttTtt....",
      "........ttTt....",
      ".........tttt...",
      "..........tt....",
      "........ff.ff...",
      ".......fff..fff.",
    ],
    bubble: [
      "..bbb..",
      ".bwl.b.",
      "bwl...b",
      "bl....b",
      "b.....b",
      ".b...b.",
      "..bbb..",
    ],
    fish: [
      "....yyy...",
      "y..yywyyy.",
      "yyyyywyyey",
      "Y..yywyyy.",
      "....YYY...",
    ],
    crabA: [
      "rr.......rr",
      "r.r.....r.r",
      ".r.e...e.r.",
      "..rrrrrrr..",
      ".rrrrrrrrr.",
      ".R.R...R.R.",
    ],
    crabB: [
      "rr.......rr",
      "r.r.....r.r",
      ".r.e...e.r.",
      "..rrrrrrr..",
      ".rrrrrrrrr.",
      "R.R.....R.R",
    ],
    // tab icons
    shield: [
      "ooooooooo",
      "oaaaoccco",
      "oaaaoccco",
      "oaaaoccco",
      "ooooooooo",
      "occcoaaao",
      ".occoaao.",
      "..occao..",
      "...ooo...",
    ],
    sparkle: [
      "....m....",
      "....m....",
      "...mmm...",
      "..mmwmm..",
      "mmmwwwmmm",
      "..mmwmm..",
      "...mmm...",
      "....m....",
      "....m....",
    ],
    chest: [
      ".ddddddd.",
      "dDDDDDDDd",
      "dDDDDDDDd",
      "ooooOoooo",
      "dDDDODDDd",
      "dDDDDDDDd",
      "dDDDDDDDd",
      "ooooooooo",
    ],
    book: [
      ".uuuuuuu.",
      "uUUUUUUUq",
      "uUUoooUUq",
      "uUUUUUUUq",
      "uUUooUUUq",
      "uUUUUUUUq",
      "uUUUUUUUq",
      ".qqqqqqqq",
    ],
    shell: [
      "...zzz...",
      ".zZzZzZz.",
      "zZzZzZzZz",
      "zZzZzZzZz",
      ".zZzZzZz.",
      "..zZzZz..",
      "...zzz...",
      "..zz.zz..",
    ],
    note: [
      "...nnn.",
      "...n.nn",
      "...n..n",
      "...n...",
      "...n...",
      ".nnn...",
      "nnnn...",
      ".nn....",
    ],
    heart: [
      ".rr.rr.",
      "rwrrrrr",
      "rrrrrrr",
      ".rrrrr.",
      "..rrr..",
      "...r...",
    ],
    star: [
      "...o...",
      "...o...",
      ".ooOoo.",
      "ooOOOoo",
      ".ooOoo.",
      "...o...",
      "...o...",
    ],
    // ---- hexlight tab icons ----
    tome: [
      ".VVVVVVV.",
      "VvvvvvvvV",
      "VvvOOOvvV",
      "VvvvvvvvV",
      "VvvOOvvvV",
      "VvvvvvvvV",
      "VvvvvvvvV",
      ".xxxxxxxx",
    ],
    eye: [
      "....v....",
      "...vvv...",
      "..vxxxv..",
      ".vxjOjxv.",
      "vxxjOjxxv",
      ".vxjOjxv.",
      "..vxxxv..",
      "...vvv...",
      "....v....",
    ],
    satchel: [
      ".VVVVVVV.",
      "VvvvvvvvV",
      "VvvvvvvvV",
      "OOOOoOOOO",
      "VvvvOvvvV",
      "VvvvvvvvV",
      "VvvvvvvvV",
      "OOOOOOOOO",
    ],
    raven: [
      "....jj...",
      "...jjjj..",
      "..jjjjjj.",
      ".jjjjjjjj",
      "jjjjjjjj.",
      "j.jj..jj.",
      "...jj....",
      "..j..j...",
    ],
    // ---- hexlight scenery ----
    // Little carrots (Siggi's a rabbit), planted along the ground. Two frames
    // give the leafy top a gentle wiggle, the same trick as Tidepool's weed.
    carrotA: [
      "..LgL..",
      ".gLgLg.",
      "..ggg..",
      ".yyyyy.",
      ".yYyYy.",
      ".yyyyy.",
      "..yYy..",
      "..yyy..",
      "...y...",
      "...y...",
    ],
    carrotB: [
      ".LgL...",
      ".gLgLg.",
      "..ggg..",
      ".yyyyy.",
      ".yYyYy.",
      ".yyyyy.",
      "..yYy..",
      "..yyy..",
      "...y...",
      "...y...",
    ],
    wisp: [
      "..vvv..",
      ".vxi.v.",
      "vxi...v",
      "vi....v",
      "v.....v",
      ".v...v.",
      "..vvv..",
    ],
    batA: [
      "j.j...j.j",
      ".jjj.jjj.",
      "..jjjjj..",
      "...jjj...",
      "....j....",
    ],
    batB: [
      "..j...j..",
      ".jj.j.jj.",
      "jjjjjjjjj",
      ".j.....j.",
      ".........",
    ],
    // ---- corporate card (currency setting, theme-agnostic) ----
    card: [
      "uuuuuuuuuuuuuuuu",
      "uUUUUUUUUUUUUUUu",
      "ueeeeeeeeeeeeeeu",
      "uUUUUUUUUUUUUUUu",
      "uUqqUUUUUUUUUUUu",
      "uUqqUUUUUwwUUwwu",
      "uUUUUUUUUUUUUUUu",
      "uUUUUUUUUUUUUUUu",
      "uUUUUUUUUUUUUUUu",
      "uuuuuuuuuuuuuuuu",
    ],
  };

  // The topbar mascot (an emo rabbit — Siggi is a mopey harengon warlock) and
  // the moon are generated from math rather than hand-drawn grids, so their
  // geometry is guaranteed clean: a filled-circle head, a straight ear, and a
  // long floppy "bangs" ear drawn as a thick line sweeping over one eye.
  function rabbitGrid() {
    const W = 15, H = 17, cx = 7, cy = 10, r = 5.4;
    const grid = Array.from({ length: H }, () => Array(W).fill("."));
    const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = c; };
    const seg = (x0, y0, x1, y1, c, thick = 1) => {
      for (let s = 0; s <= 30; s++) {
        const t = s / 30, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
        for (let o = -Math.floor(thick / 2); o <= Math.floor(thick / 2); o++) set(Math.round(px + o), Math.round(py), c);
      }
    };
    // head
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) set(x, y, d > r - 1.1 ? "j" : "x");
      }
    }
    // straight ear, standing tall on one side
    for (let y = 0; y <= cy - r + 1; y++) { set(cx + 2, y, "j"); set(cx + 3, y, "x"); set(cx + 4, y, "j"); }
    // floppy "emo bangs" ear, swept diagonally over the other eye
    seg(cx - 2, 0, cx + 1, cy - 1, "j", 2);
    // one visible eye, a tired little smudge under it, and a flat unimpressed mouth
    set(cx + 2, cy - 1, "j");
    set(cx + 2, cy, "v");
    seg(cx - 1, cy + 2, cx + 1, cy + 2, "j", 1);
    return grid.map((r) => r.join(""));
  }
  function moonGrid() {
    const N = 11, R = 5, C = 5;
    const grid = Array.from({ length: N }, () => Array(N).fill("."));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const d = Math.hypot(x - C, y - C);
        if (d <= R) grid[y][x] = d > R - 1.3 ? "i" : "x";
      }
    }
    for (const [x, y] of [[3, 4], [7, 3], [5, 7], [6, 6]]) {
      if (grid[y]?.[x] && grid[y][x] !== ".") grid[y][x] = "V";
    }
    return grid.map((r) => r.join(""));
  }
  GRIDS.rabbit = rabbitGrid();
  GRIDS.moon = moonGrid();

  // Seaweed is generated rather than hand-drawn: two strands that follow a sine
  // curve. Shifting the phase gives the second animation frame.
  function seaweedGrid(phase) {
    const W = 12, H = 34;
    const grid = Array.from({ length: H }, () => Array(W).fill("."));
    const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = c; };
    const strands = [
      { base: 3.5, len: 34, amp: 1.4, ph: 0 },
      { base: 7.5, len: 25, amp: 1.2, ph: 1.7 },
    ];
    for (const s of strands) {
      for (let i = 0; i < s.len; i++) {
        const y = H - 1 - i;
        const x = Math.round(s.base + s.amp * Math.sin(i / 4.5 + s.ph + phase * (i / s.len)));
        const shade = Math.floor(i / 3) % 2 ? "g" : "G";
        set(x, y, shade);
        if (i < s.len - 5) set(x + 1, y, shade === "g" ? "G" : "g");
        if (i % 7 === 4) set(x + 2, y, "L");
        if (i % 7 === 1 && i > 3) set(x - 1, y, "L");
      }
    }
    return grid.map((r) => r.join(""));
  }
  GRIDS.weedA = seaweedGrid(0);
  GRIDS.weedB = seaweedGrid(1.1);

  function draw(grid, scale) {
    const h = grid.length, w = Math.max(...grid.map((r) => r.length));
    const c = document.createElement("canvas");
    c.width = w * scale;
    c.height = h * scale;
    const ctx = c.getContext("2d");
    grid.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === "." || !PAL[ch]) return;
        ctx.fillStyle = PAL[ch];
        ctx.fillRect(x * scale, y * scale, scale, scale);
      });
    });
    return { url: c.toDataURL(), w: w * scale, h: h * scale };
  }

  const SCALES = {
    mermaid: 2, bubble: 3, fish: 4, crabA: 4, crabB: 4, weedA: 4, weedB: 4,
    shield: 2, sparkle: 2, chest: 2, book: 2, shell: 2, note: 3, heart: 3, star: 3,
    tome: 2, eye: 2, satchel: 2, raven: 2, carrotA: 4, carrotB: 4, wisp: 3,
    batA: 4, batB: 4, rabbit: 2, moon: 6, card: 3,
  };
  const sprites = {};
  const root = document.documentElement.style;
  for (const [name, grid] of Object.entries(GRIDS)) {
    const s = draw(grid, SCALES[name] || 2);
    sprites[name] = s;
    root.setProperty(`--sprite-${name}`, `url("${s.url}")`);
    root.setProperty(`--sprite-${name}-w`, `${s.w}px`);
    root.setProperty(`--sprite-${name}-h`, `${s.h}px`);
  }

  // ------------------------------------------------------------- scenery
  function buildScenery() {
    const deco = document.createElement("div");
    deco.className = "deco";
    deco.setAttribute("aria-hidden", "true");
    const add = (cls, style = {}) => {
      const el = document.createElement("div");
      el.className = cls;
      Object.assign(el.style, style);
      deco.append(el);
      return el;
    };
    add("sand");
    for (const [left, scale] of [["2%", 1], ["7%", .75], ["88%", 1], ["94%", .8]]) {
      add("weed", { left, transform: `scale(${scale})` });
    }
    const rand = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 14; i++) {
      const size = [14, 21, 21, 28][i % 4];
      const dur = rand(14, 30);
      add("bubble", {
        left: `${rand(1, 98)}%`,
        width: `${size}px`, height: `${size}px`,
        animationDuration: `${dur}s`,
        animationDelay: `${-rand(0, dur)}s`,
      });
    }
    add("fish", { top: "38%", animationDelay: "-12s" });
    add("fish small", { top: "64%", animationDelay: "-31s", animationDuration: "55s" });
    add("crab");
    document.body.prepend(deco);
  }

  function buildHexScenery() {
    const deco = document.createElement("div");
    deco.className = "deco-hex";
    deco.setAttribute("aria-hidden", "true");
    const add = (cls, style = {}) => {
      const el = document.createElement("div");
      el.className = cls;
      Object.assign(el.style, style);
      deco.append(el);
      return el;
    };
    add("fog");
    add("moon");
    for (const [left, scale] of [["4%", 1], ["92%", .85]]) {
      add("carrot", { left, transform: `scale(${scale})` });
    }
    const rand = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 10; i++) {
      const size = [10, 16, 16, 22][i % 4];
      const dur = rand(16, 30);
      add("wisp", {
        left: `${rand(1, 98)}%`,
        width: `${size}px`, height: `${size}px`,
        animationDuration: `${dur}s`,
        animationDelay: `${-rand(0, dur)}s`,
      });
    }
    add("bat", { top: "22%", animationDelay: "-9s" });
    document.body.prepend(deco);
  }

  // ------------------------------------------------------------- effects
  const PIXEL_THEMES = ["tidepool", "hexlight"];
  const pixelTheme = () => PIXEL_THEMES.includes(document.documentElement.dataset.theme);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function floatUp(anchor, name, count = 1) {
    const r = anchor.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const img = document.createElement("img");
      img.src = sprites[name].url;
      img.className = "fx-float";
      img.alt = "";
      img.style.left = `${r.left + r.width / 2 - sprites[name].w / 2 + (i - (count - 1) / 2) * 18}px`;
      img.style.top = `${r.top - 4}px`;
      img.style.animationDelay = `${i * 120}ms`;
      document.body.append(img);
      img.addEventListener("animationend", () => img.remove());
    }
  }

  window.fx = function (kind, anchor) {
    if (!pixelTheme() || reduced() || !anchor) return;
    if (kind === "hurt") {
      anchor.classList.remove("fx-shake");
      void anchor.offsetWidth;
      anchor.classList.add("fx-shake");
    } else if (kind === "heal") floatUp(anchor, "heart", 3);
    else if (kind === "note") floatUp(anchor, "note", 2);
    else floatUp(anchor, "star", 2);
  };

  const buildAllScenery = () => { buildScenery(); buildHexScenery(); };
  if (document.body) buildAllScenery();
  else document.addEventListener("DOMContentLoaded", buildAllScenery);
})();
