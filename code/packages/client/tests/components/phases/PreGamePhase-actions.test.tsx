// Verifies: REQ-F-UC03. Actual decision, passing and received-card controls.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { createDeck, GamePhase } from '@tichu/shared';
import { PreGamePhase } from '@/components/phases/PreGamePhase';

const props=():ComponentProps<typeof PreGamePhase> => ({phase:GamePhase.CardPassing,mySeat:'south',passSelection:new Map(),activeCardId:null,
  onBlindGrandTichuDecision:vi.fn(),onGrandTichuDecision:vi.fn(),onSlotClick:vi.fn(),onSlotRemove:vi.fn(),onConfirmPass:vi.fn(),passConfirmed:false,onCancelPass:vi.fn()});
describe('Pre-game actions', () => {
  it.each([GamePhase.BlindGrandTichuDecision,GamePhase.GrandTichuDecision])('submits call and pass decisions in %s', phase => {
    const p=props();render(<PreGamePhase {...p} phase={phase} />);
    fireEvent.click(screen.getByRole('button',{name:'Pass'}));fireEvent.click(screen.getByRole('button',{name:phase===GamePhase.BlindGrandTichuDecision ? 'Blind Grand!' : 'Grand Tichu!'}));
    const callback=phase===GamePhase.BlindGrandTichuDecision ? p.onBlindGrandTichuDecision : p.onGrandTichuDecision;expect(callback).toHaveBeenCalledWith(false);expect(callback).toHaveBeenCalledWith(true);
  });
  it('moves from Blind Grand to normal Grand or passing as decisions arrive', () => {
    const p=props();const {rerender}=render(<PreGamePhase {...p} phase={GamePhase.BlindGrandTichuDecision} blindGrandTichuDecided={['south']} />);
    expect(screen.getByText('Grand Tichu?')).toBeInTheDocument();
    rerender(<PreGamePhase {...p} phase={GamePhase.BlindGrandTichuDecision} blindGrandTichuDecided={['south']} grandTichuDecided={['south']} />);expect(screen.getByText('Pass Cards')).toBeInTheDocument();
  });
  it('assigns, removes and replaces cards and confirms only a full selection', () => {
    const p=props(),deck=createDeck();const {rerender}=render(<PreGamePhase {...p} activeCardId={0} />);
    expect(screen.getByRole('button',{name:'Confirm Pass'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Pass card to North'}));expect(p.onSlotClick).toHaveBeenCalledWith('north');
    const selection=new Map([['north',deck[0]],['east',deck[1]],['west',deck[2]]] as const);
    rerender(<PreGamePhase {...p} passSelection={selection} />);fireEvent.click(screen.getByRole('button',{name:'Remove card from North slot'}));expect(p.onSlotRemove).toHaveBeenCalledWith('north');
    fireEvent.click(screen.getByRole('button',{name:'Confirm Pass'}));expect(p.onConfirmPass).toHaveBeenCalledOnce();
    rerender(<PreGamePhase {...p} passSelection={selection} activeCardId={3} />);fireEvent.click(screen.getByRole('button',{name:'Remove card from North slot'}));expect(p.onSlotClick).toHaveBeenCalledWith('north');
    rerender(<PreGamePhase {...p} passSelection={selection} passConfirmed />);fireEvent.click(screen.getByRole('button',{name:'Remove card from North slot'}));expect(p.onSlotRemove).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('button',{name:'Cancel Pass'}));expect(p.onCancelPass).toHaveBeenCalledOnce();
  });
  it('dismisses received cards, tolerates empty directions and otherwise renders no phase controls', () => {
    const p=props(),dismiss=vi.fn();const {rerender}=render(<PreGamePhase {...p} phase={GamePhase.Playing} receivedCards={{north:createDeck()[0],east:null,south:null,west:null}} onDismissReceived={dismiss} seatNames={{north:'Partner',east:'Left',south:'Alice',west:'Right'}} />);
    expect(screen.getByText('Partner')).toBeInTheDocument();fireEvent.click(screen.getByText('Dismiss'));expect(dismiss).toHaveBeenCalledOnce();rerender(<PreGamePhase {...p} phase={GamePhase.Playing} />);expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
