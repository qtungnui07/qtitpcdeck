<script lang="ts">
  /*
   * A page with a source list on the left and a detail pane on the right.
   *
   * The rail is a fixed 260px column that collapses to a capped strip on narrow viewports, so the
   * detail pane keeps the width it needs on a phone.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    railTitle: string;
    railActions?: Snippet;
    rail?: Snippet;
    banner?: Snippet;
    children?: Snippet;
  }

  let { railTitle, railActions, rail, banner, children }: Props = $props();
</script>

{@render banner?.()}

<div class="panes">
  <aside class="rail">
    <div class="rail-header">
      <h1>{railTitle}</h1>
      {@render railActions?.()}
    </div>
    {@render rail?.()}
  </aside>

  <section class="detail">
    {@render children?.()}
  </section>
</div>

<style>
  .panes {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    gap: var(--space-4);
    height: 100%;
    padding: var(--space-4) var(--space-5);
    box-sizing: border-box;
    overflow: hidden;
  }

  .rail {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: 260px;
    flex-shrink: 0;
    min-height: 0;
  }

  .rail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    /* Reserve the height of the action button so pages without one align. */
    min-height: var(--control-height);
  }

  .rail-header h1 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .detail {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    padding: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
  }

  @media (max-width: 800px) {
    .panes {
      flex-direction: column;
    }

    .rail {
      width: 100%;
      max-height: 220px;
    }

    .detail {
      padding: var(--space-3);
    }
  }
</style>
