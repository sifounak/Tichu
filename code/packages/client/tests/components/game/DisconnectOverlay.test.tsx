// Verifies: REQ-F-ES04 — Disconnect handling UI with Wait/Kick vote
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DisconnectOverlay } from '@/components/game/DisconnectOverlay';

describe('DisconnectOverlay (REQ-F-ES04)', () => {
  const defaultProps = {
    disconnectedSeats: [] as ('north' | 'east' | 'south' | 'west')[],
    voteRequired: false,
    onVote: vi.fn(),
    countdownSeconds: 0,
    reconnectedSeat: null as 'north' | null,
  };

  it('renders nothing when no one is disconnected', () => {
    const { container } = render(<DisconnectOverlay {...defaultProps} />);
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('shows overlay when a player disconnects', () => {
    render(
      <DisconnectOverlay {...defaultProps} disconnectedSeats={['north']} />,
    );
    expect(screen.getByText('Player Disconnected')).toBeInTheDocument();
    expect(screen.getByText(/North has lost connection/)).toBeInTheDocument();
  });

  it('shows vote buttons when vote is required', () => {
    render(
      <DisconnectOverlay
        {...defaultProps}
        disconnectedSeats={['east']}
        voteRequired={true}
      />,
    );
    expect(screen.getByLabelText('Wait for player to rejoin')).toBeInTheDocument();
    expect(screen.getByLabelText('Kick disconnected player')).toBeInTheDocument();
  });

  it('calls onVote with kick', () => {
    const onVote = vi.fn();
    render(
      <DisconnectOverlay
        {...defaultProps}
        disconnectedSeats={['south']}
        voteRequired={true}
        onVote={onVote}
      />,
    );
    fireEvent.click(screen.getByLabelText('Kick disconnected player'));
    expect(onVote).toHaveBeenCalledWith('kick');
  });

  it('shows countdown timer with auto-kick text', () => {
    render(
      <DisconnectOverlay
        {...defaultProps}
        disconnectedSeats={['west']}
        countdownSeconds={25}
      />,
    );
    expect(screen.getByText(/Auto-kicking in 25s/)).toBeInTheDocument();
  });

  it('hides vote buttons when vote is not required', () => {
    render(
      <DisconnectOverlay
        {...defaultProps}
        disconnectedSeats={['north']}
        voteRequired={false}
      />,
    );
    expect(screen.queryByLabelText('Wait for player to rejoin')).toBeNull();
  });

  // REQ-F-ES17: Multi-disconnect support
  it('shows plural text for multiple disconnected players', () => {
    render(
      <DisconnectOverlay
        {...defaultProps}
        disconnectedSeats={['north', 'east']}
      />,
    );
    expect(screen.getByText('Players Disconnected')).toBeInTheDocument();
    expect(screen.getByText(/North and East have lost connection/)).toBeInTheDocument();
  });
});
