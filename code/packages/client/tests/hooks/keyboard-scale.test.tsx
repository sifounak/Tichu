// Verifies: REQ-F-UC04. Keyboard behavior and scale calculation/event cleanup, not browser geometry.
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { useRovingTabIndex } from '@/hooks/useRovingTabIndex';
import { useScaleFactor } from '@/hooks/useScaleFactor';
import { ScaleProvider } from '@/components/ScaleProvider';

const originalWidth=window.innerWidth,originalHeight=window.innerHeight;
beforeEach(() => { document.documentElement.removeAttribute('data-layout'); });
afterEach(() => {
  vi.useRealTimers();vi.restoreAllMocks();document.documentElement.removeAttribute('data-layout');document.documentElement.style.removeProperty('--scale');
  Object.defineProperty(window,'innerWidth',{configurable:true,value:originalWidth});Object.defineProperty(window,'innerHeight',{configurable:true,value:originalHeight});
});
function Hand({count=3}:{count?:number}) {
  const {containerRef,handleKeyDown}=useRovingTabIndex(count);
  return <div ref={containerRef} onKeyDown={handleKeyDown}><button>Other</button>{Array.from({length:count},(_,i)=><button key={i} data-card-id={i}>Card {i}</button>)}</div>;
}
function size(width:number,height:number) {Object.defineProperty(window,'innerWidth',{configurable:true,value:width});Object.defineProperty(window,'innerHeight',{configurable:true,value:height});}
describe('Keyboard and scale contracts', () => {
  it('moves/wraps card focus in both directions and supports Home/End', () => {
    render(<Hand />);const cards=screen.getAllByRole('button',{name:/Card/});cards[0].focus();
    for(const key of ['ArrowRight','ArrowDown']) {fireEvent.keyDown(document.activeElement!,{key});}
    expect(cards[2]).toHaveFocus();fireEvent.keyDown(cards[2],{key:'ArrowRight'});expect(cards[0]).toHaveFocus();
    fireEvent.keyDown(cards[0],{key:'ArrowLeft'});expect(cards[2]).toHaveFocus();fireEvent.keyDown(cards[2],{key:'ArrowUp'});expect(cards[1]).toHaveFocus();
    fireEvent.keyDown(cards[1],{key:'Home'});expect(cards[0]).toHaveFocus();fireEvent.keyDown(cards[0],{key:'End'});expect(cards[2]).toHaveFocus();
    fireEvent.keyDown(cards[2],{key:'x'});expect(cards[2]).toHaveFocus();screen.getByText('Other').focus();fireEvent.keyDown(screen.getByText('Other'),{key:'ArrowRight'});expect(screen.getByText('Other')).toHaveFocus();
  });
  it('ignores empty lists and an unmounted container', () => {
    render(<Hand count={0} />);const other=screen.getByText('Other');other.focus();fireEvent.keyDown(other,{key:'End'});expect(other).toHaveFocus();
    const {result}=renderHook(() => useRovingTabIndex(3));const preventDefault=vi.fn();result.current.handleKeyDown({key:'End',preventDefault} as unknown as KeyboardEvent);expect(preventDefault).not.toHaveBeenCalled();
  });
  it.each([['full',1200,900,0.75],['full',100,100,0.5],['full',3000,3000,2],['mobile',500,900,1],['mobile',400,900,0.8],['mobile',100,900,0.55],['unknown',1200,1200,1]] as const)
  ('calculates scale for %s at %s×%s', (tier,width,height,expected) => {
    size(width,height);document.documentElement.setAttribute('data-layout',tier);renderHook(() => useScaleFactor());expect(Number(document.documentElement.style.getPropertyValue('--scale'))).toBeCloseTo(expected);
  });
  it('coalesces resize events, observes tier changes, and removes pending listeners/frames', async () => {
    vi.useFakeTimers();size(1200,1200);const {unmount}=render(<ScaleProvider><span>Scaled content</span></ScaleProvider>);expect(screen.getByText('Scaled content')).toBeInTheDocument();
    size(400,900);fireEvent(window,new Event('resize'));fireEvent(window,new Event('resize'));act(() => vi.advanceTimersByTime(20));
    expect(Number(document.documentElement.style.getPropertyValue('--scale'))).toBe(0.5);
    await act(async () => {document.documentElement.setAttribute('data-layout','mobile');await Promise.resolve();});expect(Number(document.documentElement.style.getPropertyValue('--scale'))).toBe(0.8);
    fireEvent(window,new Event('resize'));unmount();expect(vi.getTimerCount()).toBe(0);
    size(600,900);fireEvent(window,new Event('resize'));expect(Number(document.documentElement.style.getPropertyValue('--scale'))).toBe(0.8);
  });
});
