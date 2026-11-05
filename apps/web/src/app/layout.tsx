import type { Metadata, Viewport } from 'next';
import { SideRails } from '../components/side-rails';
import { display, grotesk, mono } from '../lib/fonts';
import { site } from '../lib/site';
import './global.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} · ${site.role}`,
    template: `%s · ${site.name}`,
  },
  description: site.tagline,
  openGraph: {
    title: site.name,
    description: site.tagline,
    url: site.url,
    siteName: site.name,
  },
};

export const viewport: Viewport = { themeColor: '#07060b' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${grotesk.variable} ${mono.variable}`}
    >
      <body className="min-h-dvh bg-ink">
        <SideRails />
        {children}
      </body>
    </html>
  );
}
