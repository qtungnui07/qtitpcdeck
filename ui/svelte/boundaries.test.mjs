/*
 * Architectural boundaries for the Svelte app.
 *
 * The Angular project enforces the same rules with its own boundaries.test.mjs.
 * They are restated here rather than shared because the two apps have different
 * directory shapes, and a rule that silently stops matching is worse than a
 * duplicated one.
 *
 * Run with: node --test boundaries.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, 'src');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

const files = walk(src);
const sources = files.filter(f => /\.(ts|svelte)$/.test(f) && !/\.(test|spec)\./.test(f));

function read(file) {
  return readFileSync(file, 'utf8');
}

function relative(file) {
  return path.relative(here, file).replaceAll('\\', '/');
}

test('the app does not reach into the runtime package internals', () => {
  // The runtime exposes a public API barrel; deep imports would couple this app to
  // file layout the runtime is free to rearrange.
  const offenders = sources.filter(file => {
    const text = read(file);
    return /from\s+['"]@macro-deck\/runtime\/(?!styles\/)/.test(text);
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the app does not import Angular', () => {
  const offenders = sources.filter(file => /from\s+['"]@angular\//.test(read(file)));

  assert.deepEqual(offenders.map(relative), []);
});

test('the app does not import from the Angular project', () => {
  const offenders = sources.filter(file => /from\s+['"][^'"]*angular\//.test(read(file)));

  assert.deepEqual(offenders.map(relative), []);
});

test('the theme store is the only module that writes the theme classes', () => {
  // Two writers would fight over the class list and the last one to run would win
  // by accident rather than by design.
  const offenders = sources.filter(file => {
    if (relative(file) === 'src/lib/theme.svelte.ts') return false;
    return /classList\.(add|remove|toggle)\(\s*['"](light|dark)['"]/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the theme store is the only module that writes the accent tokens', () => {
  const offenders = sources.filter(file => {
    if (relative(file) === 'src/lib/theme.svelte.ts') return false;
    return /setProperty\(\s*['"]--color-accent/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('every stylesheet import is a plain CSS file', () => {
  // The runtime ships plain CSS and Svelte compiles component styles itself, so a
  // Sass import would mean a toolchain this app does not have.
  const offenders = sources.filter(file => /\.(scss|sass|less)['"]/.test(read(file)));

  assert.deepEqual(offenders.map(relative), []);
});

test('the router is the only module that touches the history API', () => {
  // Navigation has to go through navigate() so the route store stays in sync with
  // the address bar. A second writer would leave the two disagreeing.
  const offenders = sources.filter(file => {
    if (relative(file) === 'src/lib/router.svelte.ts') return false;
    return /history\.(pushState|replaceState)/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the route table is the only module that declares route patterns', () => {
  // Patterns are matched in order, so a second table would silently shadow the
  // first. Pages read the match; they do not define routes.
  const offenders = sources.filter(file => {
    if (relative(file) === 'src/lib/routes.ts') return false;
    return /pattern:\s*['"]\//.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('components do not import each other by relative path across directories', () => {
  // Components reach each other through $lib so a move is a single edit, and so
  // the dependency graph stays readable from the import lines alone.
  const offenders = sources.filter(file => {
    if (!relative(file).startsWith('src/lib/components/')) return false;
    return /from\s+['"]\.\.\/[^'"]*\.svelte['"]/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the API client is the only module that calls fetch', () => {
  // Every request has to carry the auth token, the 401 retry and the base URL.
  // A second caller would quietly skip all three.
  const offenders = sources.filter(file => {
    if (relative(file) === 'src/lib/api.svelte.ts') return false;
    return /\bfetch\s*\(/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the API client is the only module that opens a socket', () => {
  // The connection is a singleton with a reconnect loop; a second one would
  // register a second client id and the host would see two windows.
  const offenders = sources.filter(file => {
    if (relative(file) === 'src/lib/api.svelte.ts') return false;
    return /new\s+WebSocket\s*\(/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the endpoint modules are the only place that spells out an API path', () => {
  // Paths live in one file so a host route change is a single edit, and so the
  // set of endpoints this app depends on can be read at a glance.
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/endpoints.ts') return false;
    return /['"]\/api\//.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the shell bridge is the only module that reads window.macroDeckShell', () => {
  // The bridge is absent in a plain browser, so every read has to feature-detect.
  // Funnelling them through one accessor keeps that check in one place.
  const offenders = sources.filter(file => {
    if (relative(file) === 'src/lib/shell-bridge.ts') return false;
    return /macroDeckShell/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the modal stack is the only module that keeps a list of open dialogs', () => {
  // Escape and overlay clicks both have to know whether they belong to the topmost dialog.
  // A component that kept its own list would get it wrong the moment two dialogs overlap.
  const offenders = sources.filter(file => {
    if (relative(file) === 'src/lib/modal-stack.ts') return false;
    return /(let|const)\s+\w*[Ss]tack\w*\s*(:\s*\w+\[\])?\s*=\s*\[\]/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('only the modal component listens for Escape on the document', () => {
  // A second document-level Escape listener would fire alongside the modal's and close two
  // dialogs at once. Popovers get their key from the element they are attached to.
  const offenders = sources.filter(file => {
    if (relative(file) === 'src/lib/components/Modal.svelte') return false;
    // The hotkey capture service consumes document-level keys in the capture
    // phase and stops immediate propagation, so it cannot double-fire the
    // modal's own listener - recording a hotkey must swallow its own Escape.
    if (relative(file) === 'src/lib/hotkey-capture.ts') return false;
    // The side panel owns its own Escape, mirroring the Angular component: it
    // stops immediate propagation and defers while a modal overlay is open.
    if (relative(file) === 'src/lib/components/SidePanel.svelte') return false;
    const text = read(file);
    return /addEventListener\(\s*['"]keydown['"]/.test(text) && /Escape/.test(text);
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the announcement store is the only module that reads the pending announcement endpoint', () => {
  // The generation counter that stops a stale fetch overwriting a newer push only works if
  // every read goes through the store.
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/announcements.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /announcementEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the variable store is the only module that reads the variable list endpoint', () => {
  // The load overlay that keeps a mid-load change event alive only works if every read goes
  // through the store.
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/variables.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /variableEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the catalog store is the only module that reads the catalog endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/variable-catalog.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /variableCatalogEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the integration store is the only module that reads the integration endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/integrations.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /integrationEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the icon pack store is the only module that reads the icon pack endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/icon-packs.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /iconPackEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the user font store is the only module that reads the font endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/user-fonts.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /fontEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the plugin compatibility store is the only module that reads the plugin compatibility endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/plugin-compatibility.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /pluginCompatibilityEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the profile store is the only module that reads the profile endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/profiles.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /profileEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the folder store is the only module that reads the folder or widget endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/folders.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /(folderEndpoints|widgetEndpoints)/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the widget type store is the only module that reads the widget type endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/widget-types.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /widgetTypeEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the action modules are the only ones that read the action endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/actions.svelte.ts') return false;
    // The flow store is the action builder's own: it runs flows and clones
    // secrets on paste, exactly where the Angular builder injected the API.
    if (name.startsWith('src/lib/action-builder/')) return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /actionEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the connection modules are the only ones that read the connection endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    // The info store caches the connection info; the pairing-code polling
    // lives in the ConnectQr component, the same place the Angular version
    // kept it.
    if (name === 'src/lib/connection-info.svelte.ts') return false;
    if (name === 'src/lib/components/ConnectQr.svelte') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /connectionEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the store catalog store is the only module that reads the store catalog endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/store-catalog.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /storeCatalogEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the store operations store is the only module that reads the store operation endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/store-operations.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /storeOperationEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the store updates store is the only module that reads the store updates endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/store-updates.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /storeUpdatesEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the store detail store is the only module that reads the store detail endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/store-detail.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /storeDetailEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the store tests store is the only module that reads the store tests endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/store-tests.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /storeTestsEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the script store is the only module that reads the script endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/scripts.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /scriptEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the automation store is the only module that reads the automation endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/automations.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /automationEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the settings store is the only module that reads the settings endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/settings.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /settingsEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('the developer store is the only module that reads the developer endpoints', () => {
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/developer.svelte.ts') return false;
    if (name === 'src/lib/endpoints.ts') return false;
    return /developerEndpoints/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

test('only variable-source.ts inspects variable origin to categorize variables', () => {
  // A variable's origin ('event' | 'input') determines whether it is an event parameter
  // or a script input. If other components inspected origin directly rather than calling
  // isEventParameter / matchesVariableSource / groupVariablesBySource, the precedence
  // order (event -> input -> scope -> user -> integration) would silently diverge.
  const offenders = sources.filter(file => {
    const name = relative(file);
    if (name === 'src/lib/variable-source.ts') return false;
    return /\b\w+\.origin\s*===?\s*['"](event|input)['"]/.test(read(file));
  });

  assert.deepEqual(offenders.map(relative), []);
});

