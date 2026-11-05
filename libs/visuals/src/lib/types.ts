export interface Palette {
  background: string;
  /** Gradient stops used across the glyph. */
  colors: [string, string, string];
}

export interface ExperimentProps {
  glyph: string;
  palette: Palette;
  className?: string;
  /** CSS font-family used to rasterise glyphs (pass the site's display font). */
  fontFamily?: string;
  /** Technique-specific density hint (e.g. particle count). */
  count?: number;
  /** Technique-specific size hint in px (e.g. particle size). */
  pointSize?: number;
}
