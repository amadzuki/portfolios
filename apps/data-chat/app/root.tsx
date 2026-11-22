import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/instrument-sans/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type MetaFunction,
} from 'react-router';
import type { Route } from './+types/root';
import './app.css';

export const meta: MetaFunction = () => [
  { title: 'Ask your data · Ahmad Marzuki' },
  {
    name: 'description',
    content:
      'Drop in a CSV and ask questions in plain words. Charts are computed in your browser; only the column names ever reach the model.',
  },
  { name: 'theme-color', content: '#f3ede2' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231b1916'/%3E%3Crect x='7' y='16' width='4' height='9' fill='%23e4472b'/%3E%3Crect x='14' y='9' width='4' height='16' fill='%23f3ede2'/%3E%3Crect x='21' y='13' width='4' height='12' fill='%23d29b2a'/%3E%3C/svg%3E"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const title = isRouteErrorResponse(error)
    ? error.status === 404
      ? 'Nothing here'
      : `${error.status} ${error.statusText}`
    : 'Something broke';
  const detail = isRouteErrorResponse(error)
    ? typeof error.data === 'string'
      ? error.data
      : 'That page does not exist, or the dataset was removed from this browser.'
    : error instanceof Error
      ? error.message
      : 'Unknown error';
  return (
    <main className="mx-auto max-w-xl px-4 py-24">
      <p className="kicker">Error</p>
      <h1 className="font-display mt-2 text-4xl">{title}</h1>
      <p className="mt-4 text-[var(--muted-ink)]">{detail}</p>
      <a href="/" className="btn mt-8 inline-flex">
        ← Back to datasets
      </a>
    </main>
  );
}
