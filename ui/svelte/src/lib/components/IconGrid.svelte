<script lang="ts">
  /*
   * Grid container rendering IconTiles for an icon pack.
   *
   * Automatically arranges tiles in a responsive grid and forwards selection,
   * context menu, and open (double-click) events.
   */

  import type { IpcIcon } from '@macro-deck/runtime';
  import IconTile from './IconTile.svelte';

  interface Props {
    icons: readonly IpcIcon[];
    tileSize?: number;
    selectable?: boolean;
    selectedIconIds?: ReadonlySet<string>;
    multiSelect?: boolean;
    oniconclick?: (e: { icon: IpcIcon; toggle: boolean; range: boolean }) => void;
    oniconcontextmenu?: (e: { icon: IpcIcon; x: number; y: number }) => void;
    oniconopen?: (icon: IpcIcon) => void;
  }

  let {
    icons,
    tileSize = 96,
    selectable = false,
    selectedIconIds = new Set(),
    multiSelect = false,
    oniconclick,
    oniconcontextmenu,
    oniconopen,
  }: Props = $props();

  const selectionActive = $derived(selectedIconIds.size > 0);
</script>

<div class="icon-grid" style:--tile-size="{tileSize}px">
  {#each icons as icon (icon.id)}
    <IconTile
      {icon}
      size={tileSize}
      selected={selectable && selectedIconIds.has(icon.id)}
      {multiSelect}
      {selectionActive}
      ontileclick={oniconclick}
      oncontextmenu={oniconcontextmenu}
      ondblclick={oniconopen}
    />
  {/each}
</div>

<style>
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, calc(var(--tile-size) + 2 * var(--space-1)));
    gap: var(--space-2);
    align-content: flex-start;
    justify-content: flex-start;
    overflow-y: auto;
    min-height: 0;
    flex: 1 1 auto;
    padding: var(--space-1);
  }
</style>
