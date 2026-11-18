// Verifies: REQ-F-UC02. Real auth-store/guard composition and active-game rejoin.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { AuthGuard } from '@/components/AuthGuard';
import { ActiveGameBanner } from '@/components/ActiveGameBanner';
import { useAuthStore } from '@/stores/authStore';
import { account, deferred, jsonResponse, resetClientStores } from '../fixtures/client';

const navigation = vi.hoisted(() => ({ pathname: '/stats', router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation.router, usePathname: () => navigation.pathname }));
describe('Authentication guard and rejoin banner', () => {
  beforeEach(() => { resetClientStores(); vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); navigation.pathname='/stats'; });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('waits for verification before rendering protected content', async () => {
    localStorage.setItem('tichu_token','token'); const response=deferred<Response>(); vi.stubGlobal('fetch',vi.fn().mockReturnValue(response.promise));
    render(<AuthGuard><p>Protected content</p></AuthGuard>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    response.resolve(jsonResponse({ user: { id: 'alice', username:'Alice', isGuest:false } }));
    expect(await screen.findByText('Protected content')).toBeInTheDocument(); expect(navigation.router.replace).not.toHaveBeenCalled();
  });
  it('redirects anonymous users while preserving the requested destination', async () => {
    window.history.replaceState(null,'','/stats/cards?participation=solo#phoenix');
    render(<AuthGuard>Protected</AuthGuard>);
    await waitFor(() => expect(navigation.router.replace).toHaveBeenCalledWith(expect.stringContaining('returnTo=')));
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    expect(decodeURIComponent(navigation.router.replace.mock.calls[0][0])).toContain('/stats/cards?participation=solo#phoenix');
  });
  it('shows and refreshes an active room, then sends the rejoin action', async () => {
    useAuthStore.setState({ user:account, token:'token', authReady:true, loadFromStorage:vi.fn() });
    const fetch=vi.fn().mockImplementation(async () => jsonResponse({ activeRoom:{ roomCode:'ROOM', roomName:'Friends', seat:'south', gameInProgress:true } }));
    vi.stubGlobal('fetch',fetch); const mounted=render(<ActiveGameBanner />);
    await screen.findByText('Friends'); fireEvent.click(screen.getByRole('button',{name:'Rejoin'}));
    expect(navigation.router.push).toHaveBeenCalledWith('/game/ROOM');
    fireEvent(window,new Event('focus')); fireEvent(document,new Event('visibilitychange'));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3)); mounted.unmount();
    fireEvent(window,new Event('focus')); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each(['/','/game/ROOM','/spectate/ROOM'])('hides the banner on %s', pathname => {
    navigation.pathname=pathname; useAuthStore.setState({user:account,authReady:true,loadFromStorage:vi.fn()});
    const fetch=vi.fn(); vi.stubGlobal('fetch',fetch);render(<ActiveGameBanner />);expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(fetch).not.toHaveBeenCalled();
  });
  it('uses a guest identity query and handles absent/error room responses', async () => {
    useAuthStore.setState({user:account,token:null,authReady:true,loadFromStorage:vi.fn()});
    const fetch=vi.fn().mockResolvedValueOnce(jsonResponse({},404)).mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch',fetch);render(<ActiveGameBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('userId=alice'),expect.anything()));
    fireEvent(window,new Event('focus')); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('does not fetch before authentication is ready or without an identity', () => {
    useAuthStore.setState({loadFromStorage:vi.fn()});const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    render(<ActiveGameBanner />);act(() => useAuthStore.setState({authReady:true}));expect(fetch).not.toHaveBeenCalled();
  });
});
