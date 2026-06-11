// Verifies: REQ-F-MP07 — In-game chat panel
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPanel, type ChatMessage } from '@/components/game/ChatPanel';

const mockMessages: ChatMessage[] = [
  { from: 'north', text: 'Hello!', timestamp: 1000 },
  { from: 'east', text: 'Good luck!', timestamp: 2000 },
];
const originalScrollIntoView = HTMLDivElement.prototype.scrollIntoView;

describe('ChatPanel (REQ-F-MP07)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    if (originalScrollIntoView) {
      HTMLDivElement.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete (HTMLDivElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

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
    expect(screen.getByText('North:')).toBeInTheDocument();
    expect(screen.getByText('East:')).toBeInTheDocument();
  });

  it('scrolls to the latest messages when opened in mobile mode', () => {
    const scrollIntoView = vi.fn();
    HTMLDivElement.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(
      <ChatPanel messages={mockMessages} onSend={vi.fn()} isOpen={false} onToggle={vi.fn()} unreadCount={2} mobile />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(
      <ChatPanel messages={mockMessages} onSend={vi.fn()} isOpen={true} onToggle={vi.fn()} unreadCount={0} mobile />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'end' });
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

  it('uses a multiline chat entry field', () => {
    render(
      <ChatPanel messages={[]} onSend={vi.fn()} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
    );
    expect(screen.getByLabelText('Chat message').tagName).toBe('TEXTAREA');
  });

  it('sends the message when Enter is pressed in the chat entry field', () => {
    const onSend = vi.fn();
    render(
      <ChatPanel messages={[]} onSend={onSend} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
    );
    const input = screen.getByLabelText('Chat message');
    fireEvent.change(input, { target: { value: 'hello there' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('hello there');
    expect(input).toHaveValue('');
  });

  it('keeps Shift+Enter available for adding a new line', () => {
    const onSend = vi.fn();
    render(
      <ChatPanel messages={[]} onSend={onSend} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
    );
    const input = screen.getByLabelText('Chat message');
    fireEvent.change(input, { target: { value: 'line one' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('line one');
  });

  it('restores unsent draft text from local storage', () => {
    window.localStorage.setItem('chat-draft-test', 'saved draft');
    render(
      <ChatPanel
        messages={[]}
        onSend={vi.fn()}
        isOpen={true}
        onToggle={vi.fn()}
        unreadCount={0}
        draftStorageKey="chat-draft-test"
      />,
    );
    expect(screen.getByLabelText('Chat message')).toHaveValue('saved draft');
  });

  it('saves unsent draft text to local storage while typing', () => {
    render(
      <ChatPanel
        messages={[]}
        onSend={vi.fn()}
        isOpen={true}
        onToggle={vi.fn()}
        unreadCount={0}
        draftStorageKey="chat-draft-test"
      />,
    );
    fireEvent.change(screen.getByLabelText('Chat message'), { target: { value: 'in progress' } });
    expect(window.localStorage.getItem('chat-draft-test')).toBe('in progress');
  });

  it('clears the saved draft after sending', () => {
    window.localStorage.setItem('chat-draft-test', 'saved draft');
    render(
      <ChatPanel
        messages={[]}
        onSend={vi.fn()}
        isOpen={true}
        onToggle={vi.fn()}
        unreadCount={0}
        draftStorageKey="chat-draft-test"
      />,
    );
    fireEvent.keyDown(screen.getByLabelText('Chat message'), { key: 'Enter' });
    expect(window.localStorage.getItem('chat-draft-test')).toBeNull();
  });

  it('loads the draft for a changed storage key without copying the old draft', () => {
    const { rerender } = render(
      <ChatPanel
        messages={[]}
        onSend={vi.fn()}
        isOpen={true}
        onToggle={vi.fn()}
        unreadCount={0}
        draftStorageKey="chat-draft-one"
      />,
    );
    fireEvent.change(screen.getByLabelText('Chat message'), { target: { value: 'room one draft' } });

    rerender(
      <ChatPanel
        messages={[]}
        onSend={vi.fn()}
        isOpen={true}
        onToggle={vi.fn()}
        unreadCount={0}
        draftStorageKey="chat-draft-two"
      />,
    );

    expect(screen.getByLabelText('Chat message')).toHaveValue('');
    expect(window.localStorage.getItem('chat-draft-two')).toBeNull();
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

  it('renders spectator message with name and label', () => {
    const msgs: ChatMessage[] = [
      { from: null, text: 'Nice play!', timestamp: 1000, spectatorName: 'Alice' },
    ];
    render(
      <ChatPanel messages={msgs} onSend={vi.fn()} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
    );
    expect(screen.getByText((_content, el) => typeof el?.className === 'string' && el.className.includes('sender') && !!el?.textContent?.match(/Alice\s*\(spectator\)\s*:/))).toBeInTheDocument();
    expect(screen.getByText('Nice play!')).toBeInTheDocument();
  });

  it('renders system message without sender', () => {
    const msgs: ChatMessage[] = [
      { from: null, text: 'Spectator chat has been enabled by the host', timestamp: 1000 },
    ];
    render(
      <ChatPanel messages={msgs} onSend={vi.fn()} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
    );
    expect(screen.getByText('Spectator chat has been enabled by the host')).toBeInTheDocument();
  });

  it('preserves new line characters in rendered messages', () => {
    render(
      <ChatPanel
        messages={[{ from: 'north', text: 'line one\nline two', timestamp: 1000 }]}
        onSend={vi.fn()}
        isOpen={true}
        onToggle={vi.fn()}
        unreadCount={0}
      />,
    );

    const messageText = screen
      .getByText((_content, el) => typeof el?.className === 'string' && el.className.includes('messageText'));
    expect(messageText.textContent).toBe('line one\nline two');
  });

  it('renders http and https URLs as links', () => {
    render(
      <ChatPanel
        messages={[
          { from: 'north', text: 'Join https://example.com/game/ABC123 and http://localhost:3000/lobby', timestamp: 1000 },
        ]}
        onSend={vi.fn()}
        isOpen={true}
        onToggle={vi.fn()}
        unreadCount={0}
      />,
    );

    expect(screen.getByRole('link', { name: 'https://example.com/game/ABC123' })).toHaveAttribute('href', 'https://example.com/game/ABC123');
    expect(screen.getByRole('link', { name: 'http://localhost:3000/lobby' })).toHaveAttribute('href', 'http://localhost:3000/lobby');
  });

  it('renders bare www URLs as https links without swallowing trailing punctuation', () => {
    render(
      <ChatPanel
        messages={[{ from: 'east', text: 'Look at www.example.com/test).', timestamp: 1000 }]}
        onSend={vi.fn()}
        isOpen={true}
        onToggle={vi.fn()}
        unreadCount={0}
      />,
    );

    expect(screen.getByRole('link', { name: 'www.example.com/test' })).toHaveAttribute('href', 'https://www.example.com/test');
    expect(screen.getByText((_content, el) => el?.textContent === 'Look at www.example.com/test).')).toBeInTheDocument();
  });

  it('shows host toggle when isHost is true', () => {
    render(
      <ChatPanel
        messages={[]}
        onSend={vi.fn()}
        isOpen={true}
        onToggle={vi.fn()}
        unreadCount={0}
        isHost={true}
        spectatorChatEnabled={false}
        onToggleSpectatorChat={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Toggle spectator chat')).toBeInTheDocument();
  });

  it('does not show host toggle when isHost is false', () => {
    render(
      <ChatPanel messages={[]} onSend={vi.fn()} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
    );
    expect(screen.queryByLabelText('Toggle spectator chat')).not.toBeInTheDocument();
  });

  it('shows input for spectator when spectator chat is enabled', () => {
    render(
      <ChatPanel
        messages={[]}
        onSend={vi.fn()}
        isOpen={true}
        onToggle={vi.fn()}
        unreadCount={0}
        isSpectator={true}
        spectatorChatEnabled={true}
      />,
    );
    expect(screen.getByLabelText('Chat message')).toBeInTheDocument();
  });

  it('hides input for spectator when spectator chat is disabled', () => {
    render(
      <ChatPanel
        messages={[]}
        onSend={vi.fn()}
        isOpen={true}
        onToggle={vi.fn()}
        unreadCount={0}
        isSpectator={true}
        spectatorChatEnabled={false}
      />,
    );
    expect(screen.queryByLabelText('Chat message')).not.toBeInTheDocument();
  });
});
