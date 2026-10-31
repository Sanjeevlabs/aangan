/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare Workers has no built-in Next.js image optimizer. The only
  // optimised images were a handful of bundled demo photos, so they are served
  // as-is (Workers static assets, edge-cached) rather than adding a Cloudflare
  // Images dependency. See docs/DEPLOY.md.
  images: { unoptimized: true },
};

export default nextConfig;
