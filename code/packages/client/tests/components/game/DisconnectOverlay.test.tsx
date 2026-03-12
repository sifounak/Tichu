// Verifies: REQ-F-MP08 — Disconnect handling UI
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DisconnectOverlay } from '@/components/game/DisconnectOverlay';

describe('DisconnectOverlay (REQ-F-MP08)', () => {
  const defaultProps = {
    disconnectedSeat: null as 'north' | null,
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
      <DisconnectOverlay {...defaultProps} disconnectedSeat="north" />,
    );
    expect(screen.getByText('Player Disconnected')).toBeInTheDocument();
    expect(screen.getByText(/North has lost connection/)).toBeInTheDocument();
  });

  it('shows vote buttons when vote is required', () => {
    render(
      <DisconnectOverlay
        {...defaultProps}
        disconnectedSeat="east"
        voteRequired={true}
      />,
    );
    expect(screen.getByLabelText('Wait for player to reconnect')).toBeInTheDocument();
    expect(screen.getByLabelText('Replace with bot')).toBeInTheDocument();
    expect(screen.getByLabelText('Abandon game')).toBeInTheDocument();
  });

  it('calls onVote with correct value', () => {
    const onVote = vi.fn();
    render(
      <DisconnectOverlay
        {...defaultProps}
        disconnectedSeat="south"
        voteRequired={true}
        onVote={onVote}
      />,
    );
    fireEvent.click(screen.getByLabelText('Replace with bot'));
    expect(onVote).toHaveBeenCalledWith('bot');
  });

  it('shows countdown timer', () => {
    render(
      <DisconnectOverlay
        {...defaultProps}
        disconnectedSeat="west"
        countdownSeconds={25}
      />,
    );
    expect(screen.getByText(/Auto-deciding in 25s/)).toBeInTheDocument();
  });

  it('hides vote buttons when vote is not required', () => {
    render(
      <DisconnectOverlay
        {...defaultProps}
        disconnectedSeat="north"
        voteRequired={false}
      />,
    );
    expect(screen.queryByLabelText('Wait for player to reconnect')).toBeNull();
  });
});
