<script lang="ts">
  /*
   * Status strip displaying runtime badges for an integration.
   *
   * Shows status pills like "Running cleanly", "Fully compatible", etc.
   */
  export interface IntegrationStatusBadge {
    id: string;
    tier: 'ok' | 'neutral';
    icon: 'check' | 'info';
    label: string;
  }

  interface Props {
    badges: IntegrationStatusBadge[];
  }

  let { badges = [] }: Props = $props();
</script>

<div class="status-strip">
  {#each badges as badge (badge.id)}
    <span class="status-pill status-pill-{badge.tier}">
      <span class="icon icon-{badge.icon} icon-xs" aria-hidden="true"></span>
      {badge.label}
    </span>
  {/each}
</div>

<style>
  .status-strip {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2, 0.5rem);
    grid-column: 1 / -1;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    font-size: var(--text-sm);
    border-radius: 9999px;
    font-weight: var(--font-medium, 500);
  }

  .status-pill-ok {
    color: var(--color-success);
    background-color: var(--color-success-muted);
  }

  .status-pill-neutral {
    color: var(--color-text-secondary);
    background-color: var(--color-bg-hover);
  }
</style>
