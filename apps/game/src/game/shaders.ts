export const NOISE = /* glsl */ `
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`;

export const PALETTE = {
  zenith: '#07061a',
  high: '#1b1240',
  fog: '#5d3a6b',
  horizon: '#ff9e7a',
  sun: '#ffd9a8',
  duneLow: '#160d2b',
  duneHigh: '#c76a8a',
  contour: '#ffb38a',
  orbCore: '#e8fbff',
  orbRimA: '#6ef3ff',
  orbRimB: '#ff7ad9',
  gate: '#ffc58a',
  mote: '#8ff8ff',
} as const;

/** Sun sits low on the horizon straight ahead (-z). */
export const SUN_DIR: [number, number, number] = [0, 0.055, -1];
