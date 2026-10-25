<script lang="ts">
  /*
   * The top-level Library page container.
   *
   * Hosts the library content-type switcher (Icon Packs, Fonts) and renders
   * the selected subview according to the current URL path.
   */

  import { AppStrings } from '@macro-deck/runtime';
  import SegmentedControl, {
    type SegmentedOption,
  } from '$lib/components/SegmentedControl.svelte';
  import {
    FONTS_CONTENT_TYPE,
    ICON_PACKS_CONTENT_TYPE,
    LIBRARY_CONTENT_TYPES,
  } from '$lib/library-content-type';
  import { translateKey } from '$lib/localization.svelte';
  import { navigate, route } from '$lib/router.svelte';
  import FontsLibraryPage from './FontsLibraryPage.svelte';
  import IconPacksLibraryPage from './IconPacksLibraryPage.svelte';

  const activeId = $derived.by(() => {
    const path = route.path.split(/[?#]/)[0];
    const match = LIBRARY_CONTENT_TYPES.find(
      type => path === type.route || path.startsWith(`${type.route}/`),
    );
    // Unknown paths (including /library before the redirect lands) start on
    // the content-type people actually use.
    return match ? match.id : ICON_PACKS_CONTENT_TYPE;
  });

  const options = $derived<SegmentedOption[]>(LIBRARY_CONTENT_TYPES.map(type => ({
      value: type.id,
      label: translateKey(type.labelKey),
    })));

  function switchContentType(id: string): void {
    const match = LIBRARY_CONTENT_TYPES.find(type => type.id === id);
    if (match) {
      navigate(match.route);
    }
  }
</script>

<div class="library-page">
  <div class="library-switcher">
    <SegmentedControl
      {options}
      value={activeId}
      tablist={true}
      ariaLabel={translateKey(AppStrings.Library.Page.ContentTypeAriaLabel)}
      onchange={switchContentType}
    />
  </div>

  <div class="library-content">
    {#if activeId === ICON_PACKS_CONTENT_TYPE}
      <IconPacksLibraryPage />
    {:else if activeId === FONTS_CONTENT_TYPE}
      <FontsLibraryPage />
    {/if}
  </div>
</div>

<style>
  .library-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .library-switcher {
    padding: var(--space-4) var(--space-5) 0;
    flex-shrink: 0;
  }

  .library-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
</style>
