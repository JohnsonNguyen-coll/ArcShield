/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  turbopack: {},

  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      '@react-native-async-storage/async-storage': false,
      'react-native': false,
      'react-native-randombytes': false,
    };

    // Ignore MetaMask SDK warnings
    config.ignoreWarnings = [
      { module: /@metamask\/sdk/ },
    ];

    return config;
  },
}

module.exports = nextConfig