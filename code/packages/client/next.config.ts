import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Required for pnpm monorepo: tells Next.js to trace dependencies from the
  // monorepo root (code/) so the standalone output includes all resolved modules
  // and generates the server.js entry point correctly.
  outputFileTracingRoot: path.join(import.meta.dirname, '..', '..'),
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  transpilePackages: ['@tichu/shared'],
};

export default nextConfig;
