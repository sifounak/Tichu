import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HostTransferDialog } from '../../../src/components/game/HostTransferDialog';

describe('HostTransferDialog', () => {
  it('shows new host message when myName matches newHostName', () => {
    const onDismiss = vi.fn();
    render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Bob"
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText('You are now the game host')).toBeTruthy();
  });

  it('shows transfer success message when myName matches oldHostName', () => {
    const onDismiss = vi.fn();
    render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Alice"
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText('You have successfully transferred host privileges to Bob')).toBeTruthy();
  });

  it('dismisses on OK button click', () => {
    const onDismiss = vi.fn();
    render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Bob"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses on backdrop click', () => {
    const onDismiss = vi.fn();
    render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Bob"
        onDismiss={onDismiss}
      />,
    );
    // The backdrop is the outer fixed div; the dialog is role="dialog"
    // Click the parent of the dialog (the backdrop overlay)
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog.parentElement!);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses on Escape key', () => {
    const onDismiss = vi.fn();
    render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Bob"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('returns null when myName is neither old nor new host', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Charlie"
        onDismiss={onDismiss}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});
