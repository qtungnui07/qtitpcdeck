<script lang="ts">
  /*
   * The widget editor page, ported from the Angular WidgetEditorPageComponent.
   *
   * It owns the draft: a private copy of the widget the config editor edits
   * in place, saved back to the host through the folder store on demand. The
   * pieces the Angular page was careful about are kept:
   *
   *  - a live update under a CLEAN draft is adopted wholesale, one under a
   *    DIRTY draft is adopted as a patch so the user's own edits survive;
   *  - the JSON pane applies to the model only after the text parses, so
   *    invalid JSON can never overwrite a valid configuration;
   *  - Shift+Save saves and closes, and the button says so.
   */
  import {
    AppStrings,
    type GridWidget,
    type WidgetData,
    fromEditorJson,
    toEditorJson,
  } from '@macro-deck/runtime';
  import { navigate, route } from '$lib/router.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import { showToast } from '$lib/toasts.svelte';
  import { deepEqual } from '$lib/deep-equal';
  import { applyWidgetDataPatch, diffWidgetData } from '$lib/widget-data-patch';
  import {
    findWidget,
    folderStore,
    loadFolders,
    selectFolder,
    updateWidget,
  } from '$lib/folders.svelte';
  import { widgetTypeName } from '$lib/widget-types.svelte';
  import Button from '$lib/components/Button.svelte';
  import DetailPage from '$lib/components/DetailPage.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import SegmentedControl from '$lib/components/SegmentedControl.svelte';
  import WidgetConfigurationEditor from './WidgetConfigurationEditor.svelte';

  let widget = $state<GridWidget | null>(null);
  let widgetId = $state<string | null>(null);
  let notFound = $state(false);
  let editorReady = $state(false);
  let editorValid = $state(true);

  let mode = $state<'visual' | 'json'>('visual');
  let jsonText = $state('');
  let jsonBaseline = '';
  let confirmingJsonDiscard = $state(false);

  let savedData = $state<WidgetData | null>(null);
  let lastLiveData: WidgetData | null = null;
  let saving = $state(false);
  let confirmingLeave = $state(false);
  let leaveAction: (() => void) | null = null;

  let shiftHeld = $state(false);
  let saveHovered = $state(false);
  const saveClosesEditor = $derived(shiftHeld && saveHovered);

  const modeOptions = $derived([
    { value: 'visual', label: translateKey(AppStrings.WidgetEditor.Page.ModeVisual) },
    { value: 'json', label: translateKey(AppStrings.WidgetEditor.Page.ModeJson) },
  ]);

  const jsonValid = $derived.by(() => {
    if (widget === null) return false;
    try {
      fromEditorJson(widget.type, jsonText);
      return true;
    } catch {
      return false;
    }
  });

  const canSave = $derived(mode === 'json' ? jsonValid : editorValid);
  const dirty = $derived.by(() => {
    const data = widget?.data;
    if (data === undefined) return false;
    if (savedData !== null && !deepEqual(savedData, data)) return true;
    return mode === 'json' && jsonText !== jsonBaseline;
  });
  const saveVisible = $derived(dirty);
  const leaveMessage = $derived(
    canSave
      ? translateKey(AppStrings.WidgetEditor.Page.UnsavedChangesMessage)
      : translateKey(AppStrings.WidgetEditor.Page.UnsavedChangesIncompleteMessage),
  );

  const editorTitle = $derived(widget ? widgetTypeName(widget.type) : '');

  async function initialize(): Promise<void> {
    const id = route.params.widgetId ?? null;
    if (!id) {
      notFound = true;
      return;
    }

    if (folderStore.folders.length === 0) {
      await loadFolders();
    }

    const folder = folderStore.folders.find(f => f.widgets.some(w => w.id === id));
    const live = folder?.widgets.find(w => w.id === id);

    if (!folder || !live) {
      notFound = true;
      return;
    }

    if (!live.isPinned || folderStore.selectedFolderId === null) {
      selectFolder(folder.id);
    }

    widgetId = id;
    lastLiveData = plainSnapshot(live.data);
    widget = { ...live, data: { ...live.data } };
    savedData = plainSnapshot(live.data);
  }

  void initialize();

  function sveltePageWindowKeydown(event: KeyboardEvent): void {
    shiftHeld = event.shiftKey;
  }

  function sveltePageWindowBlur(): void {
    shiftHeld = false;
  }

  // A live update under a clean draft is adopted wholesale; under a dirty one
  // only the keys the host actually changed are patched in.
  $effect(() => {
    const live = widgetId !== null ? findWidget(widgetId) : undefined;
    if (!live || widget === null) return;
    if (lastLiveData && deepEqual(lastLiveData, live.data)) return;

    const patch = diffWidgetData(lastLiveData, live.data);
    lastLiveData = plainSnapshot(live.data);

    if (dirty && !patch) return;

    const nextData = dirty && widget
      ? applyWidgetDataPatch(widget.data, patch)
      : plainSnapshot(live.data);
    const next = { ...live, data: nextData as WidgetData };
    widget = next;

    if (mode === 'json' && !dirty) {
      jsonText = toEditorJson(next.type, next.data);
    }

    if (!dirty) {
      savedData = plainSnapshot(next.data);
      jsonBaseline = jsonText;
    }
  });


  // A plain deep copy of reactive state: structuredClone refuses the proxies
  // $state reads return, and Snapshot<T> recurses infinitely over the widget
  // types - the untyped binding keeps both problems out of the way.
  function plainSnapshot(value: unknown): any {
    return ($state.snapshot as (source: unknown) => unknown)(value);
  }
  function markSaved(): void {
    const data = widget?.data;
    savedData = data ? plainSnapshot(data) : null;
    lastLiveData = data ? plainSnapshot(data) : null;
    // Re-baselines to the user's literal current text, not a re-serialization:
    // a save must not reformat the document out from under the cursor.
    jsonBaseline = jsonText;
  }

  function applyJson(): boolean {
    if (widget === null) return false;

    let data: WidgetData;
    try {
      data = fromEditorJson(widget.type, jsonText);
    } catch {
      return false;
    }

    widget = { ...widget, data };
    return true;
  }

  async function save(): Promise<boolean> {
    if (widget === null || !canSave || saving) return false;
    // `jsonValid` is re-derived from the buffer on every keystroke, but a
    // synchronous re-check of the text's own parseability is what makes
    // "invalid JSON can never overwrite a valid widget configuration" true by
    // construction rather than by timing.
    if (mode === 'json' && !applyJson()) return false;
    const target = widget;
    if (target === null) return false;

    saving = true;
    const saved = await updateWidget(target.id, { data: { ...target.data } });
    saving = false;

    if (!saved) {
      showToast(translateKey(AppStrings.WidgetEditor.Page.SaveFailedToast), { variant: 'error' });
      return false;
    }

    markSaved();
    return true;
  }

  async function onSave(): Promise<void> {
    const close = shiftHeld;
    const saved = await save();
    if (saved && close) goBack();
  }

  function goBack(): void {
    if (dirty) {
      leaveAction = () => void navigate('/deck');
      confirmingLeave = true;
      return;
    }
    void navigate('/deck');
  }

  async function onSaveAndLeave(): Promise<void> {
    // A save that did not reach the host must not take the changes with it.
    confirmingLeave = false;
    const saved = await save();
    if (saved) leaveAction?.();
    leaveAction = null;
  }

  function onDiscardChanges(): void {
    confirmingLeave = false;
    leaveAction?.();
    leaveAction = null;
  }

  function onKeepEditing(): void {
    confirmingLeave = false;
    leaveAction = null;
  }

  function onModeChange(next: string): void {
    if (next === mode) return;
    if (next === 'json') {
      enterJsonMode();
    } else {
      leaveJsonMode();
    }
  }

  function enterJsonMode(): void {
    if (widget === null) return;

    const text = toEditorJson(widget.type, widget.data);
    jsonText = text;
    jsonBaseline = text;
    mode = 'json';
  }

  function leaveJsonMode(): void {
    if (jsonText === jsonBaseline) {
      mode = 'visual';
      return;
    }
    // A schema violation counts as invalid here, not just unparseable text:
    // applying it would put a value the widget cannot render on the model,
    // and Visual mode would then let it be saved. The JSON is deserialized
    // only once validation succeeds.
    if (jsonValid && applyJson()) {
      mode = 'visual';
      return;
    }
    confirmingJsonDiscard = true;
  }

  function onDiscardJsonChanges(): void {
    confirmingJsonDiscard = false;
    mode = 'visual';
  }
</script>

<svelte:window onkeydown={sveltePageWindowKeydown} onkeyup={sveltePageWindowKeydown} onblur={sveltePageWindowBlur} />

<DetailPage backLabel={translateKey(AppStrings.WidgetEditor.Page.BackToDeck)} onclose={goBack}>
  {#snippet header()}
    <div class="editor-header">
      <h1 class="editor-title">{editorTitle}</h1>
      <div class="editor-actions">
        <SegmentedControl options={modeOptions} value={mode} onchange={onModeChange} />
        {#if saveVisible}
          <span
            class="save-hover-zone"
            onmouseenter={() => (saveHovered = true)}
            onmouseleave={() => (saveHovered = false)}
          >
            <Button
              variant="primary"
              size="compact"
              disabled={!canSave || saving}
              title={translateKey(AppStrings.WidgetEditor.Page.SaveButtonTitle)}
              onclick={onSave}
            >
              {saveClosesEditor
                ? translateKey(AppStrings.WidgetEditor.Page.SaveAndCloseLabel)
                : translateKey(AppStrings.WidgetEditor.Page.SaveLabel)}
            </Button>
          </span>
        {/if}
      </div>
    </div>
  {/snippet}

  {#if notFound}
    <div class="editor-message">
      <p>{translateKey(AppStrings.WidgetEditor.Page.WidgetNotFoundMessage)}</p>
      <Button variant="secondary" onclick={() => void navigate('/deck')}>
        {translateKey(AppStrings.WidgetEditor.Page.BackToDeck)}
      </Button>
    </div>
  {:else if widget === null}
    <div class="editor-message">
      <p>{translateKey(AppStrings.WidgetEditor.Page.LoadingEditor)}</p>
    </div>
  {:else if mode === 'json'}
    <div class="json-pane">
      <textarea
        class="json-editor"
        spellcheck="false"
        aria-label={translateKey(AppStrings.WidgetEditor.Page.ModeJson)}
        bind:value={jsonText}
      ></textarea>
      {#if !jsonValid}
        <p class="json-error" role="alert">
          {translateKey(AppStrings.WidgetEditor.Page.InvalidJsonMessage)}
        </p>
      {/if}
    </div>
  {:else}
    <!-- Mounted unconditionally: the editor is the only thing that can report
         itself ready, so gating it on that flag left the page loading forever.
         It shows its preview at once and fills the configuration in when the
         host's tree lands. -->
    <div class="editor-pane" aria-busy={!editorReady}>
      <WidgetConfigurationEditor
        widget={widget}
        unsavedChanges={dirty}
        bind:ready={editorReady}
        bind:valid={editorValid}
      />
    </div>
  {/if}
</DetailPage>

{#if confirmingLeave}
  <ConfirmDialog
    heading={translateKey(AppStrings.WidgetEditor.Page.UnsavedChangesHeading)}
    message={leaveMessage}
    confirmText={translateKey(AppStrings.WidgetEditor.Page.SaveLabel)}
    altText={translateKey(AppStrings.WidgetEditor.Page.DiscardChangesAction)}
    onconfirm={onSaveAndLeave}
    oncancel={onKeepEditing}
    onalt={onDiscardChanges}
  />
{/if}

{#if confirmingJsonDiscard}
  <ConfirmDialog
    heading={translateKey(AppStrings.WidgetEditor.Page.InvalidJsonHeading)}
    message={translateKey(AppStrings.WidgetEditor.Page.InvalidJsonMessage)}
    confirmText={translateKey(AppStrings.WidgetEditor.Page.DiscardJsonChangesAction)}
    onconfirm={onDiscardJsonChanges}
    oncancel={() => (confirmingJsonDiscard = false)}
  />
{/if}

<style>
  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3, 0.75rem);
    flex-wrap: wrap;
    width: 100%;
  }

  .editor-title {
    margin: 0;
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-primary);
  }

  .editor-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .save-hover-zone {
    display: inline-flex;
  }

  .editor-message {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-6, 1.5rem);
    color: var(--color-text-secondary);
  }

  .json-pane {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    height: 100%;
    min-height: 24rem;
  }

  .json-editor {
    flex: 1;
    width: 100%;
    padding: var(--space-3, 0.75rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: var(--text-sm, 0.875rem);
    resize: vertical;
  }

  .json-error {
    margin: 0;
    color: var(--color-danger, #bf616a);
    font-size: var(--text-sm, 0.875rem);
  }
</style>
