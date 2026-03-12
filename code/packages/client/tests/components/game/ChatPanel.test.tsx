// Verifies: REQ-F-MP07 — In-game chat panel
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPanel, type ChatMessage } from '@/components/game/ChatPanel';

const mockMessages: ChatMessage[] = [
  { from: 'north', text: 'Hello!', timestamp: 1000 },
  { from: 'east', text: 'Good luck!', timestamp: 2000 },
];

describe('ChatPanel (REQ-F-MP07)', () => {
  it('renders toggle button when closed', () => {
    render(
      <ChatPanel messages={[]} onSend={vi.fn()} isOpen={false} onToggle={vi.fn()} unreadCount={0} />,
    );
    expect(screen.getByLabelText('Open chat')).toBeInTheDocument();
  });

  it('shows unread badge when there are unread messages', () => {
    render(
      <ChatPanel messages={[]} onSend={vi.fn()} isOpen={false} onToggle={vi.fn()} unreadCount={3} />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByLabelText(/3 unread/)).toBeInTheDocument();
  });

  it('renders chat panel when open', () => {
    render(
      <ChatPanel messages={mockMessages} onSend={vi.fn()} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
    );
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Hello!')).toBeInTheDocument();
    expect(screen.getByText('Good luck!')).toBeInTheDocument();
    expect(screen.getByText('North')).toBeInTheDocument();
    expect(screen.getByText('East')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(
      <ChatPanel messages={[]} onSend={vi.fn()} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
    );
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('calls onSend when submitting a message', () => {
    const onSend = vi.fn();
    render(
      <ChatPanel messages={[]} onSend={onSend} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
    );
    const input = screen.getByLabelText('Chat message');
    fireEvent.change(input, { target: { value: 'test message' } });
    fireEvent.submit(input.closest('form')!);
    expect(onSend).toHaveBeenCalledWith('test message');
  });

  it('does not send empty messages', () => {
    const onSend = vi.fn();
    render(
      <ChatPanel messages={[]} onSend={onSend} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
    );
    const input = screen.getByLabelText('Chat message');
    fireEvent.submit(input.closest('form')!);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('calls onToggle when close button clicked', () => {
    const onToggle = vi.fn();
    render(
      <ChatPanel messages={[]} onSend={vi.fn()} isOpen={true} onToggle={onToggle} unreadCount={0} />,
    );
    fireEvent.click(screen.getByLabelText('Close chat'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('send button is disabled when input is empty', () => {
    render(
      <ChatPanel messages={[]} onSend={vi.fn()} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
    );
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });
});
