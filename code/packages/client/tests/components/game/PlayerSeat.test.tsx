// Verifies: REQ-F-DI01, REQ-F-DI02, REQ-F-DI03, REQ-F-DI04
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerSeat } from '@/components/game/PlayerSeat';

describe('PlayerSeat', () => {
  const baseProps = {
    seat: 'north' as const,
    cardCount: 14,
    tichuCall: 'none' as const,
    hasPlayed: false,
    hasPassed: false,
    finishOrder: null,
    isCurrentTurn: false,
    isTrickLeader: false,
    isMe: false,
  };

  it('renders seat with name and card count', () => {
    render(<PlayerSeat {...baseProps} />);
    expect(screen.getByText('North')).toBeInTheDocument();
    // Non-"me" seats show card-back stacks with count badge
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('renders text card count for own seat', () => {
    render(<PlayerSeat {...baseProps} isMe />);
    expect(screen.getByText('14 cards')).toBeInTheDocument();
  });

  it('renders custom display name', () => {
    render(<PlayerSeat {...baseProps} displayName="Alice" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows Tichu banner when called', () => {
    render(<PlayerSeat {...baseProps} tichuCall="tichu" />);
    expect(screen.getByText('Tichu')).toBeInTheDocument();
    expect(screen.getByLabelText('Tichu called')).toBeInTheDocument();
  });

  it('shows Grand Tichu banner when called', () => {
    render(<PlayerSeat {...baseProps} tichuCall="grandTichu" />);
    expect(screen.getByText('Grand Tichu')).toBeInTheDocument();
    expect(screen.getByLabelText('Grand Tichu called')).toBeInTheDocument();
  });

  it('shows pass indicator', () => {
    render(<PlayerSeat {...baseProps} hasPassed />);
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it('shows finish order badge', () => {
    render(<PlayerSeat {...baseProps} finishOrder={1} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('Out')).toBeInTheDocument();
  });

  it('highlights current turn', () => {
    const { container } = render(<PlayerSeat {...baseProps} isCurrentTurn />);
    expect(container.querySelector('[class*="active"]')).toBeTruthy();
  });

  it('highlights own seat', () => {
    const { container } = render(<PlayerSeat {...baseProps} isMe />);
    expect(container.querySelector('[class*="me"]')).toBeTruthy();
  });

  it('shows initial when no finish order', () => {
    render(<PlayerSeat {...baseProps} />);
    expect(screen.getByText('N')).toBeInTheDocument();
  });
});
