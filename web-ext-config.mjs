// web-ext settings: what goes into the package (npx web-ext build / lint / run).
export default {
  ignoreFiles: [
    'test', 'test/**', 'tools', 'tools/**', 'dist', 'dist/**', 'web-ext-artifacts', 'web-ext-artifacts/**',
    'README.md', 'AMO.md', 'web-ext-config.mjs', '.gitignore', 'icons/icon.svg',
  ],
};
