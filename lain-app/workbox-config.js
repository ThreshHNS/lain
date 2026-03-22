module.exports = {
  globDirectory: 'dist',
  globPatterns: ['**/*.{css,html,ico,json,png,js,svg,txt,woff,woff2,glb}'],
  swDest: 'dist/sw.js',
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  navigateFallback: 'index.html',
  navigateFallbackDenylist: [/\/scenes\//],
};
