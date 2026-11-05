import { lab, SURNAME_START } from '@portfolios/visuals';
import Link from 'next/link';

/** "AHMAD MARZUKI" as a typographic nav; each letter opens its experiment. */
export function GlyphStrip({
  active,
  className = '',
}: {
  active?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Lab experiments"
      className={`flex flex-wrap items-end justify-center gap-x-2 gap-y-1 ${className}`}
    >
      {lab.map((e, i) => {
        const isActive = e.slug === active;
        return (
          <span key={e.slug} className="flex items-end">
            {i === SURNAME_START && <span className="w-4 md:w-6" aria-hidden />}
            <Link
              href={`/lab/${e.slug}`}
              aria-current={isActive ? 'page' : undefined}
              title={`${e.glyph} is for ${e.word}`}
              className={`font-display text-base leading-none transition-all duration-300 md:text-lg ${
                isActive
                  ? 'scale-125 text-fg'
                  : 'text-muted hover:-translate-y-0.5 hover:text-fg'
              }`}
            >
              {e.glyph}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
