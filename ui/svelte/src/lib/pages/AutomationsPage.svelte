<script lang="ts">
  /*
   * The Automations page.
   *
   * Displays the list of configured automations on the left rail and allows toggling
   * enabled/disabled state, renaming, duplicating, and deleting automations.
   *
   * Automations connect external event triggers to action flows. Incomplete automations
   * (missing event triggers) show a warning when enabled.
   */

  import { onMount } from 'svelte';
  import { AppStrings } from '@macro-deck/runtime';
  import Button from '$lib/components/Button.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import RailItem from '$lib/components/RailItem.svelte';
  import RailPage from '$lib/components/RailPage.svelte';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import AutomationEditDialog, {
    type AutomationEditResult,
  } from '$lib/components/AutomationEditDialog.svelte';
  import {
    type Automation,
    automationActionCount,
    automationEventName,
    automationIsIncomplete,
  } from '$lib/automation';
  import {
    automationStore,
    createAutomation,
    deleteAutomation,
    duplicateAutomation,
    loadAutomations,
    setEnabled,
    updateAutomation,
  } from '$lib/automations.svelte';
  import { localizationTranslator, translateKey } from '$lib/localization.svelte';
  import { showToast } from '$lib/toasts.svelte';

  let selectedAutomationId = $state<string | null>(null);
  let editDialogMode = $state<'create' | 'edit' | null>(null);
  let pendingDelete = $state<Automation | null>(null);
  let pendingSelection = $state<Automation | null>(null);
  let isDirty = $state(false);
  let isSaving = $state(false);
  let isTogglingEnabled = $state(false);

  const selectedAutomation = $derived(
    automationStore.automations.find(a => a.id === selectedAutomationId) ?? null,
  );

  // Auto-select first automation if none selected or selection was removed
  $effect(() => {
    const automations = automationStore.sortedAutomations;
    if (automations.length > 0) {
      if (!selectedAutomationId || !automations.some(a => a.id === selectedAutomationId)) {
        selectedAutomationId = automations[0].id;
        isDirty = false;
      }
    } else {
      selectedAutomationId = null;
      isDirty = false;
    }
  });

  onMount(() => {
    if (automationStore.automations.length === 0 && !automationStore.isLoading) {
      void loadAutomations();
    }
  });

  const draftEventName = $derived(
    selectedAutomation
      ? (automationEventName(selectedAutomation, localizationTranslator) ??
        translateKey(AppStrings.Automations.NoEventYet))
      : '',
  );

  const warnsIncomplete = $derived(
    !!selectedAutomation &&
      selectedAutomation.enabled &&
      automationIsIncomplete(selectedAutomation),
  );

  function select(automation: Automation): void {
    if (automation.id === selectedAutomationId) return;

    if (isDirty) {
      pendingSelection = automation;
      return;
    }

    applySelection(automation);
  }

  function applySelection(automation: Automation): void {
    selectedAutomationId = automation.id;
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
    if (selectedAutomation) {
      editDialogMode = 'edit';
    }
  }

  async function onEditDialogSave(result: AutomationEditResult): Promise<void> {
    const mode = editDialogMode;
    editDialogMode = null;

    if (mode === 'create') {
      const created = await createAutomation(result.name, result.description);
      if (!created.success || !created.data) {
        showToast(created.error?.message ?? translateKey(AppStrings.Automations.CreateFailed), {
          variant: 'error',
        });
        return;
      }

      applySelection(created.data);
      return;
    }

    if (!selectedAutomation) return;

    const updated = await updateAutomation(selectedAutomation.id, {
      name: result.name,
      description: result.description,
    });
    if (!updated.success) {
      showToast(updated.error?.message ?? translateKey(AppStrings.Automations.RenameFailed), {
        variant: 'error',
      });
    }
  }

  async function duplicate(): Promise<void> {
    if (!selectedAutomation) return;

    const result = await duplicateAutomation(selectedAutomation.id);
    if (!result.success || !result.data) {
      showToast(result.error?.message ?? translateKey(AppStrings.Automations.DuplicateFailed), {
        variant: 'error',
      });
      return;
    }

    showToast(translateKey(AppStrings.Automations.Duplicated, { name: result.data.name }));
    applySelection(result.data);
  }

  async function handleToggleEnabled(enabled: boolean): Promise<void> {
    if (!selectedAutomation || isTogglingEnabled) return;

    isTogglingEnabled = true;
    const result = await setEnabled(selectedAutomation.id, enabled);
    isTogglingEnabled = false;

    if (!result.success) {
      showToast(result.error?.message ?? translateKey(AppStrings.Automations.ToggleFailed), {
        variant: 'error',
      });
    }
  }

  function requestDelete(): void {
    if (selectedAutomation) {
      pendingDelete = selectedAutomation;
    }
  }

  async function confirmDelete(): Promise<void> {
    const automation = pendingDelete;
    pendingDelete = null;
    if (!automation) return;

    const result = await deleteAutomation(automation.id);
    if (!result.success) {
      showToast(result.error?.message ?? translateKey(AppStrings.Automations.DeleteFailed), {
        variant: 'error',
      });
      return;
    }

    if (selectedAutomationId === automation.id) {
      const next = automationStore.sortedAutomations.find(a => a.id !== automation.id) ?? null;
      if (next) {
        applySelection(next);
      } else {
        selectedAutomationId = null;
        isDirty = false;
      }
    }
  }

  const deleteMessage = $derived.by(() => {
    if (!pendingDelete) return '';
    const actions = automationActionCount(pendingDelete);
    return translateKey(AppStrings.Automations.DeleteAutomationMessage, {
      name: pendingDelete.name,
      count: actions,
    });
  });

  function discard(): void {
    isDirty = false;
  }

  async function save(): Promise<void> {
    if (!selectedAutomation || !isDirty || isSaving) return;

    isSaving = true;
    const result = await updateAutomation(selectedAutomation.id, {
      flows: selectedAutomation.flows,
    });
    isSaving = false;

    if (!result.success) {
      showToast(result.error?.message ?? translateKey(AppStrings.Automations.SaveFailed), {
        variant: 'error',
      });
      return;
    }

    isDirty = false;
    showToast(translateKey(AppStrings.Automations.Saved, { name: selectedAutomation.name }));
  }
</script>

<RailPage railTitle={translateKey('macrodeck.app:Nav.Automations')}>
  {#snippet banner()}
    {#if automationStore.loadError}
      <div class="banner error">
        <span>{automationStore.loadError}</span>
      </div>
    {/if}
  {/snippet}

  {#snippet railActions()}
    <Button
      variant="secondary"
      size="icon"
      title={translateKey(AppStrings.Automations.NewAutomation)}
      ariaLabel={translateKey(AppStrings.Automations.NewAutomation)}
      onclick={openCreate}
    >
      <span class="icon-plus">+</span>
    </Button>
  {/snippet}

  {#snippet rail()}
    {#if automationStore.isLoading && automationStore.automations.length === 0}
      <p class="rail-status">{translateKey(AppStrings.Automations.LoadingAutomations)}</p>
    {:else if automationStore.automations.length === 0}
      <div class="empty-state">
        <p class="empty-heading">{translateKey(AppStrings.Automations.NoAutomationsYetHeading)}</p>
        <p class="empty-message">{translateKey(AppStrings.Automations.NoAutomationsYetMessage)}</p>
      </div>
    {:else}
      <ul
        class="automation-list"
        role="listbox"
        aria-label={translateKey('macrodeck.app:Nav.Automations')}
      >
        {#each automationStore.sortedAutomations as automation (automation.id)}
          <li>
            <RailItem
              label={automation.name}
              count={automationActionCount(automation)}
              active={automation.id === selectedAutomationId}
              onclick={() => select(automation)}
            >
              {#if !automation.enabled}
                <span class="tag off">{translateKey(AppStrings.Automations.OffTag)}</span>
              {/if}
            </RailItem>
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  <div class="automation-detail">
    {#if selectedAutomation}
      <header class="detail-header">
        <div class="detail-title">
          <h2 title={selectedAutomation.name}>{selectedAutomation.name}</h2>
          {#if isDirty}
            <span class="tag">{translateKey(AppStrings.Automations.UnsavedTag)}</span>
          {/if}
        </div>

        <p class="detail-meta">
          <span class="detail-event">
            {translateKey(AppStrings.Automations.WhenLabel, { event: draftEventName })}
          </span>
          {#if selectedAutomation.description}
            <span class="detail-description">{selectedAutomation.description}</span>
          {/if}
        </p>

        <div class="detail-actions">
          <Button variant="secondary" onclick={openRename}>
            {translateKey('macrodeck:Common.Rename')}
          </Button>
          <Button variant="secondary" onclick={duplicate}>
            {translateKey(AppStrings.Automations.DuplicateAction)}
          </Button>
          <Button variant="danger" onclick={requestDelete}>
            {translateKey('macrodeck:Common.Delete')}
          </Button>

          <div class="enabled-wrapper">
            <ToggleSwitch
              label={translateKey('macrodeck:Common.Enabled')}
              ariaLabel={translateKey(AppStrings.Automations.EnableAriaLabel)}
              checked={selectedAutomation.enabled}
              busy={isTogglingEnabled}
              onchange={handleToggleEnabled}
            />
          </div>
        </div>

        {#if warnsIncomplete}
          <p class="detail-warning">
            {translateKey(AppStrings.Automations.IncompleteWarning)}
          </p>
        {/if}
      </header>

      <div class="builder-preview">
        <div class="meta-card">
          <div class="meta-row">
            <span class="meta-label">Trigger:</span>
            <span class="meta-value">{draftEventName}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Actions:</span>
            <span class="meta-value">{automationActionCount(selectedAutomation)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Status:</span>
            <span class="meta-value status-badge" class:enabled={selectedAutomation.enabled}>
              {selectedAutomation.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {#if isDirty}
        <footer class="detail-footer">
          <Button variant="secondary" onclick={discard}>
            {translateKey(AppStrings.Automations.DiscardAction)}
          </Button>
          <Button variant="primary" disabled={isSaving} onclick={save}>
            {translateKey(AppStrings.Automations.SaveChangesAction)}
          </Button>
        </footer>
      {/if}
    {:else}
      <div class="empty-state">
        <p class="empty-heading">
          {translateKey(AppStrings.Automations.NoAutomationSelectedHeading)}
        </p>
        <p class="empty-message">
          {translateKey(AppStrings.Automations.NoAutomationSelectedMessage)}
        </p>
      </div>
    {/if}
  </div>
</RailPage>

{#if editDialogMode}
  <AutomationEditDialog
    mode={editDialogMode}
    automation={editDialogMode === 'edit' ? selectedAutomation : null}
    onsave={onEditDialogSave}
    oncancel={() => (editDialogMode = null)}
  />
{/if}

{#if pendingDelete}
  <ConfirmDialog
    heading={translateKey(AppStrings.Automations.DeleteAutomationHeading)}
    message={deleteMessage}
    confirmText={translateKey('macrodeck:Common.Delete')}
    danger={true}
    onconfirm={confirmDelete}
    oncancel={() => (pendingDelete = null)}
  />
{/if}

{#if pendingSelection}
  <ConfirmDialog
    heading={translateKey(AppStrings.Automations.DiscardChangesHeading)}
    message={translateKey(AppStrings.Automations.DiscardChangesMessage, {
      name: pendingSelection.name,
    })}
    confirmText={translateKey(AppStrings.Automations.DiscardAction)}
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

  .automation-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    overflow-y: auto;
  }

  .automation-detail {
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
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .detail-event {
    font-weight: var(--font-medium);
  }

  .detail-description {
    color: var(--color-text-muted);
  }

  .detail-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    flex-wrap: wrap;
    margin-top: var(--space-1);
  }

  .enabled-wrapper {
    margin-left: auto;
  }

  .detail-warning {
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
    color: var(--color-warning, #eab308);
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

  .tag.off {
    background: var(--color-bg-tertiary);
    color: var(--color-text-muted);
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

  .status-badge {
    color: var(--color-text-muted);
  }

  .status-badge.enabled {
    color: var(--color-success, #22c55e);
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
