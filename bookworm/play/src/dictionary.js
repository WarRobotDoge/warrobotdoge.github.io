// dictionary.js - the original 167,624 word list.
//
// data/dictionary.dat is the game's own front-coded format, copied straight
// out of data/compressed.txt. Each line is either a whole word, or a number
// followed by a suffix meaning "keep that many characters of the previous
// word, then append this". A line with no number reuses the previous count:
//
//     aah        -> aah
//     3ed        -> aah + ed        = aahed
//     ing        -> aah + ing       = aahing      (count 3 carried over)
//     s          -> aah + s         = aahs
//     2l         -> aa  + l         = aal
//
// Decoding all of it takes a few tens of milliseconds and the resulting Set
// costs some memory, but word lookup is then O(1), which matters because the
// board is re-scanned for playable words after every turn.

export class Dictionary {
  constructor(words) {
    this.words = words;
    this.set = new Set(words);
  }

  static decode(text) {
    const lines = text.split('\n');
    const words = new Array(lines.length);
    let n = 0;
    let prev = '';
    let keep = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      let j = 0;
      const c0 = line.charCodeAt(0);
      if (c0 >= 48 && c0 <= 57) {
        let k = 0;
        while (j < line.length) {
          const c = line.charCodeAt(j);
          if (c < 48 || c > 57) break;
          k = k * 10 + (c - 48);
          j++;
        }
        keep = k;
      }
      const w = prev.slice(0, keep) + line.slice(j);
      words[n++] = w;
      prev = w;
    }
    words.length = n;
    return words;
  }

  static async load(Assets, path = 'data/dictionary.dat') {
    const text = await Assets.text(path);
    if (!text) return null;
    return new Dictionary(Dictionary.decode(text));
  }

  has(word) {
    return this.set.has(word.toLowerCase());
  }

  get size() {
    return this.words.length;
  }

  /**
   * Is any valid word makeable from these letters? Used to decide whether the
   * board is dead and needs a forced scramble.
   * Exhaustive search is far too slow, so this samples: it walks the word list
   * once, checking only words whose length fits, with an early letter-count
   * rejection. Fine for a 16 tile board.
   */
  anyPlayable(letters, minLen = 3) {
    const have = new Uint8Array(26);
    for (const ch of letters) {
      const i = ch.charCodeAt(0) - 97;
      if (i >= 0 && i < 26) have[i]++;
    }
    const max = letters.length;
    const need = new Uint8Array(26);
    for (let w = 0; w < this.words.length; w++) {
      const word = this.words[w];
      if (word.length < minLen || word.length > max) continue;
      need.fill(0);
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const c = word.charCodeAt(i) - 97;
        if (c < 0 || c > 25 || ++need[c] > have[c]) { ok = false; break; }
      }
      if (ok) return word;
    }
    return null;
  }
}
