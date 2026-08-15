// effects.js - the status system.
//
// The original defines these in EffectBaseClass and its subclasses, and names
// them in TooltipText: bleeding, burning, poisoned, frozen, stunned,
// petrified, cursed, shielded, powered up, invincible. Each is a timed state
// on a combatant that can do three things: tick damage, scale damage in or
// out, or take the turn away entirely.
//
// Durations and magnitudes are in tuning.json. The set of effects, and which
// enemy attack applies which, are extracted from the game.

export class StatusSet {
  /**
   * @param {object} cfg      game.json
   * @param {string} ownerName for log lines
   */
  constructor(cfg, ownerName) {
    this.cfg = cfg;
    this.owner = ownerName;
    this.active = new Map();   // id -> {id, label, turns, def}
  }

  get list() {
    return [...this.active.values()];
  }

  has(id) {
    return this.active.has(id);
  }

  /** Apply or refresh an ailment. Returns the instance, or null if unknown. */
  apply(id, turnsOverride) {
    const def = this.cfg.ailments[id];
    if (!def) return null;
    const turns = turnsOverride || def.turns || 1;
    const existing = this.active.get(id);
    if (existing) {
      existing.turns = Math.max(existing.turns, turns);
      return existing;
    }
    const inst = { id, label: def.label || id, turns, def };
    this.active.set(id, inst);
    return inst;
  }

  remove(id) {
    return this.active.delete(id);
  }

  /** Purify potion, and PurifyEffect: strip everything harmful. */
  purify() {
    const cleared = [];
    for (const [id, inst] of this.active) {
      if (this.isHarmful(id)) {
        cleared.push(inst.label);
        this.active.delete(id);
      }
    }
    return cleared;
  }

  isHarmful(id) {
    const d = this.cfg.ailments[id];
    if (!d) return false;
    return !!(d.damagePerTurn || d.skipsTurn || d.blocksTiles || (d.damageTaken || 1) > 1);
  }

  /** Multiplier on damage this combatant deals. */
  get outgoing() {
    let m = 1;
    for (const i of this.active.values()) m *= (i.def.damageDealt !== undefined ? i.def.damageDealt : 1);
    return m;
  }

  /** Multiplier on damage this combatant receives. */
  get incoming() {
    let m = 1;
    for (const i of this.active.values()) m *= (i.def.damageTaken !== undefined ? i.def.damageTaken : 1);
    return m;
  }

  get skipsTurn() {
    for (const i of this.active.values()) if (i.def.skipsTurn) return i;
    return null;
  }

  get blocksTiles() {
    for (const i of this.active.values()) if (i.def.blocksTiles) return i;
    return null;
  }

  /**
   * End of the owner's turn: run damage-over-time and count durations down.
   * @returns {{damage:number, expired:string[], ticked:string[]}}
   */
  tick() {
    let damage = 0;
    const expired = [];
    const ticked = [];
    for (const [id, inst] of [...this.active]) {
      if (inst.def.damagePerTurn) {
        damage += inst.def.damagePerTurn;
        ticked.push(inst.label);
      }
      inst.turns--;
      if (inst.turns <= 0) {
        this.active.delete(id);
        expired.push(inst.label);
      }
    }
    return { damage, expired, ticked };
  }

  clear() {
    this.active.clear();
  }

  serialize() {
    return this.list.map((i) => ({ id: i.id, turns: i.turns }));
  }

  restore(saved) {
    this.clear();
    for (const s of saved || []) this.apply(s.id, s.turns);
  }
}

// Maps the original effect class names onto what they do here. An enemy
// attack lists its effect classes; this is how those become gameplay.
export const EFFECT_BEHAVIOUR = {
  DamageEffect: { kind: 'damage' },
  PoisonAilment: { kind: 'ailment', ailment: 'poisoned' },
  DamageAilment: { kind: 'ailment', ailment: 'bleeding' },
  FreezeEffect: { kind: 'ailment', ailment: 'frozen' },
  StunEffect: { kind: 'ailment', ailment: 'stunned' },
  HealEffect: { kind: 'heal' },
  PurifyEffect: { kind: 'purify' },
  LockTileEffect: { kind: 'lock' },
  DamageMultiplierEffect: { kind: 'buff', ailment: 'powered_up' },
  DamageReducerEffect: { kind: 'buff', ailment: 'shielded' },
  RegenerateHealth: { kind: 'regen' },
  WordLengthEffect: { kind: 'wordLength' },
  HealingWordEffect: { kind: 'healingWord' },
  WordEffect: { kind: 'wordTrigger' },
  GemModifier: { kind: 'gemBonus' },
};
