<script lang="ts">
  /*
   * Star rating display component.
   * Renders 5 stars (filled, half, or empty) based on rating (0-5).
   */
  interface Props {
    rating: number;
    ratingCount?: number;
    size?: 'sm' | 'md';
  }

  const { rating = 0, ratingCount, size = 'sm' }: Props = $props();

  const clamped = $derived(Math.max(0, Math.min(5, rating)));
  const fullStars = $derived(Math.floor(clamped));
  const hasHalf = $derived(clamped - fullStars >= 0.25 && clamped - fullStars < 0.75);
  const extraFull = $derived(clamped - fullStars >= 0.75 ? 1 : 0);
  const totalFull = $derived(fullStars + extraFull);
  const emptyStars = $derived(Math.max(0, 5 - totalFull - (hasHalf ? 1 : 0)));
</script>

<div class="store-rating-stars {size}" aria-label="{rating.toFixed(1)} out of 5 stars">
  <div class="stars" aria-hidden="true">
    {#each Array(totalFull) as _}
      <span class="star filled">★</span>
    {/each}
    {#if hasHalf}
      <span class="star half">★</span>
    {/if}
    {#each Array(emptyStars) as _}
      <span class="star empty">☆</span>
    {/each}
  </div>

  {#if ratingCount !== undefined}
    <span class="count">({ratingCount})</span>
  {/if}
</div>

<style>
  .store-rating-stars {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--warning-color, #f59e0b);
  }

  .stars {
    display: inline-flex;
    line-height: 1;
    letter-spacing: -0.05em;
  }

  .star {
    user-select: none;
  }

  .star.empty {
    color: var(--text-muted, #71717a);
    opacity: 0.6;
  }

  .count {
    font-size: 0.75rem;
    color: var(--text-muted, #a1a1aa);
  }

  .sm {
    font-size: 0.875rem;
  }

  .md {
    font-size: 1.125rem;
  }
</style>
