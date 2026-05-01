// REQ-F-MP07: In-game text chat — side panel desktop, bottom sheet mobile
'use client';

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import type { Seat } from '@tichu/shared';
import styles from './ChatPanel.module.css';

export interface ChatMessage {
  from: Seat | null;
  text: string;
  timestamp: number;
  spectatorName?: string;
}

export interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
  seatNames?: Record<Seat, string>;
  // REQ-F-SP14: Spectators can read chat but not send
  readOnly?: boolean;
  isHost?: boolean;
  isSpectator?: boolean;
  spectatorChatEnabled?: boolean;
  onToggleSpectatorChat?: () => void;
  /** Mobile mode: inline bubble button + centered overlay modal */
  mobile?: boolean;
}

const SEAT_LABELS: Record<Seat, string> = {
  north: 'North',
  east: 'East',
  south: 'South',
  west: 'West',
};

export const ChatPanel = memo(function ChatPanel({
  messages,
  onSend,
  isOpen,
  onToggle,
  unreadCount,
  seatNames,
  readOnly = false,
  isHost = false,
  isSpectator = false,
  spectatorChatEnabled = false,
  onToggleSpectatorChat,
  mobile = false,
}: ChatPanelProps) {
  // Spectators can type when spectator chat is enabled; players always can
  const effectiveReadOnly = isSpectator ? !spectatorChatEnabled : readOnly;
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) return;
      onSend(trimmed);
      setInput('');
    },
    [input, onSend],
  );

  const toggleButtonClass = mobile ? styles.mobileToggleButton : styles.toggleButton;
  const panelClass = mobile ? styles.mobilePanel : styles.panel;

  return (
    <>
      {/* Toggle button — visible when closed */}
      {!isOpen && (
        <button
          className={toggleButtonClass}
          onClick={onToggle}
          aria-label={`Open chat${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <svg className={styles.chatIcon} aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 5.92 2 10.66c0 2.72 1.52 5.16 3.92 6.76-.2 1.56-.88 2.9-1.84 3.88a.5.5 0 00.36.84c2.44 0 4.36-1.08 5.56-2.16.64.08 1.3.12 2 .12 5.52 0 10-3.92 10-8.66S17.52 2 12 2z" />
          </svg>
          {unreadCount > 0 && (
            <span className={styles.unreadBadge}>{unreadCount}</span>
          )}
        </button>
      )}

      {/* Backdrop for mobile overlay */}
      {mobile && isOpen && (
        <div className={styles.mobileBackdrop} onClick={onToggle} aria-hidden="true" />
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className={panelClass} role="complementary" aria-label="Chat">
          <div className={styles.header}>
            <span className={styles.headerTitle}>Chat</span>
            {isHost && onToggleSpectatorChat && (
              <label className={styles.spectatorToggle} aria-label="Toggle spectator chat">
                <input
                  type="checkbox"
                  checked={spectatorChatEnabled}
                  onChange={onToggleSpectatorChat}
                />
                <span className={styles.spectatorToggleLabel}>Allow Spectators</span>
              </label>
            )}
            <button
              className={styles.closeButton}
              onClick={onToggle}
              aria-label="Close chat"
            >
              &times;
            </button>
          </div>

          <div className={styles.messages} role="log" aria-live="polite">
            {messages.length === 0 && (
              <p className={styles.emptyText}>No messages yet</p>
            )}
            {messages.map((msg, i) => {
              if (msg.from === null && msg.spectatorName) {
                // Spectator message
                return (
                  <div key={i} className={`${styles.message} ${styles.spectatorMessage}`}>
                    <span className={styles.sender}>{msg.spectatorName} <span className={styles.spectatorTag}>(spectator)</span>: </span>
                    <span className={styles.messageText}>{msg.text}</span>
                  </div>
                );
              }
              if (msg.from === null) {
                // System message
                return (
                  <div key={i} className={styles.systemMessage}>
                    <span className={styles.systemText}>{msg.text}</span>
                  </div>
                );
              }
              // Player message (existing)
              return (
                <div key={i} className={styles.message}>
                  <span className={styles.sender}>{seatNames?.[msg.from] ?? SEAT_LABELS[msg.from]}:</span>
                  <span className={styles.messageText}>{msg.text}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* REQ-F-SP14: Hide input for spectators (readOnly mode) */}
          {!effectiveReadOnly && (
            <form className={styles.inputRow} onSubmit={handleSubmit}>
              <input
                className={styles.input}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                maxLength={500}
                aria-label="Chat message"
              />
              <button
                className={styles.sendButton}
                type="submit"
                disabled={!input.trim()}
                aria-label="Send message"
              >
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
});
