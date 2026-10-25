/*
 * Connection info for the shell's connection panel, ported from the Angular
 * ConnectionPanelComponent's load logic: a fresh GET when the panel opens,
 * generation-guarded so a slow response cannot overwrite a newer load.
 */

import type { ConnectionEndpoint, GetConnectionInfoResponse } from '@macro-deck/runtime';
import { connectionEndpoints } from './endpoints';

export interface AddressGroup {
  address: string;
  endpoints: ConnectionEndpoint[];
}

let info = $state<GetConnectionInfoResponse | null>(null);
let loading = $state(true);
let loadGeneration = 0;

export const connectionInfo = {
  get info(): GetConnectionInfoResponse | null {
    return info;
  },
  get loading(): boolean {
    return loading;
  },
};

export function groupEndpoints(endpoints: readonly ConnectionEndpoint[]): AddressGroup[] {
  const groups: AddressGroup[] = [];
  for (const endpoint of endpoints) {
    const existing = groups.find((group) => group.address === endpoint.address);
    if (existing) {
      existing.endpoints.push(endpoint);
    } else {
      groups.push({ address: endpoint.address, endpoints: [endpoint] });
    }
  }
  return groups;
}

export async function loadConnectionInfo(): Promise<void> {
  loading = true;
  const generation = ++loadGeneration;

  try {
    const response = await connectionEndpoints.info();
    if (generation === loadGeneration) {
      info = response;
    }
  } catch {
    if (generation === loadGeneration) {
      info = null;
    }
  } finally {
    if (generation === loadGeneration) {
      loading = false;
    }
  }
}

export function resetConnectionInfo(): void {
  loadGeneration++;
  info = null;
  loading = true;
}
