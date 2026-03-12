// Connection status indicator for WebSocket
'use client';

import { memo } from 'react';
import type { ConnectionStatus as Status } from '@/hooks/useWebSocket';
import styles from './ConnectionStatus.module.css';

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  connected: { label: 'Connected', className: 'connected' },
  connecting: { label: 'Connecting...', className: 'connecting' },
  reconnecting: { label: 'Reconnecting...', className: 'reconnecting' },
  disconnected: { label: 'Disconnected', className: 'disconnected' },
};

export const ConnectionStatus = memo(function ConnectionStatus({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status];
  if (status === 'connected') return null; // Don't show when connected

  return (
    <div
      className={`${styles.indicator} ${styles[config.className]}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.dot} />
      {config.label}
    </div>
  );
});
