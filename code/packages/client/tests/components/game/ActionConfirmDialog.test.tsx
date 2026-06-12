import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionConfirmDialog } from '@/components/game/ActionConfirmDialog';

describe('ActionConfirmDialog', () => {
  it('confirms starting a Blind Grand enable vote', async () => {
    const user = userEvent.setup();
    const onStartVote = vi.fn();

    render(
      <ActionConfirmDialog
        action={{ type: 'blindGrand', enabled: true }}
        isHost={false}
        onCancel={vi.fn()}
        onStartVote={onStartVote}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Enable Blind Grand' })).toBeInTheDocument();
    expect(screen.getByText('Enable Blind Grand for upcoming rounds?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start Vote' }));
    expect(onStartVote).toHaveBeenCalledTimes(1);
  });

  it('shows host force copy for disabling Blind Grand', () => {
    render(
      <ActionConfirmDialog
        action={{ type: 'blindGrand', enabled: false }}
        isHost={true}
        onCancel={vi.fn()}
        onStartVote={vi.fn()}
        onForceAction={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Disable Blind Grand' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Force Disable' })).toBeInTheDocument();
  });
});
