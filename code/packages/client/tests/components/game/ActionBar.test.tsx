// Verifies: REQ-F-HV06, REQ-F-GF08, REQ-F-DI04
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionBar } from '../../../src/components/game/ActionBar';

const defaultProps = {
  canPlay: false,
  canPass: false,
  isMyTurn: true,
  phase: 'playing' as const,
  myTichuCall: 'none' as const,
  hasPlayedCards: false,
  onPlay: vi.fn(),
  onPass: vi.fn(),
  onTichu: vi.fn(),
};

describe('ActionBar', () => {
  it('renders Play and Pass buttons when it is my turn and playing', () => {
    render(<ActionBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /play selected cards/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pass turn/i })).toBeInTheDocument();
  });

  it('hides Play/Pass when not my turn', () => {
    render(<ActionBar {...defaultProps} isMyTurn={false} />);
    expect(screen.queryByRole('button', { name: /play selected cards/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pass turn/i })).not.toBeInTheDocument();
  });

  it('disables Play when canPlay is false', () => {
    render(<ActionBar {...defaultProps} canPlay={false} />);
    expect(screen.getByRole('button', { name: /play selected cards/i })).toBeDisabled();
  });

  it('enables Play when canPlay is true', () => {
    render(<ActionBar {...defaultProps} canPlay={true} />);
    expect(screen.getByRole('button', { name: /play selected cards/i })).not.toBeDisabled();
  });

  it('disables Pass when canPass is false', () => {
    render(<ActionBar {...defaultProps} canPass={false} />);
    expect(screen.getByRole('button', { name: /pass turn/i })).toBeDisabled();
  });

  it('enables Pass when canPass is true', () => {
    render(<ActionBar {...defaultProps} canPass={true} />);
    expect(screen.getByRole('button', { name: /pass turn/i })).not.toBeDisabled();
  });

  it('calls onPlay when Play is clicked', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(<ActionBar {...defaultProps} canPlay={true} onPlay={onPlay} />);
    await user.click(screen.getByRole('button', { name: /play selected cards/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('calls onPass when Pass is clicked', async () => {
    const onPass = vi.fn();
    const user = userEvent.setup();
    render(<ActionBar {...defaultProps} canPass={true} onPass={onPass} />);
    await user.click(screen.getByRole('button', { name: /pass turn/i }));
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('Tichu button moved to card hand area (not in ActionBar)', () => {
    render(<ActionBar {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /declare tichu/i })).not.toBeInTheDocument();
  });

  it('has toolbar role', () => {
    render(<ActionBar {...defaultProps} />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});
