import Link from 'next/link';
import { StatsTabNav } from '@/components/stats/StatsTabNav';

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="p-6" style={{ background: '#0c2415', height: '100dvh', overflowY: 'auto' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 style={{ color: '#dbb856', fontSize: '1.5rem', fontWeight: 700 }}>Player Stats</h1>
          <Link
            href="/lobby"
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: '#dbb856', color: '#0c2415' }}
          >
            Back to Lobby
          </Link>
        </div>
        <StatsTabNav />
        {children}
      </div>
    </main>
  );
}
