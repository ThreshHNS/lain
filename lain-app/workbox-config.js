module.exports = {
  globDirectory: 'dist',
  globPatterns: ['**/*.{css,html,ico,json,png,js,svg,txt,woff,woff2,glb}'],
  swDest: 'dist/sw.js',
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  navigateFallback: 'index.html',
  navigateFallbackDenylist: [/\/scenes\//],
  // Scene URLs include ?v=, ?embedded=, ?preview=, ?still= — ignore them when
  // looking up precached scene HTML so the SW can serve offline without refetching.
  ignoreURLParametersMatching: [/^v$/, /^embedded$/, /^preview$/, /^still$/],
};
