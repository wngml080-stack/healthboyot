/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react', 'date-fns', '@supabase/supabase-js', 'xlsx',
      '@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-checkbox',
      '@radix-ui/react-tabs', '@radix-ui/react-dropdown-menu', '@radix-ui/react-avatar',
      '@radix-ui/react-label', '@radix-ui/react-separator', '@radix-ui/react-slot',
    ],
  },
  // [TEMPORARY DEBUGGING] 함수/클래스명 보존 — 에러 스택에 컴포넌트 이름 노출용
  // 원인 잡으면 다시 끄기
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      const minimizers = config.optimization?.minimizer
      if (Array.isArray(minimizers)) {
        for (const m of minimizers) {
          if (m?.constructor?.name === 'TerserPlugin' && m.options) {
            m.options.terserOptions = {
              ...(m.options.terserOptions ?? {}),
              keep_classnames: true,
              keep_fnames: true,
            }
          }
        }
      }
    }
    return config
  },
  // 헤더는 vercel.json에서 관리
};

export default nextConfig;
