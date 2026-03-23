import { Platform } from 'react-native';

type RouteParams = Record<string, boolean | number | string | null | undefined>;

function getAppBaseUrl() {
  const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;

  if (manifestLink?.href) {
    const manifestUrl = new URL(manifestLink.href, window.location.href);
    manifestUrl.pathname = manifestUrl.pathname.replace(/manifest\.json$/, '');
    if (!manifestUrl.pathname.endsWith('/')) {
      manifestUrl.pathname = `${manifestUrl.pathname}/`;
    }
    manifestUrl.search = '';
    manifestUrl.hash = '';
    return manifestUrl;
  }

  const fallback = new URL(window.location.href);
  const match = fallback.pathname.match(/^(.*\/app)(?:\/.*)?$/);
  fallback.pathname = match ? `${match[1]}/` : '/';
  fallback.search = '';
  fallback.hash = '';
  return fallback;
}

function buildAppUrl(route: string, params?: RouteParams) {
  const url = new URL(route.replace(/^\/+/, '') || './', getAppBaseUrl());

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value == null) {
      url.searchParams.delete(key);
      return;
    }
    url.searchParams.set(key, String(value));
  });

  return `${url.pathname}${url.search}${url.hash}`;
}

export function navigateWithinWebApp(route: string, params?: RouteParams) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  window.location.assign(buildAppUrl(route, params));
  return true;
}

export function navigateToWebAppHome() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  window.location.assign(getAppBaseUrl().toString());
  return true;
}
