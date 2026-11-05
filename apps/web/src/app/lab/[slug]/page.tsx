import { getLabEntry, lab, paletteFor, techniques } from '@portfolios/visuals';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Experiment } from '../../../components/experiment';
import { GlyphStrip } from '../../../components/glyph-strip';
import { LabKeys } from '../../../components/lab-keys';

export const dynamicParams = false;
export const generateStaticParams = () => lab.map((e) => ({ slug: e.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = getLabEntry((await params).slug);
  if (!e) return {};
  return {
    title: `${e.glyph} is for ${e.word}`,
    description: techniques[e.technique].summary,
  };
}

const Arrow = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg
    viewBox="0 0 30 60"
    className="h-8 w-4 md:h-10 md:w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    aria-hidden
  >
    <path d={dir === 'left' ? 'M29 1 1 30l28 29' : 'M1 1l28 29L1 59'} />
  </svg>
);

export default async function LabPage({ params }: Props) {
  const { slug } = await params;
  const entry = getLabEntry(slug);
  if (!entry) notFound();

  const i = lab.indexOf(entry);
  const prev = lab[(i - 1 + lab.length) % lab.length];
  const next = lab[(i + 1) % lab.length];
  const tech = techniques[entry.technique];
  const palette = paletteFor(entry);

  return (
    <main
      className="relative h-dvh overflow-hidden"
      style={{ background: palette.background }}
    >
      <h1 className="sr-only">
        {entry.glyph} is for {entry.word}
      </h1>
      <Experiment
        key={entry.slug}
        technique={entry.technique}
        glyph={entry.glyph}
        palette={palette}
        className="absolute inset-0"
        label={`${entry.glyph} rendered with ${tech.label.toLowerCase()}`}
      />

      <aside
        key={`info-${entry.slug}`}
        className="animate-rise pointer-events-none absolute bottom-20 left-4 right-4 z-10 border-y border-line py-4 md:bottom-auto md:left-auto md:right-24 md:top-1/2 md:w-72 md:-translate-y-1/2 md:py-6"
      >
        <p className="font-mono text-[11px] text-muted">
          {String(i + 1).padStart(2, '0')} / {lab.length}
        </p>
        <h2 className="mt-2 font-display text-sm font-bold uppercase tracking-wider">
          {entry.glyph} is for {entry.word}
        </h2>
        <p className="mt-2 text-sm">
          <span className="font-bold">Tech:</span>{' '}
          <span className="text-fg/80">{tech.tech.join(', ')}</span>
        </p>
        <p className="mt-3 hidden text-sm leading-relaxed text-muted md:block">
          {tech.summary}
        </p>
      </aside>

      <div className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center gap-4 px-4 md:gap-8">
        <Link
          href={`/lab/${prev.slug}`}
          aria-label={`Previous: ${prev.glyph} is for ${prev.word}`}
          className="text-fg/60 transition hover:-translate-x-1 hover:text-fg"
        >
          <Arrow dir="left" />
        </Link>
        <GlyphStrip active={entry.slug} />
        <Link
          href={`/lab/${next.slug}`}
          aria-label={`Next: ${next.glyph} is for ${next.word}`}
          className="text-fg/60 transition hover:translate-x-1 hover:text-fg"
        >
          <Arrow dir="right" />
        </Link>
      </div>
      <LabKeys prev={`/lab/${prev.slug}`} next={`/lab/${next.slug}`} />
    </main>
  );
}
