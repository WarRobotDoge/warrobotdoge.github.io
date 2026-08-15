// assets.js - load art, data and audio, and survive anything missing.
//
// The art and sound are produced by tools/convert_assets.py from the player's
// own copy of the game, so on a fresh checkout most of this is absent. Every
// loader returns null rather than throwing, and the renderer falls back to
// drawing things itself. That way the game is always runnable.

const cache = new Map();

export const Assets = {
  images: Object.create(null),
  fonts: Object.create(null),
  data: Object.create(null),
  missing: [],
  base: '',

  url(path) {
    return this.base + path;
  },

  async image(path) {
    if (cache.has(path)) return cache.get(path);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        this.missing.push(path);
        resolve(null);
      };
      img.src = this.url(path);
    });
    cache.set(path, p);
    return p;
  },

  async json(path) {
    try {
      const r = await fetch(this.url(path));
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      this.missing.push(path);
      return null;
    }
  },

  async text(path) {
    try {
      const r = await fetch(this.url(path));
      if (!r.ok) throw new Error(r.status);
      return await r.text();
    } catch (e) {
      this.missing.push(path);
      return null;
    }
  },

  // Load a batch of images into Assets.images under short keys.
  async loadImages(map, onProgress) {
    const entries = Object.entries(map);
    let done = 0;
    await Promise.all(entries.map(async ([key, path]) => {
      this.images[key] = await this.image(path);
      done++;
      if (onProgress) onProgress(done, entries.length);
    }));
  },
};

// A sprite sheet split into equal cels, the way SexyAppFramework stores
// button states and tile variants (tile_basic is 88x44: normal, highlighted).
export function cel(img, index, count, vertical = false) {
  if (!img) return null;
  const w = vertical ? img.width : Math.floor(img.width / count);
  const h = vertical ? Math.floor(img.height / count) : img.height;
  return {
    img,
    sx: vertical ? 0 : index * w,
    sy: vertical ? index * h : 0,
    w,
    h,
  };
}

export function drawCel(ctx, c, x, y, alpha = 1) {
  if (!c) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.drawImage(c.img, c.sx, c.sy, c.w, c.h, Math.round(x), Math.round(y), c.w, c.h);
  ctx.globalAlpha = prev;
}
