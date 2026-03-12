import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold tracking-tight">Tichu</h1>
        <p className="mt-4 text-lg" style={{ color: 'var(--color-text-secondary)' }}>
          A beautiful card game for four players
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/lobby"
            className="px-6 py-3 rounded-lg font-semibold text-sm transition-colors"
            style={{
              background: 'var(--color-gold-accent)',
              color: 'var(--color-felt-green-dark)',
            }}
          >
            Play Now
          </Link>
          <div className="flex gap-4">
            <Link href="/auth" className="text-sm underline" style={{ color: 'var(--color-text-secondary)' }}>
              Sign In / Register
            </Link>
            <Link href="/leaderboard" className="text-sm underline" style={{ color: 'var(--color-text-secondary)' }}>
              Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
