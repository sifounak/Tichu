'use client';

import { memo, useEffect } from 'react';
import styles from './ErrorToast.module.css';

export interface ErrorToastProps {
  message: string | null;
  onDismiss: () => void;
}

export const ErrorToast = memo(function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className={styles.toast} role="alert" aria-live="assertive">
      {message}
    </div>
  );
});
