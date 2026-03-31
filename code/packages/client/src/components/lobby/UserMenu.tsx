// REQ-F-LU02: User icon + username button with transparent background
// REQ-F-LU03: Clicking opens dropdown menu
// REQ-F-LU04: Dropdown "Play Stats" navigates to /stats
// REQ-F-LU05: Dropdown "Log Out" logs out and redirects
// REQ-F-LU06: Dropdown closes on outside click
'use client';

import { useState, useRef, useEffect } from 'react';

interface UserMenuProps {
  user: { username: string };
  onLogout: () => void;
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // REQ-F-LU06: Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const initial = user.username.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* REQ-F-LU02: Trigger button — transparent background */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg transition-opacity hover:opacity-80"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        aria-label="User menu"
        aria-expanded={open}
      >
        {/* Gold circle with first initial */}
        <div
          className="flex items-center justify-center rounded-full font-bold"
          style={{
            width: '32px',
            height: '32px',
            background: 'var(--color-gold-accent)',
            color: 'var(--color-felt-green-dark)',
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '14px' }}>
          {user.username}
        </span>
      </button>

      {/* REQ-F-LU03: Dropdown menu */}
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '4px',
            zIndex: 50,
            background: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            minWidth: '160px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {/* REQ-F-LU04: Play Stats */}
          <a
            href="/stats"
            onClick={() => setOpen(false)}
            style={{
              display: 'block',
              padding: '10px 16px',
              color: 'var(--color-text-primary)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            Play Stats
          </a>

          <div style={{ height: '1px', background: 'var(--color-border)' }} />

          {/* REQ-F-LU05: Log Out */}
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              color: 'var(--color-text-secondary)',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}
