// Verifies: REQ-NF-U02 — Tichu call banner animation
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TichuBanner } from '@/components/game/TichuBanner';

describe('TichuBanner (REQ-NF-U02)', () => {
  it('renders nothing when no tichu event', () => {
    const { container } = render(<TichuBanner tichuEvent={null} />);
    expect(container.textContent).toBe('');
  });

  it('renders regular tichu banner', () => {
    render(<TichuBanner tichuEvent={{ seat: 'north', level: 'tichu' }} />);
    expect(screen.getByText('Tichu!')).toBeInTheDocument();
    expect(screen.getByText('North')).toBeInTheDocument();
  });

  it('renders grand tichu banner', () => {
    render(<TichuBanner tichuEvent={{ seat: 'east', level: 'grandTichu' }} />);
    expect(screen.getByText('Grand Tichu!')).toBeInTheDocument();
    expect(screen.getByText('East')).toBeInTheDocument();
  });

  it('does not render for none level', () => {
    const { container } = render(<TichuBanner tichuEvent={{ seat: 'south', level: 'none' }} />);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('has alert role for accessibility', () => {
    render(<TichuBanner tichuEvent={{ seat: 'west', level: 'tichu' }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
