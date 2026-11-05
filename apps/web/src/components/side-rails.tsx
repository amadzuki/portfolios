import Link from 'next/link';
import { site } from '../lib/site';

const nav = [
  { label: 'Lab', href: '/lab/a-attraction' },
  { label: 'Work', href: '/#work' },
  { label: 'Contact', href: `mailto:${site.email}` },
];

/** Fixed vertical rails on wide screens, a compact top bar on small ones. */
export function SideRails() {
  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-4 md:px-8">
        <Link
          href="/"
          className="pointer-events-auto font-display text-xs font-bold tracking-[0.3em] text-fg/90"
        >
          <span className="hidden sm:inline">
            AHMAD<span className="text-hot">·</span>MARZUKI
          </span>
          <span className="sm:hidden">
            A<span className="text-hot">·</span>M
          </span>
        </Link>
        <nav className="pointer-events-auto flex gap-5 text-[11px] uppercase tracking-[0.25em] text-muted md:hidden">
          {nav.map((n) => (
            <Link key={n.label} href={n.href} className="hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <nav
        aria-label="Primary"
        className="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-8 text-[11px] font-bold uppercase tracking-[0.3em] text-muted md:flex"
      >
        {nav.map((n) => (
          <Link
            key={n.label}
            href={n.href}
            className="vertical-rl transition-colors hover:text-fg"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <nav
        aria-label="Social"
        className="fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 rotate-180 flex-col items-center gap-8 text-[11px] font-bold uppercase tracking-[0.3em] text-muted md:flex"
      >
        {site.socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            className="vertical-rl transition-colors hover:text-fg"
            rel="me noreferrer"
            target="_blank"
          >
            {s.label}
          </a>
        ))}
      </nav>
    </>
  );
}
