<script lang="ts">
  /*
   * The host-driven widget configuration editor, ported from the Angular
   * WidgetConfigurationEditorComponent.
   *
   * The host composes the form: it is asked for a `config` session for this
   * widget and draft, and answers with a tree whose regions this editor lays
   * out - properties in the sidebar beside a live preview, the editor region
   * in the main pane. Edits go back as node events; the host's next revision
   * is folded into the draft, which is what the page saves.
   *
   * The draft reconciliation rules matter and are kept exactly:
   *  - the FIRST tree of a session is not reconciled (it carries provider
   *    defaults the draft never had; folding them in would dirty the editor
   *    the moment it opens);
   *  - a LATER revision reconciles every key, because a provider may write
   *    values itself (a preset applied, a state adopted) without ever
   *    emitting `change`;
   *  - a draft that arrived from outside the tree (JSON mode, a live update)
   *    reopens the session, because the tree still renders what the session
   *    was opened with.
   */
  import {
    AppStrings,
    applyConfigDraftEvent,
    composeConfigDraft,
    emitsEvent,
    type GridWidget,
    spanSize,
    UiConfigEntryPoints,
    UiConfigEvents,
    UiConfigPrimitives,
    UiConfigProperties,
    type UiNode,
    type UiNodeEvent,
    type WidgetData,
    WIDGET_REFERENCE_CELL_SIZE,
    WIDGET_REFERENCE_GAP,
  } from '@macro-deck/runtime';
  import { onMount } from 'svelte';
  import { translateKey } from '$lib/localization.svelte';
  import { deepEqual } from '$lib/deep-equal';
  import Button from '$lib/components/Button.svelte';
  import { openUiSession, type UiSessionHandle } from '$lib/ui-session.svelte';
  import { widgetTypeInfoFor } from '$lib/widget-types.svelte';
  import UiRenderSurface from '$lib/render/UiRenderSurface.svelte';
  import WidgetPreview from '$lib/render/WidgetPreview.svelte';

  interface Props {
    widget: GridWidget;
    unsavedChanges?: boolean;
    /** Whether the editor has something to show: a tree, an end, or a known-empty surface. */
    ready?: boolean;
    /** Mirrors the Angular editor's `valid` - false only for a payload too large to reopen. */
    valid?: boolean;
    onreload?: () => void;
    onfollowlivedata?: () => void;
  }

  let { widget, unsavedChanges = false, ready = $bindable(false), valid = $bindable(true) }: Props = $props();

  // A plain deep copy of reactive state: structuredClone refuses the proxies
  // $state reads return, and Snapshot<T> recurses infinitely over the widget
  // types - the untyped binding keeps both problems out of the way.
  function plainSnapshot(value: unknown): any {
    return ($state.snapshot as (source: unknown) => unknown)(value);
  }

  const DRAFT_EVENT_NAMES: ReadonlySet<string> = new Set([
    UiConfigEvents.Change,
    UiConfigEvents.Add,
    UiConfigEvents.Remove,
  ]);

  const FOLLOW_CONFIRM_MS = 2000;
  const PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE';

  type Draft = Record<string, unknown>;

  const PREVIEW_SHORT_SIDE_PX = 100;
  const PREVIEW_LONG_SIDE_MAX_PX = 220;

  const previewReference = $derived.by(() => ({
    width: spanSize(widget.w, WIDGET_REFERENCE_CELL_SIZE, WIDGET_REFERENCE_GAP),
    height: spanSize(widget.h, WIDGET_REFERENCE_CELL_SIZE, WIDGET_REFERENCE_GAP),
  }));

  const previewScale = $derived.by(() => {
    const reference = previewReference;
    return Math.min(
      PREVIEW_SHORT_SIDE_PX / Math.min(reference.width, reference.height),
      PREVIEW_LONG_SIDE_MAX_PX / Math.max(reference.width, reference.height),
    );
  });

  let handle = $state<UiSessionHandle | null>(null);
  let root: UiNode | null = $state(null);
  let rejection = $state<{ code?: string; message?: string } | null>(null);
  let fault = $state<{ code?: string; message?: string } | null>(null);

  const sessionEnd = $derived(fault ?? rejection);
  const tooLarge = $derived(sessionEnd?.code === PAYLOAD_TOO_LARGE);

  let noConfiguration = $state(false);

  const propertiesRegion = $derived(findRegion(root, UiConfigPrimitives.WidgetProperties));
  const editorRegion = $derived(findRegion(root, UiConfigPrimitives.WidgetEditor));

  let previewData = $state<WidgetData>({} as WidgetData);

  let seenTree = false;
  let treeGeneration = 0;
  let previousRoot: UiNode | null = null;
  let retainedRoot: UiNode | null = null;
  let openedWith: WidgetData | null = null;
  let lastShownDraft: WidgetData | null = null;
  let lastOpenedDraft: WidgetData | null = null;
  let treeDraft: WidgetData | null = null;

  let builtIn = false;
  let pendingFollow: { key: string; value: unknown } | null = null;
  let followDeadline: ReturnType<typeof setTimeout> | undefined;

  // The handle's reactive getters are read in an effect so the tree follows
  // the session: a new generation (a reopen) resets the first-tree
  // bookkeeping. `handle` is $state, so a reopen re-runs the effect.
  $effect(() => {
    const session = handle;
    if (session === null) {
      root = null;
      return;
    }
    const generation = session.generation;
    const nextRoot = session.root;
    const nextRejection = session.rejection;
    const nextFault = session.fault ?? null;

    rejection = nextRejection;
    fault = nextFault;
    root = nextRoot;

    if (nextRoot === null) return;

    // A tree from a newly opened session carries provider defaults the draft
    // never had.
    if (generation !== treeGeneration) {
      treeGeneration = generation;
      seenTree = false;
      retainedRoot = previousRoot;
    }

    if (nextRoot === retainedRoot) return;
    retainedRoot = null;

    const previous = previousRoot;
    previousRoot = nextRoot;

    if (!seenTree) {
      seenTree = true;
      if (!deepEqual(widget.data, openedWith)) reopen();
      else lastOpenedDraft = rememberShownDraft();
      return;
    }

    onRevision(previous, nextRoot);
  });

  async function openSession(): Promise<void> {
    const info = await widgetTypeInfoFor(widget.type);
    builtIn = info?.isBuiltIn === true;
    if (info && !info.supportsConfigUi) {
      noConfiguration = true;
      return;
    }

    handle = openUiSession(() => {
      treeDraft = plainSnapshot(widget.data);
      openedWith = plainSnapshot(widget.data);
      return {
        kind: 'config',
        entryPoint: UiConfigEntryPoints.WidgetConfig,
        widgetId: widget.id,
        // The draft, not the stored record: this editor owns the transaction,
        // and the tree has to render what is being edited rather than what
        // the widget was last saved with.
        widgetData: JSON.stringify(widget.data),
        // The host catalogue is what decided this editor mounts at all;
        // falling back to 0 ("whatever the host speaks") only matters for the
        // narrow race where that answer is not cached yet.
        configUiModelVersion: info?.configUiModelVersion ?? 0,
      };
    }, { notifyFault: false });
    root = handle.root;
  }

  function reopen(): void {
    settleFollow();
    previousRoot = null;
    handle?.close();
    handle = null;
    // The next tree is a first tree again: it carries the provider's defaults
    // for keys the draft never had, and the effect above must not fold those
    // into the draft.
    seenTree = false;
    previewData = { ...widget.data };
    void openSession();
  }

  function onRevision(previous: UiNode | null, nextRoot: UiNode): void {
    const data = widget.data as unknown as Draft;
    const follow = pendingFollow;
    if (!follow) {
      applyDraft(composeConfigDraft(nextRoot, data));
      rememberShownDraft();
      return;
    }

    const composed = composeConfigDraft(nextRoot, data);
    if (!deepEqual(composed[follow.key], follow.value)) {
      reopen();
      return;
    }

    settleFollow();
    applyDraft(previous ? foldChanges(composeConfigDraft(previous, data), composed, data) : data);
    rememberShownDraft();
  }

  const canRestore = $derived(tooLarge && restoreTarget() !== null);

  function restoreLastShownDraft(): void {
    const target = restoreTarget();
    if (!target) return;
    applyDraft(plainSnapshot(target) as unknown as Record<string, unknown>);
    reopen();
  }

  // A tree revised within a session still echoes the data the session was
  // opened with, so the last revision shown can be too large to open again;
  // the last draft a session opened with never is.
  function restoreTarget(): WidgetData | null {
    return (
      [lastShownDraft, lastOpenedDraft].find(
        draft => draft !== null && !deepEqual(draft, widget.data),
      ) ?? null
    );
  }

  function rememberShownDraft(): WidgetData {
    lastShownDraft = plainSnapshot(widget.data);
    return lastShownDraft as WidgetData;
  }

  function settleFollow(): void {
    clearTimeout(followDeadline);
    followDeadline = undefined;
    pendingFollow = null;
  }

  function onNodeEvent(event: UiNodeEvent): void {
    handle?.send(event);
    if (!DRAFT_EVENT_NAMES.has(event.name)) return;

    if (root === null) return;

    const data = widget.data as unknown as Record<string, unknown>;
    applyDraft(applyConfigDraftEvent(root, data, event));
  }

  function applyDraft(next: Record<string, unknown>): void {
    const data = widget.data as unknown as Record<string, unknown>;

    for (const key of Object.keys(data)) {
      if (!(key in next)) delete data[key];
    }

    Object.assign(data, next);
    treeDraft = plainSnapshot(widget.data);
    // A revision that leaves the draft as it was must not hand the preview a
    // new object: a new identity reopens its session, and a burst of those is
    // a flashing preview.
    if (!deepEqual(previewData, data)) {
      previewData = { ...data };
    }
  }

  // Follow-live-data: a single changed colour key is pushed into the open
  // tree rather than reopening the whole session. The Angular version used
  // the same 2 s missing-confirmation timeout: an ignored dispatch emits no
  // revision, so a follow that never lands can only be noticed by its
  // absence.
  export function followLiveData(): void {
    const data = widget.data as unknown as Draft;
    if (deepEqual(data, treeDraft)) return;

    const key = pendingFollow ? null : singleChangedKey(treeDraft as Draft | null, data);
    const currentRoot = root;
    const field = key !== null && key in data && currentRoot && builtIn ? findColorField(currentRoot, key) : null;
    if (!field) {
      reopen();
      return;
    }

    const value = data[field.id];
    treeDraft = plainSnapshot(widget.data);
    previewData = { ...widget.data };
    if (deepEqual(field.properties?.[UiConfigProperties.Value], value)) return;

    const follow = { key: field.id, value };
    pendingFollow = follow;
    followDeadline = setTimeout(() => {
      if (pendingFollow === follow) reopen();
    }, FOLLOW_CONFIRM_MS);
    handle?.send({ nodeId: field.id, name: UiConfigEvents.Change, data: value });
  }

  // A JSON-mode edit or an outside adoption is invisible to the open session,
  // which renders what it was opened with. The page calls this whenever it
  // reseeds the editor.
  export function reload(): void {
    if (deepEqual(widget.data, treeDraft)) return;
    reopen();
  }

  $effect(() => {
    ready = root !== null || sessionEnd !== null || noConfiguration;
    valid = !tooLarge;
  });

  // Runs once: a data edit must not reopen the config session (the tree
  // renders the draft the session was OPENED with, and the host folds edits
  // back as revisions). Only an outside change - JSON mode, an adopted live
  // update - reopens, through `reload()`.
  onMount(() => {
    previewData = { ...widget.data };
    void openSession();
    return () => {
      settleFollow();
      handle?.close();
      handle = null;
    };
  });

  function findRegion(rootNode: UiNode | null, type: string): UiNode | null {

    return rootNode?.children?.find(child => child.type === type) ?? null;
  }

  function singleChangedKey(before: Draft | null, after: Draft): string | null {
    if (!before) return null;
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
      key => !deepEqual(before[key], after[key]),
    );
    return changed.length === 1 ? changed[0] : null;
  }

  // Only colour inputs: every built-in top-level one binds its cell plainly,
  // while other input types include setters with side effects on other keys.
  function findColorField(node: UiNode, key: string): UiNode | null {
    for (const child of [...(node.children ?? []), ...(node.fallback ? [node.fallback] : [])]) {
      if (child.id === key) {
        return child.type === UiConfigPrimitives.Color
          && child.properties?.[UiConfigProperties.Transient] !== true
          && emitsEvent(child, UiConfigEvents.Change)
          ? child
          : null;
      }
      if (child.type === UiConfigPrimitives.Object || child.type === UiConfigPrimitives.Array) continue;

      const found = findColorField(child, key);
      if (found) return found;
    }
    return null;
  }

  function foldChanges(before: Draft, after: Draft, data: Draft): Draft {
    const result = { ...data };
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (deepEqual(before[key], after[key])) continue;
      if (key in after) result[key] = after[key];
      else delete result[key];
    }
    return result;
  }
</script>

{#snippet previewBlock()}
  <div class="editor-preview">
    <div
      class="preview-frame"
      style:width="{previewReference.width * previewScale}px"
      style:height="{previewReference.height * previewScale}px"
      style:border-radius="{22 * previewScale}px"
    >
      <div style:transform="scale({previewScale})" style:transform-origin="top left">
        <WidgetPreview
          widgetType={widget.type}
          data={previewData as Record<string, unknown>}
          width={previewReference.width}
          height={previewReference.height}
          variableScopeWidgetId={widget.id}
        />
      </div>
    </div>
  </div>
{/snippet}

{#snippet propertiesBlock()}
  {#if propertiesRegion !== null}
    <div class="widget-config-properties">
      <UiRenderSurface
        root={propertiesRegion}
        scopeRefId={widget.id}
        unsavedChanges={unsavedChanges}
        onevent={onNodeEvent}
      />
    </div>
  {/if}
{/snippet}

{#if sessionEnd !== null}
  <div class="widget-config-rejected" role="alert">
    {#if !tooLarge}
      <p>{translateKey(AppStrings.Widgets.Editor.ConfigUnavailableMessage)}</p>
    {:else if canRestore}
      <p>{translateKey(AppStrings.Widgets.Editor.ConfigTooLargeMessage)}</p>
      <Button variant="primary" onclick={restoreLastShownDraft}>
        {translateKey(AppStrings.Widgets.Editor.RestoreLastWorkingAction)}
      </Button>
    {:else}
      <p>{translateKey(AppStrings.Widgets.Editor.ConfigTooLargeNoRestoreMessage)}</p>
    {/if}
  </div>
{:else if editorRegion !== null}
  <div class="widget-editor-shell">
    <aside class="widget-editor-sidebar">
      {@render previewBlock()}
      {@render propertiesBlock()}
    </aside>
    <div class="widget-config-editor">
      <UiRenderSurface
        root={editorRegion}
        scopeRefId={widget.id}
        unsavedChanges={unsavedChanges}
        onevent={onNodeEvent}
      />
    </div>
  </div>
{:else}
  <div class="widget-config-single-pane">
    {@render previewBlock()}
    {@render propertiesBlock()}
  </div>
{/if}

<style>
  .widget-editor-shell {
    display: grid;
    grid-template-columns: minmax(220px, 300px) 1fr;
    gap: var(--space-4, 1rem);
    align-items: start;
  }

  .widget-editor-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
    position: sticky;
    top: var(--space-4, 1rem);
    max-height: calc(100vh - 12rem);
    overflow-y: auto;
  }

  .editor-preview {
    display: flex;
    justify-content: center;
    padding: var(--space-3, 0.75rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-tertiary);
  }

  .preview-frame {
    position: relative;
    overflow: hidden;
    background: var(--color-bg-primary);
  }

  .widget-config-properties {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .widget-config-editor {
    min-width: 0;
  }

  .widget-config-single-pane {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
    max-width: 32rem;
  }

  .widget-config-rejected {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    color: var(--color-text-secondary);
  }

  @media (max-width: 900px) {
    .widget-editor-shell {
      grid-template-columns: 1fr;
    }

    .widget-editor-sidebar {
      position: static;
      max-height: none;
    }
  }
</style>
