/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep desktop production output separate from npm run dev and Vercel builds.
  distDir: process.env.AKRAM_DESKTOP === '1' ? '.next-desktop' : '.next',
  experimental: {
    serverComponentsExternalPackages: ['playwright'],
  },
};

export default nextConfig;
