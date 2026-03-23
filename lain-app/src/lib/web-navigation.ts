import { Platform } from 'react-native';

type RouteParams = Record<string, boolean | number | string | null | undefined>;

function buildAppUrl(route: string, params?: RouteParams) {
  const url = new URL(`./${route.replace(/^\/+/, '')}`, window.location.href);

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

  window.location.assign(new URL('./', window.location.href).toString());
  return true;
}
