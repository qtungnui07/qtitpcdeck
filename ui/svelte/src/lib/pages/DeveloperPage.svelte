<script lang="ts">
  /*
   * Developer tools page, providing interactive diagnostics for Macro-Deck:
   * - Actions: inspect registered extension actions, test invocation, view responses
   * - Events: inspect events and fire triggers
   * - Templates & Expressions: render templates and evaluate conditions
   * - Logs: view system log stream with level filtering
   */
  import { onMount } from 'svelte';
  import { resolveLocalizedText } from '@macro-deck/runtime';
  import TabBar, { type TabItem } from '$lib/components/TabBar.svelte';
  import Button from '$lib/components/Button.svelte';
  import { localizationTranslator } from '$lib/localization.svelte';
  import {
    developerStore,
    evaluateCondition,
    evaluateExpression,
    loadActions,
    loadEvents,
    loadLogs,
    loadLogSources,
    renderTemplate,
    runAction,
    selectAction,
    selectEvent,
    triggerEvent,
  } from '$lib/developer.svelte';

  const tabs: TabItem[] = [
    { id: 'actions', label: 'Actions' },
    { id: 'events', label: 'Events' },
    { id: 'templates', label: 'Templates & Expressions' },
    { id: 'logs', label: 'Logs' },
  ];

  let activeTab = $state('actions');

  // Actions test state
  let actionParamsInput = $state('{}');

  // Events test state
  let eventPayloadInput = $state('{}');

  // Template test state
  let templateInput = $state('Hello {{user}}!');

  // Condition test state
  let conditionLeftInput = $state('1');
  let conditionOperatorInput = $state('==');
  let conditionRightInput = $state('1');

  // Logs state
  let selectedLogLevel = $state('Information');

  onMount(() => {
    void loadActions();
    void loadEvents();
    void loadLogSources();
    void loadLogs();
  });

  async function onRunSelectedAction() {
    if (!developerStore.selectedAction) return;
    try {
      const parsed = JSON.parse(actionParamsInput);
      await runAction({
        integrationId: developerStore.selectedAction.integrationId,
        actionId: developerStore.selectedAction.id,
        parameters: parsed,
      });
    } catch {
      alert('Invalid JSON in parameters');
    }
  }

  async function onTriggerSelectedEvent() {
    if (!developerStore.selectedEvent) return;
    try {
      const parsed = JSON.parse(eventPayloadInput);
      await triggerEvent({
        eventId: developerStore.selectedEvent.id,
        parameters: parsed,
      });
    } catch {
      alert('Invalid JSON in payload');
    }
  }

  async function onTestTemplate() {
    await renderTemplate(templateInput);
  }

  async function onTestCondition() {
    await evaluateCondition(
      { value: conditionLeftInput },
      conditionOperatorInput,
      { value: conditionRightInput },
    );
  }

  async function onTestExpression() {
    await evaluateExpression({
      kind: 'compare',
      id: 'test',
      left: { value: conditionLeftInput },
      operator: conditionOperatorInput,
      right: { value: conditionRightInput },
    });
  }

  async function onRefreshLogs() {
    await loadLogs(developerStore.selectedLogSource || undefined, [selectedLogLevel as any]);
  }
</script>

<div class="developer-page">
  <header class="page-header">
    <div class="header-titles">
      <h1 class="page-title">Developer Tools</h1>
      <p class="page-subtitle">Inspect actions, events, evaluate templates and monitor system logs.</p>
    </div>
  </header>

  <div class="tab-container">
    <TabBar
      items={tabs}
      activeId={activeTab}
      onchange={(id) => { activeTab = id; }}
    />
  </div>

  <main class="tab-body">
    {#if activeTab === 'actions'}
      <div class="split-pane">
        <aside class="list-pane">
          <div class="pane-header">
            <h3>Registered Actions ({developerStore.actions.length})</h3>
            <Button variant="secondary" onclick={() => loadActions()}>Refresh</Button>
          </div>
          <ul class="item-list">
            {#each developerStore.actions as action}
              <li>
                <button
                  type="button"
                  class="item-btn"
                  class:selected={developerStore.selectedAction?.id === action.id}
                  onclick={() => selectAction(action)}
                >
                  <span class="item-name">{resolveLocalizedText(action.name, localizationTranslator)}</span>
                  <span class="item-meta">{action.integrationId}</span>
                </button>
              </li>
            {/each}
          </ul>
        </aside>

        <section class="detail-pane">
          {#if developerStore.selectedAction}
            <div class="action-runner">
              <h3>Run Action: {resolveLocalizedText(developerStore.selectedAction.name, localizationTranslator)}</h3>
              <p class="desc">{resolveLocalizedText(developerStore.selectedAction.description, localizationTranslator) || 'No description provided.'}</p>

              <label class="form-label" for="action-params">JSON Parameters</label>
              <textarea
                id="action-params"
                class="code-input"
                bind:value={actionParamsInput}
                rows="6"
              ></textarea>

              <div class="action-buttons">
                <Button
                  variant="primary"
                  loading={developerStore.isExecuting}
                  onclick={onRunSelectedAction}
                >
                  Execute Action
                </Button>
              </div>

              {#if developerStore.executionResult}
                <div class="result-box">
                  <h4>Execution Result</h4>
                  <pre>{developerStore.executionResult}</pre>
                </div>
              {/if}
            </div>
          {:else}
            <div class="empty-detail">
              <p>Select an action on the left to test execution.</p>
            </div>
          {/if}
        </section>
      </div>

    {:else if activeTab === 'events'}
      <div class="split-pane">
        <aside class="list-pane">
          <div class="pane-header">
            <h3>Events ({developerStore.events.length})</h3>
            <Button variant="secondary" onclick={() => loadEvents()}>Refresh</Button>
          </div>
          <ul class="item-list">
            {#each developerStore.events as ev}
              <li>
                <button
                  type="button"
                  class="item-btn"
                  class:selected={developerStore.selectedEvent?.id === ev.id}
                  onclick={() => selectEvent(ev)}
                >
                  <span class="item-name">{resolveLocalizedText(ev.name, localizationTranslator)}</span>
                  <span class="item-meta">{ev.providerId}</span>
                </button>
              </li>
            {/each}
          </ul>
        </aside>

        <section class="detail-pane">
          {#if developerStore.selectedEvent}
            <div class="action-runner">
              <h3>Trigger Event: {resolveLocalizedText(developerStore.selectedEvent.name, localizationTranslator)}</h3>
              <p class="desc">{resolveLocalizedText(developerStore.selectedEvent.description, localizationTranslator) || 'No description.'}</p>

              <label class="form-label" for="event-payload">JSON Payload</label>
              <textarea
                id="event-payload"
                class="code-input"
                bind:value={eventPayloadInput}
                rows="6"
              ></textarea>

              <div class="action-buttons">
                <Button
                  variant="primary"
                  loading={developerStore.isExecuting}
                  onclick={onTriggerSelectedEvent}
                >
                  Trigger Event
                </Button>
              </div>

              {#if developerStore.executionResult}
                <div class="result-box">
                  <h4>Result</h4>
                  <pre>{developerStore.executionResult}</pre>
                </div>
              {/if}
            </div>
          {:else}
            <div class="empty-detail">
              <p>Select an event on the left to trigger.</p>
            </div>
          {/if}
        </section>
      </div>

    {:else if activeTab === 'templates'}
      <div class="templates-view">
        <div class="card">
          <h3>Render Template</h3>
          <label class="form-label" for="template-text">Template</label>
          <input id="template-text" type="text" class="text-input" bind:value={templateInput} />

          <Button variant="primary" onclick={onTestTemplate}>Render</Button>

          {#if developerStore.templateOutput !== null}
            <div class="result-box">
              <strong>Output:</strong> {developerStore.templateOutput}
            </div>
          {/if}
        </div>

        <div class="card">
          <h3>Evaluate Condition</h3>
          <label class="form-label" for="condition-left">Left Side</label>
          <input id="condition-left" type="text" class="text-input" bind:value={conditionLeftInput} />

          <label class="form-label" for="condition-op">Operator</label>
          <select id="condition-op" class="select-input" bind:value={conditionOperatorInput}>
            <option value="==">==</option>
            <option value="!=">!=</option>
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value=">=">&gt;=</option>
            <option value="<=">&lt;=</option>
          </select>

          <label class="form-label" for="condition-right">Right Side</label>
          <input id="condition-right" type="text" class="text-input" bind:value={conditionRightInput} />

          <div class="button-row">
            <Button variant="primary" onclick={onTestCondition}>Evaluate Condition</Button>
            <Button variant="secondary" onclick={onTestExpression}>Evaluate Expression</Button>
          </div>

          {#if developerStore.conditionResult !== null}
            <div class="result-box">
              <strong>Condition Result:</strong> {developerStore.conditionResult ? 'True' : 'False'}
            </div>
          {/if}

          {#if developerStore.expressionResult !== null}
            <div class="result-box">
              <strong>Expression Result:</strong> {developerStore.expressionResult}
            </div>
          {/if}
        </div>
      </div>

    {:else if activeTab === 'logs'}
      <div class="logs-view">
        <div class="logs-toolbar">
          <div class="filter-group">
            <label for="log-source-filter">Source:</label>
            <select
              id="log-source-filter"
              class="select-input"
              value={developerStore.selectedLogSource}
              onchange={() => onRefreshLogs()}
            >
              <option value="">(All Sources)</option>
              {#each developerStore.logSources as src}
                <option value={src.source}>{src.source}</option>
              {/each}
            </select>
          </div>

          <div class="filter-group">
            <label for="log-level-filter">Level:</label>
            <select
              id="log-level-filter"
              class="select-input"
              bind:value={selectedLogLevel}
              onchange={onRefreshLogs}
            >
              <option value="Trace">Trace</option>
              <option value="Debug">Debug</option>
              <option value="Information">Information</option>
              <option value="Warning">Warning</option>
              <option value="Error">Error</option>
            </select>
          </div>

          <Button variant="secondary" onclick={onRefreshLogs}>Refresh Logs</Button>
        </div>

        <div class="logs-table-wrapper">
          <table class="logs-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Level</th>
                <th>Source</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {#each developerStore.logs as entry}
                <tr class="log-row {entry.level.toLowerCase()}">
                  <td class="col-time">{entry.timestamp}</td>
                  <td class="col-level"><span class="badge {entry.level.toLowerCase()}">{entry.level}</span></td>
                  <td class="col-source">{entry.source || '-'}</td>
                  <td class="col-msg">{entry.message}</td>
                </tr>
              {:else}
                <tr>
                  <td colspan="4" class="empty-logs">No log entries found.</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  .developer-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .page-header {
    margin-bottom: 16px;
  }

  .page-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .page-subtitle {
    margin: 4px 0 0;
    color: var(--text-muted, #64748b);
    font-size: 0.875rem;
  }

  .tab-container {
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    margin-bottom: 16px;
  }

  .tab-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .split-pane {
    display: flex;
    height: 100%;
    gap: 16px;
    overflow: hidden;
  }

  .list-pane {
    width: 320px;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    background: var(--bg-surface, #ffffff);
    overflow: hidden;
  }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .pane-header h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .item-list {
    list-style: none;
    margin: 0;
    padding: 8px;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .item-btn {
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-btn:hover {
    background: var(--bg-hover, #f1f5f9);
  }

  .item-btn.selected {
    background: var(--primary-light, #eff6ff);
    border-color: var(--primary-color, #3b82f6);
  }

  .item-name {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .item-meta {
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
  }

  .detail-pane {
    flex: 1;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 6px;
    padding: 20px;
    background: var(--bg-surface, #ffffff);
    overflow-y: auto;
  }

  .form-label {
    display: block;
    margin: 12px 0 6px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .code-input {
    width: 100%;
    font-family: monospace;
    font-size: 0.875rem;
    padding: 8px 12px;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 4px;
    box-sizing: border-box;
  }

  .text-input,
  .select-input {
    padding: 8px 12px;
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 4px;
    font-size: 0.875rem;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 12px;
  }

  .action-buttons {
    margin-top: 16px;
  }

  .result-box {
    margin-top: 16px;
    padding: 12px;
    background: var(--bg-surface-secondary, #f8fafc);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 4px;
    overflow-x: auto;
  }

  .result-box pre {
    margin: 0;
    font-family: monospace;
    font-size: 0.8125rem;
  }

  .empty-detail {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted, #64748b);
  }

  .templates-view {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
    overflow-y: auto;
  }

  .card {
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 6px;
    padding: 16px;
    background: var(--bg-surface, #ffffff);
  }

  .card h3 {
    margin-top: 0;
    font-size: 1rem;
  }

  .logs-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 12px;
  }

  .logs-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logs-table-wrapper {
    flex: 1;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 6px;
    overflow: auto;
    background: var(--bg-surface, #ffffff);
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  .logs-table th,
  .logs-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    text-align: left;
  }

  .col-time {
    white-space: nowrap;
    width: 160px;
    color: var(--text-muted, #64748b);
  }

  .col-level {
    width: 90px;
  }

  .badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .badge.information {
    background: #dbeafe;
    color: #1e40af;
  }

  .badge.warning {
    background: #fef3c7;
    color: #92400e;
  }

  .badge.error {
    background: #fee2e2;
    color: #991b1b;
  }

  .badge.debug,
  .badge.trace {
    background: #f1f5f9;
    color: #475569;
  }
</style>
