import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Docent — a living onboarding portal for any codebase',
  description: 'Agent swarm codebase analysis with compounding memory, powered by the BTL Runtime',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
