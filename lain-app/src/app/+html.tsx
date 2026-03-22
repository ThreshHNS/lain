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

export default function Html({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="IE=edge" httpEquiv="X-UA-Compatible" />
        <meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
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
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: SERVICE_WORKER_REGISTER }} />
      </body>
    </html>
  );
}
