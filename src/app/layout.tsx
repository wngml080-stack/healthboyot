import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <Script id="chunk-reload" strategy="beforeInteractive">
          {`
            if (typeof window !== 'undefined') {
              window.addEventListener('error', function(e) {
                if (e.message && e.message.indexOf('Loading chunk') !== -1 || (e.message && e.message.indexOf('ChunkLoadError') !== -1)) {
                  var key = 'chunk_reload_' + location.pathname;
                  if (!sessionStorage.getItem(key)) {
                    sessionStorage.setItem(key, '1');
                    location.reload();
                  }
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
