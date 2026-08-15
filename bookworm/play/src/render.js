// render.js - draws the 640x480 board.
//
// Layout is measured off the original art. ui_bottom.png is the bookshelf
// panel: a scroll on the left, the shelf in the middle where the sixteen
// tiles sit, a curtain on the right, and a stone ledge along the bottom for
// the buttons. Everything checks whether its image loaded, so the whole
// screen still renders with no converted art at all.
//
// The job here is to make the systems legible: hearts rather than a number,
// what ailments are running on whom, which potions are in the bag, and which
// words this chapter pays extra for.

import { drawCel, cel } from './assets.js';
import { letterValue, scoreWord } from './combat.js';
import { State } from './game.js';

export const W = 640;
export const H = 480;

export const LAYOUT = {
  top: { x: 50, y: 0, w: 540, h: 35 },
  arena: { x: 50, y: 50, w: 540, h: 196 },
  bottom: { x: 50, y: 246, w: 540, h: 234 },
  grid: { x: 230, y: 257, pitchX: 43, pitchY: 46, tile: 44 },
  strip: { y: 36, h: 13 },
  scroll: { x: 62, y: 322, w: 152 },
  curtain: { x: 418, y: 286, w: 154 },
  ledge: { y: 441 },
  lex: { x: 92, y: 56 },
  foe: { x: 400, y: 56 },
  wordBar: { x: 320, y: 24, maxW: 290 },
};

const GOLD = '#f6d67a';
const PARCHMENT = '#f2e4c0';
const DIM = '#c9b892';
const INK = '#5a4526';

const AILMENT_COLOR = {
  poisoned: '#8fd06a', burning: '#ff8a4a', bleeding: '#e0555a',
  frozen: '#7fc4ff', stunned: '#ffe07a', petrified: '#b9b2a4',
  cursed: '#c98fff', shielded: '#7fd0c4', powered_up: '#ffd45e',
  invincible: '#ffffff',
};

export class Renderer {
  constructor(ctx, assets, fonts) {
    this.ctx = ctx;
    this.A = assets;
    this.F = fonts;
    this.tileCels = null;
  }

  font(name, fallbackSize = 12) {
    return this.F[name] || Object.values(this.F)[0]
      || { draw: () => {}, measure: () => 0, ok: false, fallbackSize };
  }

  // --- primitives ----------------------------------------------------------

  panel(x, y, w, h, fill = 'rgba(24,18,12,0.82)', stroke = 'rgba(246,214,122,0.35)') {
    const c = this.ctx;
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
    c.strokeStyle = stroke;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  /**
   * Health as a row of hearts, which is how the original shows it. Partial
   * hearts matter because word damage is fractional.
   */
  hearts(x, y, current, max, color) {
    const c = this.ctx;
    const per = 10;                    // hearts per row before wrapping
    const size = 11;
    const gap = 2;
    const whole = Math.max(1, Math.ceil(max));
    for (let i = 0; i < whole; i++) {
      const col = i % per;
      const row = Math.floor(i / per);
      const hx = x + col * (size + gap);
      const hy = y + row * (size + gap);
      const fill = Math.max(0, Math.min(1, current - i));
      const capacity = Math.max(0, Math.min(1, max - i));
      this.heart(hx, hy, size, fill, capacity, color);
    }
    return Math.ceil(whole / per) * (size + gap);
  }

  heart(x, y, s, fill, capacity, color) {
    const c = this.ctx;
    const img = this.A.images.heartSmall;
    c.save();
    // empty socket
    c.globalAlpha = capacity > 0 ? 0.28 : 0.12;
    if (img) c.drawImage(img, x, y, s, s);
    else this.heartPath(x, y, s, '#000000');
    c.globalAlpha = 1;
    if (fill > 0) {
      c.save();
      c.beginPath();
      c.rect(x, y, s * fill, s);
      c.clip();
      if (img) {
        c.drawImage(img, x, y, s, s);
      } else {
        this.heartPath(x, y, s, color);
      }
      c.restore();
    }
    c.restore();
  }

  heartPath(x, y, s, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    const cx = x + s / 2;
    c.moveTo(cx, y + s * 0.95);
    c.bezierCurveTo(x - s * 0.15, y + s * 0.55, x + s * 0.12, y - s * 0.12, cx, y + s * 0.28);
    c.bezierCurveTo(x + s * 0.88, y - s * 0.12, x + s * 1.15, y + s * 0.55, cx, y + s * 0.95);
    c.fill();
  }

  /** Small coloured chips showing which ailments are running, and for how long. */
  ailments(x, y, status, align = 'left') {
    if (!status.list.length) return 0;
    const c = this.ctx;
    const f = this.font('Humanst521BT10');
    let cx = x;
    const widths = status.list.map((i) => f.measure(`${i.label} ${i.turns}`) + 12);
    if (align === 'right') cx = x - widths.reduce((a, b) => a + b + 4, 0);
    status.list.forEach((inst, k) => {
      const w = widths[k];
      const col = AILMENT_COLOR[inst.id] || '#ffffff';
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillRect(cx, y - 9, w, 13);
      c.strokeStyle = col;
      c.globalAlpha = 0.8;
      c.strokeRect(cx + 0.5, y - 8.5, w - 1, 12);
      c.globalAlpha = 1;
      f.draw(c, `${inst.label} ${inst.turns}`, cx + 6, y, { color: col });
      cx += w + 4;
    });
    return 1;
  }

  // --- screen --------------------------------------------------------------

  draw(game, input) {
    const c = this.ctx;
    c.save();
    if (game.shake > 0) {
      const m = game.shake * 7;
      c.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    this.background(game);
    this.arena(game);
    this.topBar(game);
    this.bottomPanel(game);
    this.tiles(game, input);
    this.buttons(game, input);
    this.potions(game, input);
    this.floats(game);
    this.banner(game);
    this.overlay(game);
    c.restore();
  }

  background(game) {
    const c = this.ctx;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#241a12');
    g.addColorStop(1, '#0d0906');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const bg = this.A.images['arena' + game.chapter] || this.A.images.arena1;
    if (bg) c.drawImage(bg, LAYOUT.arena.x, LAYOUT.arena.y);
    else this.panel(LAYOUT.arena.x, LAYOUT.arena.y, LAYOUT.arena.w, LAYOUT.arena.h, '#1d2a33');
  }

  arena(game) {
    const c = this.ctx;
    const L = LAYOUT;

    this.combatant(L.lex.x, L.lex.y, this.A.images.lex, 'Lex',
      game.lex.hearts, game.lex.maxHearts, game.lexHit, '#ff5a6a', false, null, game.lex.status);

    const portrait = game.enemy.portrait ? this.A.images['foe_' + game.enemy.portrait] : null;
    this.combatant(L.foe.x, L.foe.y, portrait, game.enemy.name,
      game.enemy.hearts, game.enemy.maxHearts, game.enemyHit, '#ff5a6a', true,
      game.enemy, game.enemy.status);

    // rank, experience and difficulty live in the thin strip between the top
    // bar and the arena, so they cannot collide with the portrait stack
    const f = this.font('Humanst521BT10');
    const sy = L.strip.y + 10;
    f.draw(c, `${game.rank} - level ${game.level}`, 56, sy, { color: DIM });
    this.xpBar(300, L.strip.y + 3, 130, 7, game.xpProgress);
    f.draw(c, `chapter ${game.chapter}  -  ${game.difficultyName}`, 584, sy,
      { color: DIM, align: 'right' });
  }

  xpBar(x, y, w, h, frac) {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(x - 1, y - 1, w + 2, h + 2);
    c.fillStyle = '#2a2119';
    c.fillRect(x, y, w, h);
    const fw = Math.max(0, Math.min(1, frac)) * w;
    if (fw > 0) {
      const g = c.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#ffe08a');
      g.addColorStop(1, '#d9a326');
      c.fillStyle = g;
      c.fillRect(x, y, fw, h);
    }
    c.strokeStyle = 'rgba(246,214,122,0.4)';
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  combatant(x, y, image, name, hearts, maxHearts, hit, heartColor, isFoe, foeDef, status) {
    const c = this.ctx;
    const size = 132;

    c.save();
    if (hit > 0) c.translate((Math.random() - 0.5) * hit * 10, 0);

    if (image) {
      c.drawImage(image, x, y);
    } else {
      const g = c.createLinearGradient(x, y, x, y + size);
      g.addColorStop(0, isFoe ? '#5a2a2a' : '#2a4a2a');
      g.addColorStop(1, '#141014');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x + size / 2, y + 10);
      c.lineTo(x + size - 12, y + size - 16);
      c.lineTo(x + 12, y + size - 16);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(246,214,122,0.4)';
      c.stroke();
      this.font('Humanst521BT11Bold').draw(c, name.replace(' (Boss)', ''),
        x + size / 2, y + size / 2 + 6, { color: PARCHMENT, align: 'center' });
    }

    if (hit > 0) {
      const impact = this.A.images.impactLarge;
      if (impact) {
        c.globalAlpha = Math.min(1, hit * 2);
        c.drawImage(impact, x + size / 2 - impact.width / 2, y + size / 2 - impact.height / 2);
        c.globalAlpha = 1;
      } else {
        c.fillStyle = `rgba(255,120,90,${hit})`;
        c.fillRect(x, y, size, size);
      }
    }
    c.restore();

    let cy = y + size + 13;
    this.font('Humanst521BT11Bold').draw(c, name, x + size / 2, cy,
      { color: PARCHMENT, align: 'center' });

    cy += 6;
    const rows = this.hearts(x, cy, hearts, maxHearts, heartColor);
    this.font('Humanst521BT10').draw(c, `${hearts.toFixed(1)}/${maxHearts.toFixed(1)}`,
      x + size, cy + 10, { color: DIM, align: 'right' });

    // armour rides with the heart count; ailment chips get the line below,
    // otherwise the two collide whenever a creature has both
    if (foeDef && foeDef.armor) {
      this.font('Humanst521BT10').draw(c, `armour ${Math.round(foeDef.armor * 100)}%`,
        x, cy + 10, { color: DIM });
    }
    cy += rows + 12;
    if (status && status.list.length) this.ailments(x, cy, status);
  }

  topBar(game) {
    const c = this.ctx;
    const img = this.A.images.uiTop;
    if (img) c.drawImage(img, LAYOUT.top.x, LAYOUT.top.y);
    else this.panel(LAYOUT.top.x, LAYOUT.top.y, LAYOUT.top.w, LAYOUT.top.h);

    this.font('Optima16Bold').draw(c, String(game.xp), 205, 24, { color: GOLD, align: 'right' });

    const s = game.score;
    const word = s.word.toUpperCase();
    if (word) {
      const f = this.font('CooperBlack15');
      let scale = 1;
      const w = f.measure(word);
      if (w > LAYOUT.wordBar.maxW) scale = LAYOUT.wordBar.maxW / w;
      const color = s.valid ? (s.bonusWord ? '#ffd45e' : '#fff3c4')
        : (s.tooShort ? DIM : '#ff9a8a');
      f.draw(c, word, LAYOUT.wordBar.x, LAYOUT.wordBar.y, { color, align: 'center', scale });

      if (s.valid) {
        const tip = `${s.hearts.toFixed(2)} hearts`;
        this.font('Humanst521BT11Bold').draw(c, tip, 578, 20, { color: '#ffd45e', align: 'right' });
        const parts = [`${s.base} power`, `x${s.lengthMult.toFixed(2)} length`];
        if (s.gemBonus) parts.push(`+${Math.round(s.gemBonus * 100)}% gem`);
        if (s.bonusWord) parts.push('bonus word');
        if (s.buffMult !== 1) parts.push(`x${s.buffMult.toFixed(1)} buff`);
        this.font('Humanst521BT10').draw(c, parts.join('  '), 578, 31,
          { color: 'rgba(200,184,146,0.75)', align: 'right' });
      }
    } else {
      this.font('Humanst521BT11').draw(c, 'spell a word', LAYOUT.wordBar.x, LAYOUT.wordBar.y - 2,
        { color: 'rgba(200,184,146,0.55)', align: 'center' });
    }
  }

  bottomPanel(game) {
    const c = this.ctx;
    const img = this.A.images.uiBottom;
    if (img) c.drawImage(img, LAYOUT.bottom.x, LAYOUT.bottom.y);
    else this.panel(LAYOUT.bottom.x, LAYOUT.bottom.y, LAYOUT.bottom.w, LAYOUT.bottom.h);

    // left scroll: the art labels it Best Words, so that is what goes on it,
    // with the chapter's bonus words underneath as a hint sheet
    const fs = this.font('Humanst521BT10');
    let y = LAYOUT.scroll.y;
    if (!game.bestWords.length) {
      fs.draw(c, 'no words yet', LAYOUT.scroll.x + 6, y, { color: 'rgba(120,95,55,0.8)' });
      y += 13;
    }
    for (const entry of game.bestWords.slice(0, 4)) {
      fs.draw(c, entry.word, LAYOUT.scroll.x + 6, y, { color: entry.bonus ? '#8a6a1a' : INK });
      fs.draw(c, entry.hearts.toFixed(2), LAYOUT.scroll.x + LAYOUT.scroll.w - 6, y,
        { color: 'rgba(120,95,55,0.9)', align: 'right' });
      y += 13;
    }

    y += 8;
    fs.draw(c, `chapter ${game.chapter} bonus words`, LAYOUT.scroll.x + 6, y,
      { color: 'rgba(140,60,30,0.85)' });
    y += 13;
    const words = [...game.bonusWords];
    let col = 0;
    for (let i = 0; i < words.length && y < LAYOUT.scroll.y + 120; i++) {
      fs.draw(c, words[i], LAYOUT.scroll.x + 6 + col * 74, y, { color: 'rgba(90,69,38,0.9)' });
      col++;
      if (col === 2) { col = 0; y += 12; }
    }

    // right curtain: what this creature can do to you
    const fa = this.font('Humanst521BT10');
    let ay = LAYOUT.curtain.y;
    for (const a of game.enemy.attacks.slice(0, 5)) {
      fa.draw(c, a.name, LAYOUT.curtain.x + 6, ay, { color: '#f0d9a8' });
      if (a.tooltip) {
        fa.draw(c, a.tooltip, LAYOUT.curtain.x + 6, ay + 11,
          { color: 'rgba(230,190,170,0.72)' });
      }
      ay += 26;
    }


  }

  tileCel(index) {
    if (!this.tileCels) {
      const img = this.A.images.tileBasic;
      this.tileCels = img ? [cel(img, 0, 2), cel(img, 1, 2)] : [null, null];
    }
    return this.tileCels[index];
  }

  tiles(game, input) {
    const L = LAYOUT.grid;
    const grid = game.grid;
    const frozen = !!game.lex.status.blocksTiles;
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const i = row * grid.cols + col;
        const t = grid.tiles[i];
        if (!t) continue;
        this.tile(t, L.x + col * L.pitchX, L.y + row * L.pitchY - t.dropFrom,
          input && input.hover === i, game, frozen);
      }
    }
  }

  tile(t, x, y, hover, game, frozen) {
    const c = this.ctx;
    const S = LAYOUT.grid.tile;
    const gemImg = t.gem ? this.A.images['tile_' + t.gem] : null;
    const base = this.tileCel(t.selected || hover ? 1 : 0);

    c.save();
    if (t.pop > 0) {
      const k = 1 + t.pop * 0.12;
      c.translate(x + S / 2, y + S / 2);
      c.scale(k, k);
      c.translate(-(x + S / 2), -(y + S / 2));
    }

    if (gemImg) c.drawImage(gemImg, Math.round(x), Math.round(y));
    else if (base) drawCel(c, base, x, y);
    else {
      c.fillStyle = t.selected ? '#f6e6b4' : '#e2d3a4';
      c.fillRect(x, y, S, S);
      c.strokeStyle = '#8a7442';
      c.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
    }

    if (t.gem && !gemImg) {
      c.fillStyle = (game.cfg.gems[t.gem] && game.cfg.gems[t.gem].color) || '#b07ad6';
      c.globalAlpha = 0.45;
      c.fillRect(x + 2, y + 2, S - 4, S - 4);
      c.globalAlpha = 1;
    }

    this.font('CooperBlack24').draw(c, t.letter.toUpperCase(), x + S / 2, y + S - 11, {
      color: t.locked ? '#6a6a6a' : '#3a2a12', align: 'center', scale: 0.78,
    });

    this.font('Humanst521BT10').draw(c, String(letterValue(game.cfg, t.letter)),
      x + S - 5, y + S - 4, { color: 'rgba(70,50,20,0.8)', align: 'right' });

    if (t.selected) {
      c.fillStyle = 'rgba(255,214,90,0.92)';
      c.beginPath();
      c.arc(x + 9, y + 9, 7, 0, Math.PI * 2);
      c.fill();
      this.font('Humanst521BT10').draw(c, String(t.order + 1), x + 9, y + 13,
        { color: '#3a2a12', align: 'center' });
      c.strokeStyle = 'rgba(255,232,150,0.95)';
      c.lineWidth = 2;
      c.strokeRect(x + 1, y + 1, S - 2, S - 2);
      c.lineWidth = 1;
    }

    if (t.locked > 0) {
      const lock = this.A.images.tileLocked;
      if (lock) c.drawImage(lock, Math.round(x), Math.round(y));
      else {
        c.fillStyle = 'rgba(20,25,45,0.62)';
        c.fillRect(x, y, S, S);
      }
      this.font('Humanst521BT11Bold').draw(c, String(t.locked), x + S - 8, y + 14,
        { color: '#9fc0ff', align: 'right' });
    } else if (frozen) {
      c.fillStyle = 'rgba(120,190,255,0.30)';
      c.fillRect(x, y, S, S);
    }
    c.restore();
  }

  buttons(game, input) {
    const c = this.ctx;
    const s = game.score;
    for (const b of input.buttons) {
      const enabled = b.enabled(game, s);
      const state = !enabled ? 3 : (input.pressed === b.id ? 2 : (input.hover === b.id ? 1 : 0));
      const img = this.A.images[b.image];
      if (img) drawCel(c, cel(img, Math.min(state, 3), 4), b.x, b.y);
      else this.panel(b.x, b.y, b.w, b.h, enabled ? (state ? '#6a4a18' : '#4a3412') : '#2a2418');
      this.font('Humanst521BT13Bold').draw(c, b.label, b.x + b.w / 2, b.y + b.h / 2 + 5,
        { color: enabled ? '#fff0c0' : 'rgba(200,184,146,0.4)', align: 'center' });
    }
    if (game.message) {
      this.font('Humanst521BT11').draw(c, game.message, 320, 474,
        { color: 'rgba(240,220,180,0.85)', align: 'center' });
    }
  }

  /** Potion slots, keyed 1 2 3, drawn on the ledge to the right. */
  potions(game, input) {
    const c = this.ctx;
    const kinds = ['health', 'attack', 'purify'];
    const colors = { health: '#e0555a', attack: '#ffd45e', purify: '#7fd0c4' };
    const x0 = 528;
    const y = LAYOUT.ledge.y + 3;
    kinds.forEach((k, i) => {
      const n = game.inventory.count(k);
      const x = x0 + i * 22;
      c.fillStyle = n ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)';
      c.fillRect(x, y, 18, 26);
      c.strokeStyle = n ? colors[k] : 'rgba(140,120,90,0.4)';
      c.strokeRect(x + 0.5, y + 0.5, 17, 25);
      if (n) {
        c.fillStyle = colors[k];
        c.globalAlpha = 0.75;
        c.fillRect(x + 4, y + 10, 10, 12);
        c.globalAlpha = 1;
      }
      this.font('Humanst521BT10').draw(c, String(i + 1), x + 9, y + 9,
        { color: n ? '#fff0c0' : 'rgba(200,184,146,0.35)', align: 'center' });
      if (n > 1) {
        this.font('Humanst521BT10').draw(c, `x${n}`, x + 16, y + 25,
          { color: '#fff0c0', align: 'right' });
      }
    });
  }

  floats(game) {
    const c = this.ctx;
    for (const f of game.floats) {
      const k = f.t / f.life;
      this.font('Optima24Bold').draw(c, f.text, f.x, f.y - k * 46, {
        color: f.color, align: 'center', alpha: 1 - k * k, scale: f.size,
      });
    }
  }

  banner(game) {
    if (!game.banner) return;
    const c = this.ctx;
    const b = game.banner;
    const k = 1 - b.t / b.max;
    const alpha = b.t < 0.3 ? b.t / 0.3 : Math.min(1, k * 6);
    const scale = 1 + Math.max(0, 0.25 - k) * 1.6;
    this.font('CooperBlack24').draw(c, b.text, 320, 150,
      { color: '#ffe9a8', align: 'center', alpha, scale });
  }

  overlay(game) {
    const c = this.ctx;
    if (game.flash > 0) {
      c.fillStyle = `rgba(180,40,30,${game.flash * 0.35})`;
      c.fillRect(0, 0, W, H);
    }
    if (game.state !== State.DEFEAT && game.state !== State.RUN_COMPLETE) return;

    c.fillStyle = 'rgba(0,0,0,0.72)';
    c.fillRect(0, 0, W, H);
    const won = game.state === State.RUN_COMPLETE;
    this.font('CooperBlack24').draw(c, won ? 'Book One Complete' : 'Game Over', 320, 170,
      { color: '#ffe9a8', align: 'center' });

    const f = this.font('Humanst521BT11');
    const cleared = game.chapterIndex * 5 + game.enemyIndex;
    const lines = [
      `${cleared} of 20 opponents defeated on ${game.difficultyName}`,
      `${game.wordsPlayed} words for ${game.totalHearts.toFixed(1)} hearts`,
      `longest word: ${game.longestWord || '-'}`,
      `finished as ${game.rank} at level ${game.level}`,
    ];
    lines.forEach((t, i) => f.draw(c, t, 320, 206 + i * 18, { color: PARCHMENT, align: 'center' }));

    if (game.bestWords.length) {
      f.draw(c, 'best words', 320, 296, { color: GOLD, align: 'center' });
      game.bestWords.slice(0, 4).forEach((b, i) => {
        f.draw(c, `${b.word}  ${b.hearts.toFixed(2)}h${b.bonus ? '  bonus' : ''}`,
          320, 314 + i * 16, { color: DIM, align: 'center' });
      });
    }
    this.font('Humanst521BT11Bold').draw(c, 'press Enter to play again', 320, 400,
      { color: GOLD, align: 'center' });
  }
}
