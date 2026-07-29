/**
 * Object-URL lifecycle helpers.
 *
 * Object URLs are an external resource, so they are created where the data
 * arrives (an async load or a user event) and revoked when replaced or on
 * unmount — never derived inside a render-phase effect.
 */

export type UrlMap = Record<string, string>;

/** Create URLs for a set of keyed blobs. */
export function createUrls<T extends { id: string }>(
  items: T[],
  pick: (item: T) => Blob,
): UrlMap {
  const urls: UrlMap = {};
  for (const item of items) urls[item.id] = URL.createObjectURL(pick(item));
  return urls;
}

/** Revoke every URL in a map. Safe to call with an empty map. */
export function revokeUrls(urls: UrlMap): void {
  for (const url of Object.values(urls)) URL.revokeObjectURL(url);
}

/** Revoke a single URL if present. */
export function revokeUrl(url: string | undefined | null): void {
  if (url) URL.revokeObjectURL(url);
}
