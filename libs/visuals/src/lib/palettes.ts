import type { Palette } from './types';

export const palettes = {
  ember: { background: '#07060b', colors: ['#ff3d6e', '#b13cff', '#4d7cff'] },
  aurora: { background: '#05080b', colors: ['#00e0b8', '#3d8bff', '#c86bff'] },
  acid: { background: '#080806', colors: ['#d4ff3a', '#2fe6a6', '#2b8cff'] },
  sunset: { background: '#0a0605', colors: ['#ffb238', '#ff4f5e', '#9b3dff'] },
  ice: { background: '#05070a', colors: ['#e8f4ff', '#7cc8ff', '#5a5cff'] },
  candy: { background: '#090509', colors: ['#ff7ad9', '#ffd36e', '#6ef0ff'] },
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof palettes;
