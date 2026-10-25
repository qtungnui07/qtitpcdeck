/*
 * Tests for the modal components.
 *
 * The two behaviours worth pinning down are the ones a rewrite silently loses: a click only closes
 * the dialog when the press started on the overlay, and a dialog ignores overlay clicks for its
 * first 300ms so a double-click that opened it does not immediately close it again.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Modal from './Modal.svelte';
import ConfirmDialog from './ConfirmDialog.svelte';
import NoticeDialog from './NoticeDialog.svelte';
import AnnouncementDialog from './AnnouncementDialog.svelte';
import { resetModalStack } from '../modal-stack';
import { resetPopoverLayer } from '../popover-layer';
import { startLocalization, stopLocalization } from '../localization.svelte';

function overlay(): HTMLElement {
  const element = document.querySelector('.modal-overlay');
  if (element === null) throw new Error('no overlay rendered');
  return element as HTMLElement;
}

function dialog(): HTMLElement {
  const element = document.querySelector('.modal-dialog');
  if (element === null) throw new Error('no dialog rendered');
  return element as HTMLElement;
}

beforeEach(() => {
  startLocalization();
});

afterEach(() => {
  cleanup();
  resetModalStack();
  resetPopoverLayer();
  stopLocalization();
  vi.useRealTimers();
});

describe('Modal', () => {
  it('renders the heading', () => {
    render(Modal, { heading: 'Delete widget' });
    expect(screen.getByText('Delete widget')).toBeTruthy();
  });

  it('hides the header when asked', () => {
    render(Modal, { heading: 'Hidden', showHeader: false });
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('hides the close button when asked', () => {
    render(Modal, { heading: 'No close', showClose: false });
    expect(document.querySelector('.modal-close-btn')).toBeNull();
  });

  it('labels the close button from the localization catalog', () => {
    render(Modal, { heading: 'Close me' });
    expect(document.querySelector('.modal-close-btn')?.getAttribute('aria-label')).toBe('Close');
  });

  it('closes from the close button', async () => {
    const onclose = vi.fn();
    render(Modal, { heading: 'Close me', onclose });

    await fireEvent.click(document.querySelector('.modal-close-btn') as HTMLElement);
    await vi.waitFor(() => expect(onclose).toHaveBeenCalledOnce());
  });

  it('applies the size class and width', () => {
    render(Modal, { heading: 'Large', size: 'large' });

    expect(dialog().classList.contains('modal-size-large')).toBe(true);
    expect(dialog().style.maxWidth).toBe('1100px');
  });

  it('falls back to the explicit max width without a size', () => {
    render(Modal, { heading: 'Custom', maxWidth: '30rem' });
    expect(dialog().style.maxWidth).toBe('30rem');
  });

  it('marks the dialog as a modal for assistive technology', () => {
    render(Modal, { heading: 'Accessible' });

    expect(dialog().getAttribute('role')).toBe('dialog');
    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(dialog().getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('drops the label reference when the header is hidden', () => {
    render(Modal, { heading: 'No header', showHeader: false });
    expect(dialog().getAttribute('aria-labelledby')).toBeNull();
  });

  it('ignores an overlay click inside the open grace period', async () => {
    const onclose = vi.fn();
    render(Modal, { heading: 'Fresh', onclose });

    await fireEvent.pointerDown(overlay());
    await fireEvent.click(overlay());

    expect(onclose).not.toHaveBeenCalled();
  });

  it('closes on an overlay click after the grace period', async () => {
    const onclose = vi.fn();
    render(Modal, { heading: 'Settled', onclose });

    await new Promise(resolve => setTimeout(resolve, 320));
    await fireEvent.pointerDown(overlay());
    await fireEvent.click(overlay());

    await vi.waitFor(() => expect(onclose).toHaveBeenCalledOnce());
  });

  it('ignores a click that started inside the dialog', async () => {
    const onclose = vi.fn();
    render(Modal, { heading: 'Drag', onclose });

    await new Promise(resolve => setTimeout(resolve, 320));
    await fireEvent.pointerDown(dialog());
    await fireEvent.click(overlay());

    expect(onclose).not.toHaveBeenCalled();
  });

  it('ignores an overlay click when closing on overlay is off', async () => {
    const onclose = vi.fn();
    render(Modal, { heading: 'Pinned', closeOnOverlay: false, onclose });

    await new Promise(resolve => setTimeout(resolve, 320));
    await fireEvent.pointerDown(overlay());
    await fireEvent.click(overlay());

    expect(onclose).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const onclose = vi.fn();
    render(Modal, { heading: 'Escape', onclose });

    await fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(onclose).toHaveBeenCalledOnce());
  });

  it('ignores Escape when closing on overlay is off', async () => {
    const onclose = vi.fn();
    render(Modal, { heading: 'Pinned', closeOnOverlay: false, onclose });

    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(onclose).not.toHaveBeenCalled();
  });

  it('ignores Escape when it is not the topmost modal', async () => {
    const onOuterClose = vi.fn();
    render(Modal, { heading: 'Outer', onclose: onOuterClose });
    render(Modal, { heading: 'Inner' });

    await fireEvent.keyDown(document, { key: 'Escape' });
    await tick();

    expect(onOuterClose).not.toHaveBeenCalled();
  });

  it('lets the topmost modal close on Escape', async () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    render(Modal, { heading: 'Outer', onclose: onOuterClose });
    render(Modal, { heading: 'Inner', onclose: onInnerClose });

    await fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(onInnerClose).toHaveBeenCalledOnce());

    expect(onOuterClose).not.toHaveBeenCalled();
  });

  it('renders the footer snippet only when the footer is shown', () => {
    render(Modal, { heading: 'Footer', showFooter: false });
    expect(document.querySelector('.modal-footer')).toBeNull();
  });
});

describe('ConfirmDialog', () => {
  it('renders the message', () => {
    render(ConfirmDialog, { heading: 'Sure?', message: 'This cannot be undone.' });
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
  });

  it('confirms', async () => {
    const onconfirm = vi.fn();
    render(ConfirmDialog, { heading: 'Sure?', message: 'Go?', onconfirm });

    await fireEvent.click(screen.getByText('Confirm'));
    await vi.waitFor(() => expect(onconfirm).toHaveBeenCalledOnce());
  });

  it('cancels', async () => {
    const oncancel = vi.fn();
    render(ConfirmDialog, { heading: 'Sure?', message: 'Go?', oncancel });

    await fireEvent.click(screen.getByText('Cancel'));
    await vi.waitFor(() => expect(oncancel).toHaveBeenCalledOnce());
  });

  it('offers a third answer when given one', async () => {
    const onalt = vi.fn();
    render(ConfirmDialog, { heading: 'Save?', message: 'Unsaved changes.', altText: 'Discard', onalt });

    await fireEvent.click(screen.getByText('Discard'));
    await vi.waitFor(() => expect(onalt).toHaveBeenCalledOnce());
  });

  it('widens the dialog for a third answer', () => {
    render(ConfirmDialog, { heading: 'Save?', message: 'Unsaved.', altText: 'Discard' });
    expect(dialog().style.maxWidth).toBe('min(92vw, 46rem)');
  });

  it('keeps the default width without a third answer', () => {
    render(ConfirmDialog, { heading: 'Sure?', message: 'Go?' });
    expect(dialog().style.maxWidth).toBe('450px');
  });

  it('uses the danger variant when asked', () => {
    render(ConfirmDialog, { heading: 'Delete?', message: 'Gone.', danger: true });
    expect(screen.getByText('Confirm').classList.contains('sb-danger')).toBe(true);
  });

  it('cancels when the dialog is dismissed', async () => {
    const oncancel = vi.fn();
    render(ConfirmDialog, { heading: 'Sure?', message: 'Go?', oncancel });

    await fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(oncancel).toHaveBeenCalledOnce());
  });
});

describe('NoticeDialog', () => {
  it('renders the message', () => {
    render(NoticeDialog, { heading: 'Heads up', message: 'Something happened.' });
    expect(screen.getByText('Something happened.')).toBeTruthy();
  });

  it('reports that it was not suppressed', async () => {
    const onclosed = vi.fn();
    render(NoticeDialog, { heading: 'Heads up', message: 'Hi', onclosed });

    await fireEvent.click(screen.getByText('Got it'));
    await vi.waitFor(() => expect(onclosed).toHaveBeenCalledWith(false));
  });

  it('reports that it was suppressed', async () => {
    const onclosed = vi.fn();
    render(NoticeDialog, { heading: 'Heads up', message: 'Hi', onclosed });

    await fireEvent.click(document.querySelector('.cb-box') as HTMLElement);
    await fireEvent.click(screen.getByText('Got it'));

    await vi.waitFor(() => expect(onclosed).toHaveBeenCalledWith(true));
  });

  it('hides the suppression checkbox when asked', () => {
    render(NoticeDialog, { heading: 'Heads up', message: 'Hi', showDontShowAgain: false });
    expect(document.querySelector('.cb-box')).toBeNull();
  });
});

describe('AnnouncementDialog', () => {
  it('renders the title and body', () => {
    render(AnnouncementDialog, { title: 'Version 4 is here', content: 'Lots of changes.' });

    expect(screen.getByText('Version 4 is here')).toBeTruthy();
    expect(screen.getByText('Lots of changes.')).toBeTruthy();
  });

  it('shows the publication date when given one', () => {
    render(AnnouncementDialog, {
      title: 'Version 4',
      content: 'Notes.',
      publishedAt: '2026-03-04T10:00:00Z',
    });

    expect(document.querySelector('.whats-new-modal__meta')?.textContent).toContain('2026');
  });

  it('omits the date when it is missing', () => {
    render(AnnouncementDialog, { title: 'Version 4', content: 'Notes.' });
    expect(document.querySelector('.whats-new-modal__meta')).toBeNull();
  });

  it('omits an unparseable date', () => {
    render(AnnouncementDialog, { title: 'Version 4', content: 'Notes.', publishedAt: 'not a date' });
    expect(document.querySelector('.whats-new-modal__meta')).toBeNull();
  });

  it('dismisses', async () => {
    const ondismiss = vi.fn();
    render(AnnouncementDialog, { title: 'Version 4', content: 'Notes.', ondismiss });

    await fireEvent.click(screen.getByText('Got it'));
    await vi.waitFor(() => expect(ondismiss).toHaveBeenCalledOnce());
  });
});
