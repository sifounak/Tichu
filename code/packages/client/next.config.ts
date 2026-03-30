import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: '/tichu',
  transpilePackages: ['@tichu/shared'],
};

export default nextConfig;
