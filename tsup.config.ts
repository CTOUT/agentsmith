import { defineConfig } from 'tsup'

export default defineConfig([
  {
    // CLI entry — CJS so Node handles the shebang correctly regardless of package "type"
    entry: { cli: 'src/cli.ts' },
    format: ['cjs'],
    dts: false,
    sourcemap: true,
    clean: false,
    splitting: false,
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
    outExtension: () => ({ js: '.cjs' }),
  },
  {
    // Library entry — ESM + CJS with types
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    shims: true,
  },
])
