// Verifies: REQ-F-UC03. Queued play, layout, Tichu/bomb and auto-pass state combinations.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { GamePhase } from '@tichu/shared';
import { ActionBar } from '@/components/game/ActionBar';

const props=():ComponentProps<typeof ActionBar> => ({canPlay:true,hasAnyValidPlay:true,canPass:true,isMyTurn:true,phase:GamePhase.Playing,
  myTichuCall:'none',hasPlayedCards:false,hasBombReady:false,onPlay:vi.fn(),onPass:vi.fn(),onTichu:vi.fn(),onBomb:vi.fn()});
afterEach(() => vi.useRealTimers());
describe('Action state combinations', () => {
  it('submits a selected bomb out of turn', () => {
    const p=props();render(<ActionBar {...p} isMyTurn={false} hasBombReady />);fireEvent.click(screen.getByRole('button',{name:'Play bomb'}));expect(p.onBomb).toHaveBeenCalledOnce();
  });
  it.each(['full','mobile'] as const)('offers no-trick state in %s layout', layoutTier => {
    render(<ActionBar {...props()} layoutTier={layoutTier} hasAnyValidPlay={false} />);expect(screen.getByRole('button',{name:'No tricks available'})).toBeDisabled();
  });
  it('uses inline Tichu and bomb capabilities in mobile layout', () => {
    const p=props();render(<ActionBar {...p} layoutTier="mobile" canCallTichuProp canBombProp />);
    fireEvent.click(screen.getByRole('button',{name:'Declare Tichu'}));fireEvent.click(screen.getByRole('button',{name:'Play bomb'}));expect(p.onTichu).toHaveBeenCalledOnce();expect(p.onBomb).toHaveBeenCalledOnce();
  });
  it('renders split controls and hides unavailable mobile placeholders', () => {
    const {rerender}=render(<ActionBar {...props()} layout="split" playerSeat={<span>Alice seat</span>} />);expect(screen.getByText('Alice seat')).toBeInTheDocument();
    rerender(<ActionBar {...props()} layoutTier="mobile" isMyTurn={false} />);expect(screen.queryByRole('button',{name:'Declare Tichu'})).not.toBeInTheDocument();
  });
  it('cancels queued play and updates/cleans up its progress animation', () => {
    vi.useFakeTimers();vi.setSystemTime(1000);const cancel=vi.fn();const {rerender,unmount}=render(<ActionBar {...props()} playQueued bombWindowEndTime={2000} onCancelQueue={cancel} />);
    act(() => vi.advanceTimersByTime(250));const button=screen.getByRole('button',{name:'Cancel queued play'});fireEvent.mouseEnter(button);expect(screen.getByText('Cancel Play')).toBeInTheDocument();
    fireEvent.mouseLeave(button);fireEvent.click(button);expect(cancel).toHaveBeenCalledOnce();act(() => vi.advanceTimersByTime(900));
    rerender(<ActionBar {...props()} playQueued bombWindowEndTime={500} />);rerender(<ActionBar {...props()} playQueued={false} />);unmount();expect(vi.getTimerCount()).toBe(0);
  });
  it('handles a queued play without an expiration and retains auto-pass during the own turn', () => {
    const toggle=vi.fn();render(<ActionBar {...props()} playQueued autoPassEnabled showAutoPass trickEstablished onAutoPassToggle={toggle} />);
    fireEvent.click(screen.getByRole('checkbox',{name:'Auto-pass until next trick'}));expect(toggle).toHaveBeenCalledWith(false);expect(screen.queryByRole('button',{name:'Pass turn'})).not.toBeInTheDocument();
  });
  it('shows no actions outside playing and a disabled pass when no trick is established', () => {
    const {rerender}=render(<ActionBar {...props()} phase={GamePhase.CardPassing} />);expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<ActionBar {...props()} isMyTurn={false} showAutoPass layout="split" />);expect(screen.getByRole('button',{name:'Pass turn'})).toBeDisabled();
  });
});
