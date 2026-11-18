// Verifies: REQ-F-UC03. Vote, disconnect and leave behavior through user controls.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { VoteOverlay } from '@/components/game/VoteOverlay';
import { KickDialog } from '@/components/game/KickDialog';
import { LeaveConfirmDialog } from '@/components/game/LeaveConfirmDialog';
import { WaitingForReconnectOverlay } from '@/components/game/WaitingForReconnectOverlay';
import { SpectatorOverlay } from '@/components/game/SpectatorOverlay';

vi.mock('@/hooks/useAnimationSettings', () => ({ useAnimationSettings: () => ({ enabled:false,durations:{cardPlay:0} }) }));
const names={north:'Partner',east:'Left',south:'Alice',west:'Right'};
function voteProps(type: NonNullable<ComponentProps<typeof VoteOverlay>['activeVote']>['voteType']='kick'): ComponentProps<typeof VoteOverlay> {
  return { activeVote:{voteId:'vote-1',voteType:type,initiatorSeat:'north',targetSeat:'east',votes:{},timeoutMs:30000},
    mySeat:'south',countdownSeconds:30,seatNames:names,onVote:vi.fn() };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('Control dialogs', () => {
  it.each([['kick','Kick',"Don't Kick"],['restartRound','Restart',"Don't Restart"],['restartGame','Restart',"Don't Restart"],
    ['enableBlindGrand','Enable','No Change'],['disableBlindGrand','Disable','No Change']] as const)
  ('submits approve/reject for %s and resets when the vote changes', (type,approve,reject) => {
    const props=voteProps(type);const {rerender}=render(<VoteOverlay {...props} />);
    fireEvent.click(screen.getByRole('button',{name:approve}));expect(props.onVote).toHaveBeenCalledWith('vote-1',true);
    expect(screen.getByText('Waiting for other players...')).toBeInTheDocument();expect(screen.queryByRole('button',{name:approve})).not.toBeInTheDocument();
    rerender(<VoteOverlay {...props} activeVote={{...props.activeVote!,voteId:'vote-2'}} countdownSeconds={0} />);
    fireEvent.click(screen.getByRole('button',{name:reject}));expect(props.onVote).toHaveBeenCalledWith('vote-2',false);
  });
  it('shows no dialog without a vote and restricts targets and spectators', () => {
    const props=voteProps();const {rerender}=render(<VoteOverlay {...props} activeVote={null} />);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<VoteOverlay {...props} mySeat="east" />);expect(screen.getByText('Partner has started a vote to kick you')).toBeInTheDocument();expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<VoteOverlay {...props} readOnly />);expect(screen.getByText(/spectators cannot vote/)).toBeInTheDocument();expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('permits cancellation only when the caller provides that capability', () => {
    const props=voteProps();const onCancelVote=vi.fn();const {rerender}=render(<VoteOverlay {...props} canCancel onCancelVote={onCancelVote} />);
    fireEvent.click(screen.getByRole('button',{name:'Cancel vote'}));expect(onCancelVote).toHaveBeenCalledOnce();
    rerender(<VoteOverlay {...props} canCancel={false} onCancelVote={onCancelVote} />);expect(screen.queryByRole('button',{name:'Cancel vote'})).not.toBeInTheDocument();
  });
  it('dispatches kick and keep-waiting independently', () => {
    const kick=vi.fn(),keep=vi.fn();render(<KickDialog playerName="Left" onKick={kick} onKeepWaiting={keep} />);
    expect(screen.getByRole('dialog',{name:'Kick Left?'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Keep Waiting'}));expect(keep).toHaveBeenCalledOnce();expect(kick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Kick'}));expect(kick).toHaveBeenCalledOnce();
  });
  it('opens, cancels and confirms leave without a backdrop click leaking into the panel', () => {
    const confirm=vi.fn(),close=vi.fn();render(<LeaveConfirmDialog title="Leave Game?" subtitle="Return to lobby" onConfirm={confirm} onClose={close}>
      {open => <button onClick={open}>Open leave</button>}</LeaveConfirmDialog>);
    fireEvent.click(screen.getByText('Open leave'));fireEvent.click(screen.getByText('Leave Game?'));expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Stay'));expect(close).toHaveBeenCalledOnce();expect(screen.queryByText('Leave Game?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Open leave'));fireEvent.click(screen.getByRole('button',{name:'Leave'}));expect(confirm).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledTimes(2);
  });
  it('supports external leave opening and backdrop cancellation', () => {
    const close=vi.fn();const {rerender}=render(<LeaveConfirmDialog title="Leave?" subtitle="" onConfirm={vi.fn()} onClose={close} externalOpen>{() => null}</LeaveConfirmDialog>);
    fireEvent.click(screen.getByText('Leave?').parentElement!.parentElement!);expect(close).toHaveBeenCalledOnce();
    rerender(<LeaveConfirmDialog title="Leave?" subtitle="" onConfirm={vi.fn()} externalOpen={false}>{() => null}</LeaveConfirmDialog>);
    expect(screen.queryByText('Leave?')).not.toBeInTheDocument();
  });
  it('provides an accessible leave dialog and cancels with Escape', () => {
    const close=vi.fn();render(<LeaveConfirmDialog title="Leave Game?" subtitle="" onConfirm={vi.fn()} onClose={close} externalOpen>{() => null}</LeaveConfirmDialog>);
    expect(screen.getByRole('dialog',{name:'Leave Game?'})).toBeInTheDocument();fireEvent.keyDown(window,{key:'Escape'});
    expect(close).toHaveBeenCalledOnce();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('contains keyboard focus and restores the opener after cancellation', () => {
    render(<LeaveConfirmDialog title="Leave?" subtitle="" onConfirm={vi.fn()}>{open => <button onClick={open}>Open leave</button>}</LeaveConfirmDialog>);
    const opener=screen.getByText('Open leave');opener.focus();fireEvent.click(opener);const stay=screen.getByText('Stay'),leave=screen.getByText('Leave');
    expect(stay).toHaveFocus();fireEvent.keyDown(window,{key:'Tab',shiftKey:true});expect(leave).toHaveFocus();fireEvent.keyDown(window,{key:'Tab'});expect(stay).toHaveFocus();
    fireEvent.keyDown(window,{key:'x'});fireEvent.click(stay);expect(opener).toHaveFocus();
  });
  it('debounces reconnect status, restarts for a new seat and clears pending work on teardown', () => {
    vi.useFakeTimers();const {rerender,unmount}=render(<WaitingForReconnectOverlay waitingForSeat="east" playerName="Left" />);
    act(() => vi.advanceTimersByTime(499));expect(screen.queryByLabelText(/Waiting for/)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));expect(screen.getByLabelText('Waiting for Left to reconnect')).toBeInTheDocument();
    rerender(<WaitingForReconnectOverlay waitingForSeat="west" playerName="Right" />);expect(screen.queryByLabelText(/Waiting for/)).not.toBeInTheDocument();
    unmount();expect(vi.getTimerCount()).toBe(0);
  });
  it('expires the in-game spectator offer once and handles offer, queue and vacancy actions', () => {
    vi.useFakeTimers();const claim=vi.fn(),decline=vi.fn(),leave=vi.fn();
    const props={seatOffer:{seats:['north' as const],timeoutMs:1000},queueStatus:null,availableSeats:[],onClaimSeat:claim,onDeclineSeat:decline,onLeaveRoom:leave};
    const {rerender,unmount}=render(<SpectatorOverlay {...props} />);fireEvent.click(screen.getByText('Join Game'));expect(claim).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(3000));expect(decline).toHaveBeenCalledOnce();
    rerender(<SpectatorOverlay {...props} seatOffer={null} queueStatus={{decidingSpectator:'Other',position:2,timeoutMs:1000}} />);expect(screen.getByText(/#2 in line/)).toBeInTheDocument();
    rerender(<SpectatorOverlay {...props} seatOffer={null} queueStatus={{decidingSpectator:'Other',position:0,timeoutMs:1000}} />);expect(screen.getByText(/Waiting for other spectators/)).toBeInTheDocument();
    rerender(<SpectatorOverlay {...props} seatOffer={null} availableSeats={['north']} />);expect(screen.getByText(/Seats are up for Grabs/)).toBeInTheDocument();unmount();
  });
});
