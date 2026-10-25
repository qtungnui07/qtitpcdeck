/*
 * Opening a link outside the app, ported from the Angular ExternalLinkService.
 *
 * Inside the desktop shell the host opens the URL in the system browser. In a
 * plain browser there is no bridge, so a new tab is the fallback.
 */

import { shellBridge } from './shell-bridge';

export function usesShell(): boolean {
  return typeof shellBridge()?.openExternal === 'function';
}

export function openExternal(url: string): void {
  const openExternalInShell = shellBridge()?.openExternal;
  if (!openExternalInShell) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    // A rejected bridge call cannot fall back to window.open - the WebView would
    // drop that too - so it is reported and the link stays unopened.
    void Promise.resolve(openExternalInShell(url)).catch((error: unknown) => reportFailure(url, error));
  } catch (error) {
    reportFailure(url, error);
  }
}

function reportFailure(url: string, error: unknown): void {
  console.error(`Could not open ${url} in the browser`, error);
}
