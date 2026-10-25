/*
 * Classifies a path dropped onto the shell, ported from the Angular
 * shell-drop/archive-drop/icon-drop utils.
 *
 * An application (an executable, a shortcut, or a bare path) becomes an
 * application widget; the specialized archive extensions import whole
 * bundles. Anything else is not a drop the deck accepts.
 */

import type { ShellDroppedPath } from './shell-bridge';

export const droppedPathExtension = (path: string): string => {
  const name = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

export type ArchiveDropKind = 'profile' | 'folder' | 'widgets' | 'iconPack' | 'plugin';

export const ARCHIVE_DROP_EXTENSIONS: Readonly<Record<ArchiveDropKind, string>> = {
  profile: 'macrodeckprofile',
  folder: 'macrodeckfolder',
  widgets: 'macrodeckwidget',
  iconPack: 'macrodeckiconpack',
  plugin: 'macrodeckplugin',
};

export function archiveDropKind(path: string): ArchiveDropKind | null {
  const extension = droppedPathExtension(path);
  const match = Object.entries(ARCHIVE_DROP_EXTENSIONS).find(([, candidate]) => candidate === extension);
  return match ? (match[0] as ArchiveDropKind) : null;
}

export function acceptsArchiveDropPath(path: ShellDroppedPath, kinds: readonly ArchiveDropKind[]): boolean {
  if (path.directory) {
    return false;
  }

  const kind = archiveDropKind(path.path);
  return kind !== null && kinds.includes(kind);
}

export type ShellDropKind = ArchiveDropKind | 'application';

export function isApplicationDropPath(path: ShellDroppedPath): boolean {
  // Anything that is not a known archive opens with its default handler - an
  // executable, a shortcut, an image, a song, a folder - so the deck's drop
  // target treats every such path as the launch-button case.
  return archiveDropKind(path.path) === null;
}

export function shellDropKind(path: ShellDroppedPath): ShellDropKind | null {
  return isApplicationDropPath(path) ? 'application' : archiveDropKind(path.path);
}

export function acceptsShellDropPath(path: ShellDroppedPath, kinds: readonly ShellDropKind[]): boolean {
  if (isApplicationDropPath(path)) {
    return kinds.includes('application');
  }

  return acceptsArchiveDropPath(path, kinds.filter((kind): kind is ArchiveDropKind => kind !== 'application'));
}
