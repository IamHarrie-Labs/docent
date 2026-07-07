'use client';

import Link from 'next/link';

const LINK_STYLE = { color: 'rgba(225, 224, 204, 0.8)' } as const;

const ITEMS = [
  { href: '/#story', label: 'Story' },
  { href: '/#swarm', label: 'The swarm' },
  { href: '/#memory', label: 'Memory' },
  { href: '/docs', label: 'Docs' },
  { href: '/analyze', label: 'Try it' },
];

export function Navbar() {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
      <nav className="bg-black rounded-b-2xl md:rounded-b-3xl px-4 py-2 md:px-8 flex items-center gap-3 sm:gap-6 md:gap-12 lg:gap-14">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={LINK_STYLE}
            className="text-[10px] sm:text-xs md:text-sm whitespace-nowrap transition-colors hover:!text-[#E1E0CC]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
