/**
 * Resolve a public-asset path against the app's base URL, so bundled assets
 * work both at "/" (local) and under a subpath (GitHub Pages).
 * Tolerates legacy absolute paths persisted in older state.
 */
export function assetUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}
