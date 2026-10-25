/*
 * Tests for the modal stack.
 *
 * The stack is what makes Escape close one dialog rather than all of them, so these tests are
 * mostly about ordering: the last one opened is the only one that answers.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  closeModal,
  isAnyModalOpen,
  isTopmostModal,
  openModal,
  openModalCount,
  resetModalStack,
} from './modal-stack';

afterEach(() => {
  resetModalStack();
});

describe('modal stack', () => {
  it('starts empty', () => {
    expect(openModalCount()).toBe(0);
    expect(isAnyModalOpen()).toBe(false);
  });

  it('counts an opened modal', () => {
    openModal();
    expect(openModalCount()).toBe(1);
    expect(isAnyModalOpen()).toBe(true);
  });

  it('makes the only modal topmost', () => {
    const token = openModal();
    expect(isTopmostModal(token)).toBe(true);
  });

  it('makes the last opened modal topmost', () => {
    const first = openModal();
    const second = openModal();

    expect(isTopmostModal(second)).toBe(true);
    expect(isTopmostModal(first)).toBe(false);
  });

  it('hands the top back when the topmost closes', () => {
    const first = openModal();
    const second = openModal();

    closeModal(second);

    expect(isTopmostModal(first)).toBe(true);
    expect(openModalCount()).toBe(1);
  });

  it('ignores closing a modal that is not open', () => {
    const token = openModal();
    closeModal(Symbol('never opened'));

    expect(openModalCount()).toBe(1);
    expect(isTopmostModal(token)).toBe(true);
  });

  it('ignores closing the same modal twice', () => {
    const first = openModal();
    const second = openModal();

    closeModal(second);
    closeModal(second);

    expect(openModalCount()).toBe(1);
    expect(isTopmostModal(first)).toBe(true);
  });

  it('reports nothing open once every modal closes', () => {
    const first = openModal();
    const second = openModal();

    closeModal(first);
    closeModal(second);

    expect(isAnyModalOpen()).toBe(false);
    expect(openModalCount()).toBe(0);
  });

  it('gives every modal a distinct token', () => {
    const tokens = new Set([openModal(), openModal(), openModal()]);
    expect(tokens.size).toBe(3);
  });

  it('treats a token from a reset stack as not topmost', () => {
    const token = openModal();
    resetModalStack();

    expect(isTopmostModal(token)).toBe(false);
  });
});
