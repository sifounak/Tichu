// Verifies: REQ-F-UC03. Actual settings, menu/drawer and room interactions.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { DEFAULT_GAME_CONFIG } from '@tichu/shared';
import { PreRoomView } from '@/components/game/PreRoomView';
import { GameSettingsForm } from '@/components/ui/GameSettingsForm';
import { CreateGamePopup } from '@/components/lobby/CreateGamePopup';
import { GameActionsMenu } from '@/components/game/GameActionsMenu';
import { GameActionsDrawer } from '@/components/game/GameActionsDrawer';
import { useUiStore } from '@/stores/uiStore';
import { useRoomStore } from '@/stores/roomStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { roomPlayers, resetClientStores } from '../../fixtures/client';

vi.mock('@/hooks/useAnimationSettings', () => ({useAnimationSettings:() => ({enabled:false,durations:{cardPlay:0}})}));
const roomProps=():ComponentProps<typeof PreRoomView> => ({roomCode:'ROOM',roomName:'Friends',mySeat:'south',hostSeat:'south',players:roomPlayers(),
  config:{...DEFAULT_GAME_CONFIG},readyPlayers:[],send:vi.fn().mockReturnValue(true),onLeave:vi.fn()});
const menuProps=():ComponentProps<typeof GameActionsMenu> => ({isHost:true,isSpectator:false,isPreGame:false,votingEnabled:true,activeVote:null,mySeat:'south',onAction:vi.fn()});
beforeEach(() => { resetClientStores(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Settings and menu behavior', () => {
  it('submits settings changes and resets creation defaults after cancellation', () => {
    const create=vi.fn(),cancel=vi.fn();const {unmount}=render(<CreateGamePopup onCreate={create} onCancel={cancel} />);
    fireEvent.change(screen.getByLabelText('Target Score'),{target:{value:'1500'}});
    fireEvent.change(screen.getByLabelText('Turn Timer'),{target:{value:'60'}});
    for(const label of ['Spectator Chat','Private','Allow Blind Grand','Spectators']) fireEvent.click(screen.getByLabelText(label));
    fireEvent.click(screen.getByRole('button',{name:'Create Game'}));expect(create).toHaveBeenCalledWith({targetScore:1500,turnTimerSeconds:60,isPrivate:true,spectatorsAllowed:false,spectatorChatEnabled:false,blindGrandTichuEnabled:true});
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(cancel).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('dialog'));expect(cancel).toHaveBeenCalledTimes(2);unmount();
    render(<CreateGamePopup onCreate={create} onCancel={cancel} />);expect(screen.getByLabelText('Target Score')).toHaveValue(1000);
  });
  it('shows editable settings updates and read-only summaries for both settings states', () => {
    const change=vi.fn();const {rerender}=render(<GameSettingsForm config={DEFAULT_GAME_CONFIG} onChange={change} />);
    fireEvent.change(screen.getByLabelText('Turn Timer'),{target:{value:'off'}});expect(change).toHaveBeenCalledWith({turnTimerSeconds:null});
    rerender(<GameSettingsForm config={DEFAULT_GAME_CONFIG} onChange={change} readOnly />);expect(screen.getByText('Timer: Off')).toBeInTheDocument();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    rerender(<GameSettingsForm config={{...DEFAULT_GAME_CONFIG,turnTimerSeconds:30,isPrivate:true,spectatorsAllowed:false,spectatorChatEnabled:false,blindGrandTichuEnabled:true}} onChange={change} readOnly />);expect(screen.getByText('Timer: 30s')).toBeInTheDocument();expect(screen.getByText('Private Room')).toBeInTheDocument();
  });
  it.each([false,true])('honors spectator menu restrictions in drawer=%s', drawer => {
    const p={...menuProps(),isSpectator:true,isHost:false};
    render(drawer ? <GameActionsDrawer {...p} open onClose={vi.fn()} /> : <GameActionsMenu {...p} />);
    if(!drawer) fireEvent.click(screen.getByRole('button',{name:'Game Menu'}));
    expect(screen.queryByRole('menuitem',{name:'Kick Player'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem',{name:'Game Settings'}));expect(p.onAction).toHaveBeenCalledWith({type:'gameSettings'});
  });
  it('navigates the menu with keys and dismisses outside/Escape, restoring focus', () => {
    render(<GameActionsMenu {...menuProps()} />);const opener=screen.getByRole('button',{name:'Game Menu'});fireEvent.mouseEnter(opener);fireEvent.mouseLeave(opener);fireEvent.click(opener);
    const first=screen.getByRole('menuitemcheckbox');first.focus();fireEvent.keyDown(first,{key:'ArrowDown'});expect(screen.getByRole('menuitem',{name:'Kick Player'})).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menuitem',{name:'Kick Player'}),{key:'ArrowUp'});expect(first).toHaveFocus();fireEvent.keyDown(first,{key:'x'});fireEvent.keyDown(window,{key:'Escape'});expect(opener).toHaveFocus();
    fireEvent.click(opener);fireEvent.mouseDown(document.body);expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
  it.each([false,true])('disables denied and cooldown actions in drawer=%s', drawer => {
    const p={...menuProps(),isHost:false,votingEnabled:false,isOnCooldown:() => true,getCooldownRemaining:() => 12};
    const {rerender}=render(drawer ? <GameActionsDrawer {...p} open onClose={vi.fn()} /> : <GameActionsMenu {...p} />);
    if(!drawer) fireEvent.click(screen.getByRole('button',{name:'Game Menu'}));expect(screen.getByRole('menuitem',{name:/Kick Player/})).toBeDisabled();
    const updated={...p,isHost:true,votingEnabled:true,activeVote:{initiatorSeat:'east' as const},blindGrandTichuEnabled:true,autopilotEnabled:true};
    rerender(drawer ? <GameActionsDrawer {...updated} open onClose={vi.fn()} /> : <GameActionsMenu {...updated} />);
    expect(screen.getByRole('menuitem',{name:/Restart Round/})).toBeDisabled();expect(screen.getByRole('menuitem',{name:/Transfer Host/})).toBeDisabled();expect(screen.getByRole('menuitemcheckbox')).toHaveAttribute('aria-checked','true');
  });
  it('closes the drawer by item, close button, backdrop and Escape, then ends its exit transition', () => {
    vi.useFakeTimers();const close=vi.fn(),action=vi.fn();const p={...menuProps(),onAction:action};const {rerender,container}=render(<GameActionsDrawer {...p} open onClose={close} />);
    act(() => vi.advanceTimersByTime(20));fireEvent.click(screen.getByRole('menuitem',{name:'Preferences'}));expect(action).toHaveBeenCalledWith({type:'preferences'});
    fireEvent.click(screen.getByRole('button',{name:'Close menu'}));fireEvent.keyDown(window,{key:'Escape'});fireEvent.keyDown(window,{key:'x'});
    const menu=screen.getByRole('menu');fireEvent.click(menu.previousElementSibling!);expect(close).toHaveBeenCalledTimes(4);
    rerender(<GameActionsDrawer {...p} open={false} onClose={close} />);act(() => vi.advanceTimersByTime(200));expect(screen.queryByRole('menu')).not.toBeInTheDocument();expect(container).toBeEmptyDOMElement();
  });
});

describe('Pre-room controls', () => {
  function action(label:string) {fireEvent.click(screen.getByRole('button',{name:'Game Menu'}));fireEvent.click(screen.getByRole('menuitem',{name:label}));}
  it('sends ready/cancel, bot, kick and seat-swap actions', () => {
    const p=roomProps();const {rerender}=render(<PreRoomView {...p} />);fireEvent.click(screen.getByRole('button',{name:'Start Game'}));expect(p.send).toHaveBeenCalledWith({type:'READY_TO_START'});
    fireEvent.click(screen.getAllByRole('button',{name:'Remove Bot'})[0]);fireEvent.click(screen.getByRole('button',{name:'Kick'}));
    expect(p.send).toHaveBeenCalledWith({type:'REMOVE_BOT',seat:'east'});expect(p.send).toHaveBeenCalledWith({type:'KICK_PLAYER',seat:'north'});
    rerender(<PreRoomView {...p} players={[p.players[0]]} readyPlayers={['south']} />);fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(p.send).toHaveBeenCalledWith({type:'CANCEL_READY'});
    fireEvent.click(screen.getAllByRole('button',{name:'Add Bot'})[0]);fireEvent.click(screen.getAllByRole('button',{name:'Sit Here'})[0]);
    expect(p.send).toHaveBeenCalledWith({type:'ADD_BOT',seat:'north'});expect(p.send).toHaveBeenCalledWith({type:'SWAP_SEATS',targetSeat:'north'});
  });
  it('restricts non-host actions and displays read-only settings', () => {
    const p=roomProps();render(<PreRoomView {...p} hostSeat="north" />);expect(screen.queryByRole('button',{name:'Kick'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Remove Bot'})).not.toBeInTheDocument();
    action('Game Settings');expect(screen.getByText('Target: 1000 pts')).toBeInTheDocument();expect(screen.queryByRole('checkbox',{name:'Private'})).not.toBeInTheDocument();
  });
  it('edits settings, toggles voting/autopilot and opens preferences', () => {
    const p=roomProps();const preferences=vi.spyOn(usePreferencesStore.getState(),'openDialog').mockResolvedValue();render(<PreRoomView {...p} />);
    action('Game Settings');fireEvent.change(screen.getByLabelText('Target Score'),{target:{value:'1200'}});expect(p.send).toHaveBeenCalledWith({type:'CONFIGURE_ROOM',config:{targetScore:1200}});
    fireEvent.click(screen.getByText('Game Settings').parentElement!.parentElement!);action('Disable Voting');expect(p.send).toHaveBeenCalledWith({type:'TOGGLE_VOTING'});
    fireEvent.click(screen.getByRole('button',{name:'Game Menu'}));fireEvent.click(screen.getByRole('menuitemcheckbox'));expect(p.send).toHaveBeenCalledWith({type:'ENABLE_AUTOPILOT'});
    action('Preferences');expect(preferences).toHaveBeenCalledOnce();
  });
  it.each([['Start Vote','PRE_GAME_BLIND_GRAND_VOTE'],['Force Enable','FORCE_SET_BLIND_GRAND'],['Cancel',null]] as const)
  ('handles Blind Grand confirmation: %s', (button,type) => {
    const p=roomProps();render(<PreRoomView {...p} />);action('Enable Blind Grand');fireEvent.click(screen.getByRole('button',{name:button}));
    if(type) expect(p.send).toHaveBeenCalledWith({type,enabled:true});
    else expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it.each(['Kick Player','Transfer Host'])('cancels %s target selection with Escape', label => {
    render(<PreRoomView {...roomProps()} />);action(label);fireEvent.keyDown(window,{key:'Escape'});
    expect(screen.queryByText(/Click a player to/)).not.toBeInTheDocument();
  });
  it.each([['Start Vote','PRE_GAME_KICK_VOTE'],['Force Kick','FORCE_KICK']] as const)('sends kick confirmation: %s', (button,type) => {
    const p=roomProps();render(<PreRoomView {...p} />);action('Kick Player');fireEvent.click(screen.getByRole('button',{name:'Kick Partner'}));fireEvent.click(screen.getByRole('button',{name:button}));
    expect(p.send).toHaveBeenCalledWith({type,targetSeat:'north'});
  });
  it('transfers host only to a human target', () => {
    const p=roomProps();render(<PreRoomView {...p} />);action('Transfer Host');fireEvent.click(screen.getByRole('button',{name:'Kick Left'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Kick Partner'}));fireEvent.click(screen.getByRole('button',{name:'Transfer'}));expect(p.send).toHaveBeenCalledWith({type:'TRANSFER_HOST',targetSeat:'north'});
  });
  it('blocks a kick target on cooldown and handles non-host vote cancellation capability', () => {
    const p=roomProps();useUiStore.setState({voteCooldowns:new Map([['kick:north',Date.now()+5000]])});
    render(<PreRoomView {...p} />);action('Kick Player');fireEvent.click(screen.getByRole('button',{name:'Kick Partner'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('shows the correct spectator offer and queue states and sends claims', () => {
    const p=roomProps();const claim=vi.fn(),decline=vi.fn();const {rerender}=render(<PreRoomView {...p} mySeat={null} players={[p.players[0]]} seatOffer={{seats:['north'],timeoutMs:2000}} onClaimSeat={claim} onDeclineSeat={decline} />);
    fireEvent.click(screen.getAllByRole('button',{name:'Claim Seat'})[0]);fireEvent.click(screen.getByRole('button',{name:'Pass'}));expect(claim.mock.calls.length+(p.send as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);expect(decline).toHaveBeenCalledOnce();
    for(const position of [0,1,2,3,4,21]) {rerender(<PreRoomView {...p} mySeat={null} queueStatus={{position,decidingSpectator:'Other',timeoutMs:5000}} />);expect(screen.getByText(position===0 ? /Waiting for other spectators/ : /You are .* in line/)).toBeInTheDocument();}
    rerender(<PreRoomView {...p} mySeat={null} availableSeats={['north']} onClaimSeat={claim} />);fireEvent.click(screen.getByRole('button',{name:'Claim Seat'}));expect(claim).toHaveBeenCalled();
    rerender(<PreRoomView {...p} mySeat={null} />);expect(screen.getByText('Waiting for game to start...')).toBeInTheDocument();
  });
  it('expires a spectator offer only once and clears its timer when removed', () => {
    vi.useFakeTimers();const p=roomProps(),decline=vi.fn();const {unmount}=render(<PreRoomView {...p} mySeat={null} seatOffer={{seats:['north'],timeoutMs:1000}} onDeclineSeat={decline} />);
    act(() => vi.advanceTimersByTime(3000));expect(decline).toHaveBeenCalledOnce();unmount();
  });
  it('shows one leave confirmation for a mobile back-button request', () => {
    render(<PreRoomView {...roomProps()} layoutTier="mobile" backButtonDialogOpen />);expect(screen.getAllByRole('dialog',{name:'Leave Room?'})).toHaveLength(1);
  });
  it('handles mobile drawer, pending vote, results and autopilot', () => {
    const p=roomProps();useUiStore.setState({activeVote:{voteId:'vote',voteType:'kick',initiatorSeat:'north',targetSeat:'east',votes:{},timeoutMs:30000},voteCountdown:30});
    const {rerender}=render(<PreRoomView {...p} layoutTier="mobile" />);fireEvent.click(within(screen.getByRole('dialog',{name:'Player vote'})).getByRole('button',{name:'Kick'}));expect(p.send).toHaveBeenCalledWith({type:'PRE_GAME_VOTE',voteId:'vote',vote:true});
    fireEvent.click(screen.getByRole('button',{name:'Cancel vote'}));expect(p.send).toHaveBeenCalledWith({type:'CANCEL_VOTE'});
    fireEvent.click(screen.getByRole('button',{name:'Game Menu'}));fireEvent.click(screen.getByRole('menuitem',{name:'Preferences'}));
    act(() => useUiStore.setState({activeVote:null,voteResult:{passed:true,message:'Vote passed'}}));expect(screen.getByText('Vote passed')).toBeInTheDocument();
    rerender(<PreRoomView {...p} layoutTier="mobile" players={p.players.map(player => ({...player,isAutopilot:player.seat==='south'}))} />);
    fireEvent.click(screen.getByRole('button',{name:'Game Menu'}));fireEvent.click(screen.getByRole('menuitemcheckbox'));expect(p.send).toHaveBeenCalledWith({type:'DISABLE_AUTOPILOT'});
    act(() => useRoomStore.setState({votingEnabled:false}));
  });
});
