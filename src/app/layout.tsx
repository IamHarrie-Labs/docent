import type { Metadata } from 'next';
import { Almarai, Instrument_Serif } from 'next/font/google';
import './globals.css';

const almarai = Almarai({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '700', '800'],
  variable: '--font-almarai',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-serif-italic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Docent, a codebase companion that remembers',
  description: 'Six agents read your repository, argue about what they found, and remember it the next time you ask. Powered by the BTL Runtime.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${almarai.variable} ${instrumentSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
