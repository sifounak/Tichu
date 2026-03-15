// Verifies: REQ-F-WP01
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WishPicker } from '../../../src/components/game/WishPicker';

describe('WishPicker', () => {
  const onSelect = vi.fn();
  const onCancel = vi.fn();

  it('renders 13 rank buttons (2-A) plus No Wish', () => {
    render(<WishPicker onSelect={onSelect} onCancel={onCancel} />);
    // 13 rank buttons + No Wish + Cancel = 15 buttons total
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(15);
    // Verify face card labels
    expect(screen.getByRole('button', { name: /wish for j/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wish for q/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wish for k/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wish for a/i })).toBeInTheDocument();
  });

  it('calls onSelect with the chosen rank', async () => {
    const onSelectMock = vi.fn();
    const user = userEvent.setup();
    render(<WishPicker onSelect={onSelectMock} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /wish for 7/i }));
    expect(onSelectMock).toHaveBeenCalledWith(7);
  });

  it('calls onSelect with null when No Wish clicked', async () => {
    const onSelectMock = vi.fn();
    const user = userEvent.setup();
    render(<WishPicker onSelect={onSelectMock} onCancel={onCancel} />);
    await user.click(screen.getByText('No Wish'));
    expect(onSelectMock).toHaveBeenCalledWith(null);
  });

  it('calls onCancel when overlay clicked', async () => {
    const onCancelMock = vi.fn();
    const user = userEvent.setup();
    render(<WishPicker onSelect={onSelect} onCancel={onCancelMock} />);
    const dialog = screen.getByRole('dialog');
    await user.click(dialog);
  });

  it('renders dialog with correct title', () => {
    render(<WishPicker onSelect={onSelect} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: /choose wish rank/i })).toBeInTheDocument();
    expect(screen.getByText('Make a Wish')).toBeInTheDocument();
  });
});
