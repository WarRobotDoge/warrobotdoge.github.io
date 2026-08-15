// profile.js - the player's save.
//
// CreatureBaseClass in the original carries a profile through the run and the
// game writes completed chapters into it. This is the same idea against
// localStorage: one autosave you can resume, plus lifetime statistics and the
// settings that survive a reload.

const KEY = 'bwa-js/profile/v1';

const EMPTY = {
  v: 1,
  settings: { difficulty: 3, sound: true, volume: 0.7 },
  save: null,
  stats: {
    runs: 0,
    wins: 0,
    enemiesDefeated: 0,
    wordsPlayed: 0,
    heartsDealt: 0,
    bestWord: '',
    bestWordHearts: 0,
    longestWord: '',
    highestLevel: 1,
    highestRank: '',
    bonusWordsFound: 0,
  },
};

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

export class Profile {
  constructor(data) {
    this.data = data;
  }

  static load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return new Profile(clone(EMPTY));
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1) return new Profile(clone(EMPTY));
      // fill in anything a newer build added
      const merged = clone(EMPTY);
      Object.assign(merged.settings, parsed.settings || {});
      Object.assign(merged.stats, parsed.stats || {});
      merged.save = parsed.save || null;
      return new Profile(merged);
    } catch (e) {
      return new Profile(clone(EMPTY));
    }
  }

  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      return false;    // private browsing, quota, or storage disabled
    }
  }

  get settings() { return this.data.settings; }
  get stats() { return this.data.stats; }
  get save() { return this.data.save; }

  setSetting(key, value) {
    this.data.settings[key] = value;
    this.write();
  }

  autosave(game) {
    this.data.save = game.serialize();
    this.write();
  }

  clearSave() {
    this.data.save = null;
    this.write();
  }

  /** Fold a finished run into the lifetime numbers. */
  recordRun(game, won) {
    const s = this.data.stats;
    s.runs++;
    if (won) s.wins++;
    s.enemiesDefeated += game.chapterIndex * 5 + game.enemyIndex;
    s.wordsPlayed += game.wordsPlayed;
    s.heartsDealt += game.totalHearts;
    if (game.longestWord.length > s.longestWord.length) s.longestWord = game.longestWord;
    const best = game.bestWords[0];
    if (best && best.hearts > s.bestWordHearts) {
      s.bestWordHearts = best.hearts;
      s.bestWord = best.word;
    }
    if (game.level > s.highestLevel) {
      s.highestLevel = game.level;
      s.highestRank = game.rank;
    }
    this.data.save = null;
    this.write();
  }

  noteBonusWord() {
    this.data.stats.bonusWordsFound++;
  }

  reset() {
    this.data = clone(EMPTY);
    this.write();
  }
}
