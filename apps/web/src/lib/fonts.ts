import { JetBrains_Mono, Space_Grotesk, Unbounded } from 'next/font/google';

export const display = Unbounded({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-unbounded',
});
export const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
});
export const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});
