<script lang="ts">
  /*
   * The footer strip: the version label on the left, outbound links on the right.
   *
   * The links open in the system browser rather than in the webview, which is
   * what the Angular ExternalLinkService did. The anchor keeps its href so the
   * link is still copyable and keyboard-reachable; the click handler intercepts
   * it so the shell can take over.
   */
  import { AppStrings } from '@macro-deck/runtime';
  import { navigation } from '$lib/navigation.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import { openExternal } from '$lib/external-link';

  const REPOSITORY_URL = 'https://github.com/Macro-Deck-App/Macro-Deck';

  const links = $derived([
    {
      label: translateKey(AppStrings.Shell.Footer.Donate),
      url: 'https://ko-fi.com/manuelmayer',
      icon: 'heart',
    },
    {
      label: translateKey(AppStrings.Shell.Footer.JoinDiscord),
      url: 'https://discord.macro-deck.app',
      icon: 'discord',
    },
    {
      label: translateKey(AppStrings.Shell.Footer.ReportBug),
      url: `${REPOSITORY_URL}/issues`,
      icon: 'bug',
    },
  ]);

  const versionLabel = $derived(
    translateKey(AppStrings.Shell.Footer.Version, { version: navigation.versionLabel }),
  );

  function follow(event: MouseEvent, url: string): void {
    // A modified click is the reader asking for a new tab or window, which is
    // the browser's business, not the shell's.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openExternal(url);
  }
</script>

<div class="footer-bar">
  <span class="footer-version">{versionLabel}</span>

  <div class="footer-links">
    {#each links as link (link.url)}
      <a
        class="footer-link"
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onclick={event => follow(event, link.url)}
      >
        <span class="icon icon-{link.icon} icon-xs" aria-hidden="true"></span>
        <span>{link.label}</span>
      </a>
    {/each}
  </div>
</div>

<style>
  .footer-bar {
    height: var(--footer-bar-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-inline: var(--space-3);
    border-top: 1px solid var(--color-border);
    background-color: var(--color-bg-secondary);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .footer-links {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .footer-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: inherit;
    text-decoration: none;
  }

  .footer-link:hover {
    color: var(--color-text-primary);
  }
</style>
