/*
 * UI sessions, ported from the Angular UiSessionService.
 *
 * A session is the host rendering a piece of UI for the client: a widget's
 * config form, a folder, a modal. The client opens a session (`Open*UiSession`),
 * attaches to it, and then receives the tree plus patches over the socket,
 * while sending node events back.
 *
 * The handle mirrors the Angular one: `root`/`revision`/`rejection`/`fault`/
 * `generation` are reactive getters over `$state` fields, so a Svelte
 * component can read them in a template and rerender on change. The reopen
 * budget, patch fallback to a fresh snapshot, and flush settlement are kept
 * as they are - they encode host behaviour, not Angular idioms.
 */

import {
  AppStrings,
  applyUiPatch,
  type FlushUiSessionRequest,
  type FlushUiSessionResponse,
  type OpenConfigUiSessionRequest,
  type OpenConfigUiSessionResponse,
  type OpenFolderUiSessionRequest,
  type OpenFolderUiSessionResponse,
  type OpenModalUiSessionRequest,
  type OpenModalUiSessionResponse,
  type OpenUiPreviewSessionRequest,
  type OpenUiPreviewSessionResponse,
  type OpenWidgetUiSessionRequest,
  type OpenWidgetUiSessionResponse,
  rootNodeOf,
  supportsUiModelVersion,
  type UiAttachSessionResponse,
  type UiNode,
  type UiNodeEvent,
  type UiPatch,
  type UiSendEventResponse,
  type UiSessionClosedEvent,
  type UiSessionFlushedEvent,
  type UiSessionInvalidatedEvent,
  type UiSessionParameterValuesReportedEvent,
  type UiSessionPatchedEvent,
  type UiSessionTreeUpdatedEvent,
} from '@macro-deck/runtime';
import { invokeResult, onNotificationOf } from './api.svelte';
import { translateKey } from './localization.svelte';
import { showToast } from './toasts.svelte';

export type UiSessionOpenRequest =
  | ({ kind: 'config' } & OpenConfigUiSessionRequest & { configUiModelVersion: number })
  | ({ kind: 'widget' } & OpenWidgetUiSessionRequest)
  | ({ kind: 'folder' } & OpenFolderUiSessionRequest)
  | ({ kind: 'modal' } & OpenModalUiSessionRequest)
  | ({ kind: 'preview' } & OpenUiPreviewSessionRequest);

export type UiSessionOpenRequestSource = UiSessionOpenRequest | (() => UiSessionOpenRequest);

export interface UiSessionHandle {
  readonly root: UiNode | null;
  readonly revision: number;
  readonly rejection: UiSessionRejection | null;
  readonly fault: UiSessionRejection | null;
  readonly generation: number;
  readonly reopenReason: string | null;
  send(event: UiNodeEvent): void;
  close(): void;
  // Synchronous rather than reactive: a save that awaited flush() reads the
  // store right after, before any effect would have run.
  onParameterValuesReported?(listener: (values: Readonly<Record<string, unknown>>) => void): () => void;
  flush?(): Promise<void>;
}

export interface UiSessionOpenOptions {
  notifyFault?: boolean;
}

export interface UiSessionRejection {
  code?: string;
  message?: string;
}

function isNegotiableVersion(version: number): boolean {
  return version > 0;
}

export function openUiSession(source: UiSessionOpenRequestSource, options: UiSessionOpenOptions = {}): UiSessionHandle {
  const request = typeof source === 'function' ? source() : source;
  if (request.kind === 'config' && isNegotiableVersion(request.configUiModelVersion)
    && !supportsUiModelVersion(request.configUiModelVersion)) {
    // Attaching and then falling back would burn one of the provider's few
    // session slots and briefly show an unrenderable tree - negotiation has to
    // happen before OpenConfigUiSession is ever called.
    return new NullUiSessionHandle();
  }

  return new LiveUiSessionHandle(
    request,
    typeof source === 'function' ? source : null,
    options.notifyFault ?? true,
  );
}

class NullUiSessionHandle implements UiSessionHandle {
  readonly root = null;
  readonly revision = 0;
  readonly rejection = null;
  readonly fault = null;
  readonly generation = 0;
  readonly reopenReason = null;

  send(): void {
    // No session was ever opened; nothing to send to.
  }

  close(): void {
    // No session was ever opened; nothing to close.
  }
}

const MAX_REOPENS_WITHOUT_A_TREE = 3;

let nextFlushId = 0;

type OpenResponse =
  | OpenConfigUiSessionResponse
  | OpenWidgetUiSessionResponse
  | OpenFolderUiSessionResponse
  | OpenModalUiSessionResponse
  | OpenUiPreviewSessionResponse;

class LiveUiSessionHandle implements UiSessionHandle {
  root = $state<UiNode | null>(null);
  revision = $state(0);
  rejection = $state<UiSessionRejection | null>(null);
  fault = $state<UiSessionRejection | null>(null);
  generation = $state(0);
  reopenReason = $state<string | null>(null);

  private sessionId: string | null = null;
  private closed = false;
  // Whether a closed/invalidated notification should surface to the user:
  // only once a tree was actually shown, and never for our own deliberate close().
  private hadTree = false;
  private unsubscribes: Array<() => void> = [];
  private reopens = 0;
  private readonly reportListeners = new Set<(values: Readonly<Record<string, unknown>>) => void>();
  private readonly pendingFlushes = new Map<string, () => void>();

  constructor(
    private request: UiSessionOpenRequest,
    private readonly nextRequest: (() => UiSessionOpenRequest) | null,
    private readonly notifyFault: boolean,
  ) {
    // Subscribed before the first realtime request goes out, so no
    // notification for this session can arrive and be missed while sessionId
    // is still unknown.
    this.unsubscribes = [
      onNotificationOf<UiSessionTreeUpdatedEvent>('UiSessionTreeUpdatedEvent', event => this.onTreeUpdated(event)),
      onNotificationOf<UiSessionPatchedEvent>('UiSessionPatchedEvent', event => this.onPatched(event)),
      onNotificationOf<UiSessionInvalidatedEvent>('UiSessionInvalidatedEvent', event => {
        if (event.sessionId !== this.sessionId) return;
        const rejection = { code: event.code, message: event.message };
        if (event.retryable) this.reopen(rejection);
        else this.onFaulted(rejection);
      }),
      onNotificationOf<UiSessionClosedEvent>('UiSessionClosedEvent', event => {
        if (event.sessionId === this.sessionId) this.onFaulted({ message: event.reason });
      }),
      onNotificationOf<UiSessionParameterValuesReportedEvent>('UiSessionParameterValuesReportedEvent', event => {
        this.onParameterValuesReportedEvent(event);
      }),
      onNotificationOf<UiSessionFlushedEvent>('UiSessionFlushedEvent', event => this.onFlushed(event)),
    ];

    void this.start();
  }

  send(event: UiNodeEvent): void {
    if (this.closed || !this.sessionId) return;
    void invokeResult<UiSendEventResponse>('SendUiEvent', {
      sessionId: this.sessionId,
      nodeId: event.nodeId,
      name: event.name,
      data: event.data,
      revision: this.revision,
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
    this.reportListeners.clear();
    this.settleFlushes();
    this.root = null;
    if (this.sessionId) {
      void invokeResult<boolean>('CloseUiSession', this.sessionId);
    }
  }

  onParameterValuesReported(listener: (values: Readonly<Record<string, unknown>>) => void): () => void {
    this.reportListeners.add(listener);
    return () => this.reportListeners.delete(listener);
  }

  flush(): Promise<void> {
    const sessionId = this.sessionId;
    if (this.closed || !sessionId) return Promise.resolve();

    const flushId = `flush-${++nextFlushId}`;
    return new Promise<void>(resolve => {
      this.pendingFlushes.set(flushId, resolve);
      void invokeResult<FlushUiSessionResponse>('FlushUiSession', {
        sessionId,
        flushId,
      } satisfies FlushUiSessionRequest).then(response => {
        // A host that predates flushing answers with an error, and a refused
        // flush has nothing queued.
        if (!response?.accepted) this.settleFlush(flushId);
      });
    });
  }

  private onParameterValuesReportedEvent(event: UiSessionParameterValuesReportedEvent): void {
    if (event.sessionId !== this.sessionId || this.closed || !event.values) return;
    for (const listener of [...this.reportListeners]) listener(event.values);
  }

  private onFlushed(event: UiSessionFlushedEvent): void {
    if (event.sessionId !== this.sessionId) return;
    this.settleFlush(event.flushId);
  }

  private settleFlush(flushId: string): void {
    const resolve = this.pendingFlushes.get(flushId);
    if (!resolve) return;
    this.pendingFlushes.delete(flushId);
    resolve();
  }

  private settleFlushes(): void {
    for (const resolve of this.pendingFlushes.values()) resolve();
    this.pendingFlushes.clear();
  }

  private async start(): Promise<void> {
    const opened = await this.openSession();
    if (this.closed) return;

    if (!opened?.accepted) {
      this.rejection = { code: opened?.code, message: opened?.message };
      return;
    }

    this.rejection = null;
    this.sessionId = opened.sessionId;
    this.generation++;
    await this.attach(true);
  }

  private openSession(): Promise<OpenResponse | null> {
    switch (this.request.kind) {
      case 'config': return invokeResult<OpenConfigUiSessionResponse>('OpenConfigUiSession', this.request);
      case 'widget': return invokeResult<OpenWidgetUiSessionResponse>('OpenWidgetUiSession', this.request);
      case 'folder': return invokeResult<OpenFolderUiSessionResponse>('OpenFolderUiSession', this.request);
      case 'modal': return invokeResult<OpenModalUiSessionResponse>('OpenModalUiSession', this.request);
      case 'preview': return invokeResult<OpenUiPreviewSessionResponse>('OpenUiPreviewSession', this.request);
    }
  }

  private async attach(first = false): Promise<void> {
    const sessionId = this.sessionId;
    if (this.closed || !sessionId) return;

    const attached = await invokeResult<UiAttachSessionResponse>('AttachUiSession', { sessionId });
    if (this.closed || this.sessionId !== sessionId || !attached) return;

    if (!attached.accepted) {
      // Only a first attach can learn of its session's end this way: the host
      // sends the terminal event to attached connections alone, so a refused
      // re-attach still gets that event and lets it decide.
      if (first) this.onFaulted({ code: attached.code, message: attached.message });
      return;
    }

    this.revision = attached.revision;
    // The tree itself arrives via a tree-updated notification pushed as a side
    // effect of attaching - attach is idempotent and always forces a fresh
    // snapshot, which is exactly what a patch that failed to apply needs.
  }

  private onTreeUpdated(event: UiSessionTreeUpdatedEvent): void {
    if (event.sessionId !== this.sessionId || this.closed) return;

    const root = rootNodeOf(event.tree);
    if (root === null) return;

    this.root = root;
    this.revision = event.revision;
    this.fault = null;
    this.hadTree = true;
    this.reopens = 0;
  }

  private onPatched(event: UiSessionPatchedEvent): void {
    if (event.sessionId !== this.sessionId || this.closed) return;

    const current = this.root;
    if (!current) return;

    const patch: UiPatch = {
      fromRevision: event.fromRevision,
      toRevision: event.toRevision,
      operations: (event.patch as { operations?: UiPatch['operations'] } | null)?.operations ?? [],
    };

    const next = applyUiPatch(current, this.revision, patch);
    if (next === null) {
      void this.attach();
      return;
    }

    this.root = next;
    this.revision = event.toRevision;
  }

  private reopen(rejection: UiSessionRejection): void {
    if (this.closed) return;

    if (this.reopens >= MAX_REOPENS_WITHOUT_A_TREE) {
      this.onFaulted(rejection);
      return;
    }

    this.reopens++;
    this.sessionId = null;
    this.settleFlushes();
    this.reopenReason = rejection.code ?? null;
    if (this.nextRequest) this.request = this.nextRequest();
    void this.start();
  }

  private onFaulted(rejection: UiSessionRejection = {}): void {
    if (this.closed) return;

    const wasShowingTree = this.hadTree && this.root !== null;
    this.settleFlushes();
    this.fault = rejection;
    this.root = null;
    if (!this.hadTree) this.rejection = rejection;

    if (wasShowingTree && this.request.kind === 'config' && this.notifyFault) {
      showToast(translateKey(AppStrings.ConfigUi.ViewUnavailable), { variant: 'error' });
    }
  }
}
