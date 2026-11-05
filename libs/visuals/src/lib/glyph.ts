export interface GlyphOptions {
  /** Canvas height in px used for rasterising. Higher = finer sampling. */
  resolution?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  /** Alpha threshold (0-255) for a pixel to count as "inside". */
  threshold?: number;
  /** Extra width/height ratio for the canvas (useful to match a viewport aspect). */
  minAspect?: number;
}

export interface GlyphRaster {
  width: number;
  height: number;
  /** Alpha channel, row-major, 0-255. */
  alpha: Uint8ClampedArray;
  aspect: number;
}

const DEFAULT_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Rasterises text (may contain `\n`) onto an offscreen canvas and returns its alpha mask. Browser only. */
export function rasterizeGlyph(
  text: string,
  opts: GlyphOptions = {},
): GlyphRaster {
  const {
    resolution = 256,
    fontFamily = DEFAULT_FONT,
    fontWeight = 900,
    minAspect = 0,
  } = opts;
  const lines = text.split('\n');
  const lineHeight = resolution / lines.length;
  const fontSize = lineHeight * 0.82;
  const font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const textWidth = Math.max(...lines.map((l) => measure.measureText(l).width));
  const height = resolution;
  const width = Math.ceil(
    Math.max(textWidth + fontSize * 0.3, height * minAspect, 1),
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) =>
    ctx.fillText(line, width / 2, lineHeight * (i + 0.5) + fontSize * 0.04),
  );

  const rgba = ctx.getImageData(0, 0, width, height).data;
  const alpha = new Uint8ClampedArray(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  return { width, height, alpha, aspect: width / height };
}

/**
 * Points inside the glyph, normalised so the raster height spans [-1, 1] (y up) and
 * x spans [-aspect, aspect]. Step is chosen to land near `count` points.
 */
export function sampleGlyphPoints(
  text: string,
  count = 3000,
  opts: GlyphOptions = {},
): { points: Float32Array; aspect: number } {
  const r = rasterizeGlyph(text, opts);
  const threshold = opts.threshold ?? 128;
  let filled = 0;
  for (let i = 0; i < r.alpha.length; i++) if (r.alpha[i] > threshold) filled++;
  const step = Math.max(1, Math.sqrt(filled / count));

  const out: number[] = [];
  const half = r.height / 2;
  for (let y = 0; y < r.height; y += step) {
    for (let x = 0; x < r.width; x += step) {
      // jitter so the grid doesn't read as a grid
      const jx = x + (Math.random() - 0.5) * step;
      const jy = y + (Math.random() - 0.5) * step;
      const ix = Math.min(r.width - 1, Math.max(0, Math.round(jx)));
      const iy = Math.min(r.height - 1, Math.max(0, Math.round(jy)));
      if (r.alpha[iy * r.width + ix] > threshold) {
        out.push((jx - r.width / 2) / half, -(jy - half) / half);
      }
    }
  }
  return { points: new Float32Array(out), aspect: r.aspect };
}

/** Downsamples the glyph into a cols x rows grid of coverage values in [0, 1]. */
export function glyphGrid(
  text: string,
  cols: number,
  rows: number,
  opts: GlyphOptions = {},
): Float32Array {
  const r = rasterizeGlyph(text, {
    ...opts,
    minAspect: Math.max(opts.minAspect ?? 0, cols / rows),
  });
  const grid = new Float32Array(cols * rows);
  // Fit the raster into the grid preserving aspect.
  const scale = Math.max(r.width / cols, r.height / rows);
  const ox = (cols * scale - r.width) / 2;
  const oy = (rows * scale - r.height) / 2;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const px = Math.floor((gx + 0.5) * scale - ox);
      const py = Math.floor((gy + 0.5) * scale - oy);
      grid[gy * cols + gx] =
        px >= 0 && py >= 0 && px < r.width && py < r.height
          ? r.alpha[py * r.width + px] / 255
          : 0;
    }
  }
  return grid;
}
