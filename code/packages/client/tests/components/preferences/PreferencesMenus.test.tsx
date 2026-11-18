// Verifies: REQ-F-UP02
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserMenu } from '@/components/lobby/UserMenu';
import { GameActionsMenu } from '@/components/game/GameActionsMenu';
import { GameActionsDrawer } from '@/components/game/GameActionsDrawer';
import { PreRoomView } from '@/components/game/PreRoomView';
import { usePreferencesStore } from '@/stores/preferencesStore';

const menuProps = { isHost: false, isSpectator: true, isPreGame: false, votingEnabled: true, activeVote: null, mySeat: null };
describe('Preferences access', () => {
  it('opens preferences from the lobby account menu', async () => {
    const open = vi.spyOn(usePreferencesStore.getState(), 'openDialog').mockResolvedValue(undefined);
    render(<UserMenu user={{ username: 'Alice' }} onLogout={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'User menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Preferences' }));
    expect(open).toHaveBeenCalledOnce();
    open.mockRestore();
  });
  it('offers Preferences to spectators in the desktop game menu', async () => {
    const onAction = vi.fn();
    render(<GameActionsMenu {...menuProps} onAction={onAction} />);
    await userEvent.click(screen.getByRole('button', { name: 'Game Menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Preferences' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'preferences' });
  });
  it('offers Preferences in the mobile game drawer', async () => {
    const onAction = vi.fn(); const onClose = vi.fn();
    render(<GameActionsDrawer {...menuProps} open onClose={onClose} onAction={onAction} />);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Preferences' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'preferences' });
    expect(onClose).toHaveBeenCalledOnce();
  });
  it.each(['full', 'mobile'] as const)('opens Preferences before the game starts in %s layout', async (layoutTier) => {
    const open = vi.spyOn(usePreferencesStore.getState(), 'openDialog').mockResolvedValue(undefined);
    render(<PreRoomView roomCode="TEST" roomName="Test room" mySeat={null} players={[]} hostSeat={null}
      config={null} readyPlayers={[]} send={vi.fn(() => true)} onLeave={vi.fn()} layoutTier={layoutTier} />);
    await userEvent.click(screen.getByRole('button', { name: 'Game Menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Preferences' }));
    expect(open).toHaveBeenCalledOnce();
    open.mockRestore();
  });
});
