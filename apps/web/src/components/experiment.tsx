'use client';
import {
  loadTechnique,
  type ExperimentProps,
  type Palette,
  type TechniqueId,
} from '@portfolios/visuals';
import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';
import { display } from '../lib/fonts';

const cache = new Map<
  TechniqueId,
  LazyExoticComponent<ComponentType<ExperimentProps>>
>();
const getComponent = (id: TechniqueId) => {
  let c = cache.get(id);
  if (!c) cache.set(id, (c = lazy(loadTechnique[id])));
  return c;
};

function Placeholder({
  glyph,
  palette,
  className,
}: {
  glyph: string;
  palette: Palette;
  className?: string;
}) {
  return (
    <div
      className={`${className ?? ''} grid place-items-center`}
      style={{ background: palette.background }}
      aria-hidden
    >
      <span
        className="font-display text-[28vmin] font-black leading-none opacity-20"
        style={{ color: palette.colors[1] }}
      >
        {glyph}
      </span>
    </div>
  );
}

/** Lazy-loads a generative technique after the display font is ready (glyphs are rasterised from it). */
export function Experiment({
  technique,
  glyph,
  palette,
  className,
  label,
  count,
  pointSize,
}: {
  count?: number;
  pointSize?: number;
  technique: TechniqueId;
  glyph: string;
  palette: Palette;
  className?: string;
  label: string;
}) {
  const [fontReady, setFontReady] = useState(false);
  const fontFamily = display.style.fontFamily;

  useEffect(() => {
    let alive = true;
    document.fonts
      .load(`900 100px ${fontFamily}`)
      .catch(() => undefined)
      .finally(() => alive && setFontReady(true));
    return () => {
      alive = false;
    };
  }, [fontFamily]);

  const Component = getComponent(technique);
  const placeholder = (
    <Placeholder glyph={glyph} palette={palette} className={className} />
  );

  return (
    <div role="img" aria-label={label} className="contents">
      {fontReady ? (
        <Suspense fallback={placeholder}>
          <Component
            glyph={glyph}
            palette={palette}
            fontFamily={fontFamily}
            className={className}
            count={count}
            pointSize={pointSize}
          />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}
