import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const here = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

/*
 * The host serves the built UI under /admin/, and the bootstrapper loads it from
 * there too, so the base has to match in production. In dev the app is served
 * from the root instead - a base of /admin/ would make every dev URL carry a
 * prefix that the dev server does not need.
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/admin/' : '/',

  plugins: [svelte()],

  resolve: {
    alias: {
      $lib: here('./src/lib'),
      $routes: here('./src/routes'),
    },

    // Svelte's export map sends "browser" to the client build and "default" to
    // the server build, whose mount() throws lifecycle_function_unavailable.
    // Vitest resolves through the node/ssr condition set, so the browser
    // condition has to be named explicitly or every component test fails.
    conditions: ['browser', 'import', 'module', 'default'],
  },

  server: {
    // The Angular dev server owns 4200 and the bootstrapper's devUrl points at it,
    // so the Svelte one takes the next port and the two can run side by side while
    // routes are migrated one at a time.
    port: 4300,
    strictPort: true,
  },

  build: {
    // Matches the Angular build's output path so the bootstrapper and the host's
    // static-file middleware find the bundle where they already look for it.
    outDir: 'dist/desktop-ui',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,svelte.ts}'],
  },
}));
