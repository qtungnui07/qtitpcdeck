<script lang="ts">
  /*
   * One action card, ported from the Angular card family (action-card-frame +
   * generic/break/wait/if-else/switch/repeat/while cards) as a single
   * component: the frame, the summary line, and a body that varies by block
   * type - parameter rows for an action, a condition for while, branches for
   * if/else and switch, a nested list for loops.
   *
   * Block types come from the definitions: 'action', 'delay', 'condition'
   * (if/else), 'switch', 'loop' (repeat/while), 'flow-control' (break).
   */
  import {
    type ActionBlock,
    AppStrings,
    type ParameterValue,
  } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import { isParameterVisible } from '$lib/parameter-visibility.util';
  import { summarizeParameters } from '$lib/action-summary.util';
  import type { ActionFlowStore } from './action-flow-store.svelte';
  import ActionBlockList from './ActionBlockList.svelte';
  import ConditionBuilder from './ConditionBuilder.svelte';
  import ParamRow from './ParamRow.svelte';

  interface Props {
    block: ActionBlock;
    listId: string;
    index: number;
    store: ActionFlowStore;
  }

  let { block, listId, index, store }: Props = $props();

  let menuOpen = $state(false);
  let commentOpen = $state(false);

  const definition = $derived(
    store.availableBlocks.find(def => def.blockType === block.blockType)
      ?? store.availableBlocks.find(
        def => def.integrationId === block.integrationId && def.actionId === block.actionId,
      ),
  );

  const label = $derived(definition?.label ?? block.blockType);
  const color = $derived(definition?.color ?? '#64748b');

  const isLoop = $derived(block.type === 'loop');
  const isIfElse = $derived(block.type === 'condition');
  const isSwitch = $derived(block.type === 'switch');
  const hasCondition = $derived(isLoop && !!block.condition);
  const hasBranches = $derived(block.type === 'condition' || block.type === 'switch');

  const params = $derived(block.parameters ?? []);
  const visibleParams = $derived(params.filter(param => isParameterVisible(param, params)));
  const hasBody = $derived(
    visibleParams.length > 0 || !!block.children || !!block.branches || !!block.condition,
  );

  const expanded = $derived(!hasBody || store.isExpanded(block.id));
  const summary = $derived(
    summarizeParameters(block.parameters, (key, args) => translateKey(key, args)),
  );

  const errors = $derived(store.errorsFor(block.id));
  const errorMessages = $derived(
    errors.map(error => (error.paramName ? `${error.paramName}: ${error.message}` : error.message)),
  );

  function paramNameError(paramName: string): boolean {
    return errors.some(error => error.paramName === paramName);
  }

  function onParamChange(paramName: string, value: ParameterValue, valueLabel?: string): void {
    store.updateParam(block.id, paramName, value, valueLabel);
  }

  function onCaseValueInput(branchId: string, event: Event & { currentTarget: EventTarget & HTMLInputElement }): void {
    store.updateCaseValue(block.id, branchId, (event.currentTarget as HTMLInputElement).value);
  }

  function onSubjectInput(event: Event & { currentTarget: EventTarget & HTMLInputElement }): void {
    store.updateSwitchSubject(block.id, (event.currentTarget as HTMLInputElement).value);
  }

  // Reorder without drag: the move target indices are in the original list's
  // coordinates (the same convention the drag service used), so moving down
  // lands after the next item - two slots, one of which the removal eats.
  function moveUp(): void {
    if (index > 0) store.moveBlock(listId, index, listId, index - 1);
  }

  function moveDown(): void {
    store.moveBlock(listId, index, listId, index + 2);
  }
</script>

<div
  class="action-card"
  class:is-disabled={block.disabled === true}
  class:is-cut={store.isCutSource(block.id)}
  data-block-id={block.id}
>
  <div class="card-header" style:--card-color={color}>
    <button
      type="button"
      class="card-chevron"
      aria-label={label}
      aria-expanded={hasBody ? expanded : undefined}
      onclick={() => hasBody && store.toggleExpanded(block.id)}
    >
      {#if hasBody}
        <span class="chevron" class:chevron-open={expanded}>▸</span>
      {/if}
      <span class="card-bar" aria-hidden="true"></span>
      <span class="card-label">{label}</span>
      {#if summary}
        <span class="card-summary">{summary}</span>
      {/if}
    </button>

    <div class="card-tools">
      {#if block.comment}
        <span class="card-comment-badge" title={block.comment}>💬</span>
      {/if}
      <button
        type="button"
        class="card-tool"
        title={translateKey(block.disabled ? AppStrings.ActionBuilder.Frame.EnableAction : AppStrings.ActionBuilder.Frame.DisableAction)}
        onclick={() => store.toggleDisabled(block.id)}
      >
        {block.disabled ? '⏸' : '⏵'}
      </button>
      <div class="card-menu-zone">
        <button
          type="button"
          class="card-tool"
          aria-label={label}
          onclick={() => (menuOpen = !menuOpen)}
        >⋮</button>
        {#if menuOpen}
          <div class="card-menu" role="menu">
            <button type="button" role="menuitem" disabled={index === 0} onclick={() => { menuOpen = false; moveUp(); }}>
              {translateKey(AppStrings.Forms.KeyboardSequenceEditor.MoveUp)}
            </button>
            <button type="button" role="menuitem" onclick={() => { menuOpen = false; moveDown(); }}>
              {translateKey(AppStrings.Forms.KeyboardSequenceEditor.MoveDown)}
            </button>
            <button type="button" role="menuitem" onclick={() => { menuOpen = false; void store.duplicateBlock(block.id); }}>
              {translateKey(AppStrings.ActionBuilder.Frame.MenuDuplicate)}
            </button>
            <button type="button" role="menuitem" onclick={() => { menuOpen = false; store.copyBlock(block.id); }}>
              {translateKey('macrodeck:Common.Copy')}
            </button>
            <button type="button" role="menuitem" onclick={() => { menuOpen = false; store.cutBlock(block.id); }}>
              {translateKey(AppStrings.ActionBuilder.Frame.MenuCut)}
            </button>
            {#if store.canPaste}
              <button type="button" role="menuitem" onclick={() => { menuOpen = false; void store.pasteAfter(block.id); }}>
                {translateKey(AppStrings.ActionBuilder.Frame.MenuPasteAfter)}
              </button>
            {/if}
            <button type="button" role="menuitem" onclick={() => { menuOpen = false; commentOpen = true; }}>
              {translateKey(AppStrings.ActionBuilder.Frame.AddComment)}
            </button>
            <button type="button" role="menuitem" class="is-danger" onclick={() => { menuOpen = false; store.removeBlock(block.id); }}>
              {translateKey(AppStrings.ActionBuilder.Frame.DeleteAction)}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if commentOpen}
    <div class="card-comment">
      <input
        class="comment-input"
        type="text"
        aria-label={translateKey(AppStrings.ActionBuilder.Frame.CommentFieldAriaLabel)}
        placeholder={translateKey(AppStrings.ActionBuilder.Frame.CommentPlaceholder)}
        value={block.comment ?? ''}
        oninput={event => store.updateBlockComment(block.id, (event.currentTarget as HTMLInputElement).value)}
      />
      <button type="button" class="card-tool" onclick={() => (commentOpen = false)}>×</button>
    </div>
  {/if}

  {#if errorMessages.length > 0}
    <div class="card-errors" role="alert">
      {#each errorMessages as message, i (i)}
        <p>{message}</p>
      {/each}
    </div>
  {/if}

  {#if expanded}
    <div class="card-body">
      {#each visibleParams as param (param.name)}
        <ParamRow
          param={param}
          disabled={block.disabled === true}
          invalid={paramNameError(param.name)}
          onchange={(value, valueLabel) => onParamChange(param.name, value, valueLabel)}
        />
      {/each}

      {#if hasCondition && block.condition}
        <div class="card-section">
          <span class="card-section-label">{translateKey(AppStrings.ActionBuilder.Loop.When)}</span>
          <ConditionBuilder
            expression={block.condition}
            variables={store.pickerVariables}
            comparisonOperators={store.comparisonOperators}
            onchange={expression => store.updateBlockCondition(block.id, expression)}
          />
        </div>
      {/if}

      {#if isSwitch}
        <div class="card-section">
          <label class="card-section-label" for="switch-subject-{block.id}">
            {translateKey(AppStrings.ActionBuilder.Switch.SubjectLabel)}
          </label>
          <input
            id="switch-subject-{block.id}"
            class="subject-input"
            type="text"
            aria-label={translateKey(AppStrings.ActionBuilder.Switch.SubjectAriaLabel)}
            placeholder={'{{ vars.x }}'}
            value={block.subject === null || block.subject === undefined || typeof block.subject === 'object' ? '' : String(block.subject)}
            oninput={onSubjectInput}
          />
        </div>
      {/if}

      {#if hasBranches && block.branches}
        {#each block.branches as branch, branchIndex (branch.id)}
          <div class="card-branch">
            <div class="branch-header">
              {#if branch.kind === 'if'}
                <span class="branch-kind">{translateKey(AppStrings.ActionBuilder.Branch.If)}</span>
              {:else if branch.kind === 'elseif'}
                <span class="branch-kind">{translateKey(AppStrings.ActionBuilder.Branch.ElseIf)}</span>
              {:else if branch.kind === 'case'}
                <span class="branch-kind">{translateKey(AppStrings.ActionBuilder.Branch.Case)}</span>
                <input
                  class="case-input"
                  type="text"
                  aria-label={translateKey(AppStrings.ActionBuilder.Branch.CaseValueAriaLabel)}
                  value={branch.value === null || branch.value === undefined || typeof branch.value === 'object' ? '' : String(branch.value)}
                  oninput={event => onCaseValueInput(branch.id, event)}
                />
                {#if (block.branches?.filter(b => b.kind === 'case').length ?? 0) > 1}
                  <button
                    type="button"
                    class="card-tool"
                    aria-label={translateKey(AppStrings.ActionBuilder.Branch.RemoveCaseAriaLabel)}
                    onclick={() => store.removeCase(block.id, branch.id)}
                  >×</button>
                {/if}
              {:else}
                <span class="branch-kind">{translateKey(AppStrings.ActionBuilder.Branch.Otherwise)}</span>
                {#if branchIndex === block.branches.length - 1}
                  <button
                    type="button"
                    class="card-tool"
                    aria-label={translateKey(AppStrings.ActionBuilder.Branch.RemoveOtherwiseAriaLabel)}
                    onclick={() => store.removeBranch(block.id, branch.id)}
                  >×</button>
                {/if}
              {/if}

              {#if branch.kind === 'if' || branch.kind === 'elseif'}
                <button
                  type="button"
                  class="card-tool"
                  aria-label={translateKey(AppStrings.ActionBuilder.ConditionSection.RemoveBranchAriaLabel)}
                  onclick={() => store.removeBranch(block.id, branch.id)}
                >×</button>
              {/if}
            </div>

            {#if branch.kind === 'if' || branch.kind === 'elseif'}
              <div class="branch-condition">
                {#if branch.condition}
                  <ConditionBuilder
                    expression={branch.condition}
                    variables={store.pickerVariables}
                    comparisonOperators={store.comparisonOperators}
                    onchange={expression => store.updateBranchCondition(block.id, branch.id, expression)}
                  />
                {/if}
              </div>
            {/if}

            <div class="branch-body">
              <ActionBlockList blocks={branch.children} listId={`branch:${branch.id}`} {store} />
            </div>
          </div>
        {/each}

        <div class="branch-additions">
          {#if isIfElse}
            <button type="button" class="branch-add" onclick={() => store.addElseIf(block.id)}>
              + {translateKey(AppStrings.ActionBuilder.Branch.AddElseIf)}
            </button>
            {#if !block.branches?.some(b => b.kind === 'else')}
              <button type="button" class="branch-add" onclick={() => store.addElse(block.id)}>
                + {translateKey(AppStrings.ActionBuilder.Branch.AddOtherwise)}
              </button>
            {/if}
          {:else}
            <button type="button" class="branch-add" onclick={() => store.addCase(block.id)}>
              + {translateKey(AppStrings.ActionBuilder.Branch.AddCase)}
            </button>
            {#if !block.branches?.some(b => b.kind === 'else')}
              <button type="button" class="branch-add" onclick={() => store.addElse(block.id)}>
                + {translateKey(AppStrings.ActionBuilder.Branch.AddOtherwise)}
              </button>
            {/if}
          {/if}
        </div>
      {/if}

      {#if isLoop && block.children}
        <div class="card-section">
          <span class="card-section-label">{translateKey(AppStrings.ActionBuilder.Loop.Do)}</span>
          <ActionBlockList blocks={block.children} listId={`children:${block.id}`} {store} />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .action-card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-secondary);
    overflow: visible;
  }

  .action-card.is-disabled {
    opacity: 0.55;
  }

  .action-card.is-cut {
    border-style: dashed;
    opacity: 0.7;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2, 0.5rem);
    padding: 0.375rem var(--space-2, 0.5rem) 0.375rem 0;
  }

  .card-chevron {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0 0.25rem var(--space-2, 0.5rem);
    min-width: 0;
    text-align: left;
    color: var(--color-text-primary);
  }

  .chevron {
    color: var(--color-text-muted);
    font-size: var(--text-xs, 0.75rem);
    transition: transform 120ms ease;
  }

  .chevron-open {
    transform: rotate(90deg);
  }

  .card-bar {
    width: 4px;
    height: 1.25rem;
    border-radius: 2px;
    background: var(--card-color, var(--color-accent));
    flex: none;
  }

  .card-label {
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-semibold, 600);
    white-space: nowrap;
  }

  .card-summary {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .card-tools {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: none;
  }

  .card-tool {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
    line-height: 1;
    padding: 0.25rem 0.375rem;
    border-radius: var(--radius-sm, 4px);
  }

  .card-tool:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
  }

  .card-menu-zone {
    position: relative;
  }

  .card-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 30;
    min-width: 12rem;
    padding: var(--space-1, 0.25rem);
    background: var(--color-bg-elevated, var(--color-bg-secondary));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
  }

  .card-menu button {
    background: none;
    border: none;
    border-radius: var(--radius-sm, 4px);
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
    padding: 0.375rem var(--space-2, 0.5rem);
    text-align: left;
  }

  .card-menu button:hover {
    background: var(--color-bg-tertiary);
  }

  .card-menu button.is-danger {
    color: var(--color-danger, #bf616a);
  }

  .card-comment {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: 0 var(--space-2, 0.5rem) var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  }

  .comment-input,
  .subject-input,
  .case-input {
    padding: 0.25rem var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
    width: 100%;
  }

  .card-errors {
    padding: 0.25rem var(--space-3, 0.75rem);
  }

  .card-errors p {
    margin: 0;
    color: var(--color-danger, #bf616a);
    font-size: var(--text-xs, 0.75rem);
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
    padding: 0 var(--space-2, 0.5rem) var(--space-3, 0.75rem) var(--space-3, 0.75rem);
  }

  .card-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .card-section-label {
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .card-branch {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
  }

  .branch-header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .branch-kind {
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-semibold, 600);
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex: none;
  }

  .case-input {
    width: auto;
    flex: 1;
  }

  .branch-body {
    padding-left: var(--space-3, 0.75rem);
    border-left: 2px solid var(--color-border);
  }

  .branch-additions {
    display: flex;
    gap: var(--space-2, 0.5rem);
    flex-wrap: wrap;
  }

  .branch-add {
    background: none;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md, 6px);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-xs, 0.75rem);
    padding: 0.25rem var(--space-2, 0.5rem);
  }

  .branch-add:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>
