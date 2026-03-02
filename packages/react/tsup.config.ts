import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx', 'src/swr.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react', 'swr', 'swr/_internal'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
