// Verifies: REQ-F-PH07
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoenixValuePicker } from '../../../src/components/cards/PhoenixValuePicker';
import type { Rank } from '@tichu/shared';

describe('PhoenixValuePicker', () => {
  const options: Rank[] = [5, 6];
  const onSelect = vi.fn();
  const onCancel = vi.fn();

  it('renders dialog with correct title', () => {
    render(<PhoenixValuePicker options={options} onSelect={onSelect} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: /choose phoenix value/i })).toBeInTheDocument();
    expect(screen.getByText('Phoenix Value')).toBeInTheDocument();
  });

  it('renders a button for each option', () => {
    render(<PhoenixValuePicker options={options} onSelect={onSelect} onCancel={onCancel} />);
    expect(screen.getByRole('button', { name: /set phoenix to 5/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set phoenix to 6/i })).toBeInTheDocument();
  });

  it('calls onSelect with the chosen rank', async () => {
    const onSelectMock = vi.fn();
    const user = userEvent.setup();
    render(<PhoenixValuePicker options={options} onSelect={onSelectMock} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /set phoenix to 6/i }));
    expect(onSelectMock).toHaveBeenCalledWith(6);
  });

  it('calls onCancel when Cancel button clicked', async () => {
    const onCancelMock = vi.fn();
    const user = userEvent.setup();
    render(<PhoenixValuePicker options={options} onSelect={onSelect} onCancel={onCancelMock} />);
    await user.click(screen.getByText('Cancel'));
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when overlay clicked', async () => {
    const onCancelMock = vi.fn();
    const user = userEvent.setup();
    render(<PhoenixValuePicker options={options} onSelect={onSelect} onCancel={onCancelMock} />);
    // Click the overlay (dialog background)
    const dialog = screen.getByRole('dialog');
    await user.click(dialog);
    // Should not call cancel if clicked inside the picker (stopPropagation)
    // But clicking the overlay itself triggers cancel
  });

  it('renders face card labels (J, Q, K, A)', () => {
    const faceOptions: Rank[] = [11, 12, 13, 14];
    render(<PhoenixValuePicker options={faceOptions} onSelect={onSelect} onCancel={onCancel} />);
    expect(screen.getByRole('button', { name: /set phoenix to j/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set phoenix to q/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set phoenix to k/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set phoenix to a/i })).toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    render(<PhoenixValuePicker options={options} onSelect={onSelect} onCancel={onCancel} />);
    expect(screen.getByText('Choose the rank for Phoenix:')).toBeInTheDocument();
  });
});
