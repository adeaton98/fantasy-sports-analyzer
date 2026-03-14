'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSportStore } from '@/store/useSportStore';

export default function Nav() {
  const { activeSport } = useSportStore();
  const pathname = usePathname();

  const baseLinks = [
    { href: '/upload', label: 'Upload Data', icon: '↑' },
    { href: `/${activeSport}/analysis`, label: 'Analysis', icon: '◈' },
  ];

  const sportLinks = activeSport === 'baseball'
    ? [
        { href: '/baseball/deep-analysis', label: 'Deep Analysis', icon: '🔬' },
        { href: '/baseball/auction', label: 'Auction Values', icon: '$' },
        { href: '/baseball/draft', label: 'Draft Mode', icon: '◎' },
        { href: '/baseball/watchlist', label: 'Watchlist', icon: '★' },
        { href: '/baseball/league', label: 'My League', icon: '🏆' },
      ]
    : [
        { href: '/basketball/draft', label: 'Draft Mode', icon: '◎' },
      ];

  const links = [...baseLinks, ...sportLinks];

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const active = pathname === link.href || pathname?.startsWith(link.href + '/');
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200
              ${active
                ? 'accent-text font-semibold accent-dim-bg'
                : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--navy-3)]'
              }
            `}
          >
            <span className="font-mono text-xs">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
