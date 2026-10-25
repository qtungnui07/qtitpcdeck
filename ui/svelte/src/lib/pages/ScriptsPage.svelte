<script lang="ts">
  /*
   * The Scripts page.
   *
   * Displays the list of configured scripts on the left rail and allows running,
   * editing, duplicating, or deleting scripts.
   *
   * Scripts can declare parameterized inputs (text, numeric, boolean, color).
   * When running a script with inputs, ScriptRunDialog is presented to prompt
   * for parameter values.
   */

  import { onMount } from 'svelte';
  import {
    AppStrings,
    type Script,
    type ScriptInputValue,
    type ScriptUsage,
    scriptActionCount,
  } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import RailItem from '$lib/components/RailItem.svelte';
  import RailPage from '$lib/components/RailPage.svelte';
  import ScriptEditDialog, { type ScriptEditResult } from '$lib/components/ScriptEditDialog.svelte';
  import ScriptRunDialog from '$lib/components/ScriptRunDialog.svelte';
  import { translateKey } from '$lib/localization.svelte';
  import {
    createScript,
    deleteScript,
    duplicateScript,
    getUsages,
    loadScripts,
    runScript,
    scriptStore,
    updateScript,
  } from '$lib/scripts.svelte';
  import { showToast } from '$lib/toasts.svelte';

  let selectedScriptId = $state<string | null>(null);
  let editDialogMode = $state<'create' | 'edit' | null>(null);
  let pendingDelete = $state<Script | null>(null);
  let pendingDeleteUsages = $state<ScriptUsage[]>([]);
  let pendingRun = $state<Script | null>(null);
  let pendingSelection = $state<Script | null>(null);
  let isDirty = $state(false);
  let isSaving = $state(false);

  const selectedScript = $derived(
    scriptStore.scripts.find(s => s.id === selectedScriptId) ?? null,
  );

  // Auto-select first script if none selected or selection was removed
  $effect(() => {
    const scripts = scriptStore.sortedScripts;
    if (scripts.length > 0) {
      if (!selectedScriptId || !scripts.some(s => s.id === selectedScriptId)) {
        selectedScriptId = scripts[0].id;
        isDirty = false;
      }
    } else {
      selectedScriptId = null;
      isDirty = false;
    }
  });

  onMount(() => {
    if (scriptStore.scripts.length === 0 && !scriptStore.isLoading) {
      void loadScripts();
    }
  });

  function select(script: Script): void {
    if (script.id === selectedScriptId) return;

    if (isDirty) {
      pendingSelection = script;
      return;
    }

    applySelection(script);
  }

  function applySelection(script: Script): void {
    selectedScriptId = script.id;
    isDirty = false;
  }

  function confirmDiscardAndSwitch(): void {
    const next = pendingSelection;
    pendingSelection = null;
    if (next) {
      applySelection(next);
    }
  }

  function openCreate(): void {
    editDialogMode = 'create';
  }

  function openRename(): void {
    if (selectedScript) {
      editDialogMode = 'edit';
    }
  }

  async function onEditDialogSave(result: ScriptEditResult): Promise<void> {
    const mode = editDialogMode;
    editDialogMode = null;

    if (mode === 'create') {
      const created = await createScript(result.name, result.description);
      if (!created.success || !created.data) {
        showToast(created.error?.message ?? translateKey(AppStrings.Scripts.CreateFailed), {
          variant: 'error',
        });
        return;
      }

      applySelection(created.data);
      return;
    }

    if (!selectedScript) return;

    const updated = await updateScript(selectedScript.id, {
      name: result.name,
      description: result.description,
    });
    if (!updated.success) {
      showToast(updated.error?.message ?? translateKey(AppStrings.Scripts.RenameFailed), {
        variant: 'error',
      });
    }
  }

  async function duplicate(): Promise<void> {
    if (!selectedScript) return;

    const result = await duplicateScript(selectedScript.id);
    if (!result.success || !result.data) {
      showToast(result.error?.message ?? translateKey(AppStrings.Scripts.DuplicateFailed), {
        variant: 'error',
      });
      return;
    }

    showToast(translateKey(AppStrings.Scripts.Duplicated, { name: result.data.name }));
    applySelection(result.data);
  }

  async function run(): Promise<void> {
    if (!selectedScript) return;

    if (isDirty) {
      showToast(translateKey(AppStrings.Scripts.RunNeedsSaveFirst), { variant: 'error' });
      return;
    }

    if (selectedScript.inputs.length > 0) {
      pendingRun = selectedScript;
      return;
    }

    await execute(selectedScript, undefined);
  }

  async function runWithInputs(inputs: Record<string, ScriptInputValue>): Promise<void> {
    const script = pendingRun;
    pendingRun = null;
    if (script) {
      await execute(script, inputs);
    }
  }

  async function execute(
    script: Script,
    inputs: Record<string, ScriptInputValue> | undefined,
  ): Promise<void> {
    const result = await runScript(script.id, inputs);
    if (!result.success) {
      showToast(result.error?.message ?? translateKey(AppStrings.Scripts.RunFailed), {
        variant: 'error',
      });
    }
  }

  async function requestDelete(): Promise<void> {
    if (!selectedScript) return;

    const usages = await getUsages(selectedScript.id);
    pendingDeleteUsages = usages;
    pendingDelete = selectedScript;
  }

  async function confirmDelete(): Promise<void> {
    const script = pendingDelete;
    pendingDelete = null;
    if (!script) return;

    const result = await deleteScript(script.id);
    if (!result.success) {
      showToast(result.error?.message ?? translateKey(AppStrings.Scripts.DeleteFailed), {
        variant: 'error',
      });
      return;
    }

    if (selectedScriptId === script.id) {
      const next = scriptStore.sortedScripts.find(s => s.id !== script.id) ?? null;
      if (next) {
        applySelection(next);
      } else {
        selectedScriptId = null;
        isDirty = false;
      }
    }
  }

  const deleteMessage = $derived.by(() => {
    const script = pendingDelete;
    if (!script) return '';

    const usages = pendingDeleteUsages;
    if (usages.length === 0) {
      return translateKey(AppStrings.Scripts.DeleteScriptSimpleMessage, { name: script.name });
    }

    const widgetCount = usages
      .filter(u => u.kind === 'widget')
      .reduce((total, u) => total + u.count, 0);
    const scriptCount = usages.filter(u => u.kind === 'script').length;

    const parts: string[] = [];
    if (widgetCount > 0) {
      parts.push(translateKey(AppStrings.Scripts.UsageWidgetCount, { count: widgetCount }));
    }
    if (scriptCount > 0) {
      parts.push(translateKey(AppStrings.Scripts.UsageOtherScriptCount, { count: scriptCount }));
    }

    const where = usages.map(u => u.location).join(', ');
    return translateKey(AppStrings.Scripts.DeleteScriptUsageMessage, {
      name: script.name,
      parts: parts.join(` ${translateKey(AppStrings.Scripts.UsageConjunction)} `),
      where,
    });
  });

  function discard(): void {
    isDirty = false;
  }

  async function save(): Promise<void> {
    if (!selectedScript || !isDirty || isSaving) return;

    isSaving = true;
    const result = await updateScript(selectedScript.id, {
      flows: selectedScript.flows,
      inputs: selectedScript.inputs,
      runsOnWidget: selectedScript.runsOnWidget,
    });
    isSaving = false;

    if (!result.success) {
      showToast(result.error?.message ?? translateKey(AppStrings.Scripts.SaveFailed), {
        variant: 'error',
      });
      return;
    }

    isDirty = false;
    showToast(translateKey(AppStrings.Scripts.Saved, { name: selectedScript.name }));
  }
</script>

<RailPage railTitle={translateKey('macrodeck.app:Nav.Scripts')}>
  {#snippet banner()}
    {#if scriptStore.loadError}
      <div class="banner error">
        <span>{scriptStore.loadError}</span>
      </div>
    {/if}
  {/snippet}

  {#snippet railActions()}
    <Button
      variant="secondary"
      size="icon"
      title={translateKey(AppStrings.Scripts.NewScript)}
      ariaLabel={translateKey(AppStrings.Scripts.NewScript)}
      onclick={openCreate}
    >
      <span class="icon-plus">+</span>
    </Button>
  {/snippet}

  {#snippet rail()}
    {#if scriptStore.isLoading && scriptStore.scripts.length === 0}
      <p class="rail-status">{translateKey(AppStrings.Scripts.LoadingScripts)}</p>
    {:else if scriptStore.scripts.length === 0}
      <div class="empty-state">
        <p class="empty-heading">{translateKey(AppStrings.Scripts.NoScriptsYetHeading)}</p>
        <p class="empty-message">{translateKey(AppStrings.Scripts.NoScriptsYetMessage)}</p>
      </div>
    {:else}
      <ul class="script-list" role="listbox" aria-label={translateKey('macrodeck.app:Nav.Scripts')}>
        {#each scriptStore.sortedScripts as script (script.id)}
          <li>
            <RailItem
              label={script.name}
              count={scriptActionCount(script)}
              active={script.id === selectedScriptId}
              onclick={() => select(script)}
            />
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  <div class="script-detail">
    {#if selectedScript}
      <header class="detail-header">
        <div class="detail-title">
          <h2 title={selectedScript.name}>{selectedScript.name}</h2>
          {#if isDirty}
            <span class="tag">{translateKey(AppStrings.Scripts.UnsavedTag)}</span>
          {/if}
        </div>
        {#if selectedScript.description}
          <p class="detail-meta">{selectedScript.description}</p>
        {/if}

        <div class="detail-actions">
          <Button variant="secondary" disabled={isDirty} onclick={run}>
            {translateKey(AppStrings.Scripts.RunAction)}
          </Button>
          <Button variant="secondary" onclick={openRename}>
            {translateKey('macrodeck:Common.Rename')}
          </Button>
          <Button variant="secondary" onclick={duplicate}>
            {translateKey(AppStrings.Scripts.DuplicateAction)}
          </Button>
          <Button variant="danger" onclick={requestDelete}>
            {translateKey('macrodeck:Common.Delete')}
          </Button>
        </div>
      </header>

      <div class="builder-preview">
        <div class="meta-card">
          <div class="meta-row">
            <span class="meta-label">Actions:</span>
            <span class="meta-value">{scriptActionCount(selectedScript)}</span>
          </div>
          {#if selectedScript.runsOnWidget}
            <div class="meta-row">
              <span class="meta-label">{translateKey(AppStrings.Scripts.RunsOnWidgetLabel)}</span>
              <span class="tag">Active</span>
            </div>
          {/if}
          <div class="meta-row">
            <span class="meta-label">{translateKey(AppStrings.Scripts.InputsTabLabel)}:</span>
            <span class="meta-value">{selectedScript.inputs.length}</span>
          </div>
        </div>

        {#if selectedScript.inputs.length > 0}
          <div class="inputs-section">
            <h3 class="section-heading">{translateKey(AppStrings.Scripts.InputsTabLabel)}</h3>
            <div class="input-tags">
              {#each selectedScript.inputs as input (input.name)}
                <div class="input-badge">
                  <span class="input-name">{input.name}</span>
                  <span class="input-type">{input.type}</span>
                  {#if input.required}
                    <span class="required-badge">{translateKey(AppStrings.Scripts.RequiredBadge)}</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      {#if isDirty}
        <footer class="detail-footer">
          <Button variant="secondary" onclick={discard}>
            {translateKey(AppStrings.Scripts.DiscardAction)}
          </Button>
          <Button variant="primary" disabled={isSaving} onclick={save}>
            {translateKey(AppStrings.Scripts.SaveChangesAction)}
          </Button>
        </footer>
      {/if}
    {:else}
      <div class="empty-state">
        <p class="empty-heading">{translateKey(AppStrings.Scripts.NoScriptSelectedHeading)}</p>
        <p class="empty-message">{translateKey(AppStrings.Scripts.NoScriptSelectedMessage)}</p>
      </div>
    {/if}
  </div>
</RailPage>

{#if editDialogMode}
  <ScriptEditDialog
    mode={editDialogMode}
    script={editDialogMode === 'edit' ? selectedScript : null}
    onsave={onEditDialogSave}
    oncancel={() => (editDialogMode = null)}
  />
{/if}

{#if pendingDelete}
  <ConfirmDialog
    heading={translateKey(AppStrings.Scripts.DeleteScriptHeading)}
    message={deleteMessage}
    confirmText={translateKey('macrodeck:Common.Delete')}
    danger={true}
    onconfirm={confirmDelete}
    oncancel={() => (pendingDelete = null)}
  />
{/if}

{#if pendingRun}
  <ScriptRunDialog
    scriptName={pendingRun.name}
    inputs={pendingRun.inputs}
    onrun={runWithInputs}
    oncancel={() => (pendingRun = null)}
  />
{/if}

{#if pendingSelection}
  <ConfirmDialog
    heading={translateKey(AppStrings.Scripts.DiscardChangesHeading)}
    message={translateKey(AppStrings.Scripts.DiscardChangesSwitchMessage, {
      name: pendingSelection.name,
    })}
    confirmText={translateKey(AppStrings.Scripts.DiscardAction)}
    danger={true}
    onconfirm={confirmDiscardAndSwitch}
    oncancel={() => (pendingSelection = null)}
  />
{/if}

<style>
  .banner {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    margin-bottom: var(--space-3);
  }

  .banner.error {
    background: var(--color-danger-subtle, rgba(239, 68, 68, 0.1));
    color: var(--color-danger);
    border: 1px solid var(--color-danger);
  }

  .icon-plus {
    font-size: 1.125rem;
    line-height: 1;
    font-weight: var(--font-bold);
  }

  .rail-status {
    padding: var(--space-3);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .script-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    overflow-y: auto;
  }

  .script-detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    height: 100%;
    min-height: 0;
  }

  .detail-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .detail-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .detail-title h2 {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .detail-meta {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .detail-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    flex-wrap: wrap;
    margin-top: var(--space-1);
  }

  .tag {
    display: inline-block;
    padding: 0.125rem var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
  }

  .builder-preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1 1 auto;
    min-height: 0;
  }

  .meta-card {
    display: flex;
    gap: var(--space-4);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .meta-label {
    color: var(--color-text-secondary);
  }

  .meta-value {
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .inputs-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .section-heading {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
  }

  .input-tags {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .input-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
    font-size: var(--text-xs);
  }

  .input-name {
    font-family: var(--font-mono);
    font-weight: var(--font-medium);
  }

  .input-type {
    color: var(--color-text-muted);
  }

  .required-badge {
    color: var(--color-danger);
    font-weight: var(--font-semibold);
  }

  .detail-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--space-6) var(--space-4);
    color: var(--color-text-muted);
  }

  .empty-heading {
    font-weight: var(--font-semibold);
    font-size: var(--text-base);
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-1);
  }

  .empty-message {
    margin: 0;
    font-size: var(--text-sm);
  }
</style>
