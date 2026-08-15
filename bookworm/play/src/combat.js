// combat.js - scoring a word, and turning that score into hearts.
//
// Health in Bookworm Adventures is hearts, not hit points. Each creature's
// Init passes a heart count per difficulty (Starving Rat 1-4, Odin 6-20) and
// sets mArmor to 0.25, a fraction rather than a flat subtraction. Those are
// extracted values. What is reconstructed is the bridge between the two: how
// much word power buys one heart. That is cfg.heartValue.
//
// A word's power is the sum of its letter values, which come from the game's
// own config.xml, scaled by length, gems, chapter bonus words, and whatever
// buffs are running.

export function letterValue(cfg, ch) {
  return cfg.letterValues[ch.toLowerCase()] || 1;
}

export function lengthMultiplier(cfg, len) {
  const table = cfg.lengthMultiplier;
  const key = String(len);
  if (table[key] !== undefined) return table[key];
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const last = keys[keys.length - 1];
  const prev = keys[keys.length - 2];
  const step = table[String(last)] - table[String(prev)];
  return table[String(last)] + step * (len - last);
}

/**
 * Full breakdown for the current selection, so the interface can show why a
 * word is worth what it is rather than just a number.
 *
 * @param {object} cfg
 * @param {Tile[]} tiles      the selected tiles, in order
 * @param {Dictionary} dict
 * @param {object} ctx        {bonusWords:Set, outgoing:number, chapter:number}
 */
export function scoreWord(cfg, tiles, dict, ctx = {}) {
  const word = tiles.map((t) => t.letter).join('');
  const out = {
    word,
    letters: tiles.length,
    base: 0,
    gemBonus: 0,
    lengthMult: 1,
    bonusWord: false,
    buffMult: ctx.outgoing || 1,
    power: 0,
    hearts: 0,
    tier: -1,
    tierName: '',
    valid: false,
    tooShort: word.length > 0 && word.length < 3,
    notAWord: false,
  };
  if (!word) return out;

  for (const t of tiles) {
    out.base += letterValue(cfg, t.letter);
    if (t.gem && cfg.gems[t.gem]) out.gemBonus += cfg.gems[t.gem].bonus;
  }

  out.valid = word.length >= 3 && (!dict || dict.has(word));
  out.notAWord = word.length >= 3 && !out.valid;
  if (!out.valid) return out;

  out.lengthMult = lengthMultiplier(cfg, word.length);
  out.bonusWord = !!(ctx.bonusWords && ctx.bonusWords.has(word));

  let power = out.base * out.lengthMult * (1 + out.gemBonus);
  if (out.bonusWord) power *= (cfg.bonusWordMultiplier || 1.5);
  power *= out.buffMult;

  out.power = power;
  out.hearts = power / (cfg.heartValue || 14);

  // Tiers are keyed off raw word power before buffs, so the shout you get
  // reflects the word you found rather than the potion you drank.
  const raw = out.base * (1 + out.gemBonus);
  let tier = -1;
  for (let i = 0; i < cfg.wordPowerThresholds.length; i++) {
    if (raw >= cfg.wordPowerThresholds[i]) tier = i;
  }
  out.tier = tier;
  out.tierName = tier >= 0 ? (cfg.wordPowerTiers[tier] || '') : '';
  return out;
}

/** Armour is a fraction of incoming damage, not a flat subtraction. */
export function afterArmor(hearts, armor, incomingMult = 1) {
  return Math.max(0, hearts * (1 - (armor || 0)) * incomingMult);
}

/** SOUND_LEX_AWESOME -> lex_awesome, matching the converted sound folder. */
export function tierSound(cfg, tier) {
  const id = cfg.wordPowerSounds && cfg.wordPowerSounds[tier];
  return id ? id.replace(/^SOUND_/, '').toLowerCase() : null;
}

// --- experience ------------------------------------------------------------

export function levelForXp(cfg, xp) {
  let level = 1;
  for (let i = 0; i < cfg.xpThresholds.length; i++) if (xp >= cfg.xpThresholds[i]) level = i + 2;
  return level;
}

export function xpForCurrentLevel(cfg, level) {
  return level >= 2 ? cfg.xpThresholds[level - 2] : 0;
}

export function xpForNextLevel(cfg, level) {
  const t = cfg.xpThresholds[level - 1];
  return t === undefined ? null : t;
}

export function rankName(cfg, level) {
  if (!cfg.ranks || !cfg.ranks.length) return '';
  return cfg.ranks[Math.min(level - 1, cfg.ranks.length - 1)];
}

export function maxHeartsForLevel(cfg, level) {
  return cfg.lex.hearts + cfg.lex.heartsPerLevel * (level - 1);
}

export function xpForWord(cfg, score) {
  return Math.max(1, Math.round(score.base * (1 + score.gemBonus) * (score.bonusWord ? 1.5 : 1)));
}

/**
 * Hearts a creature has at the chosen difficulty. The extracted ladder runs
 * hardest first and collapses repeated values, so index from the end.
 */
export function heartsFor(enemyDef, difficultyIndex) {
  const ladder = enemyDef.hearts;
  if (!ladder || !ladder.length) return 3;
  // difficultyIndex 0 = Extreme ... 3 = Casual
  const i = Math.min(difficultyIndex, ladder.length - 1);
  return ladder[i];
}
