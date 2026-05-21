/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // tronweb 等 server-only 依赖，避免被打进客户端 bundle
  experimental: {
    serverComponentsExternalPackages: ['tronweb', 'bcryptjs', 'jose'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
