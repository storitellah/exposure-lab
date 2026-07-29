/**
 * Per-route page metadata. The same data drives the runtime title/description
 * (for in-app navigation and shared links) and the build-time prerender that
 * writes a real HTML file per route, so crawlers see correct metadata without
 * running JavaScript.
 */
import seo from './seo.json';

export interface RouteMeta {
  path: string;
  title: string;
  description: string;
}

export const ROUTES: RouteMeta[] = seo.routes;
export const SITE_NAME = seo.siteName;
export const DEFAULT_DESCRIPTION = seo.defaultDescription;

/** Longest matching route prefix wins, so /learn/aperture-dof uses /learn. */
export function metaForPath(path: string): RouteMeta {
  const normalised = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  let best: RouteMeta | undefined;
  for (const route of ROUTES) {
    if (normalised === route.path || (route.path !== '/' && normalised.startsWith(`${route.path}/`))) {
      if (!best || route.path.length > best.path.length) best = route;
    }
  }
  return best ?? (ROUTES[0] as RouteMeta);
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Apply a route's metadata to the live document. */
export function applyRouteMeta(path: string): void {
  const meta = metaForPath(path);
  document.title = meta.title;
  setMeta('meta[name="description"]', 'name', 'description', meta.description);
  setMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = `${window.location.origin}${meta.path}`;
}
