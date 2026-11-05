import {
  earlier,
  education,
  experience,
  formatMonth,
  profile,
  projects,
  type Project,
} from '@portfolios/content';
import { lab, paletteFor, techniques } from '@portfolios/visuals';
import Link from 'next/link';
import { AskAhmad } from '../components/ask-ahmad';
import { GlyphStrip } from '../components/glyph-strip';
import { HeroName } from '../components/hero-name';
import { site } from '../lib/site';

const statusLabel = {
  live: 'Live',
  building: 'Building',
  planned: 'Planned',
} as const;

/** Lets each deployment point at its own game URL (e.g. a preview). */
const hrefFor = (p: Project) =>
  p.id === 'proj-lumen-drift'
    ? (process.env.NEXT_PUBLIC_GAME_URL ?? p.href)
    : p.href;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.35em] text-hot">
      {children}
    </p>
  );
}

function ProjectCard({ p }: { p: Project }) {
  const href = hrefFor(p);
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{p.title}</h3>
        <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {statusLabel[p.status]}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{p.blurb}</p>
      <p className="mt-6 font-mono text-[11px] text-fg/70">
        {p.stack.join(' · ')}
      </p>
    </>
  );
  const cls = 'block h-full p-6 transition-colors hover:bg-ink-2 md:p-8';
  if (!href) return <div className="h-full p-6 md:p-8">{body}</div>;
  return href.startsWith('http') ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}

export default function Home() {
  return (
    <main>
      <section className="relative h-dvh overflow-hidden">
        <HeroName className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-6 px-4 pb-10 text-center">
          <h1 className="sr-only">{site.name}</h1>
          <p className="animate-rise font-mono text-xs uppercase tracking-[0.35em] text-muted">
            {site.role} · {profile.location.split(',')[0]}, Indonesia
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

      <section
        id="about"
        className="mx-auto max-w-5xl scroll-mt-16 px-4 py-24 md:px-8 md:py-32"
      >
        <SectionLabel>About</SectionLabel>
        <p className="mt-6 max-w-3xl text-balance font-display text-2xl leading-snug md:text-4xl">
          Materials engineer turned{' '}
          <span className="text-gradient">frontend engineer</span>. Six years
          shipping production web apps with React and Next.js, now a{' '}
          {profile.headline} at {profile.company}.
        </p>
        <p className="mt-8 max-w-2xl leading-relaxed text-muted">
          {profile.summary}
        </p>
        <ul className="mt-8 flex flex-wrap gap-2">
          {profile.topSkills.map((s) => (
            <li
              key={s}
              className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-fg/80"
            >
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section
        id="experience"
        className="mx-auto max-w-5xl scroll-mt-16 px-4 pb-24 md:px-8"
      >
        <SectionLabel>Experience</SectionLabel>
        <ol className="mt-10 border-l border-line">
          {experience.map((r) => (
            <li
              key={r.id}
              id={r.id}
              className="relative scroll-mt-24 pb-12 pl-8 last:pb-0"
            >
              <span
                className={`absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full ${r.end ? 'bg-line ring-4 ring-ink' : 'bg-hot ring-4 ring-hot/20'}`}
                aria-hidden
              />
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                {formatMonth(r.start)} – {formatMonth(r.end)} · {r.location}
              </p>
              <h3 className="mt-2 font-display text-lg font-bold">
                {r.title} <span className="font-normal text-muted">at</span>{' '}
                {r.company}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg/80">
                {r.summary}
              </p>
              {r.highlights.length > 0 && (
                <ul className="mt-3 max-w-2xl list-disc space-y-1 pl-4 text-sm leading-relaxed text-muted marker:text-hot">
                  {r.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              {r.link && (
                <a
                  href={r.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block font-mono text-[11px] text-hot hover:underline"
                >
                  {r.link.replace('https://', '')} ↗
                </a>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section
        id="earlier"
        className="mx-auto max-w-5xl scroll-mt-16 px-4 pb-24 md:px-8"
      >
        <SectionLabel>Before code</SectionLabel>
        <div className="mt-6 grid gap-10 md:grid-cols-[1.4fr_1fr]">
          <p className="leading-relaxed text-muted">{earlier.summary}</p>
          <ul className="space-y-4">
            {education.items.map((e) => (
              <li key={e.school}>
                <p className="font-display text-sm font-bold">{e.school}</p>
                <p className="text-sm text-muted">
                  {e.detail}
                  {e.years && ` · ${e.years}`}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="work"
        className="mx-auto max-w-5xl scroll-mt-16 px-4 pb-24 md:px-8"
      >
        <SectionLabel>Work &amp; experiments</SectionLabel>
        <ul className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id} className="bg-ink">
              <ProjectCard p={p} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-32 md:px-8">
        <SectionLabel>The Lab</SectionLabel>
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

      <AskAhmad />
    </main>
  );
}
