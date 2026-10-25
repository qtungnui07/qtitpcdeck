/*
 * Widget-archive import state, ported from the Angular ArchiveImportSession
 * in its path role (shell drops carry paths, not File objects).
 *
 * Inspect first - the host describes the archive (kind, counts, whether it is
 * encrypted) - then the preview modal confirms; the import runs with the
 * password when the host asks for one, and separates "needs a password" from
 * "the password was wrong" the way the Angular mapping did.
 */

import type { ArchiveSummary, IpcWidget } from '@macro-deck/runtime';
import { archiveEndpoints } from './endpoints';

export type ImportOutcome =
  | { status: 'success'; widgets: IpcWidget[] }
  | { status: 'passwordRequired' }
  | { status: 'invalidPassword' }
  | { status: 'error'; message: string };

let summary = $state<ArchiveSummary | null>(null);
let passwordVisible = $state(false);
let passwordInvalid = $state(false);
let error = $state<string | null>(null);
let sourcePath: string | null = null;

export const archiveImport = {
  get summary(): ArchiveSummary | null {
    return summary;
  },
  get passwordVisible(): boolean {
    return passwordVisible;
  },
  get passwordInvalid(): boolean {
    return passwordInvalid;
  },
  get error(): string | null {
    return error;
  },
};

export async function beginArchiveImport(path: string): Promise<void> {
  resetArchiveImport();
  try {
    const response = await archiveEndpoints.inspectPath({ path });
    if (!response.success || !response.archive) {
      error = response.error?.message ?? 'The archive could not be read.';
      return;
    }
    sourcePath = path;
    summary = response.archive;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'The archive could not be read.';
  }
}

export async function confirmArchiveImport(folderId: string, x: number, y: number): Promise<IpcWidget[] | null> {
  summary = null;
  return executeImport(folderId, x, y, undefined);
}

export async function submitArchivePassword(folderId: string, x: number, y: number, password: string): Promise<IpcWidget[] | null> {
  passwordVisible = false;
  return executeImport(folderId, x, y, password);
}

export function cancelArchiveImport(): void {
  resetArchiveImport();
}

export function dismissArchiveError(): void {
  error = null;
}

async function executeImport(
  folderId: string,
  x: number,
  y: number,
  password: string | undefined,
): Promise<IpcWidget[] | null> {
  const path = sourcePath;
  if (path === null) return null;

  try {
    const response = await archiveEndpoints.importWidgetsFromPath({
      folderId,
      anchorX: x,
      anchorY: y,
      path,
      password,
    });

    if (response.success) {
      sourcePath = null;
      return response.widgets ?? [];
    }

    if (response.error?.code === 'PasswordRequired') {
      passwordInvalid = false;
      passwordVisible = true;
      return null;
    }
    if (response.error?.code === 'InvalidPassword') {
      passwordInvalid = true;
      passwordVisible = true;
      return null;
    }

    sourcePath = null;
    error = response.error?.message ?? 'The archive could not be imported.';
    return null;
  } catch (cause) {
    sourcePath = null;
    error = cause instanceof Error ? cause.message : 'The archive could not be imported.';
    return null;
  }
}

function resetArchiveImport(): void {
  sourcePath = null;
  summary = null;
  passwordVisible = false;
  passwordInvalid = false;
  error = null;
}
