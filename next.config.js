/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/predict': [
        './data/tcgdex/upstream-snapshot.json',
        './data/tcgdex/LICENSE',
        './data/hybrid/catalog.json', './data/hybrid/manifest.json', './data/hybrid/LICENSE',
      ],
    },
  },
};

module.exports = nextConfig;
