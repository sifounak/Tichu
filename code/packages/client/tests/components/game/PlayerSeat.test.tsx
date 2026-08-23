// Verifies: REQ-F-DI01, REQ-F-DI02, REQ-F-DI03, REQ-F-DI04
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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

  it('renders card count badge for own seat', () => {
    render(<PlayerSeat {...baseProps} isMe />);
    // Own seat now shows same card-back stack with count badge as other seats
    expect(screen.getByText('14')).toBeInTheDocument();
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
    const badges = screen.getAllByText('#1');
    expect(badges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Out').length).toBeGreaterThanOrEqual(1);
  });

  it('highlights current turn', () => {
    const { container } = render(<PlayerSeat {...baseProps} isCurrentTurn />);
    expect(container.querySelector('[class*="active"]')).toBeTruthy();
  });

  it('keeps the blue current-turn border when the turn timer is active', () => {
    const playerSeatCss = readFileSync('src/components/game/PlayerSeat.module.css', 'utf8');

    expect(playerSeatCss).toMatch(/\.timerNoGlow\s*\{[^}]*border-color:\s*#4a9eff;/s);
    expect(playerSeatCss).toMatch(/\.timerAmber\s*\{[^}]*border-color:\s*#4a9eff;/s);
    expect(playerSeatCss).toMatch(/\.timerRed\s*\{[^}]*border-color:\s*#4a9eff;/s);
  });

  it('uses an outside vertical timer progress bar', () => {
    const playerSeatCss = readFileSync('src/components/game/PlayerSeat.module.css', 'utf8');

    expect(playerSeatCss).toMatch(/\.timerProgressActive::before\s*\{[^}]*top:\s*0;[^}]*bottom:\s*0;[^}]*width:\s*calc\(8px \* var\(--scale\)\);/s);
    expect(playerSeatCss).toMatch(/\.timerProgressActive::after\s*\{[^}]*bottom:\s*0;[^}]*height:\s*var\(--timer-progress,\s*0%\);/s);
    expect(playerSeatCss).toMatch(/\.timerProgressLeft::before,\s*\.timerProgressLeft::after\s*\{[^}]*right:\s*calc\(100% \+ 6px \* var\(--scale\)\);/s);
    expect(playerSeatCss).toMatch(/\.timerProgressRight::before,\s*\.timerProgressRight::after\s*\{[^}]*left:\s*calc\(100% \+ 6px \* var\(--scale\)\);/s);
  });

  it('highlights own seat', () => {
    const { container } = render(<PlayerSeat {...baseProps} isMe />);
    expect(container.querySelector('[class*="me"]')).toBeTruthy();
  });

  it('shows initial when no finish order', () => {
    render(<PlayerSeat {...baseProps} />);
    expect(screen.getByText('N')).toBeInTheDocument();
  });

  it('constrains player names for ellipsis in standard and pre-game seat layouts', () => {
    const playerSeatCss = readFileSync('src/components/game/PlayerSeat.module.css', 'utf8');
    const preRoomCss = readFileSync('src/components/game/PreRoomView.module.css', 'utf8');

    expect(playerSeatCss).toMatch(/\.name\s*\{[^}]*white-space:\s*nowrap;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*min-width:\s*0;[^}]*width:\s*100%;/s);
    expect(preRoomCss).toMatch(/\.botSeatContent\s*\{[^}]*align-self:\s*stretch;[^}]*min-width:\s*0;[^}]*width:\s*100%;/s);
    expect(preRoomCss).toMatch(/\.botName\s*\{[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
    expect(preRoomCss).toMatch(/\.emptySeatContent\s*\{[^}]*align-self:\s*stretch;[^}]*min-width:\s*0;[^}]*width:\s*100%;/s);
    expect(preRoomCss).toMatch(/\.emptyTitle\s*\{[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
  });
});
