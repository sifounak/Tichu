// REQ-F-MP07: In-game text chat — side panel desktop, bottom sheet mobile
'use client';

import { memo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  /** Local storage key used to preserve unsent draft text across refreshes */
  draftStorageKey?: string;
}

const SEAT_LABELS: Record<Seat, string> = {
  north: 'North',
  east: 'East',
  south: 'South',
  west: 'West',
};

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
const TRAILING_URL_PUNCTUATION = /[.,!?;:)\]]+$/;

function readChatDraft(key?: string): string {
  if (!key || typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeChatDraft(key: string | undefined, value: string): void {
  if (!key || typeof window === 'undefined') return;
  try {
    if (value.length > 0) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage failures; draft persistence is best-effort.
  }
}

function renderMessageText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const rawUrl = match[0];
    const index = match.index ?? 0;
    const trailing = rawUrl.match(TRAILING_URL_PUNCTUATION)?.[0] ?? '';
    const displayUrl = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;

    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    if (displayUrl) {
      const href = displayUrl.startsWith('www.') ? `https://${displayUrl}` : displayUrl;
      parts.push(
        <a
          key={`${index}-${displayUrl}`}
          className={styles.messageLink}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {displayUrl}
        </a>,
      );
    }

    if (trailing) {
      parts.push(trailing);
    }

    lastIndex = index + rawUrl.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

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
  draftStorageKey,
}: ChatPanelProps) {
  // Spectators can type when spectator chat is enabled; players always can
  const effectiveReadOnly = isSpectator ? !spectatorChatEnabled : readOnly;
  const [input, setInput] = useState(() => readChatDraft(draftStorageKey));
  const draftStorageKeyRef = useRef(draftStorageKey);
  const skipNextDraftWriteRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(messages.length);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    messagesEndRef.current?.scrollIntoView?.({ behavior, block: 'end' });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    scrollToBottom('auto');
  }, [isOpen, mobile, scrollToBottom]);

  useEffect(() => {
    const previousMessageCount = previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;
    if (!isOpen || messages.length === previousMessageCount) return;
    scrollToBottom('smooth');
  }, [isOpen, messages.length, scrollToBottom]);

  useEffect(() => {
    if (draftStorageKeyRef.current === draftStorageKey) return;
    draftStorageKeyRef.current = draftStorageKey;
    skipNextDraftWriteRef.current = true;
    setInput(readChatDraft(draftStorageKey));
  }, [draftStorageKey]);

  useEffect(() => {
    if (skipNextDraftWriteRef.current) {
      skipNextDraftWriteRef.current = false;
      return;
    }
    writeChatDraft(draftStorageKey, input);
  }, [draftStorageKey, input]);

  const sendInput = useCallback(
    () => {
      const trimmed = input.trim();
      if (!trimmed) return;
      onSend(trimmed);
      setInput('');
      writeChatDraft(draftStorageKey, '');
    },
    [draftStorageKey, input, onSend],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendInput();
    },
    [sendInput],
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      sendInput();
    },
    [sendInput],
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

      {/* Chat panel — mobile uses portal to escape parent stacking context */}
      {isOpen && (() => {
        const panel = (
          <>
            {mobile && (
              <div className={styles.mobileBackdrop} onClick={onToggle} aria-hidden="true" />
            )}
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
                    return (
                      <div key={i} className={`${styles.message} ${styles.spectatorMessage}`}>
                        <span className={styles.sender}>{msg.spectatorName} <span className={styles.spectatorTag}>(spectator)</span>: </span>
                        <span className={styles.messageText}>{renderMessageText(msg.text)}</span>
                      </div>
                    );
                  }
                  if (msg.from === null) {
                    return (
                      <div key={i} className={styles.systemMessage}>
                        <span className={styles.systemText}>{renderMessageText(msg.text)}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={styles.message}>
                      <span className={styles.sender}>{seatNames?.[msg.from] ?? SEAT_LABELS[msg.from]}:</span>
                      <span className={styles.messageText}>{renderMessageText(msg.text)}</span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {!effectiveReadOnly && (
                <form className={styles.inputRow} onSubmit={handleSubmit}>
                  <textarea
                    className={styles.input}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={500}
                    aria-label="Chat message"
                    rows={1}
                    onKeyDown={handleInputKeyDown}
                  />
                  <button
                    className={styles.sendButton}
                    type="submit"
                    disabled={!input.trim()}
                    aria-label="Send message"
                  >
                    <svg className={styles.sendIcon} aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </form>
              )}
            </div>
          </>
        );
        return mobile ? createPortal(panel, document.body) : panel;
      })()}
    </>
  );
});
