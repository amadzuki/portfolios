//@ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace libs ship TypeScript source.
  transpilePackages: [
    '@portfolios/visuals',
    '@portfolios/llm',
    '@portfolios/content',
  ],
  reactStrictMode: true,
};

module.exports = nextConfig;
