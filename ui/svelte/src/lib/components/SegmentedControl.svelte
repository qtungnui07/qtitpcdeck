<script lang="ts">
  /*
   * A segmented control for switching between a small set of mutually
   * exclusive options or views (such as tabs or subpages).
   *
   * Renders as a horizontal pill group. When `tablist` is true, renders with
   * WAI-ARIA tablist/tab semantics and handles arrow key navigation so screen
   * readers and keyboard users get standard tab behavior.
   */

  export interface SegmentedOption {
    value: string;
    label?: string;
    icon?: string;
    ariaLabel?: string;
    badge?: string;
  }

  interface Props {
    options: readonly SegmentedOption[];
    value: string;
    ariaLabel?: string;
    tablist?: boolean;
    onchange?: (value: string) => void;
  }

  let {
    options,
    value,
    ariaLabel,
    tablist = false,
    onchange,
  }: Props = $props();

  function selectOption(optValue: string): void {
    if (optValue !== value) {
      onchange?.(optValue);
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!tablist || options.length === 0) return;

    const currentIndex = options.findIndex(opt => opt.value === value);
    let nextIndex = -1;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % options.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + options.length) % options.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = options.length - 1;
        break;
    }

    if (nextIndex >= 0) {
      event.preventDefault();
      const nextOption = options[nextIndex];
      if (nextOption) {
        selectOption(nextOption.value);
        // Focus the newly active tab button
        const target = (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('.seg-option')[nextIndex];
        target?.focus();
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="seg"
  role={tablist ? 'tablist' : 'group'}
  aria-label={ariaLabel}
  onkeydown={handleKeydown}
>
  {#each options as option (option.value)}
    {@const isActive = option.value === value}
    <button
      type="button"
      class="seg-option"
      class:active={isActive}
      class:icon-only={Boolean(option.icon && !option.label)}
      role={tablist ? 'tab' : undefined}
      aria-selected={tablist ? isActive : undefined}
      aria-label={option.ariaLabel || option.label}
      tabindex={tablist ? (isActive ? 0 : -1) : 0}
      onclick={() => selectOption(option.value)}
    >
      {#if option.icon}
        <span class="icon icon-{option.icon}" aria-hidden="true"></span>
      {/if}
      {#if option.label}
        <span>{option.label}</span>
      {/if}
      {#if option.badge}
        <span class="seg-badge">{option.badge}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    gap: var(--space-1);
    padding: var(--space-1);
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow-x: auto;
    max-width: 100%;
    scrollbar-width: none;
  }

  .seg::-webkit-scrollbar {
    display: none;
  }

  .seg-option {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0.3125rem var(--space-3);
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .seg-option.icon-only {
    justify-content: center;
    min-width: 2.25rem;
    padding-inline: var(--space-2);
  }

  .seg-option:hover:not(.active) {
    color: var(--color-text-primary);
    background-color: var(--color-bg-hover);
  }

  .seg-option.active {
    background-color: var(--color-accent);
    color: var(--color-on-accent);
  }

  .seg-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .seg-option.active .seg-badge {
    background-color: rgba(255, 255, 255, 0.2);
    color: var(--color-on-accent);
  }
</style>
