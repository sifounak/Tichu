// Verifies: REQ-F-UC04. Room metadata transitions and cleanup preserve lobby browsing.
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '@tichu/shared';
import { useRoomStore } from '@/stores/roomStore';
import { roomPlayers, resetClientStores } from '../fixtures/client';

beforeEach(() => resetClientStores());
describe('Room state lifecycle', () => {
  it('applies participant, spectator, ready, config and voting updates and resets on departure', () => {
    const store=useRoomStore.getState();store.setRoom('ROOM','south');store.updateRoom('Friends',roomPlayers(),'south',DEFAULT_GAME_CONFIG,true,2,['Watcher','Other'],['south'],false);
    expect(useRoomStore.getState()).toMatchObject({roomCode:'ROOM',mySeat:'south',spectatorCount:2,spectatorNames:['Watcher','Other'],readyPlayers:['south'],votingEnabled:false,gameInProgress:true});
    store.leaveRoom();expect(useRoomStore.getState()).toMatchObject({roomCode:null,mySeat:null,players:[],spectatorNames:[],readyPlayers:[],votingEnabled:true});
  });
  it('supports spectator seats, default metadata and a complete reset', () => {
    const store=useRoomStore.getState();store.setRoom('ROOM',null);store.updateRoom('Friends',roomPlayers(),'south',DEFAULT_GAME_CONFIG,false);
    expect(useRoomStore.getState()).toMatchObject({mySeat:null,spectatorCount:0,readyPlayers:[],votingEnabled:true});store.setLobbyRooms([]);store.reset();expect(useRoomStore.getState().roomName).toBeNull();
  });
});
