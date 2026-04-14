'use client';

import Link from 'next/link';

interface StatSectionProps {
  title: string;
  href?: string;
  children: React.ReactNode;
}

export function StatSection({ title, href, children }: StatSectionProps) {
  return (
    <section style={{ marginBottom: '1.8rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <span
          style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: 'rgba(255,255,255,0.3)',
            fontWeight: 600,
          }}
        >
          {title}
        </span>
        {href && (
          <Link
            href={href}
            style={{
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.3)',
              textDecoration: 'none',
              marginLeft: '0.25rem',
            }}
          >
            →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
