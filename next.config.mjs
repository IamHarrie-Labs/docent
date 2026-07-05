/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'simple-git'],
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
