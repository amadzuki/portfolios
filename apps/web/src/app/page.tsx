import { lab, paletteFor, techniques } from '@portfolios/visuals';
import Link from 'next/link';
import { GlyphStrip } from '../components/glyph-strip';
import { HeroName } from '../components/hero-name';
import { projects, site } from '../lib/site';

const statusLabel = {
  live: 'Live',
  building: 'Building',
  planned: 'Planned',
} as const;

export default function Home() {
  return (
    <main>
      <section className="relative h-dvh overflow-hidden">
        <HeroName className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-6 px-4 pb-10 text-center">
          <h1 className="sr-only">{site.name}</h1>
          <p className="animate-rise font-mono text-xs uppercase tracking-[0.35em] text-muted">
            {site.role}
          </p>
          <p className="animate-rise max-w-xl text-balance text-lg text-fg/90 [animation-delay:150ms] md:text-xl">
            {site.tagline}
          </p>
          <div className="pointer-events-auto animate-rise [animation-delay:300ms]">
            <GlyphStrip />
            <p className="mt-3 font-mono text-[11px] text-muted">
              pick a letter to enter the lab · move your cursor over the name
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-24 md:px-8 md:py-32">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-hot">
          About
        </p>
        <p className="mt-6 max-w-3xl text-balance font-display text-2xl leading-snug md:text-4xl">
          Frontend engineer who likes the space where{' '}
          <span className="text-gradient">design, data and code</span> meet.
          This site is a playground: every project below picks the framework
          that suits it best.
        </p>
      </section>

      <section
        id="work"
        className="mx-auto max-w-5xl scroll-mt-16 px-4 pb-24 md:px-8"
      >
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-hot">
          Work
        </p>
        <ul className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2">
          {projects.map((p) => {
            const body = (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">{p.title}</h3>
                  <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                    {statusLabel[p.status]}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {p.blurb}
                </p>
                <p className="mt-6 font-mono text-[11px] text-fg/70">
                  {p.stack.join(' · ')}
                </p>
              </>
            );
            return (
              <li key={p.title} className="bg-ink">
                {p.href ? (
                  <Link
                    href={p.href}
                    className="block h-full p-6 transition-colors hover:bg-ink-2 md:p-8"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="h-full p-6 md:p-8">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-32 md:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-hot">
          The Lab
        </p>
        <h2 className="mt-4 font-display text-2xl md:text-3xl">
          Twelve letters, six techniques.
        </h2>
        <ul className="mt-10 grid grid-cols-3 gap-3 md:grid-cols-6">
          {lab.map((e) => {
            const pal = paletteFor(e);
            return (
              <li key={e.slug}>
                <Link
                  href={`/lab/${e.slug}`}
                  className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-xl border border-line p-3 transition-transform duration-300 hover:-translate-y-1"
                  style={{ background: pal.background }}
                >
                  <span
                    className="font-display text-6xl font-black leading-none transition-transform duration-500 group-hover:scale-110"
                    style={{
                      background: `linear-gradient(135deg, ${pal.colors.join(', ')})`,
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                    }}
                  >
                    {e.glyph}
                  </span>
                  <span className="text-[11px] leading-tight">
                    <span className="block font-bold">{e.word}</span>
                    <span className="text-muted">
                      {techniques[e.technique].label}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="border-t border-line px-4 py-10 text-center font-mono text-[11px] text-muted md:px-8">
        <a href={`mailto:${site.email}`} className="hover:text-fg">
          {site.email}
        </a>
        <span className="mx-3">·</span>© {new Date().getFullYear()} {site.name}
      </footer>
    </main>
  );
}
