// audio.js - the game's own Ogg files, which every current browser decodes.
//
// Sounds are fetched lazily and decoded into an AudioContext so that repeated
// hits do not restart a single HTMLAudioElement. Everything is optional: if a
// file is missing or the context is blocked, calls are silent no-ops.

export class Audio {
  constructor(base = 'sound/') {
    this.base = base;
    this.ctx = null;
    this.buffers = new Map();
    this.pending = new Map();
    this.enabled = true;
    this.volume = 0.7;
  }

  /** Must be called from a user gesture on most browsers. */
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.gain) this.gain.gain.value = v;
  }

  async _load(name) {
    if (this.buffers.has(name)) return this.buffers.get(name);
    if (this.pending.has(name)) return this.pending.get(name);
    const p = (async () => {
      try {
        const r = await fetch(this.base + name + '.ogg');
        if (!r.ok) throw new Error(String(r.status));
        const bytes = await r.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(bytes);
        this.buffers.set(name, buf);
        return buf;
      } catch (e) {
        this.buffers.set(name, null);
        return null;
      }
    })();
    this.pending.set(name, p);
    return p;
  }

  async play(name, { volume = 1, rate = 1 } = {}) {
    if (!this.enabled || !name) return;
    if (!this.ctx) return;
    const buf = await this._load(name);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    if (volume === 1) {
      src.connect(this.gain);
    } else {
      const g = this.ctx.createGain();
      g.gain.value = volume;
      g.connect(this.gain);
      src.connect(g);
    }
    src.start();
  }

  /** Warm the cache for sounds we know we will need. */
  preload(names) {
    if (!this.ctx) return;
    for (const n of names) this._load(n);
  }
}

// Names as they appear in the converted sound folder.
export const SFX = {
  select: 'tile_select',
  click: 'click1',
  bad: 'click2',
  scramble: 'v_scramble',
  wordPower: 'word_power',
  gemSpawn: 'gemspawn',
  lock: 'Lockit',
  lowHealth: 'low_health',
  heal: 'heal2',
  hitSmall: 'SmallImpact_01',
  hitLarge: 'LargeImpact_01',
  cheer: 'crowdcheer',
  enemyBite: 'bite_01',
  enemyBlunt: 'BluntImpact_WithWoosh',
  enemyDeath: 'Bat_Death_01',
};
