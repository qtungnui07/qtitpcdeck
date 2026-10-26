/*
 * The route table, mirroring the Angular app's app.routes.ts.
 *
 * Order matters: the first pattern that matches wins, so the more specific
 * `store/installed` and `store/tests` have to come before `store/:kind/:extensionId`
 * or they would be swallowed by it.
 *
 * The `id` is what the sidebar highlights, and it is deliberately the same
 * string as the nav item id in the navigation store so the two line up without
 * a lookup table.
 */

import type { RouteDefinition } from '$lib/router.svelte';

export const ROUTES: readonly RouteDefinition[] = [
  { id: 'root', pattern: '/', redirectTo: '/deck' },

  { id: 'deck', pattern: '/deck' },
  { id: 'widget-editor', pattern: '/deck/widgets/:widgetId' },

  { id: 'scripts', pattern: '/scripts' },
  { id: 'automations', pattern: '/automations' },

  { id: 'integrations', pattern: '/integrations' },
  { id: 'integration-detail', pattern: '/integrations/:integrationId' },


  { id: 'store', pattern: '/store' },
  { id: 'store-installed', pattern: '/store/installed' },
  { id: 'store-tests', pattern: '/store/tests' },
  { id: 'store-detail', pattern: '/store/:kind/:extensionId' },

  { id: 'variables', pattern: '/variables' },
  { id: 'developer', pattern: '/developer' },
];
