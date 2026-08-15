// game.js - the battle engine and the run through Book One.
//
// Turn order matches the original's BattleEngine states: the player spells a
// word, the word resolves, ailments on the enemy tick, the enemy picks an
// attack, ailments on Lex tick, control returns. Twenty opponents across four
// chapters, every fifth one a boss.

import { Grid } from './grid.js';
import { StatusSet, EFFECT_BEHAVIOUR } from './effects.js';
import { Inventory } from './items.js';
import {
  scoreWord, tierSound, afterArmor, levelForXp, rankName, maxHeartsForLevel,
  xpForWord, xpForCurrentLevel, xpForNextLevel, heartsFor,
} from './combat.js';
import { SFX } from './audio.js';

export const State = {
  PLAYER: 'player',
  RESOLVING: 'resolving',
  ENEMY: 'enemy',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
  CHAPTER_END: 'chapterEnd',
  RUN_COMPLETE: 'runComplete',
};

let floatId = 1;

export class Game {
  constructor(cfg, dictionary, audio, options = {}) {
    this.cfg = cfg;
    this.dict = dictionary;
    this.audio = audio;
    this.difficulty = options.difficulty !== undefined
      ? options.difficulty : (cfg.difficultyIndex !== undefined ? cfg.difficultyIndex : 3);

    this.chapterOrder = Object.keys(cfg.chapters).map(Number).sort((a, b) => a - b);
    this.chapterIndex = 0;
    this.enemyIndex = 0;

    this.xp = 0;
    this.level = cfg.lex.startLevel || 1;

    this.lex = {
      name: 'Lex',
      maxHearts: maxHeartsForLevel(cfg, this.level),
      hearts: maxHeartsForLevel(cfg, this.level),
      status: new StatusSet(cfg, 'Lex'),
    };
    this.inventory = new Inventory(cfg);

    this.grid = new Grid(cfg);
    this.log = [];
    this.floats = [];
    this.bestWords = [];
    this.wordsPlayed = 0;
    this.totalHearts = 0;
    this.longestWord = '';

    this.shake = 0;
    this.flash = 0;
    this.lexHit = 0;
    this.enemyHit = 0;
    this.banner = null;
    this.message = '';
    this.timer = 0;
    this.state = State.PLAYER;

    this.startEnemy();
  }

  // --- roster --------------------------------------------------------------

  get chapter() { return this.chapterOrder[this.chapterIndex]; }
  get roster() { return this.cfg.chapters[String(this.chapter)] || []; }
  get enemyKey() { return this.roster[this.enemyIndex]; }
  get difficultyName() { return this.cfg.difficulties[this.difficulty] || 'Casual'; }

  /** Chapter-themed words are worth extra. Ten lists ship with the game. */
  get bonusWords() {
    if (this._bonusChapter === this.chapter) return this._bonusSet;
    const list = this.cfg.chapterWords[String(this.chapter)] || [];
    this._bonusSet = new Set(list);
    this._bonusChapter = this.chapter;
    return this._bonusSet;
  }

  startEnemy() {
    const def = this.cfg.enemies[this.enemyKey];
    const hearts = heartsFor(def, this.difficulty);
    this.enemy = {
      key: this.enemyKey,
      name: def.name,
      shortName: def.name.replace(' (Boss)', ''),
      boss: def.boss,
      chapter: def.chapter,
      armor: def.armor || 0,
      portrait: def.portrait,
      attacks: def.attacks,
      maxHearts: hearts,
      hearts,
      status: new StatusSet(this.cfg, def.name),
      turnsSeen: 0,
      lastAttack: null,
    };
    this.grid.clearSelection();
    this.setBanner(def.name, 1.6);
    this.addLog(`${def.name} blocks the way.`);
  }

  setBanner(text, seconds) {
    this.banner = { text, t: seconds, max: seconds };
  }

  addLog(text) {
    this.log.push(text);
    if (this.log.length > 40) this.log.shift();
  }

  float(text, x, y, color, size = 1) {
    this.floats.push({ id: floatId++, text, x, y, color, size, t: 0, life: 1.3 });
  }

  // --- scoring -------------------------------------------------------------

  get score() {
    return scoreWord(this.cfg, this.grid.selection, this.dict, {
      bonusWords: this.bonusWords,
      outgoing: this.lex.status.outgoing,
      chapter: this.chapter,
    });
  }

  get rank() { return rankName(this.cfg, this.level); }

  get xpProgress() {
    const lo = xpForCurrentLevel(this.cfg, this.level);
    const hi = xpForNextLevel(this.cfg, this.level);
    if (hi === null) return 1;
    return Math.max(0, Math.min(1, (this.xp - lo) / (hi - lo)));
  }

  canAct() {
    return this.state === State.PLAYER;
  }

  // --- player actions ------------------------------------------------------

  clickTile(index) {
    if (!this.canAct()) return;
    const before = this.grid.selection.length;
    if (this.grid.toggle(index) && this.grid.selection.length > before) {
      this.audio.play(SFX.select, { rate: 0.95 + Math.min(before, 8) * 0.03 });
    }
  }

  typeLetter(ch) {
    if (!this.canAct()) return;
    if (this.grid.typeLetter(ch)) {
      this.audio.play(SFX.select, { rate: 0.95 + Math.min(this.grid.selection.length, 8) * 0.03 });
    } else {
      this.audio.play(SFX.bad, { volume: 0.35 });
    }
  }

  backspace() { if (this.canAct()) this.grid.backspace(); }
  clear() { if (this.canAct()) this.grid.clearSelection(); }

  usePotion(kind) {
    if (this.state !== State.PLAYER && this.state !== State.VICTORY) return;
    const result = this.inventory.use(kind, this.lex);
    if (!result) {
      this.audio.play(SFX.bad, { volume: 0.4 });
      return;
    }
    this.audio.play(result.sound);
    this.message = result.text;
    this.addLog(result.text);
    this.float(result.kind === 'health' ? '+HEALTH' : result.kind.toUpperCase(),
      150, 150, '#8fe08a');
  }

  scramble() {
    if (!this.canAct()) return;
    this.grid.scramble();
    this.audio.play(SFX.scramble);
    this.message = 'Shelf scrambled - the turn passes';
    this.addLog('Lex scrambles the shelf.');
    this.endPlayerTurn(0.35);
  }

  attack() {
    if (!this.canAct()) return;
    const s = this.score;
    if (!s.word) return;

    if (!s.valid) {
      this.audio.play(SFX.bad);
      this.message = s.tooShort
        ? 'Words must be at least three letters'
        : `"${s.word.toUpperCase()}" is not in the dictionary`;
      this.flash = 0.4;
      this.grid.clearSelection();
      return;
    }

    const dealt = afterArmor(s.hearts, this.enemy.armor, this.enemy.status.incoming);
    this.enemy.hearts = Math.max(0, this.enemy.hearts - dealt);
    this.totalHearts += dealt;
    this.wordsPlayed++;
    if (s.word.length > this.longestWord.length) this.longestWord = s.word.toUpperCase();

    this.recordWord(s, dealt);

    this.audio.play(dealt > 1.5 ? SFX.hitLarge : SFX.hitSmall);
    const voice = tierSound(this.cfg, s.tier);
    if (voice) setTimeout(() => this.audio.play(voice), 200);
    if (s.tierName) this.setBanner(s.tierName, 1.1);

    this.enemyHit = 0.45;
    this.shake = Math.min(0.5, 0.1 + dealt * 0.12);
    this.float(`-${dealt.toFixed(1)}`, 470, 150, '#ff5a4a', 1 + Math.min(1, dealt / 4));
    if (s.bonusWord) {
      this.float('BONUS WORD', 320, 190, '#ffd45e', 0.9);
      this.addLog(`${s.word.toUpperCase()} fits the chapter - bonus damage.`);
    }

    const gained = xpForWord(this.cfg, s);
    this.addXp(gained);
    this.addLog(`Lex spells ${s.word.toUpperCase()} for ${dealt.toFixed(1)} hearts.`);

    const len = s.word.length;
    this.grid.consumeSelection();
    if (this.grid.spawnGems(len)) this.audio.play(SFX.gemSpawn);

    // an attack potion is consumed by the word it powered
    if (this.lex.status.has('powered_up')) this.lex.status.remove('powered_up');

    this.message = `${s.word.toUpperCase()}  -  ${dealt.toFixed(1)} hearts  -  +${gained} xp`;

    if (this.enemy.hearts <= 0) return this.win();
    this.endPlayerTurn(0.5);
  }

  recordWord(s, dealt) {
    this.bestWords.push({ word: s.word.toUpperCase(), hearts: dealt, bonus: s.bonusWord });
    this.bestWords.sort((a, b) => b.hearts - a.hearts);
    if (this.bestWords.length > 8) this.bestWords.length = 8;
  }

  addXp(amount) {
    this.xp += amount;
    const level = levelForXp(this.cfg, this.xp);
    if (level > this.level) {
      this.level = level;
      this.lex.maxHearts = maxHeartsForLevel(this.cfg, level);
      this.lex.hearts = this.lex.maxHearts;
      this.setBanner(`Level ${level} - ${this.rank}`, 2.0);
      this.audio.play(SFX.heal);
      this.float('LEVEL UP', 150, 140, '#ffd45e', 1.3);
      this.addLog(`Lex reaches level ${level}: ${this.rank}.`);
    }
  }

  endPlayerTurn(delay) {
    this.state = State.RESOLVING;
    this.timer = delay;
  }

  win() {
    this.state = State.VICTORY;
    this.timer = 1.7;
    this.audio.play(SFX.enemyDeath);
    this.setBanner('Defeated!', 1.4);
    this.addLog(`${this.enemy.shortName} falls.`);

    // a breather between fights, or the run becomes pure attrition
    const heal = (this.cfg.victoryHeal || 0) * this.lex.maxHearts;
    if (heal > 0 && this.lex.hearts < this.lex.maxHearts) {
      const got = Math.min(heal, this.lex.maxHearts - this.lex.hearts);
      this.lex.hearts += got;
      this.float(`+${got.toFixed(1)}`, 150, 175, '#8fe08a', 0.85);
    }

    const drop = Inventory.roll(this.cfg);
    if (drop && this.inventory.add(drop)) {
      const label = this.cfg.potions[drop].name;
      this.message = `${this.enemy.shortName} drops a ${label}`;
      this.float(label.toUpperCase(), 470, 190, '#8fe08a', 0.85);
      this.addLog(`Picked up a ${label}.`);
    }
  }

  // --- enemy turn ----------------------------------------------------------

  /** Pick an attack. Effect-bearing attacks are held back until they matter. */
  chooseAttack() {
    const list = this.enemy.attacks;
    if (!list || !list.length) return null;
    const scored = list.map((a) => {
      let weight = 1;
      const kinds = a.effects.map((e) => (EFFECT_BEHAVIOUR[e] || {}).kind);
      if (kinds.includes('heal')) {
        // only worth using when actually hurt
        weight = this.enemy.hearts < this.enemy.maxHearts * 0.6 ? 1.6 : 0.12;
      }
      if (kinds.includes('lock')) weight = 1.2;
      if (kinds.includes('ailment')) weight = 1.4;
      if (a === this.enemy.lastAttack) weight *= 0.45;   // avoid repeats
      return { a, weight };
    });
    const total = scored.reduce((n, s) => n + s.weight, 0);
    let r = Math.random() * total;
    for (const s of scored) {
      r -= s.weight;
      if (r <= 0) return s.a;
    }
    return list[0];
  }

  enemyTurn() {
    const e = this.enemy;
    e.turnsSeen++;

    // ailments on the enemy resolve before it acts
    const et = e.status.tick();
    if (et.damage > 0) {
      e.hearts = Math.max(0, e.hearts - et.damage);
      this.float(`-${et.damage.toFixed(1)}`, 470, 175, '#9ae06a', 0.85);
      this.addLog(`${e.shortName} suffers ${et.damage.toFixed(1)} from ${et.ticked.join(' and ')}.`);
      if (e.hearts <= 0) return this.win();
    }
    for (const label of et.expired) this.addLog(`${e.shortName} is no longer ${label}.`);

    const skipped = e.status.skipsTurn;
    if (skipped) {
      this.message = `${e.shortName} is ${skipped.label.toLowerCase()} and loses the turn`;
      this.addLog(this.message + '.');
      return this.finishEnemyTurn();
    }

    const attack = this.chooseAttack();
    e.lastAttack = attack;
    const kinds = (attack ? attack.effects : []).map((x) => (EFFECT_BEHAVIOUR[x] || {}).kind);
    const parts = [];

    // plain damage, scaled by the creature's own strength and the chapter
    if (!attack || kinds.includes('damage') || kinds.length === 0) {
      const d = this.cfg.enemyDamage;
      let base = (d.base + e.chapter * d.perChapter) * (attack ? attack.power || 1 : 1);
      if (e.boss) base *= d.bossMultiplier || 1;
      let dmg = base * (1 - d.variance + Math.random() * d.variance * 2);
      dmg *= e.status.outgoing * this.lex.status.incoming;
      this.lex.hearts = Math.max(0, this.lex.hearts - dmg);
      this.lexHit = 0.45;
      this.shake = 0.2;
      this.float(`-${dmg.toFixed(1)}`, 150, 150, '#ff5a4a', 1.05);
      this.audio.play(e.chapter >= 3 ? SFX.enemyBlunt : SFX.enemyBite);
      parts.push(`${dmg.toFixed(1)} hearts`);
      if (this.lex.hearts > 0 && this.lex.hearts / this.lex.maxHearts < 0.25) {
        this.audio.play(SFX.lowHealth, { volume: 0.6 });
      }
    }

    for (const cls of (attack ? attack.effects : [])) {
      const b = EFFECT_BEHAVIOUR[cls];
      if (!b) continue;
      if (b.kind === 'ailment') {
        const inst = this.lex.status.apply(b.ailment);
        if (inst) {
          parts.push(inst.label.toLowerCase());
          this.audio.play(b.ailment === 'frozen' ? SFX.lock : SFX.hitSmall, { volume: 0.7 });
          this.float(inst.label.toUpperCase(), 150, 185, '#c98fff', 0.85);
        }
      } else if (b.kind === 'lock') {
        const t = this.grid.lockRandom(3);
        if (t) {
          parts.push('a sealed tile');
          this.audio.play(SFX.lock);
          this.float('SEALED', 320, 300, '#8fb6ff', 0.85);
        }
      } else if (b.kind === 'heal') {
        const h = this.cfg.enemyHeal;
        const amount = Math.min(e.maxHearts - e.hearts, h.base + e.chapter * h.perChapter);
        if (amount > 0.05) {
          e.hearts += amount;
          parts.push(`healing ${amount.toFixed(1)}`);
          this.audio.play(SFX.heal, { volume: 0.7 });
          this.float(`+${amount.toFixed(1)}`, 470, 150, '#8fe08a', 0.9);
        }
      } else if (b.kind === 'buff') {
        e.status.apply(b.ailment);
        parts.push(b.ailment.replace('_', ' '));
      } else if (b.kind === 'purify') {
        const cleared = e.status.purify();
        if (cleared.length) parts.push(`shaking off ${cleared.join(', ')}`);
      }
    }

    const label = attack ? attack.name : 'Strike';
    this.message = `${e.shortName} uses ${label}${parts.length ? ' - ' + parts.join(', ') : ''}`;
    this.addLog(this.message + '.');

    this.finishEnemyTurn();
  }

  finishEnemyTurn() {
    // ailments on Lex resolve at the end of the round
    const lt = this.lex.status.tick();
    if (lt.damage > 0) {
      this.lex.hearts = Math.max(0, this.lex.hearts - lt.damage);
      this.float(`-${lt.damage.toFixed(1)}`, 150, 175, '#9ae06a', 0.85);
      this.addLog(`Lex suffers ${lt.damage.toFixed(1)} from ${lt.ticked.join(' and ')}.`);
    }
    for (const label of lt.expired) this.addLog(`Lex is no longer ${label}.`);

    this.grid.tickLocks();

    if (this.lex.hearts <= 0) {
      this.state = State.DEFEAT;
      this.timer = 2;
      this.setBanner('Game Over', 2);
      this.addLog('Lex is defeated.');
      return;
    }

    // frozen board: the tiles stay put but the turn is lost
    const frozen = this.lex.status.blocksTiles;
    if (frozen) {
      this.message = `Lex is ${frozen.label.toLowerCase()} - the shelf will not move`;
    }

    this.state = State.PLAYER;
    this.ensurePlayable();
  }

  ensurePlayable() {
    if (!this.dict) return;
    const letters = this.grid.letters();
    if (letters.length < 3) return;
    if (!this.dict.anyPlayable(letters)) {
      this.grid.scramble();
      this.message = 'No words available - the shelf resets';
      this.addLog('The shelf resets: nothing could be spelled.');
      this.audio.play(SFX.scramble);
    }
  }

  // --- progression ---------------------------------------------------------

  advance() {
    this.enemyIndex++;
    if (this.enemyIndex < this.roster.length) {
      this.startEnemy();
      this.state = State.PLAYER;
      return;
    }
    this.enemyIndex = 0;
    this.chapterIndex++;
    if (this.chapterIndex >= this.chapterOrder.length) {
      this.state = State.RUN_COMPLETE;
      this.setBanner('Book One complete', 3);
      this.audio.play(SFX.cheer);
      return;
    }
    this.state = State.CHAPTER_END;
    this.timer = 2.2;
    this.setBanner(`Chapter ${this.chapter}`, 2.2);
    this.audio.play(SFX.cheer);
    this.addLog(`Chapter ${this.chapter} begins.`);
  }

  restart(difficulty) {
    const fresh = new Game(this.cfg, this.dict, this.audio, {
      difficulty: difficulty !== undefined ? difficulty : this.difficulty,
    });
    Object.assign(this, fresh);
  }

  // --- save ----------------------------------------------------------------

  serialize() {
    return {
      v: 1,
      difficulty: this.difficulty,
      chapterIndex: this.chapterIndex,
      enemyIndex: this.enemyIndex,
      xp: this.xp,
      level: this.level,
      hearts: this.lex.hearts,
      status: this.lex.status.serialize(),
      items: this.inventory.serialize(),
      wordsPlayed: this.wordsPlayed,
      totalHearts: this.totalHearts,
      longestWord: this.longestWord,
      bestWords: this.bestWords,
    };
  }

  restore(save) {
    if (!save || save.v !== 1) return false;
    this.difficulty = save.difficulty;
    this.chapterIndex = Math.min(save.chapterIndex, this.chapterOrder.length - 1);
    this.enemyIndex = save.enemyIndex;
    this.xp = save.xp;
    this.level = save.level;
    this.lex.maxHearts = maxHeartsForLevel(this.cfg, this.level);
    this.lex.hearts = Math.min(save.hearts, this.lex.maxHearts);
    this.lex.status.restore(save.status);
    this.inventory.restore(save.items);
    this.wordsPlayed = save.wordsPlayed || 0;
    this.totalHearts = save.totalHearts || 0;
    this.longestWord = save.longestWord || '';
    this.bestWords = save.bestWords || [];
    this.startEnemy();
    this.state = State.PLAYER;
    return true;
  }

  // --- tick ----------------------------------------------------------------

  update(dt) {
    this.grid.update(dt);

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2);
    if (this.lexHit > 0) this.lexHit = Math.max(0, this.lexHit - dt * 2.2);
    if (this.enemyHit > 0) this.enemyHit = Math.max(0, this.enemyHit - dt * 2.2);
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }

    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < f.life);

    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        if (this.state === State.RESOLVING) {
          this.state = State.ENEMY;
          this.enemyTurn();
        } else if (this.state === State.VICTORY) {
          this.advance();
        } else if (this.state === State.CHAPTER_END) {
          this.startEnemy();
          this.state = State.PLAYER;
        }
      }
    }
  }
}
