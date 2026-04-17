/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', '@supabase/supabase-js', 'xlsx'],
  },
  // 헤더는 vercel.json에서 관리
};

export default nextConfig;
