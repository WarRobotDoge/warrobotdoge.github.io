// bitmapfont.js - render the game's original bitmap fonts.
//
// A SexyAppFramework font is a sprite sheet plus a table of per-character
// source rectangles, advance widths, draw offsets and kerning pairs. Some
// fonts ship only a white glyph mask and are tinted at draw time; those are
// marked colorize:true by the converter, and we cache one tinted copy of the
// sheet per colour.

export class BitmapFont {
  constructor(def, sheet) {
    this.def = def || null;
    this.sheet = sheet || null;
    this.tinted = new Map();
    this.fallbackSize = def ? def.pointSize : 14;
  }

  get ok() {
    return !!(this.def && this.sheet && Object.keys(this.def.chars).length);
  }

  get lineHeight() {
    if (!this.def) return this.fallbackSize + 4;
    return this.def.ascent + (this.def.lineSpacing || 0) + (this.def.ascentPadding || 0) + 6;
  }

  kern(a, b) {
    if (!this.def || !a || !b) return 0;
    return this.def.kerning[a + b] || 0;
  }

  measure(text) {
    if (!this.ok) return this._fallbackMeasure(text);
    let w = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ' ') {
        w += this.def.spaceWidth;
        continue;
      }
      const c = this.def.chars[ch];
      if (!c) {
        w += this.def.spaceWidth;
        continue;
      }
      w += c.width + this.kern(ch, text[i + 1]);
    }
    return w;
  }

  _fallbackMeasure(text) {
    return text.length * this.fallbackSize * 0.55;
  }

  // Tinting a mask sheet: draw it, then paint the colour through it with
  // source-in. Cached because it is a full-sheet operation.
  _sheetFor(color) {
    if (!this.def.colorize || !color) return this.sheet;
    const key = color;
    if (this.tinted.has(key)) return this.tinted.get(key);
    const c = document.createElement('canvas');
    c.width = this.sheet.width;
    c.height = this.sheet.height;
    const g = c.getContext('2d');
    g.drawImage(this.sheet, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    this.tinted.set(key, c);
    return c;
  }

  /**
   * @param {object} o  {color, align: 'left'|'center'|'right', alpha, scale}
   * `y` is the text baseline.
   */
  draw(ctx, text, x, y, o = {}) {
    text = String(text);
    const align = o.align || 'left';
    const alpha = o.alpha === undefined ? 1 : o.alpha;
    const scale = o.scale || 1;

    if (!this.ok) return this._fallbackDraw(ctx, text, x, y, align, o.color, alpha, scale);

    const width = this.measure(text) * scale;
    let cx = x;
    if (align === 'center') cx = x - width / 2;
    else if (align === 'right') cx = x - width;

    const sheet = this._sheetFor(o.color);
    const top = y - this.def.ascent * scale;

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * alpha;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ' ') {
        cx += this.def.spaceWidth * scale;
        continue;
      }
      const c = this.def.chars[ch] || this.def.chars[ch.toUpperCase()] || this.def.chars[ch.toLowerCase()];
      if (!c) {
        cx += this.def.spaceWidth * scale;
        continue;
      }
      const [sx, sy, sw, sh] = c.rect;
      if (sw > 0 && sh > 0) {
        ctx.drawImage(
          sheet, sx, sy, sw, sh,
          Math.round(cx + c.offset[0] * scale), Math.round(top + c.offset[1] * scale),
          Math.round(sw * scale), Math.round(sh * scale),
        );
      }
      cx += (c.width + this.kern(ch, text[i + 1])) * scale;
    }
    ctx.globalAlpha = prevAlpha;
    return width;
  }

  _fallbackDraw(ctx, text, x, y, align, color, alpha, scale) {
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * alpha;
    ctx.save();
    ctx.font = `bold ${Math.round(this.fallbackSize * scale)}px Georgia, serif`;
    ctx.fillStyle = color || '#ffffff';
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, Math.round(x), Math.round(y));
    ctx.restore();
    ctx.globalAlpha = prevAlpha;
    return ctx.measureText ? this._fallbackMeasure(text) * scale : 0;
  }
}

/** Build every font described in fonts.json. */
export async function loadFonts(defs, Assets) {
  const out = Object.create(null);
  if (!defs) return out;
  await Promise.all(Object.entries(defs).map(async ([name, def]) => {
    const sheet = await Assets.image('art/' + def.sheet);
    out[name] = new BitmapFont(def, sheet);
  }));
  return out;
}
