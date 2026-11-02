import { defineConfig } from 'tsup'

export default defineConfig([
  {
    // CLI entry — CJS, no shebang (bin wrapper handles execution)
    entry: { cli: 'src/cli.ts' },
    format: ['cjs'],
    dts: false,
    sourcemap: true,
    clean: false,
    splitting: false,
    shims: true,
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
