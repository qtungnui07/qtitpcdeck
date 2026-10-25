<script lang="ts">
  /*
   * A stand-in for a page that has not been migrated yet.
   *
   * Every real page needs the service layer (phase 2) before it can be ported,
   * so phase 1 routes to this instead. It names the route it stands for, which
   * makes it obvious in the running app which destinations are still Angular's.
   */
  interface Props {
    title: string;
    routeId: string;
    params?: Record<string, string>;
  }

  let { title, routeId, params = {} }: Props = $props();

  const paramEntries = $derived(Object.entries(params));
</script>

<div class="placeholder">
  <h1>{title}</h1>
  <p class="lede">
    Trang này chưa được chuyển sang Svelte. Khung, điều hướng và theme đã chạy; nội dung sẽ tới ở
    giai đoạn sau khi lớp service được port.
  </p>

  <dl class="meta">
    <dt>route id</dt>
    <dd><code>{routeId}</code></dd>
    {#each paramEntries as [name, value] (name)}
      <dt>{name}</dt>
      <dd><code>{value}</code></dd>
    {/each}
  </dl>
</div>

<style>
  .placeholder {
    padding: var(--space-6) var(--space-5);
    max-width: 48rem;
  }

  h1 {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
  }

  .lede {
    margin: 0 0 var(--space-6);
    color: var(--color-text-secondary);
  }

  .meta {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-2) var(--space-4);
    margin: 0;
    align-items: center;
  }

  .meta dt {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .meta dd {
    margin: 0;
  }

  code {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    padding: 0.125rem var(--space-2);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-tertiary);
    color: var(--color-accent);
  }
</style>
