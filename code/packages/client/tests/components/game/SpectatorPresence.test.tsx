import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SpectatorPresence } from '@/components/game/SpectatorPresence';
import type { RoomPlayer } from '@tichu/shared';

const players: RoomPlayer[] = [
  { seat: 'north', name: 'North Player', isBot: false, isConnected: true },
  { seat: 'east', name: 'East Player', isBot: false, isConnected: true },
  { seat: 'south', name: 'South Player', isBot: false, isConnected: true },
  { seat: 'west', name: 'West Player', isBot: false, isConnected: true },
];

function renderPresence(spectatorNames: string[] = []) {
  return render(
    <SpectatorPresence
      spectatorCount={spectatorNames.length}
      spectatorNames={spectatorNames}
      players={players}
    />,
  );
}

describe('SpectatorPresence', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show a toast on initial render with existing spectators', () => {
    renderPresence(['Maya']);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 spectator' })).toBeInTheDocument();
  });

  it('shows an avatar toast when one spectator joins', () => {
    const { rerender } = renderPresence([]);

    rerender(<SpectatorPresence spectatorCount={1} spectatorNames={['Maya']} players={players} />);

    expect(screen.getByRole('status')).toHaveTextContent('Maya is spectating');
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('shows a leave toast when one spectator leaves', () => {
    const { rerender } = renderPresence(['Maya']);

    rerender(<SpectatorPresence spectatorCount={0} spectatorNames={[]} players={players} />);

    expect(screen.getByRole('status')).toHaveTextContent('Maya left');
  });

  it('aggregates multiple spectator changes in one toast', () => {
    const { rerender } = renderPresence([]);

    rerender(<SpectatorPresence spectatorCount={3} spectatorNames={['Maya', 'Jordan', 'Sam']} players={players} />);

    expect(screen.getByRole('status')).toHaveTextContent('3 spectators joined');
  });

  it('hides the toast and shows the spectator list on hover', () => {
    const { rerender } = renderPresence([]);
    rerender(<SpectatorPresence spectatorCount={1} spectatorNames={['Maya']} players={players} />);

    fireEvent.mouseEnter(screen.getByRole('button', { name: '1 spectator' }).parentElement!);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Spectators')).toBeInTheDocument();
    expect(screen.getByText('Maya')).toBeInTheDocument();
  });

  it('does not show a leave toast when a spectator claims a player seat', () => {
    const { rerender } = renderPresence(['Maya']);
    const playersWithMaya: RoomPlayer[] = [
      ...players.slice(0, 3),
      { seat: 'west', name: 'Maya', isBot: false, isConnected: true },
    ];

    rerender(<SpectatorPresence spectatorCount={0} spectatorNames={[]} players={playersWithMaya} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('auto-dismisses the toast', () => {
    vi.useFakeTimers();
    const { rerender } = renderPresence([]);
    rerender(<SpectatorPresence spectatorCount={1} spectatorNames={['Maya']} players={players} />);

    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
