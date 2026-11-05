//@ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace libs ship TypeScript source.
  transpilePackages: ['@portfolios/visuals', '@portfolios/llm'],
  reactStrictMode: true,
};

module.exports = nextConfig;
