// Verifies: REQ-F-HV06, REQ-F-GF08, REQ-F-DI04, REQ-F-AP01, REQ-F-AP02, REQ-F-AP03, REQ-F-AP07
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
  hasBombReady: false,
  onPlay: vi.fn(),
  onPass: vi.fn(),
  onTichu: vi.fn(),
  onBomb: vi.fn(),
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

  // Verifies: REQ-F-AP02/AP03 — Auto-pass toggle not rendered by default
  describe('Auto-pass toggle', () => {
    it('is not rendered when showAutoPass is false (default)', () => {
      render(<ActionBar {...defaultProps} />);
      expect(screen.queryByRole('checkbox', { name: /auto-pass/i })).not.toBeInTheDocument();
    });

    // Verifies: REQ-F-AP01 — Toggle visible when not my turn (replaces Pass button)
    it('is rendered when showAutoPass is true and not my turn', () => {
      render(
        <ActionBar
          {...defaultProps}
          isMyTurn={false}
          showAutoPass={true}
          onAutoPassToggle={vi.fn()}
        />,
      );
      expect(screen.getByRole('checkbox', { name: /auto-pass/i })).toBeInTheDocument();
      // Pass button should NOT be shown (not my turn)
      expect(screen.queryByRole('button', { name: /pass turn/i })).not.toBeInTheDocument();
    });

    // Verifies: REQ-F-AP01 — On my turn with auto-pass off, show Pass instead of toggle
    it('shows Pass button instead of toggle when my turn and auto-pass off', () => {
      render(
        <ActionBar
          {...defaultProps}
          isMyTurn={true}
          showAutoPass={true}
          autoPassEnabled={false}
          onAutoPassToggle={vi.fn()}
        />,
      );
      expect(screen.getByRole('button', { name: /pass turn/i })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: /auto-pass/i })).not.toBeInTheDocument();
    });

    // Verifies: REQ-F-AP01 — On my turn with auto-pass on, keep toggle visible (no Pass button)
    it('shows toggle instead of Pass when my turn and auto-pass on', () => {
      render(
        <ActionBar
          {...defaultProps}
          isMyTurn={true}
          showAutoPass={true}
          autoPassEnabled={true}
          onAutoPassToggle={vi.fn()}
        />,
      );
      expect(screen.getByRole('checkbox', { name: /auto-pass/i })).toBeChecked();
      expect(screen.queryByRole('button', { name: /pass turn/i })).not.toBeInTheDocument();
    });

    // Verifies: REQ-F-AP03 — Default state is off/unchecked
    it('is unchecked by default', () => {
      render(
        <ActionBar
          {...defaultProps}
          isMyTurn={false}
          showAutoPass={true}
          autoPassEnabled={false}
          onAutoPassToggle={vi.fn()}
        />,
      );
      expect(screen.getByRole('checkbox', { name: /auto-pass/i })).not.toBeChecked();
    });

    // Verifies: REQ-F-AP01 — Toggle calls onAutoPassToggle when clicked
    it('calls onAutoPassToggle when clicked', async () => {
      const onAutoPassToggle = vi.fn();
      const user = userEvent.setup();
      render(
        <ActionBar
          {...defaultProps}
          isMyTurn={false}
          showAutoPass={true}
          autoPassEnabled={false}
          onAutoPassToggle={onAutoPassToggle}
        />,
      );
      await user.click(screen.getByRole('checkbox', { name: /auto-pass/i }));
      expect(onAutoPassToggle).toHaveBeenCalledWith(true);
    });

    // Verifies: REQ-F-AP07 — Bomb button renders independently of auto-pass
    it('does not suppress bomb button when auto-pass is enabled', () => {
      render(
        <ActionBar
          {...defaultProps}
          isMyTurn={false}
          hasBombReady={true}
          showAutoPass={true}
          autoPassEnabled={true}
          onAutoPassToggle={vi.fn()}
        />,
      );
      expect(screen.getByRole('button', { name: /play bomb/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /auto-pass/i })).toBeInTheDocument();
    });
  });
});
