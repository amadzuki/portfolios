import type { ComponentType } from 'react';
import { palettes, type PaletteName } from './lib/palettes';
import type { ExperimentProps } from './lib/types';

export type TechniqueId =
  | 'particles'
  | 'voxels'
  | 'pixel-shader'
  | 'force-network'
  | 'contours'
  | 'ascii';

export const techniques: Record<
  TechniqueId,
  { label: string; tech: string[]; summary: string }
> = {
  particles: {
    label: 'GPU particles',
    tech: ['three.js', 'React Three Fiber', 'GLSL'],
    summary:
      'Thousands of points sampled from the glyph raster, rendered with a custom point shader and additive blending. A spring simulation pulls each particle home while the cursor pushes them away.',
  },
  voxels: {
    label: 'Instanced voxels',
    tech: ['three.js', 'InstancedMesh', 'React Three Fiber'],
    summary:
      'The glyph is downsampled to a grid and extruded into a single InstancedMesh, so hundreds of cubes cost one draw call. A travelling wave and a cursor-driven lift animate each instance matrix.',
  },
  'pixel-shader': {
    label: 'Fragment shader',
    tech: ['WebGL', 'GLSL', 'fbm noise'],
    summary:
      'A full-screen fragment shader samples the glyph texture through a pixel grid whose cell size shrinks near the cursor, with fbm colour flow, band glitches and scanlines.',
  },
  'force-network': {
    label: 'Force simulation',
    tech: ['d3-force', 'Canvas 2D'],
    summary:
      'Nodes sampled from the glyph are linked to their nearest neighbours and held in place by d3 positioning forces, plus a custom force that repels them from the cursor. Click to scatter.',
  },
  contours: {
    label: 'Topographic contours',
    tech: ['d3-contour', 'd3-geo', 'SVG'],
    summary:
      'The glyph becomes terrain: a blurred height field plus drifting value noise, traced into isolines with marching squares every frame. The cursor raises a hill that the lines flow around.',
  },
  ascii: {
    label: 'ASCII field',
    tech: ['Canvas 2D', 'value noise'],
    summary:
      'Glyph coverage and noise map to a character ramp on a monospaced grid. The cursor scrambles nearby cells, and any keys you type become the scramble alphabet.',
  },
};

/** Code-split loaders so each page only downloads the technique it shows. */
export const loadTechnique: Record<
  TechniqueId,
  () => Promise<{ default: ComponentType<ExperimentProps> }>
> = {
  particles: () => import('./experiments/particles'),
  voxels: () => import('./experiments/voxels'),
  'pixel-shader': () => import('./experiments/pixel-shader'),
  'force-network': () => import('./experiments/force-network'),
  contours: () => import('./experiments/contours'),
  ascii: () => import('./experiments/ascii'),
};

export interface LabEntry {
  slug: string;
  glyph: string;
  /** "A is for …" */
  word: string;
  technique: TechniqueId;
  palette: PaletteName;
}

/** One experiment per letter of the name. */
export const lab: LabEntry[] = [
  {
    slug: 'a-attraction',
    glyph: 'A',
    word: 'Attraction',
    technique: 'particles',
    palette: 'ember',
  },
  {
    slug: 'h-height',
    glyph: 'H',
    word: 'Height',
    technique: 'voxels',
    palette: 'aurora',
  },
  {
    slug: 'm-molecules',
    glyph: 'M',
    word: 'Molecules',
    technique: 'force-network',
    palette: 'acid',
  },
  {
    slug: 'a-aliasing',
    glyph: 'A',
    word: 'Aliasing',
    technique: 'pixel-shader',
    palette: 'sunset',
  },
  {
    slug: 'd-dunes',
    glyph: 'D',
    word: 'Dunes',
    technique: 'contours',
    palette: 'ice',
  },
  {
    slug: 'm-monospace',
    glyph: 'M',
    word: 'Monospace',
    technique: 'ascii',
    palette: 'candy',
  },
  {
    slug: 'a-altitude',
    glyph: 'A',
    word: 'Altitude',
    technique: 'voxels',
    palette: 'sunset',
  },
  {
    slug: 'r-repulsion',
    glyph: 'R',
    word: 'Repulsion',
    technique: 'particles',
    palette: 'aurora',
  },
  {
    slug: 'z-zigzag',
    glyph: 'Z',
    word: 'Zigzag',
    technique: 'pixel-shader',
    palette: 'candy',
  },
  {
    slug: 'u-union',
    glyph: 'U',
    word: 'Union',
    technique: 'force-network',
    palette: 'ember',
  },
  {
    slug: 'k-karst',
    glyph: 'K',
    word: 'Karst',
    technique: 'contours',
    palette: 'acid',
  },
  {
    slug: 'i-input',
    glyph: 'I',
    word: 'Input',
    technique: 'ascii',
    palette: 'ice',
  },
];

/** Index where the surname starts, for rendering "AHMAD MARZUKI" with a gap. */
export const SURNAME_START = 5;

export const getLabEntry = (slug: string) => lab.find((e) => e.slug === slug);
export const paletteFor = (e: LabEntry) => palettes[e.palette];
