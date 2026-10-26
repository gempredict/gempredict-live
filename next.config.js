/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/predict': [
        './data/tcgdex/upstream-snapshot.json',
        './data/tcgdex/LICENSE',
      ],
    },
  },
};

module.exports = nextConfig;
