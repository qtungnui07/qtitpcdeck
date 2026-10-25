/*
 * Whether the update dialog is up.
 *
 * Kept apart from the settings dialog because an update can be offered while settings is already
 * open, and the two must not share a flag.
 */

let isOpen = $state(false);

export const updateModal = {
  get isOpen() {
    return isOpen;
  },
};

export function openUpdateModal(): void {
  isOpen = true;
}

export function closeUpdateModal(): void {
  isOpen = false;
}

export function resetUpdateModal(): void {
  isOpen = false;
}
