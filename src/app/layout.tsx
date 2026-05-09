import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { DebugErrorBoundary } from "@/components/debug-error-boundary";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  preload: true,
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "헬스보이짐 당산역점 OT시스템",
  description: "헬스보이짐 당산역점 OT 배정 및 관리 시스템",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "헬스보이짐",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Vercel은 빌드 ID를 환경변수로 노출 — HTML에 박아 클라이언트에서 동기 비교
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
    || process.env.VERCEL_DEPLOYMENT_ID
    || 'dev'

  return (
    <html lang="ko" data-build={buildId}>
      <head>
        {/* React hydration 시작 전에 빌드 ID 비교 → stale 캐시면 즉시 새로고침 */}
        {/* useEffect는 render 도중 #310이 터지면 못 도달하므로 head inline script로 처리 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var serverBuild = '${buildId}';
                var stored = localStorage.getItem('__build_id');
                var url = new URL(location.href);
                var alreadyVersioned = url.searchParams.has('_v');
                if (stored && stored !== serverBuild && !alreadyVersioned) {
                  var key = '__build_reload_' + serverBuild;
                  if (!sessionStorage.getItem(key)) {
                    sessionStorage.setItem(key, '1');
                    localStorage.setItem('__build_id', serverBuild);
                    url.searchParams.set('_v', serverBuild);
                    location.replace(url.toString());
                    return;
                  }
                }
                localStorage.setItem('__build_id', serverBuild);
              } catch(_){}
            })();`,
          }}
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DebugErrorBoundary>
          <Providers>{children}</Providers>
        </DebugErrorBoundary>
        <Script id="chunk-reload" strategy="beforeInteractive">
          {`
            if (typeof window !== 'undefined') {
              // 청크 로드 실패 시 한 번만 새로고침 (배포 직후 stale chunk 해소)
              var __chunkReloaded = false;
              var __chunkRecover = function() {
                if (__chunkReloaded) return;
                var key = 'chunk_reload_' + location.pathname;
                try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch(_){}
                __chunkReloaded = true;
                location.reload();
              };
              window.addEventListener('error', function(e) {
                var msg = (e && e.message) || '';
                if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1) {
                  __chunkRecover();
                }
              });
              window.addEventListener('unhandledrejection', function(e) {
                var msg = (e && e.reason && (e.reason.message || String(e.reason))) || '';
                if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('Failed to fetch dynamically imported module') !== -1) {
                  __chunkRecover();
                }
              });
            }
          `}
        </Script>
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
          integrity="sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <Script id="kakao-init" strategy="afterInteractive">
          {`
            if (typeof window !== 'undefined') {
              window.__initKakao = function() {
                var key = '${process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? ''}';
                if (key && window.Kakao && !window.Kakao.isInitialized()) {
                  window.Kakao.init(key);
                }
              };
              var tryInit = function(){ if (window.Kakao) { window.__initKakao(); } else { setTimeout(tryInit, 100); } };
              tryInit();
            }
          `}
        </Script>
      </body>
    </html>
  );
}
