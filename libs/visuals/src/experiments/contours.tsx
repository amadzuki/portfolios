'use client';
import {
  blur2,
  contours as d3contours,
  geoPath,
  interpolateRgbBasis,
} from 'd3';
import { useMemo, useRef } from 'react';
import { glyphGrid } from '../lib/glyph';
import {
  useAnimationFrame,
  useElementSize,
  usePointer,
  useReducedMotion,
} from '../lib/hooks';
import { noise3 } from '../lib/noise';
import type { ExperimentProps } from '../lib/types';

const LEVELS = 14;

/** d3-contour: a topographic map whose terrain is the glyph plus drifting noise; the cursor raises a hill. */
export default function Contours({
  glyph,
  palette,
  fontFamily,
  className,
}: ExperimentProps) {
  const [wrap, { width, height }] = useElementSize<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const pointer = usePointer(wrap);
  const reduced = useReducedMotion();

  const cols = 120;
  const rows = Math.max(20, Math.round(cols * (height / Math.max(1, width))));

  const base = useMemo(() => {
    if (!width || !height) return null;
    const g = glyphGrid(glyph, cols, rows, { fontFamily, resolution: 256 });
    // smooth edges so the glyph reads as a plateau with slopes
    blur2({ data: g, width: cols, height: rows }, 1.5);
    return g;
  }, [glyph, fontFamily, cols, rows, width, height]);

  const color = useMemo(() => interpolateRgbBasis(palette.colors), [palette]);
  const thresholds = useMemo(
    () => Array.from({ length: LEVELS }, (_, i) => 0.08 + (i / LEVELS) * 1.1),
    [],
  );
  const generator = useMemo(
    () => d3contours().size([cols, rows]).thresholds(thresholds),
    [cols, rows, thresholds],
  );
  const values = useMemo(() => new Float64Array(cols * rows), [cols, rows]);

  useAnimationFrame(
    (t) => {
      const el = svg.current;
      if (!el || !base) return;
      const p = pointer.current;
      const sx = cols / width;
      const sy = rows / height;
      const mx = p ? p.x * sx : -1e3;
      const my = p ? p.y * sy : -1e3;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const n = noise3(x * 0.05, y * 0.05, t * 0.25) * 0.3;
          const hill = Math.exp(-((x - mx) ** 2 + (y - my) ** 2) / 90) * 0.6;
          values[i] = base[i] * 1.1 + n + hill;
        }
      }
      const path = geoPath();
      const paths = generator(values as unknown as number[]);
      let html = '';
      paths.forEach((c, i) => {
        const k = i / (LEVELS - 1);
        // low levels are the noisy "terrain"; the glyph plateau gets the bright, heavier lines
        html += `<path d="${path(c) ?? ''}" fill="none" stroke="${color(k)}" stroke-width="${k > 0.45 ? 1.6 : 0.8}" vector-effect="non-scaling-stroke" opacity="${0.18 + k * 0.82}"/>`;
      });
      el.innerHTML = html;
    },
    !reduced,
    [base, width, height],
  );

  return (
    <div
      ref={wrap}
      className={className}
      style={{ background: palette.background, touchAction: 'none' }}
    >
      <svg
        ref={svg}
        viewBox={`0 0 ${cols} ${rows}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block' }}
        aria-hidden
      />
    </div>
  );
}
