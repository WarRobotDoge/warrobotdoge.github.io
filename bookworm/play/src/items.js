// items.js - the three potions.
//
// The original has ATTACK_ITEM, HEALTH_ITEM and PURIFY_ITEM in TooltipText,
// with LEX_HINT_* prompts nudging you to drink one, and CreatureBaseClass
// carries mItemSlots and mItems. Lex holds a small number at a time; enemies
// drop them on death.

export const POTIONS = ['health', 'attack', 'purify'];

export class Inventory {
  constructor(cfg) {
    this.cfg = cfg;
    this.slots = cfg.lex.itemSlots || 3;
    this.items = [];
  }

  get full() {
    return this.items.length >= this.slots;
  }

  count(kind) {
    return this.items.filter((i) => i === kind).length;
  }

  add(kind) {
    if (this.full) return false;
    this.items.push(kind);
    return true;
  }

  remove(kind) {
    const i = this.items.indexOf(kind);
    if (i < 0) return false;
    this.items.splice(i, 1);
    return true;
  }

  def(kind) {
    return this.cfg.potions[kind];
  }

  /**
   * Drinking is a free action in this port - it does not cost the turn, which
   * keeps potions worth carrying. Returns a description of what happened, or
   * null if the potion could not be used.
   */
  use(kind, lex) {
    if (!this.count(kind)) return null;
    const def = this.def(kind);
    if (!def) return null;

    if (kind === 'health') {
      if (lex.hearts >= lex.maxHearts) return null;
      const healed = Math.min(def.heals, lex.maxHearts - lex.hearts);
      lex.hearts += healed;
      this.remove(kind);
      return { kind, text: `Restored ${healed.toFixed(1)} hearts`, sound: 'heal2' };
    }

    if (kind === 'attack') {
      lex.status.apply('powered_up', def.turns);
      this.remove(kind);
      return { kind, text: 'Powered up - next word hits harder', sound: 'word_power' };
    }

    if (kind === 'purify') {
      const cleared = lex.status.purify();
      if (!cleared.length) return null;
      this.remove(kind);
      return { kind, text: `Cleared ${cleared.join(', ')}`, sound: 'heal2' };
    }
    return null;
  }

  /** What an enemy leaves behind. Weighted so healing is the common drop. */
  static roll(cfg, rng = Math.random) {
    if (rng() > (cfg.potionDropChance || 0.22)) return null;
    const r = rng();
    if (r < 0.55) return 'health';
    if (r < 0.85) return 'attack';
    return 'purify';
  }

  serialize() {
    return this.items.slice();
  }

  restore(saved) {
    this.items = (saved || []).slice(0, this.slots);
  }
}
