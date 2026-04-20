/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', '@supabase/supabase-js', 'xlsx', '@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-checkbox', '@radix-ui/react-tabs'],
  },
  // 헤더는 vercel.json에서 관리
};

export default nextConfig;
