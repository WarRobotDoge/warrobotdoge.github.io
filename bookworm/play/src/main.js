// main.js - boot, input and the frame loop.

import { Assets } from './assets.js';
import { loadFonts } from './bitmapfont.js';
import { Dictionary } from './dictionary.js';
import { Audio } from './audio.js';
import { Profile } from './profile.js';
import { Game, State } from './game.js';
import { Renderer, LAYOUT, W, H } from './render.js';

const IMAGES = {
  uiTop: 'art/board/ui_top.png',
  uiBottom: 'art/board/ui_bottom.png',
  tileBasic: 'art/tiles/tile_basic.png',
  tile_amethyst: 'art/tiles/tile_amethyst.png',
  tile_emerald: 'art/tiles/tile_emerald.png',
  tile_sapphire: 'art/tiles/tile_saphire.png',   // the original spells it this way
  tileLocked: 'art/tiles/overlay_locked.png',
  heartSmall: 'art/board/heart_small.png',
  buttonAttack: 'art/board/button_attack.png',
  buttonScramble: 'art/board/button_scramble.png',
  lex: 'art/portraits/portrait_lex.png',
  foe_ratking: 'art/portraits/portrait_ratking.png',
  foe_hamlet: 'art/portraits/portrait_hamlet.png',
  foe_odin: 'art/portraits/portrait_odin.png',
  foe_librarian: 'art/portraits/portrait_librarian.png',
  impactLarge: 'art/characters/impact_lrg.png',
  arena1: 'art/arenas/Book1/library-1.png',
  arena2: 'art/arenas/Book1/library-2.png',
  arena3: 'art/arenas/Book1/library-3.png',
  arena4: 'art/arenas/Book1/library-4.png',
};

const input = {
  hover: -1,
  pressed: null,
  buttons: [
    {
      id: 'attack', label: 'Attack', image: 'buttonAttack',
      x: 320 - 79, y: LAYOUT.ledge.y, w: 158, h: 39,
      enabled: (g, s) => g.canAct() && s.valid,
      action: (g) => g.attack(),
    },
    {
      id: 'scramble', label: 'Scramble', image: 'buttonScramble',
      x: 112, y: LAYOUT.ledge.y, w: 118, h: 39,
      enabled: (g) => g.canAct(),
      action: (g) => g.scramble(),
    },
    {
      id: 'clear', label: 'Clear', image: null,
      x: 406, y: LAYOUT.ledge.y, w: 104, h: 39,
      enabled: (g) => g.canAct() && g.grid.selection.length > 0,
      action: (g) => g.clear(),
    },
  ],
};

function setStatus(text, detail) {
  const el = document.getElementById('status');
  if (el) el.innerHTML = text + (detail ? `<span>${detail}</span>` : '');
}

function tileIndexAt(px, py) {
  const L = LAYOUT.grid;
  const col = Math.floor((px - L.x) / L.pitchX);
  const row = Math.floor((py - L.y) / L.pitchY);
  if (col < 0 || col > 3 || row < 0 || row > 3) return -1;
  if ((px - L.x) % L.pitchX > L.tile || (py - L.y) % L.pitchY > L.tile) return -1;
  return row * 4 + col;
}

function potionSlotAt(px, py) {
  const y = LAYOUT.ledge.y + 3;
  if (py < y || py > y + 26) return null;
  const i = Math.floor((px - 528) / 22);
  return i >= 0 && i < 3 ? ['health', 'attack', 'purify'][i] : null;
}

function buttonAt(px, py) {
  for (const b of input.buttons) {
    if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) return b;
  }
  return null;
}

async function boot() {
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  setStatus('Loading art');
  await Assets.loadImages(IMAGES, (done, total) => setStatus('Loading art', `${done} / ${total}`));

  setStatus('Loading fonts');
  const fonts = await loadFonts(await Assets.json('data/fonts.json'), Assets);

  setStatus('Loading game data');
  const cfg = await Assets.json('data/game.json');
  if (!cfg) {
    setStatus('Missing data/game.json',
      'run: python3 tools/extract_gamedata.py "&lt;game folder&gt;" .');
    return;
  }

  setStatus('Loading dictionary');
  const dict = await Dictionary.load(Assets);

  const profile = Profile.load();
  const audio = new Audio();
  audio.enabled = profile.settings.sound !== false;
  audio.volume = profile.settings.volume;

  const game = new Game(cfg, dict, audio, { difficulty: profile.settings.difficulty });
  let resumed = false;
  if (profile.save) resumed = game.restore(profile.save);

  const renderer = new Renderer(ctx, Assets, fonts);

  const missingArt = Assets.missing.filter((p) => p.startsWith('art/')).length;
  const notes = [];
  if (!dict) notes.push('no dictionary - every word will be rejected');
  if (missingArt) notes.push(`${missingArt} art files missing`);
  if (resumed) notes.push('resumed your last run');
  setStatus(
    dict ? `${dict.size.toLocaleString()} words - ${cfg.difficulties[game.difficulty]}` : 'Ready',
    notes.length ? notes.join(' | ') : 'click a tile or just type',
  );

  // --- autosave ------------------------------------------------------------

  let lastState = game.state;
  function checkPersistence() {
    if (game.state === lastState) return;
    if (game.state === State.DEFEAT || game.state === State.RUN_COMPLETE) {
      profile.recordRun(game, game.state === State.RUN_COMPLETE);
    } else if (lastState === State.VICTORY || lastState === State.CHAPTER_END) {
      profile.autosave(game);      // checkpoint after every fight
    }
    lastState = game.state;
  }

  // --- input ---------------------------------------------------------------

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (W / r.width),
      y: (e.clientY - r.top) * (H / r.height),
    };
  }

  canvas.addEventListener('mousemove', (e) => {
    const p = toCanvas(e);
    const b = buttonAt(p.x, p.y);
    input.hover = b ? b.id : tileIndexAt(p.x, p.y);
    const overPotion = potionSlotAt(p.x, p.y);
    canvas.style.cursor = (b && b.enabled(game, game.score)) || input.hover >= 0 || overPotion
      ? 'pointer' : 'default';
  });

  canvas.addEventListener('mouseleave', () => { input.hover = -1; });

  canvas.addEventListener('mousedown', (e) => {
    audio.resume();
    const p = toCanvas(e);
    const b = buttonAt(p.x, p.y);
    if (b) { input.pressed = b.id; return; }
    const potion = potionSlotAt(p.x, p.y);
    if (potion) { game.usePotion(potion); return; }
    const i = tileIndexAt(p.x, p.y);
    if (i >= 0) game.clickTile(i);
    else if (game.state === State.DEFEAT || game.state === State.RUN_COMPLETE) restart();
  });

  window.addEventListener('mouseup', (e) => {
    if (!input.pressed) return;
    const p = toCanvas(e);
    const b = buttonAt(p.x, p.y);
    if (b && b.id === input.pressed && b.enabled(game, game.score)) b.action(game);
    input.pressed = null;
  });

  function restart(difficulty) {
    profile.clearSave();
    game.restart(difficulty);
    lastState = game.state;
    setStatus(`${dict ? dict.size.toLocaleString() + ' words' : 'Ready'} - ${cfg.difficulties[game.difficulty]}`,
      'new run');
  }

  window.addEventListener('keydown', (e) => {
    audio.resume();
    const over = game.state === State.DEFEAT || game.state === State.RUN_COMPLETE;

    if (e.key === 'Enter') {
      if (over) restart(); else game.attack();
      e.preventDefault();
    } else if (e.key === 'Backspace') {
      game.backspace();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      game.clear();
    } else if (e.key === ' ') {
      game.scramble();
      e.preventDefault();
    } else if (e.key === '1') {
      game.usePotion('health');
    } else if (e.key === '2') {
      game.usePotion('attack');
    } else if (e.key === '3') {
      game.usePotion('purify');
    } else if (e.key === 'Tab') {
      // cycle difficulty; only meaningful between runs
      const next = (game.difficulty + 1) % cfg.difficulties.length;
      profile.setSetting('difficulty', next);
      restart(next);
      e.preventDefault();
    } else if (e.key === 'm' || e.key === 'M') {
      audio.enabled = !audio.enabled;
      profile.setSetting('sound', audio.enabled);
      setStatus(audio.enabled ? 'sound on' : 'sound off');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      game.typeLetter(e.key);
    }
  });

  // --- integer scaling -----------------------------------------------------

  const frameEl = document.getElementById('frame');
  const stage = document.getElementById('stage');
  function fit() {
    const availW = window.innerWidth * 0.96;
    const availH = window.innerHeight - 96;
    const scale = Math.max(1, Math.floor(Math.min(availW / W, availH / H)));
    frameEl.style.transform = `scale(${scale})`;
    stage.style.height = `${H * scale}px`;
  }
  window.addEventListener('resize', fit);
  fit();

  // --- loop ----------------------------------------------------------------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    checkPersistence();
    renderer.draw(game, input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.game = game;
  window.profile = profile;
}

boot().catch((e) => {
  setStatus('Failed to start', String(e && e.message ? e.message : e));
  console.error(e);
});
