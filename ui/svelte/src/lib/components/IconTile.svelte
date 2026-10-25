<script lang="ts">
  /*
   * A single icon preview tile within an icon pack.
   *
   * Displays thumbnail image, animated/appearances badges, failure indicators,
   * selection checkbox, and truncated filename label.
   */

  import type { IpcIcon } from '@macro-deck/runtime';
  import { AppStrings } from '@macro-deck/runtime';
  import { iconImageUrl } from '$lib/icon-packs.svelte';
  import { translateKey } from '$lib/localization.svelte';

  interface Props {
    icon: IpcIcon;
    size?: number;
    selected?: boolean;
    multiSelect?: boolean;
    selectionActive?: boolean;
    ontileclick?: (e: { icon: IpcIcon; toggle: boolean; range: boolean }) => void;
    oncontextmenu?: (e: { icon: IpcIcon; x: number; y: number }) => void;
    ondblclick?: (icon: IpcIcon) => void;
  }

  let {
    icon,
    size = 96,
    selected = false,
    multiSelect = false,
    selectionActive = false,
    ontileclick,
    oncontextmenu,
    ondblclick,
  }: Props = $props();

  const animatedLabel = $derived(translateKey(AppStrings.IconPacks.Tile.AnimatedIcon));
  const processingLabel = $derived(translateKey(AppStrings.IconPacks.Tile.Processing));
  const appearancesCount = $derived(icon.appearances?.length ?? 0);
  const appearancesLabel = $derived(
    translateKey(AppStrings.IconPacks.Appearances.Badge, { count: appearancesCount }),
  );
  const failedTooltip = $derived(
    icon.processingError
      ? translateKey(AppStrings.IconPacks.Tile.ImportFailedWithReason, {
          reason: icon.processingError,
        })
      : translateKey(AppStrings.IconPacks.Tile.ImportFailed),
  );
  const selectAriaLabel = $derived(
    translateKey(AppStrings.IconPacks.Tile.SelectIcon, { name: icon.name }),
  );

  const thumbUrl = $derived(iconImageUrl(icon.id, icon.contentHash, 128));

  function handleClick(e: MouseEvent): void {
    ontileclick?.({
      icon,
      toggle: e.metaKey || e.ctrlKey,
      range: e.shiftKey,
    });
  }

  function handleCheckboxClick(e: MouseEvent): void {
    e.stopPropagation();
    ontileclick?.({
      icon,
      toggle: true,
      range: false,
    });
  }

  function handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    oncontextmenu?.({
      icon,
      x: e.clientX,
      y: e.clientY,
    });
  }
</script>

<button
  type="button"
  class="tile"
  class:selected
  style:--tile-size="{size}px"
  aria-label={icon.name}
  aria-pressed={selected}
  onclick={handleClick}
  ondblclick={() => ondblclick?.(icon)}
  oncontextmenu={handleContextMenu}
>
  {#if multiSelect}
    <span
      class="checkbox"
      class:checked={selected}
      class:visible={selected || selectionActive}
      role="checkbox"
      aria-checked={selected}
      aria-label={selectAriaLabel}
      tabindex="-1"
      onclick={handleCheckboxClick}
      onkeydown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleCheckboxClick(e as unknown as MouseEvent);
        }
      }}
    >
      {#if selected}
        <span class="icon icon-check icon-xs"></span>
      {/if}
    </span>
  {/if}

  <span class="thumb">
    {#if icon.processingState === 'Ready'}
      <img src={thumbUrl} alt={icon.name} loading="lazy" decoding="async" />
      {#if icon.isAnimated || appearancesCount > 0}
        <span class="badges">
          {#if appearancesCount > 0}
            <span
              class="badge appearances-badge"
              role="img"
              title={appearancesLabel}
              aria-label={appearancesLabel}
            >
              <span class="icon icon-layers icon-xs"></span>
            </span>
          {/if}
          {#if icon.isAnimated}
            <span
              class="badge"
              role="img"
              title={animatedLabel}
              aria-label={animatedLabel}
            >
              <span class="icon icon-play icon-xs"></span>
            </span>
          {/if}
        </span>
      {/if}
    {:else if icon.processingState === 'Failed'}
      <span class="failed" role="img" title={failedTooltip} aria-label={failedTooltip}>
        <span class="icon icon-x icon-lg"></span>
      </span>
    {:else}
      <span class="shimmer" role="img" title={processingLabel} aria-label={processingLabel}></span>
    {/if}
  </span>

  <span class="name" title={icon.name}>{icon.name}</span>
</button>

<style>
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    width: calc(var(--tile-size) + 2 * var(--space-1));
    gap: var(--space-1);
    padding: var(--space-1);
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color var(--transition-fast);
  }

  .tile:hover {
    background: var(--color-bg-hover);
  }

  .tile:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .tile.selected {
    background: var(--color-accent-muted);
  }

  .tile:hover .checkbox {
    opacity: 1;
  }

  .checkbox {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-elevated);
    box-shadow: var(--shadow-sm);
    opacity: 0;
    transition: opacity var(--transition-fast), background-color var(--transition-fast);
  }

  .checkbox.visible {
    opacity: 1;
  }

  .checkbox.checked {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .checkbox .icon {
    background-color: #fff;
  }

  .checkbox:hover {
    border-color: var(--color-accent);
  }

  .thumb {
    position: relative;
    width: var(--tile-size);
    aspect-ratio: 1;
    border-radius: var(--radius-lg);
    background: var(--color-bg-tertiary);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .badges {
    position: absolute;
    right: var(--space-1);
    bottom: var(--space-1);
    display: flex;
    gap: var(--space-1);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-sm);
    background: var(--color-scrim);
  }

  .badge .icon {
    background-color: #fff;
  }

  .failed {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .failed .icon {
    background-color: var(--color-danger);
  }

  .shimmer {
    display: block;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      100deg,
      var(--color-bg-tertiary) 40%,
      var(--color-bg-hover) 50%,
      var(--color-bg-tertiary) 60%
    );
    background-size: 200% 100%;
    animation: icon-tile-shimmer 1.4s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .shimmer {
      animation: none;
      background: var(--color-bg-hover);
    }
  }

  @keyframes icon-tile-shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }

  .name {
    max-width: 100%;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
