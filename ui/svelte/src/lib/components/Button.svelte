<script lang="ts">
  /*
   * The one button in the app. Every variant, size and disabled rule lives here so a page never
   * has to restyle a button to get a slightly different one.
   */
  import type { Snippet } from 'svelte';

  type Variant = 'primary' | 'secondary' | 'danger' | 'danger-ghost' | 'ghost' | 'add';
  type Size = 'compact' | 'md' | 'lg' | 'icon' | 'icon-compact';

  interface Props {
    variant?: Variant;
    size?: Size;
    iconOnly?: boolean;
    fill?: boolean;
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    ariaLabel?: string;
    title?: string;
    pressed?: boolean;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    variant = 'secondary',
    size,
    iconOnly = false,
    fill = false,
    loading = false,
    disabled = false,
    type = 'button',
    ariaLabel = '',
    title,
    pressed,
    onclick,
    children,
  }: Props = $props();

  const resolvedSize = $derived<Size>(size ?? (iconOnly ? 'icon' : 'md'));
  const classes = $derived(
    `sb sb-${variant} sb-${resolvedSize}${loading ? ' sb-loading' : ''}${pressed ? ' sb-pressed' : ''}`,
  );
</script>

<button
  class={classes}
  class:sb-fill={fill}
  {type}
  {title}
  disabled={disabled || loading}
  aria-label={ariaLabel || undefined}
  aria-pressed={pressed === undefined ? undefined : pressed}
  {onclick}
>
  {#if loading}
    <span class="sb-spinner" aria-hidden="true"></span>
  {/if}
  {@render children?.()}
</button>

<style>
  .sb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-weight: var(--font-medium);
    line-height: 1;
    /* A translated label runs longer than the English it was laid out for; clip rather than spill. */
    white-space: nowrap;
    overflow: hidden;
    border: 1px solid transparent;
    box-sizing: border-box;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast),
      border-color var(--transition-fast),
      opacity var(--transition-fast);
  }

  .sb-fill {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }

  .sb:disabled,
  .sb-loading {
    opacity: 0.55;
    cursor: not-allowed;
    pointer-events: none;
  }

  .sb:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  /*
   * compact keeps the vertical padding shared with dense form controls, so its height still binds
   * the same way with an icon child: a 16px icon plus 2 x 3px and the 1px borders is 24px, under
   * the 26px floor. Reserved for standalone icon buttons now that single-line form controls all
   * render at --control-height.
   */
  .sb-compact { min-height: var(--control-height-compact); padding: 0.1875rem 0.6875rem; font-size: var(--text-sm); }
  /* md matches the control height exactly: a button sits inside field rows and beside inputs in
     search rows, so it cannot be the odd one out. A primary action reads as heavier through its
     accent fill and wider inline padding, not through height. */
  .sb-md { min-height: var(--control-height); padding: var(--space-2) 1.125rem; font-size: var(--text-base); }
  .sb-lg { min-height: 2.75rem; padding: var(--space-3) 1.4375rem; font-size: var(--text-lg); }
  .sb-icon { width: var(--control-height); height: var(--control-height); padding: 0; font-size: var(--text-base); }
  .sb-icon-compact { width: var(--control-height-compact); height: var(--control-height-compact); padding: 0; font-size: var(--text-sm); }

  .sb-primary {
    background-color: var(--color-accent);
    color: var(--color-on-accent);
  }
  .sb-primary:hover:not(:disabled) {
    background-color: var(--color-accent-hover);
  }

  .sb-secondary {
    background-color: var(--color-bg-tertiary);
    border-color: var(--color-border);
    color: var(--color-text-secondary);
  }
  .sb-secondary:hover:not(:disabled) {
    background-color: var(--color-bg-elevated);
    color: var(--color-text-primary);
    border-color: var(--color-border-light);
  }

  .sb-danger {
    background-color: var(--color-danger);
    color: var(--color-on-accent);
  }
  .sb-danger:hover:not(:disabled) {
    background-color: var(--color-danger-hover);
  }

  .sb-ghost {
    background-color: transparent;
    color: var(--color-text-secondary);
  }
  .sb-ghost:hover:not(:disabled) {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .sb-danger-ghost {
    background-color: transparent;
    color: var(--color-text-secondary);
  }
  .sb-danger-ghost:hover:not(:disabled) {
    background-color: var(--color-danger-muted);
    color: var(--color-danger);
  }

  .sb-add {
    background-color: transparent;
    border-style: dashed;
    border-color: var(--color-border);
    color: var(--color-text-secondary);
  }
  .sb-add:hover:not(:disabled) {
    border-color: var(--color-accent);
    color: var(--color-text-primary);
  }

  /* A toggled button keeps the accent treatment through hover, so the pressed state cannot be
     mistaken for a hover of the plain variant. Doubled selector to outrank the variant hovers. */
  .sb.sb-pressed,
  .sb.sb-pressed:hover:not(:disabled) {
    border-color: var(--color-accent);
    background-color: var(--color-accent-muted);
    color: var(--color-accent);
  }

  .sb-spinner {
    display: inline-block;
    width: 0.875em;
    height: 0.875em;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: ds-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
</style>
