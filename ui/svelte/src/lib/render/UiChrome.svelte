<script lang="ts">
  /*
   * The chrome primitives - containers and prose, ported from the Angular
   * UiChromeComponent.
   *
   * Chrome is structure: flow, steps, stacks, tabs, headings, banners,
   * buttons, menus and dialogs. The tab memory, the advanced-section toggle,
   * and the confirm/prompt gate before a destructive `activate` are all state
   * the Angular version kept per node and are kept here for the same reasons.
   */
  import { getContext } from 'svelte';
  import {
    AppStrings,
    UiConfigEvents,
    UiConfigPrimitives,
    UiConfigProperties,
    type UiNode,
    type UiTextSpanRun,
    emitsEvent,
    nodeBoolean,
    nodeNumber,
    nodeRaw,
    nodeString,
    nodeText,
    nodeTextSpans,
    textSpanStyle,
  } from '@macro-deck/runtime';
  import { translateKey, localizationTranslator } from '$lib/localization.svelte';
  import Button from '$lib/components/Button.svelte';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import SegmentedControl, { type SegmentedOption } from '$lib/components/SegmentedControl.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import UiNodeView from './UiNode.svelte';
  import { UI_RENDER_CONTEXT, type UiRenderContext } from './ui-render-context.svelte';
  import { UI_CHROME_TYPES } from './ui-chrome-types';

  interface Props {
    node: UiNode;
  }

  let { node }: Props = $props();

  const types = UiConfigPrimitives;
  const properties = UiConfigProperties;
  const context = getContext<UiRenderContext>(UI_RENDER_CONTEXT)!;

  const HexColor = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
  const HeadingLevels: Record<string, number> = { 'heading-1': 1, 'heading-2': 2, 'heading-3': 3 };

  function isExternalUrl(url: string): boolean {
    try {
      const parsed = new URL(url, window.location.href);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin !== window.location.origin;
    } catch {
      return false;
    }
  }

  const children = $derived(node.children ?? []);
  const title = $derived(nodeText(node, properties.Title, localizationTranslator));
  const description = $derived(nodeText(node, properties.Description, localizationTranslator));
  const text = $derived(nodeText(node, properties.Text, localizationTranslator));
  const label = $derived(nodeText(node, properties.Label, localizationTranslator));
  const advancedSectionLabel = $derived(label ?? translateKey(AppStrings.UiRender.AdvancedConfiguration));
  const copyValue = $derived(nodeString(node, properties.Value));
  const url = $derived(nodeString(node, properties.Url) ?? '');
  const severity = $derived(nodeString(node, properties.Severity));
  const direction = $derived(nodeString(node, properties.Direction));
  const accent = $derived.by(() => {
    const value = nodeString(node, properties.Accent);
    return value !== undefined && HexColor.test(value) ? value : undefined;
  });
  const variant = $derived(nodeString(node, properties.Variant));
  const headingLevel = $derived(HeadingLevels[variant ?? ''] ?? null);
  const proseSpans = $derived.by(() => {
    const runs = nodeTextSpans(node);
    return runs !== null && runs.length > 0 ? runs : null;
  });
  const wrap = $derived(nodeBoolean(node, properties.Wrap) !== false);
  const hasCaptionedInput = $derived(
    children.some(
      child =>
        !UI_CHROME_TYPES.has(child.type) &&
        !!nodeRaw(child, properties.Label) &&
        nodeBoolean(child, properties.HideLabel) !== true,
    ),
  );
  const hoisted = $derived.by(() => {
    const forId = nodeString(node, properties.For);
    return !!forId && context.isHoistedOnto(forId);
  });

  let expandedOverride = $state<boolean | null>(null);
  const expanded = $derived(expandedOverride ?? nodeBoolean(node, properties.DefaultExpanded) ?? false);

  let activeTabId = $state<string | null>(null);
  const tabOptions = $derived<SegmentedOption[]>(
    children.map(tab => ({ value: tab.id, label: nodeText(tab, properties.Label, localizationTranslator) ?? tab.id })),
  );
  const activeTabIdValue = $derived(activeTabId ?? children[0]?.id ?? null);
  const activeTabChildren = $derived(
    (children.find(tab => tab.id === activeTabIdValue) ?? children[0])?.children ?? [],
  );

  const buttonIcon = $derived(nodeString(node, properties.Icon));
  const statusValue = $derived(nodeText(node, properties.Value, localizationTranslator));
  const dialogAnswers = $derived(children.filter(child => child.type === types.Button));
  const dialogBody = $derived(children.filter(child => child.type !== types.Button));
  const isDialogOpen = $derived(node.type === types.Dialog);

  function iconOf(child: UiNode): string | undefined {
    return nodeString(child, properties.Icon);
  }

  function labelOf(child: UiNode): string {
    return nodeText(child, properties.Label, localizationTranslator) ?? '';
  }

  function textOf(target: UiNode, key: string): string | undefined {
    return nodeText(target, key, localizationTranslator) ?? undefined;
  }

  function isDanger(target: UiNode): boolean {
    return nodeBoolean(target, properties.ConfirmDanger) === true;
  }

  function childFlex(child: UiNode): string | null {
    if (wrap) return null;
    const weight = nodeNumber(child, properties.RowWeight);
    return weight != null ? `${weight} ${weight} 0%` : null;
  }

  let pending = $state<{ node: UiNode; prompt: boolean; text: string } | null>(null);

  function requestActivate(target: UiNode): void {
    if (!emitsEvent(target, UiConfigEvents.Activate)) return;
    const prompt = nodeRaw(target, properties.PromptValue) !== undefined;
    if (prompt || nodeRaw(target, properties.ConfirmMessage) !== undefined) {
      pending = { node: target, prompt, text: nodeString(target, properties.PromptValue) ?? '' };
      return;
    }
    context.emit(target, UiConfigEvents.Activate);
  }

  function confirmPending(): void {
    const asking = pending;
    pending = null;
    if (!asking) return;
    context.emit(asking.node, UiConfigEvents.Activate, asking.prompt ? asking.text : undefined);
  }

  function onLinkClick(event: MouseEvent): void {
    if (event.button !== 0 && event.button !== 1) return;
    const external = isExternalUrl(url);
    const activates = emitsEvent(node, UiConfigEvents.Activate);
    if (!external && !activates) return;
    event.preventDefault();
    if (external) window.open(url, '_blank', 'noopener,noreferrer');
    if (activates) context.emit(node, UiConfigEvents.Activate);
  }

  function onToggleExpanded(open: boolean): void {
    expandedOverride = open;
    context.emit(node, open ? UiConfigEvents.Expand : UiConfigEvents.Collapse);

    if (!open && nodeBoolean(node, properties.ClearOnCollapse) === true) {
      context.clearDescendantInputs(node.id);
    }
  }

  function spanStyle(run: UiTextSpanRun): string {
    if (run.kind !== 'text') return '';
    const style = textSpanStyle(run) as Record<string, string>;
    return Object.entries(style)
      .map(([prop, value]) => `${prop}: ${value};`)
      .join(' ');
  }

  function copyToClipboard(value: string): void {
    void navigator.clipboard?.writeText(value);
  }
</script>

{#if node.type === types.Flow}
  <div class="config-chrome-flow">
    {#each children as child (child.id)}
      <UiNodeView node={child} />
    {/each}
  </div>
{:else if node.type === types.Step}
  <div class="config-chrome-step">
    {#if title}
      <h2 class="config-chrome-title">{title}</h2>
    {/if}
    {#if description}
      <p class="config-chrome-description">{description}</p>
    {/if}
    {#each children as child (child.id)}
      <UiNodeView node={child} />
    {/each}
  </div>
{:else if node.type === types.Stack}
  <div
    class="config-chrome-stack"
    class:config-chrome-stack-accent={accent !== undefined}
    class:config-chrome-stack-row={direction === 'horizontal'}
    class:config-chrome-stack-nowrap={!wrap}
    class:config-chrome-stack-captioned={!wrap && hasCaptionedInput}
    style:--config-chrome-stack-accent={accent}
  >
    {#each children as child (child.id)}
      {@const flex = childFlex(child)}
      <div class="config-chrome-stack-child" style:flex={flex ?? null}>
        <UiNodeView node={child} />
      </div>
    {/each}
  </div>
{:else if node.type === types.Tabs}
  <div class="config-chrome-tabs">
    <SegmentedControl options={tabOptions} value={activeTabIdValue ?? ''} tablist onchange={id => (activeTabId = id)} />
    {#each activeTabChildren as child (child.id)}
      <UiNodeView node={child} />
    {/each}
  </div>
{:else if node.type === types.Tab}
  <div class="config-chrome-tab">
    {#each children as child (child.id)}
      <UiNodeView node={child} />
    {/each}
  </div>
{:else if node.type === types.Heading}
  <h3 class="config-chrome-heading">{text}</h3>
{:else if node.type === types.Prose}
  <p
    class="config-chrome-prose"
    class:config-chrome-prose-styled={proseSpans !== null || variant !== undefined}
    data-severity={severity}
    data-variant={variant}
    role={headingLevel ? 'heading' : null}
    aria-level={headingLevel}
  >
    {#if proseSpans !== null}
      {#each proseSpans as run, index (index)}
        {#if run.kind === 'text'}
          <span style={spanStyle(run)}>{run.text}</span>
        {:else if run.alt}
          <span>{run.alt}</span>
        {/if}
      {/each}
    {:else}
      {text}
    {/if}
  </p>
{:else if node.type === types.Divider}
  <hr class="config-chrome-divider" />
{:else if node.type === types.Instructions}
  <ol class="config-chrome-instructions">
    {#each children as child (child.id)}
      <UiNodeView node={child} />
    {/each}
  </ol>
{:else if node.type === types.Instruction}
  <li class="config-chrome-instruction">
    {#if text}
      <span>{text}</span>
    {/if}
    {#each children as child (child.id)}
      <UiNodeView node={child} />
    {/each}
  </li>
{:else if node.type === types.CopyValue}
  <div class="config-chrome-copy-value">
    {#if label}
      <span class="config-chrome-copy-label">{label}</span>
    {/if}
    <code class="config-chrome-copy-text">{copyValue ?? ''}</code>
    <button type="button" class="config-chrome-copy-button" onclick={() => copyToClipboard(copyValue ?? '')}>
      {translateKey('macrodeck:Common.Copy')}
    </button>
  </div>
{:else if node.type === types.Link}
  <a class="config-chrome-link" href={url} target="_blank" rel="noopener noreferrer" onclick={onLinkClick} onauxclick={onLinkClick}>
    {label ?? url}
  </a>
{:else if node.type === types.AdvancedSection}
  <div class="config-chrome-advanced">
    <ToggleSwitch label={advancedSectionLabel} checked={expanded} onchange={onToggleExpanded} />
    {#if expanded}
      {#each children as child (child.id)}
        <UiNodeView node={child} />
      {/each}
    {/if}
  </div>
{:else if node.type === types.Banner}
  <div class="config-chrome-banner" data-severity={severity}>{text}</div>
{:else if node.type === types.ValidationMessage}
  {#if !hoisted}
    <div class="config-node-error" id={node.id}>{text}</div>
  {/if}
{:else if node.type === types.Busy}
  <div class="config-chrome-busy">
    <span class="config-chrome-spinner" aria-hidden="true"></span>
    {#if text}
      <span>{text}</span>
    {/if}
  </div>
{:else if node.type === types.Button}
  {#if buttonIcon}
    <button
      type="button"
      class="config-chrome-icon-button"
      title={label ?? ''}
      aria-label={label ?? ''}
      onclick={() => requestActivate(node)}
    >
      <span class="icon icon-{buttonIcon} icon-xs" aria-hidden="true"></span>
    </button>
  {:else}
    <Button variant="secondary" size="compact" onclick={() => requestActivate(node)}>{label ?? ''}</Button>
  {/if}
{:else if node.type === types.Status}
  <div class="config-chrome-status">
    {#if buttonIcon}
      <span class="icon icon-{buttonIcon} icon-sm config-chrome-status-icon" aria-hidden="true"></span>
    {/if}
    <span class="config-chrome-status-copy">{label} <strong>{statusValue}</strong></span>
    {#each children as child (child.id)}
      {#if child.type === types.Button && iconOf(child)}
        <Button
          variant="ghost"
          size="icon-compact"
          title={labelOf(child)}
          ariaLabel={labelOf(child)}
          onclick={() => requestActivate(child)}
        >
          <span class="icon icon-{iconOf(child)} icon-xs" aria-hidden="true"></span>
        </Button>
      {:else}
        <UiNodeView node={child} />
      {/if}
    {/each}
  </div>
{:else if node.type === types.Menu}
  <details class="config-chrome-menu-details">
    <summary class="config-chrome-menu-trigger" aria-label={label ?? ''}>
      <span class="icon icon-{buttonIcon ?? 'dots-vertical'} icon-sm" aria-hidden="true"></span>
    </summary>
    <div class="config-chrome-menu">
      {#each children as child (child.id)}
        {#if child.type === types.Button}
          <button
            type="button"
            class="config-chrome-menu-item"
            class:is-danger={isDanger(child)}
            onclick={() => requestActivate(child)}
          >
            {#if iconOf(child)}
              <span class="icon icon-{iconOf(child)} icon-sm" aria-hidden="true"></span>
            {/if}
            <span class="config-chrome-menu-label">{labelOf(child)}</span>
          </button>
        {:else}
          <UiNodeView node={child} />
        {/if}
      {/each}
    </div>
  </details>
{:else if node.type === types.Dialog}
  {#if isDialogOpen}
    <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
    <div class="config-chrome-dialog" role="dialog" aria-label={title ?? ''}>
      {#if title}
        <h4 class="config-chrome-dialog-title">{title}</h4>
      {/if}
      {#if text}
        <p class="config-chrome-dialog-message">{text}</p>
      {/if}
      {#each dialogBody as child (child.id)}
        <UiNodeView node={child} />
      {/each}
      <div class="config-chrome-dialog-footer">
        {#each dialogAnswers as answer, index (answer.id)}
          <Button
            variant={isDanger(answer) ? 'danger' : index === dialogAnswers.length - 1 ? 'primary' : 'secondary'}
            onclick={() => requestActivate(answer)}
          >
            {labelOf(answer)}
          </Button>
        {/each}
      </div>
    </div>
  {/if}
{:else if node.type === types.WidgetConfiguration || node.type === types.WidgetProperties || node.type === types.WidgetEditor}
  <div class="config-chrome-widget-region">
    {#each children as child (child.id)}
      <UiNodeView node={child} />
    {/each}
  </div>
{/if}

{#if pending}
  <ConfirmDialog
    heading={textOf(pending.node, properties.ConfirmTitle) ?? labelOf(pending.node)}
    message={textOf(pending.node, properties.ConfirmMessage) ?? ''}
    confirmText={textOf(pending.node, properties.ConfirmLabel) ?? labelOf(pending.node)}
    danger={isDanger(pending.node)}
    onconfirm={confirmPending}
    oncancel={() => (pending = null)}
  >
    {#if pending.prompt}
      <input
        class="config-chrome-prompt-input"
        type="text"
        id="{pending.node.id}-prompt"
        name="{pending.node.id}-prompt"
        placeholder={textOf(pending.node, properties.Placeholder) ?? ''}
        bind:value={pending.text}
      />
    {/if}
  </ConfirmDialog>
{/if}

<style>
  .config-chrome-flow,
  .config-chrome-step,
  .config-chrome-tab,
  .config-chrome-widget-region {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .config-chrome-title {
    margin: 0;
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-primary);
  }

  .config-chrome-description {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm, 0.875rem);
  }

  .config-chrome-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .config-chrome-stack-row {
    flex-direction: row;
    gap: var(--space-3, 0.75rem);
  }

  .config-chrome-stack-nowrap {
    flex-wrap: nowrap;
  }

  .config-chrome-stack-nowrap.config-chrome-stack-captioned {
    align-items: flex-end;
  }

  .config-chrome-stack-child {
    min-width: 0;
  }

  .config-chrome-stack-accent {
    border-left: 3px solid var(--config-chrome-stack-accent, var(--color-accent));
    padding-left: var(--space-3, 0.75rem);
  }

  .config-chrome-tabs {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .config-chrome-heading {
    margin: var(--space-2, 0.5rem) 0 0;
    font-size: var(--text-base, 1rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-primary);
  }

  .config-chrome-prose {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm, 0.875rem);
    line-height: 1.5;
  }

  .config-chrome-prose-styled {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-tertiary);
  }

  .config-chrome-divider {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: var(--space-2, 0.5rem) 0;
  }

  .config-chrome-instructions {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    color: var(--color-text-secondary);
    font-size: var(--text-sm, 0.875rem);
  }

  .config-chrome-instruction {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .config-chrome-copy-value {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    font-size: var(--text-sm, 0.875rem);
  }

  .config-chrome-copy-label {
    color: var(--color-text-secondary);
  }

  .config-chrome-copy-text {
    font-family: var(--font-mono);
    padding: 0.125rem var(--space-2, 0.5rem);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-bg-tertiary);
    color: var(--color-accent);
    overflow-wrap: anywhere;
  }

  .config-chrome-copy-button {
    background: none;
    border: none;
    color: var(--color-accent);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
    padding: 0;
  }

  .config-chrome-copy-button:hover {
    text-decoration: underline;
  }

  .config-chrome-link {
    color: var(--color-accent);
    text-decoration: none;
  }

  .config-chrome-link:hover {
    text-decoration: underline;
  }

  .config-chrome-advanced {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-3, 0.75rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
  }

  .config-chrome-banner {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    font-size: var(--text-sm, 0.875rem);
  }

  .config-chrome-banner[data-severity='warning'] {
    background: var(--color-warning-muted, rgba(235, 203, 139, 0.15));
    color: var(--color-warning, #ebcb8b);
  }

  .config-chrome-banner[data-severity='error'] {
    background: var(--color-danger-muted, rgba(191, 97, 106, 0.15));
    color: var(--color-danger, #bf616a);
  }

  .config-chrome-banner[data-severity='success'] {
    background: var(--color-success-muted, rgba(163, 190, 140, 0.15));
    color: var(--color-success, #a3be8c);
  }

  .config-node-error {
    color: var(--color-danger, #bf616a);
    font-size: var(--text-sm, 0.875rem);
  }

  .config-chrome-busy {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    color: var(--color-text-secondary);
    font-size: var(--text-sm, 0.875rem);
    padding: var(--space-2, 0.5rem) 0;
  }

  .config-chrome-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: config-chrome-spin 0.8s linear infinite;
  }

  @keyframes config-chrome-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .config-chrome-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .config-chrome-icon-button:hover {
    background: var(--color-bg-tertiary);
  }

  .config-chrome-status {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary);
  }

  .config-chrome-status-copy strong {
    color: var(--color-text-primary);
  }

  .config-chrome-menu-details {
    position: relative;
  }

  .config-chrome-menu-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    cursor: pointer;
    list-style: none;
  }

  .config-chrome-menu-trigger::-webkit-details-marker {
    display: none;
  }

  .config-chrome-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 20;
    min-width: 180px;
    padding: var(--space-1, 0.25rem);
    background: var(--color-bg-elevated, var(--color-bg-secondary));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
  }

  .config-chrome-menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    width: 100%;
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    background: none;
    border: none;
    border-radius: var(--radius-sm, 4px);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
    text-align: left;
  }

  .config-chrome-menu-item:hover {
    background: var(--color-bg-tertiary);
  }

  .config-chrome-menu-item.is-danger {
    color: var(--color-danger, #bf616a);
  }

  .config-chrome-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-secondary);
  }

  .config-chrome-dialog-title {
    margin: 0;
    font-size: var(--text-base, 1rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-primary);
  }

  .config-chrome-dialog-message {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm, 0.875rem);
  }

  .config-chrome-dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2, 0.5rem);
  }

  .config-chrome-prompt-input {
    width: 100%;
    padding: 0.5rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
  }
</style>
