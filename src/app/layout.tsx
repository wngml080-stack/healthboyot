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
                // 1) SW + 캐시 발견 시 → 즉시 unregister + 강제 리로드 (chunk fetch 시작 전에)
                //    옛 SW가 chunk를 가로채면 새 HTML + 옛 chunk mismatch → React #310/#419 발생
                //    따라서 SW 발견 시 즉시 죽이고 한 번 리로드해서 SW 없는 상태에서 chunk fetch
                var killKey = '__sw_killed_v3';
                if (!sessionStorage.getItem(killKey) && 'serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(regs){
                    if (regs.length === 0) return;
                    Promise.all(regs.map(function(r){ return r.unregister().catch(function(){}); }))
                      .then(function(){
                        if (typeof caches !== 'undefined') {
                          return caches.keys().then(function(keys){
                            return Promise.all(keys.map(function(k){ return caches.delete(k).catch(function(){}); }));
                          }).catch(function(){});
                        }
                      })
                      .then(function(){
                        sessionStorage.setItem(killKey, '1');
                        var u = new URL(location.href);
                        u.searchParams.set('_sw', Date.now().toString());
                        location.replace(u.toString());
                      })
                      .catch(function(){});
                  }).catch(function(){});
                }

                // 2) 빌드 ID 체크 → stale 캐시 자동 새로고침
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
              // 모든 client 에러를 localStorage에 누적 저장 — 디버깅용
              var __log = function(prefix, err, extra) {
                try {
                  var arr = JSON.parse(localStorage.getItem('__error_log') || '[]');
                  arr.push({
                    t: new Date().toISOString(),
                    prefix: prefix,
                    msg: (err && err.message) || String(err || ''),
                    stack: (err && err.stack) || '',
                    extra: extra || null,
                    url: location.href,
                  });
                  if (arr.length > 20) arr = arr.slice(-20);
                  localStorage.setItem('__error_log', JSON.stringify(arr));
                } catch(_){}
              };
              window.addEventListener('error', function(e) {
                var msg = (e && e.message) || '';
                __log('window.error', e.error || e, { filename: e.filename, lineno: e.lineno, colno: e.colno });
                if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1) {
                  var key = 'chunk_reload_' + location.pathname;
                  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch(_){}
                  location.reload();
                }
              });
              window.addEventListener('unhandledrejection', function(e) {
                __log('unhandledrejection', e.reason);
                var msg = (e && e.reason && (e.reason.message || String(e.reason))) || '';
                if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('Failed to fetch dynamically imported module') !== -1) {
                  var key = 'chunk_reload_' + location.pathname;
                  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch(_){}
                  location.reload();
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
