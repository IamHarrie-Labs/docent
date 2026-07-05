/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'simple-git'],
  outputFileTracingRoot: process.cwd(),
  webpack: (config) => {
    // Cloned repos + SQLite files live under data/ — never let the dev
    // watcher treat them as source changes (it kills in-flight SSE streams).
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/data/**', '**/node_modules/**', '**/.git/**'],
    };
    return config;
  },
};

export default nextConfig;
