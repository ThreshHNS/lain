import type { PropsWithChildren } from 'react';

import { ScrollViewStyleReset } from 'expo-router/html';

const SERVICE_WORKER_REGISTER = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (error) {
      console.error('Service worker registration failed', error);
    });
  });
}
`;

/**
 * Generates a data-URI splash screen image (white logo on dark bg) at the
 * given pixel dimensions.  iOS requires device-specific
 * apple-touch-startup-image entries so the app launches without a white flash.
 */
const SPLASH_BG = '#050608';

const SPLASH_SCREENS: { w: number; h: number; ratio: number; query: string }[] = [
  // iPhone 16 Pro Max
  { w: 1320, h: 2868, ratio: 3, query: '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 16 Pro
  { w: 1206, h: 2622, ratio: 3, query: '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 16 Plus, 15 Plus, 14 Pro Max
  { w: 1290, h: 2796, ratio: 3, query: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 16, 15, 15 Pro, 14 Pro
  { w: 1179, h: 2556, ratio: 3, query: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 14 Plus, 13 Pro Max, 12 Pro Max
  { w: 1284, h: 2778, ratio: 3, query: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 14, 13, 13 Pro, 12, 12 Pro
  { w: 1170, h: 2532, ratio: 3, query: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 13 mini, 12 mini
  { w: 1125, h: 2436, ratio: 3, query: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 11 Pro Max, XS Max
  { w: 1242, h: 2688, ratio: 3, query: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)' },
  // iPhone 11, XR
  { w: 828, h: 1792, ratio: 2, query: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)' },
  // iPhone SE 3rd gen, 8, 7, 6s
  { w: 750, h: 1334, ratio: 2, query: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
  // iPhone 8 Plus
  { w: 1242, h: 2208, ratio: 3, query: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)' },
];

function splashDataUri(w: number, h: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${SPLASH_BG}"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="system-ui,-apple-system,sans-serif" font-size="${Math.round(w * 0.06)}" font-weight="700" fill="rgba(255,246,239,0.85)">lain</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function Html({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="IE=edge" httpEquiv="X-UA-Compatible" />
        <meta
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
          name="viewport"
        />
        <meta content="#050608" name="theme-color" />
        <meta content="yes" name="mobile-web-app-capable" />
        <meta content="yes" name="apple-mobile-web-app-capable" />
        <meta content="black-translucent" name="apple-mobile-web-app-status-bar-style" />
        <meta content="lain" name="apple-mobile-web-app-title" />
        <meta
          content="Installable web shell for the lain scene feed and editor."
          name="description"
        />
        <link href="./manifest.json" rel="manifest" />
        <link href="./apple-touch-icon.png" rel="apple-touch-icon" />
        <link href="./apple-touch-icon.png" rel="apple-touch-icon" sizes="180x180" />
        {/* iOS splash screens for all major iPhone sizes */}
        {SPLASH_SCREENS.map(({ w, h, query }) => (
          <link
            key={`${w}x${h}`}
            href={splashDataUri(w, h)}
            media={`screen and ${query} and (orientation: portrait)`}
            rel="apple-touch-startup-image"
          />
        ))}
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: SERVICE_WORKER_REGISTER }} />
      </body>
    </html>
  );
}
