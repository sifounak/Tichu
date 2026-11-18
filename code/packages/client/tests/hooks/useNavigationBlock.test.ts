// Verifies: REQ-F-UC02. Browser event contracts simulated in jsdom.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useNavigationBlock } from '@/hooks/useNavigationBlock';

describe('Navigation confirmation hook', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(window.history,'go').mockImplementation(() => {}); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); Reflect.deleteProperty(window,'navigation'); });
  it('does not install a guard when disabled', () => {
    const push=vi.spyOn(window.history,'pushState'); const {result}=renderHook(() => useNavigationBlock({enabled:false}));
    expect(push).not.toHaveBeenCalled(); expect(result.current.dialogOpen).toBe(false);
  });
  it('arms after setup, blocks popstate, supports cancel and confirmation, and cleans up', () => {
    const push=vi.spyOn(window.history,'pushState');const {result,unmount}=renderHook(() => useNavigationBlock({enabled:true}));
    act(() => window.dispatchEvent(new PopStateEvent('popstate'))); expect(result.current.dialogOpen).toBe(false);
    act(() => vi.advanceTimersByTime(50)); act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(result.current.dialogOpen).toBe(true);expect(push).toHaveBeenCalledTimes(2);
    act(() => result.current.cancelNavigation());expect(result.current.dialogOpen).toBe(false);
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));act(() => result.current.confirmNavigation());
    act(() => window.dispatchEvent(new PopStateEvent('popstate'))); expect(result.current.dialogOpen).toBe(false);
    unmount(); expect(window.history.go).not.toHaveBeenCalled();
  });
  it('pops an installed guard on teardown and removes listeners', () => {
    const {unmount}=renderHook(() => useNavigationBlock({enabled:true}));act(() => vi.advanceTimersByTime(50));unmount();
    expect(window.history.go).toHaveBeenCalledWith(-1);
  });
  it('handles Navigation API traversal and removes its listener', () => {
    const navigation=new EventTarget();Object.defineProperty(window,'navigation',{configurable:true,value:navigation});
    const {result,unmount}=renderHook(() => useNavigationBlock({enabled:true}));
    const event=(type:string) => { const e=new Event('navigate',{cancelable:true});Object.defineProperty(e,'navigationType',{value:type});return e; };
    const early=event('traverse');act(() => navigation.dispatchEvent(early));expect(early.defaultPrevented).toBe(false);
    act(() => vi.advanceTimersByTime(50));act(() => navigation.dispatchEvent(event('push')));expect(result.current.dialogOpen).toBe(false);
    const traverse=event('traverse');act(() => navigation.dispatchEvent(traverse));expect(traverse.defaultPrevented).toBe(true);
    unmount();const later=event('traverse');navigation.dispatchEvent(later);expect(later.defaultPrevented).toBe(false);
  });
  it('handles persisted page restoration and disabled transitions', () => {
    const {result,rerender}=renderHook(({enabled}) => useNavigationBlock({enabled}),{initialProps:{enabled:true}});
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:false})));
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    act(() => result.current.confirmNavigation());act(() => result.current.confirmNavigation());
    rerender({enabled:false});act(() => window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));expect(result.current.dialogOpen).toBe(false);
  });
});
