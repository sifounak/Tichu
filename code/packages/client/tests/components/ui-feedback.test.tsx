// Verifies: REQ-F-UC04. Connection transitions, pending feedback and toast lifecycle.
import { act, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { ErrorToast } from '@/components/ui/ErrorToast';
import { ActionSpinner } from '@/components/game/ActionSpinner';
import { useUiStore } from '@/stores/uiStore';
import { resetClientStores } from '../fixtures/client';

beforeEach(() => resetClientStores());
afterEach(() => vi.useRealTimers());
describe('User feedback', () => {
  it('announces connection transitions and clears status after reconnection', () => {
    const {rerender}=render(<ConnectionStatus status="connecting" />);expect(screen.getByRole('status')).toHaveTextContent('Connecting...');
    rerender(<ConnectionStatus status="reconnecting" />);expect(screen.getByRole('status')).toHaveTextContent('Reconnecting...');
    rerender(<ConnectionStatus status="disconnected" />);expect(screen.getByRole('status')).toHaveTextContent('Disconnected');
    rerender(<ConnectionStatus status="connected" />);expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('shows pending-action feedback and removes it when the action resolves', () => {
    render(<ActionSpinner />);expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => useUiStore.setState({pendingActionSpinner:true}));expect(screen.getByRole('status',{name:'Sending action'})).toHaveTextContent('Sending...');
    act(() => useUiStore.setState({pendingActionSpinner:false}));expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('restarts the toast deadline for a replacement error and cancels it on unmount', () => {
    vi.useFakeTimers();const dismiss=vi.fn();const {rerender,unmount}=render(<ErrorToast message={null} onDismiss={dismiss} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();rerender(<ErrorToast message="First failure" onDismiss={dismiss} />);
    act(() => vi.advanceTimersByTime(3999));expect(dismiss).not.toHaveBeenCalled();rerender(<ErrorToast message="Second failure" onDismiss={dismiss} />);
    act(() => vi.advanceTimersByTime(1));expect(dismiss).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('Second failure');
    act(() => vi.advanceTimersByTime(3999));expect(dismiss).toHaveBeenCalledOnce();rerender(<ErrorToast message="Last failure" onDismiss={dismiss} />);unmount();expect(vi.getTimerCount()).toBe(0);
  });
});
