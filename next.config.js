/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['jspdf', 'html2canvas'],
  },
};

module.exports = nextConfig;
