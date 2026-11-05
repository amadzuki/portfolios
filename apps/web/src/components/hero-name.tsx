'use client';
import { palettes } from '@portfolios/visuals';
import { useEffect, useState } from 'react';
import { Experiment } from './experiment';

/** The name as an interactive particle field; wraps to two lines on narrow screens. */
export function HeroName({ className }: { className?: string }) {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (narrow === null)
    return (
      <div
        className={className}
        style={{ background: palettes.ember.background }}
      />
    );
  return (
    <Experiment
      key={String(narrow)}
      technique="particles"
      glyph={narrow ? 'AHMAD\nMARZUKI' : 'AHMAD MARZUKI'}
      palette={palettes.ember}
      count={narrow ? 9000 : 16000}
      pointSize={narrow ? 2.4 : 2.8}
      className={className}
      label="The name Ahmad Marzuki drawn with interactive particles"
    />
  );
}
