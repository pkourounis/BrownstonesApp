/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A per-build id (Netlify commit ref, else build timestamp) inlined into both
  // client and server bundles. Used to detect stale clients and auto-reload.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.COMMIT_REF || String(Date.now()),
  },
  // Service worker and manifest are served from /public.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
