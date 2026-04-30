import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ScaleProvider } from '@/components/ScaleProvider';
import { DebugOutlines } from '@/components/DebugOutlines';

export const metadata: Metadata = {
  title: 'Tichu',
  description: 'Web-based Tichu card game',
};

// REQ-NF-U06: Touch targets via viewport config
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><DebugOutlines /><ScaleProvider>{children}</ScaleProvider></body>
    </html>
  );
}
