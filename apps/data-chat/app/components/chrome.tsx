import { Link } from 'react-router';

export function Masthead({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b border-[var(--ink)]">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2"
          aria-label="Ask your data, home"
        >
          <Logo />
          <span className="font-display text-lg leading-none tracking-tight">
            Ask your data
          </span>
        </Link>
        <div className="min-w-0 flex-1">{children}</div>
        <a
          href="https://ahmadmarzuki.com"
          className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-ink)] hover:text-[var(--ink)] sm:block"
        >
          by Ahmad Marzuki ↗
        </a>
      </div>
    </header>
  );
}

export function Logo() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 32 32"
      aria-hidden
      className="shrink-0"
    >
      <rect width="32" height="32" rx="6" fill="var(--ink)" />
      <rect
        x="7"
        y="16"
        width="4"
        height="9"
        fill="var(--accent)"
        className="origin-bottom transition-transform duration-300 group-hover:scale-y-125"
      />
      <rect x="14" y="9" width="4" height="16" fill="var(--paper)" />
      <rect
        x="21"
        y="13"
        width="4"
        height="12"
        fill="var(--c3)"
        className="origin-bottom transition-transform duration-300 group-hover:scale-y-75"
      />
    </svg>
  );
}

export function LocalBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c2)]/40 bg-[var(--c2)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--c2)]"
      title="Rows are parsed, stored and charted in this browser. The server only sees column names, types and stats."
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden
      >
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 1 1 8 0v4" />
      </svg>
      Data stays in this browser
    </span>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--rule)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 font-mono text-[11px] text-[var(--muted-ink)] sm:px-6">
        <span>
          React Router · visx · Papa Parse in a Web Worker · IndexedDB
        </span>
        <span className="flex-1" />
        <a
          className="hover:text-[var(--ink)]"
          href="https://github.com/amadzuki/portfolios/tree/main/apps/data-chat"
        >
          Source ↗
        </a>
        <a className="hover:text-[var(--ink)]" href="https://ahmadmarzuki.com">
          ahmadmarzuki.com ↗
        </a>
      </div>
    </footer>
  );
}
