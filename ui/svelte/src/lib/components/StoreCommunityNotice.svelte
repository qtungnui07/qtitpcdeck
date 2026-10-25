<script lang="ts">
  /*
   * Community package advisory notice.
   * Warns users that extensions outside the official/verified namespace
   * are community-contributed and run arbitrary code in the host process.
   */
  import { AppStrings } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';

  interface Props {
    publisher?: string;
  }

  const { publisher: _publisher }: Props = $props();
</script>

<div class="community-notice" role="note">
  <div class="notice-icon" aria-hidden="true">⚠️</div>
  <div class="notice-body">
    <div class="notice-title">
      {translateKey(AppStrings.Store.CommunityNotice.Heading)}
    </div>
    <div class="notice-text">
      {translateKey(AppStrings.Store.CommunityNotice.Responsibility)}
    </div>
  </div>
</div>

<style>
  .community-notice {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--bg-surface-secondary, rgba(234, 179, 8, 0.08));
    border: 1px solid var(--border-warning, rgba(234, 179, 8, 0.3));
    border-radius: var(--radius-md, 6px);
    font-size: 0.8125rem;
  }

  .notice-icon {
    font-size: 1.125rem;
    line-height: 1.2;
    flex-shrink: 0;
  }

  .notice-body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .notice-title {
    font-weight: 600;
    color: var(--text-warning, #eab308);
  }

  .notice-text {
    color: var(--text-muted, #a1a1aa);
    line-height: 1.4;
  }
</style>
