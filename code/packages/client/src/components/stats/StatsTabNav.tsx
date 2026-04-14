'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/stats', label: 'Overview' },
  { href: '/stats/cards', label: 'Card Stats' },
  { href: '/stats/tichu', label: 'Tichu Calls' },
  { href: '/stats/players', label: 'Partners & Opponents' },
  { href: '/stats/history', label: 'Game History' },
] as const;

export function StatsTabNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: 'flex',
        gap: '0.25rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        marginBottom: '1.5rem',
        overflowX: 'auto',
      }}
    >
      {TABS.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'inline-block',
              padding: '0.6rem 1rem',
              fontSize: '0.85rem',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#dbb856' : 'rgba(255,255,255,0.4)',
              borderBottom: isActive ? '2px solid #dbb856' : '2px solid transparent',
              background: isActive ? 'rgba(219,184,86,0.12)' : 'transparent',
              borderRadius: '6px 6px 0 0',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
