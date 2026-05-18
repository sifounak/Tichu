import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ScaleProvider } from '@/components/ScaleProvider';
import { DebugOutlines } from '@/components/DebugOutlines';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

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
      <head>
        {/* Preload special card images at page load so they display instantly when cards render.
            Without this, images only load when the game page chunk executes — too late. */}
        <link rel="preload" href={`${basePath}/images/cards/dragon.png`} as="image" />
        <link rel="preload" href={`${basePath}/images/cards/phoenix.png`} as="image" />
        <link rel="preload" href={`${basePath}/images/cards/dog.png`} as="image" />
        <link rel="preload" href={`${basePath}/images/cards/mahjong.png`} as="image" />
      </head>
      <body><DebugOutlines /><ScaleProvider>{children}</ScaleProvider></body>
    </html>
  );
}
