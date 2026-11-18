// Verifies: REQ-F-UC02. Authentication behavior and stale-response regressions.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { account, deferred, jsonResponse, resetClientStores } from '../fixtures/client';

const apiUser = { id: account.userId, username: account.username, displayName: account.username, email: account.email, isGuest: false };
describe('Authentication store', () => {
  beforeEach(() => { resetClientStores(); localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const fetchResponses = (...responses: Response[]) => {
    const fetch = vi.fn(); responses.forEach(response => fetch.mockResolvedValueOnce(response)); vi.stubGlobal('fetch', fetch); return fetch;
  };
  it('logs in with the supplied identifier and saves credentials/profile', async () => {
    const fetch = fetchResponses(jsonResponse({ token: 'token', userId: 'alice', username: 'Alice' }));
    await useAuthStore.getState().login('alice@example.test', 'password');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ identifier: 'alice@example.test', password: 'password' });
    expect(useAuthStore.getState()).toMatchObject({ user: { userId: 'alice', username: 'Alice' }, token: 'token', loading: false, authReady: true });
    expect(localStorage.getItem('tichu_token')).toBe('token');
    expect(JSON.parse(localStorage.getItem('tichu_user_profile')!)).toMatchObject({ userId: 'alice' });
  });
  it.each([['Rejected', 'Rejected'], [undefined, 'Login failed']])('handles rejected login (%s)', async (error, message) => {
    fetchResponses(jsonResponse({ error }, 401));
    await useAuthStore.getState().login('bad', 'bad');
    expect(useAuthStore.getState()).toMatchObject({ loading: false, error: message, user: null });
  });
  it('settles a network failure and supports retrying login', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(jsonResponse({ token: 'ok', userId: 'alice', username: 'Alice' }));
    vi.stubGlobal('fetch', fetch);
    await useAuthStore.getState().login('Alice', 'password');
    expect(useAuthStore.getState().error).toBe('offline');
    await useAuthStore.getState().login('Alice', 'password');
    expect(useAuthStore.getState().error).toBeNull();
  });
  it('registers and retrieves the full account profile', async () => {
    fetchResponses(jsonResponse({ token: 'registered', userId: 'alice' }), jsonResponse({ user: apiUser }));
    await useAuthStore.getState().register({ userId: 'alice', username: 'Alice', email: account.email, password: 'password' });
    expect(useAuthStore.getState()).toMatchObject({ user: account, loading: false, authReady: true });
  });
  it('uses the display name when a full profile lacks a username', async () => {
    fetchResponses(jsonResponse({ token: 'registered', userId: 'alice' }), jsonResponse({ user: { ...apiUser, username: null } }));
    await useAuthStore.getState().register({ userId: 'alice', username: 'Alice', email: account.email, password: 'password' });
    expect(useAuthStore.getState().user?.username).toBe('Alice');
  });
  it.each([['Already registered', 'Already registered'], [undefined, 'Registration failed']])('handles rejected registration (%s)', async (error, message) => {
    fetchResponses(jsonResponse({ error }, 409));
    await useAuthStore.getState().register({ userId: 'a', username: 'a', email: 'a@example.test', password: 'password' });
    expect(useAuthStore.getState()).toMatchObject({ loading: false, error: message });
  });
  it('initializes the preserved guest helper without exposing a new guest UI', async () => {
    fetchResponses(jsonResponse({ user: { id: 'guest', displayName: 'Guest', isGuest: true } }));
    await useAuthStore.getState().initGuest('guest', 'Guest');
    expect(useAuthStore.getState()).toMatchObject({ user: { isGuest: true }, authReady: true, loading: false });
    expect(sessionStorage.getItem('tichu_user_id')).toBe('guest');
  });
  it('settles a rejected guest initialization', async () => {
    fetchResponses(jsonResponse({}, 500));
    await useAuthStore.getState().initGuest('guest', 'Guest');
    expect(useAuthStore.getState()).toMatchObject({ error: 'Failed to initialize guest', authReady: true, loading: false });
  });
  it('logout clears persistent and session identity', () => {
    for (const key of ['tichu_token','tichu_user_id','tichu_user_profile']) localStorage.setItem(key, 'old');
    sessionStorage.setItem('tichu_user_id', 'old'); sessionStorage.setItem('tichu_player_name', 'Old');
    useAuthStore.setState({ user: account, token: 'old' });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState()).toMatchObject({ user: null, token: null, authReady: true });
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  });
  it('settles readiness without a token and during server rendering', () => {
    useAuthStore.getState().loadFromStorage(); expect(useAuthStore.getState().authReady).toBe(true);
    useAuthStore.setState({ authReady: false }); vi.stubGlobal('window', undefined);
    useAuthStore.getState().loadFromStorage(); expect(useAuthStore.getState().authReady).toBe(true);
  });
  it.each(['{broken', JSON.stringify({ userId: 42 }), null])('ignores unusable cached profiles (%s) and verifies the token', async raw => {
    localStorage.setItem('tichu_token', 'valid'); if (raw) localStorage.setItem('tichu_user_profile', raw);
    fetchResponses(jsonResponse({ user: { ...apiUser, username: null } }));
    useAuthStore.getState().loadFromStorage();
    await vi.waitFor(() => expect(useAuthStore.getState().user?.username).toBe('Alice'));
  });
  it('hydrates a cached profile and refreshes it in the background', async () => {
    localStorage.setItem('tichu_token','valid'); localStorage.setItem('tichu_user_profile',JSON.stringify(account));
    const response = deferred<Response>(); vi.stubGlobal('fetch',vi.fn().mockReturnValue(response.promise));
    useAuthStore.getState().loadFromStorage(); expect(useAuthStore.getState()).toMatchObject({ user: account, authReady: true });
    response.resolve(jsonResponse({ user: { ...apiUser, username: 'Updated' } }));
    await vi.waitFor(() => expect(useAuthStore.getState().user?.username).toBe('Updated'));
  });
  it('clears expired authentication and settles readiness', async () => {
    localStorage.setItem('tichu_token','expired'); localStorage.setItem('tichu_user_id','alice');
    fetchResponses(jsonResponse({},401)); useAuthStore.getState().loadFromStorage();
    await vi.waitFor(() => expect(localStorage.getItem('tichu_token')).toBeNull());
    expect(useAuthStore.getState()).toMatchObject({ user: null, token: null, authReady: true });
  });
  it('tolerates unavailable profile storage', async () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(key,value) {
      if (key==='tichu_user_profile') throw new Error('full'); return original.call(this,key,value);
    });
    fetchResponses(jsonResponse({ token: 'ok', userId: 'alice', username: 'Alice' }));
    await useAuthStore.getState().login('Alice','password'); expect(useAuthStore.getState().user?.userId).toBe('alice');
  });
  it('logout wins over a pending login response', async () => {
    const response=deferred<Response>(); vi.stubGlobal('fetch',vi.fn().mockReturnValue(response.promise));
    const login=useAuthStore.getState().login('Alice','password'); useAuthStore.getState().logout();
    response.resolve(jsonResponse({ token: 'stale', userId: 'alice', username: 'Alice' })); await login;
    expect(useAuthStore.getState().user).toBeNull(); expect(localStorage.getItem('tichu_token')).toBeNull();
  });
  it('logout wins over background token verification', async () => {
    localStorage.setItem('tichu_token','old'); const response=deferred<Response>(); vi.stubGlobal('fetch',vi.fn().mockReturnValue(response.promise));
    useAuthStore.getState().loadFromStorage(); useAuthStore.getState().logout(); response.resolve(jsonResponse({ user: apiUser }));
    await response.promise; await new Promise(resolve => setTimeout(resolve, 0));
    await vi.waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    expect(localStorage.getItem('tichu_user_profile')).toBeNull();
  });
  it.each(['guest','register','login'] as const)('ignores a late failed %s request after logout', async kind => {
    const response=deferred<Response>();vi.stubGlobal('fetch',vi.fn().mockReturnValue(response.promise));
    const state=useAuthStore.getState();
    const pending=kind==='guest' ? state.initGuest('guest','Guest') : kind==='login' ? state.login('Alice','password')
      : state.register({userId:'alice',username:'Alice',email:account.email,password:'password'});
    state.logout();response.reject(new Error('late failure'));await pending;
    expect(useAuthStore.getState()).toMatchObject({user:null,error:null,loading:false});
  });
  it.each(['guest','register'] as const)('ignores a late successful %s request after logout', async kind => {
    const response=deferred<Response>();vi.stubGlobal('fetch',vi.fn().mockReturnValue(response.promise));
    const state=useAuthStore.getState();const pending=kind==='guest' ? state.initGuest('guest','Guest')
      : state.register({userId:'alice',username:'Alice',email:account.email,password:'password'});
    state.logout();response.resolve(jsonResponse({user:apiUser,token:'old',userId:'alice'}));await pending;
    expect(useAuthStore.getState().user).toBeNull();expect(localStorage.getItem('tichu_token')).toBeNull();
  });
  it('ignores a full profile arriving after logout during registration', async () => {
    const response=deferred<Response>();const fetch=vi.fn().mockResolvedValueOnce(jsonResponse({token:'old',userId:'alice'})).mockReturnValueOnce(response.promise);
    vi.stubGlobal('fetch',fetch);const pending=useAuthStore.getState().register({userId:'alice',username:'Alice',email:account.email,password:'password'});
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));useAuthStore.getState().logout();response.resolve(jsonResponse({user:apiUser}));await pending;
    expect(useAuthStore.getState().user).toBeNull();expect(localStorage.getItem('tichu_user_profile')).toBeNull();
  });
});
