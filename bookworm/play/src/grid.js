// grid.js - the 4x4 letter board that sits on the bookshelf.
//
// Unlike Bookworm Deluxe there is no adjacency rule: any tile can follow any
// other. Tiles are consumed when a word is played and new ones drop in from
// above. Gem tiles add a damage bonus when used; locked tiles are unusable
// until their timer runs out.

let nextId = 1;

export class Tile {
  constructor(letter, gem = null) {
    this.id = nextId++;
    this.letter = letter;
    this.gem = gem;
    this.locked = 0;        // turns remaining
    this.selected = false;
    this.order = -1;        // position within the current word
    this.dropFrom = 0;      // pixels above home, animated to 0
    this.pop = 0;           // 0..1 spawn flourish
  }

  get usable() {
    return this.locked === 0;
  }
}

export class Grid {
  /**
   * @param {object} cfg  game.json
   * @param {function} rng  () => [0,1)
   */
  constructor(cfg, rng = Math.random) {
    this.cfg = cfg;
    this.rng = rng;
    this.cols = cfg.grid.cols;
    this.rows = cfg.grid.rows;
    this.size = this.cols * this.rows;
    this.tiles = new Array(this.size).fill(null);
    this.selection = [];
    this._buildBag();
    this.refill(true);
  }

  _buildBag() {
    // Expand the weight table into a flat array so picking is a single index.
    this.bag = [];
    for (const [letter, weight] of Object.entries(this.cfg.letterWeights)) {
      for (let i = 0; i < weight; i++) this.bag.push(letter);
    }
    this.vowels = new Set(this.cfg.vowels.split(''));
  }

  randomLetter() {
    return this.bag[(this.rng() * this.bag.length) | 0];
  }

  countVowels() {
    let n = 0;
    for (const t of this.tiles) if (t && this.vowels.has(t.letter)) n++;
    return n;
  }

  /**
   * Fill empty slots. The original guarantees a workable mix rather than
   * letting pure chance hand you sixteen consonants, so after filling we
   * nudge the vowel count into range by rerolling offending tiles.
   */
  refill(initial = false) {
    for (let i = 0; i < this.size; i++) {
      if (!this.tiles[i]) {
        this.tiles[i] = new Tile(this.randomLetter());
        this.tiles[i].dropFrom = initial ? 0 : 60 + this.rng() * 40;
        this.tiles[i].pop = 1;
      }
    }
    this._balanceVowels();
  }

  _balanceVowels() {
    const { minVowels, maxVowels } = this.cfg.grid;
    let guard = 200;
    while (this.countVowels() < minVowels && guard-- > 0) {
      const candidates = this.tiles.filter((t) => !this.vowels.has(t.letter) && t.usable);
      if (!candidates.length) break;
      const t = candidates[(this.rng() * candidates.length) | 0];
      t.letter = this.cfg.vowels[(this.rng() * this.cfg.vowels.length) | 0];
    }
    guard = 200;
    while (this.countVowels() > maxVowels && guard-- > 0) {
      const candidates = this.tiles.filter((t) => this.vowels.has(t.letter) && t.usable);
      if (!candidates.length) break;
      const t = candidates[(this.rng() * candidates.length) | 0];
      let l = this.randomLetter();
      let g = 30;
      while (this.vowels.has(l) && g-- > 0) l = this.randomLetter();
      t.letter = l;
    }
  }

  at(col, row) {
    return this.tiles[row * this.cols + col];
  }

  indexOfTile(tile) {
    return this.tiles.indexOf(tile);
  }

  // --- selection -----------------------------------------------------------

  toggle(index) {
    const t = this.tiles[index];
    if (!t || !t.usable) return false;
    if (t.selected) {
      // deselecting anything but the last letter would reorder the word, so
      // clicking a used tile rewinds to just before it, like the original.
      const from = t.order;
      for (const s of this.selection) if (s.order >= from) { s.selected = false; s.order = -1; }
      this.selection = this.selection.filter((s) => s.selected);
      return true;
    }
    t.selected = true;
    t.order = this.selection.length;
    this.selection.push(t);
    return true;
  }

  /** Type a letter: select the first free tile showing it. */
  typeLetter(letter) {
    letter = letter.toLowerCase();
    let best = null;
    for (const t of this.tiles) {
      if (t.selected || !t.usable || t.letter !== letter) continue;
      // prefer a plain tile so gems are not spent by accident when typing
      if (!best || (best.gem && !t.gem)) best = t;
    }
    if (!best) return false;
    best.selected = true;
    best.order = this.selection.length;
    this.selection.push(best);
    return true;
  }

  backspace() {
    const t = this.selection.pop();
    if (!t) return false;
    t.selected = false;
    t.order = -1;
    return true;
  }

  clearSelection() {
    for (const t of this.selection) { t.selected = false; t.order = -1; }
    this.selection = [];
  }

  get word() {
    return this.selection.map((t) => t.letter).join('');
  }

  /** Remove the selected tiles and drop replacements in. */
  consumeSelection() {
    const used = this.selection.slice();
    for (const t of used) {
      const i = this.tiles.indexOf(t);
      if (i >= 0) this.tiles[i] = null;
    }
    this.selection = [];
    this.refill();
    return used;
  }

  // --- board effects -------------------------------------------------------

  scramble() {
    this.clearSelection();
    for (const t of this.tiles) {
      if (t.usable) {
        t.letter = this.randomLetter();
        t.pop = 1;
      }
    }
    this._balanceVowels();
  }

  /** Enemy attack: seal a random usable tile for a few turns. */
  lockRandom(turns = 3, maxLocked = 3) {
    if (this.tiles.filter((t) => t.locked > 0).length >= maxLocked) return null;
    const free = this.tiles.filter((t) => t.usable && !t.selected);
    if (!free.length) return null;
    const t = free[(this.rng() * free.length) | 0];
    t.locked = turns;
    return t;
  }

  tickLocks() {
    for (const t of this.tiles) if (t.locked > 0) t.locked--;
  }

  /** Roll gems onto freshly placed tiles based on the word just played. */
  spawnGems(wordLength) {
    const spawn = this.cfg.gemSpawn;
    const len = Math.min(wordLength, spawn.maxWordLength);
    const chance = (spawn.byWordLength[String(len)] || 0) / 100;
    if (this.rng() > chance) return null;

    const plain = this.tiles.filter((t) => !t.gem && t.usable);
    if (!plain.length) return null;
    const tile = plain[(this.rng() * plain.length) | 0];

    // richer gems need longer words
    const kinds = Object.keys(this.cfg.gems);
    let tier = 0;
    if (wordLength >= 6) tier = 1;
    if (wordLength >= 8) tier = 2;
    tier = Math.min(tier, kinds.length - 1);
    tile.gem = kinds[tier];
    tile.pop = 1;
    return tile;
  }

  letters() {
    return this.tiles.filter((t) => t.usable).map((t) => t.letter);
  }

  update(dt) {
    for (const t of this.tiles) {
      if (t.dropFrom > 0) t.dropFrom = Math.max(0, t.dropFrom - dt * 900);
      if (t.pop > 0) t.pop = Math.max(0, t.pop - dt * 4);
    }
  }
}
