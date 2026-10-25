<script lang="ts">
  /*
   * The QR code and pairing code of the connect link, ported from the Angular
   * ConnectQrComponent.
   *
   * It mints a FRESH pairing code for every mount, so each place that shows
   * one replaces the code another place showed before (the host keeps a single
   * active code). The QR encodes the connect link the companion apps' readers
   * parse; the code underneath is the fallback for a camera that cannot read
   * it. The timer ticks the countdown and polls, so a code the host rotated
   * (or one another window consumed) replaces itself.
   */
  import { onDestroy } from 'svelte';
  import { toDataURL } from 'qrcode';
  import { AppStrings, type GetConnectionInfoResponse, type PairingCodeResponse } from '@macro-deck/runtime';
  import { translateKey } from '$lib/localization.svelte';
  import { connectionEndpoints } from '$lib/endpoints';
  import { encodeConnectLink } from '$lib/connect-link';

  interface Props {
    info: GetConnectionInfoResponse;
    hint?: string | null;
  }

  let { info, hint = translateKey(AppStrings.Shell.ConnectionPanel.ScanHint) }: Props = $props();

  const PAIRING_POLL_SECONDS = 5;

  let qrDataUrl = $state<string | null>(null);
  let pairingCode = $state<PairingCodeResponse | null>(null);
  let now = $state(Date.now());
  let generation = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const groupedPairingCode = $derived.by(() => {
    const code = pairingCode?.code;
    return code ? `${code.slice(0, 3)} ${code.slice(3)}` : null;
  });

  const pairingCodeRemaining = $derived.by(() => {
    const expiresAt = pairingCode?.expiresAt;
    const seconds = expiresAt ? Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000)) : 0;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });

  async function start(current: GetConnectionInfoResponse): Promise<void> {
    stopPairingTimer();
    const currentGeneration = ++generation;
    const code = await connectionEndpoints.rotatePairingCode().catch(() => null);
    if (currentGeneration !== generation) {
      return;
    }

    await showPairingCode(current, code);
    if (code && currentGeneration === generation) {
      startPairingTimer();
    }
  }

  function startPairingTimer(): void {
    stopPairingTimer();
    let ticks = 0;
    timer = setInterval(() => {
      now = Date.now();
      const expired = Date.parse(pairingCode?.expiresAt ?? '') <= Date.now();
      ticks += 1;
      if (ticks % PAIRING_POLL_SECONDS === 0 || expired) {
        void pollPairingCode();
      }
    }, 1000);
  }

  function stopPairingTimer(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  async function pollPairingCode(): Promise<void> {
    const currentGeneration = generation;
    try {
      const code = await connectionEndpoints.getPairingCode();
      if (currentGeneration !== generation) {
        return;
      }

      if (code.code !== pairingCode?.code || code.expiresAt !== pairingCode?.expiresAt) {
        await showPairingCode(info, code);
      }
    } catch {
      if (currentGeneration === generation) {
        stopPairingTimer();
        await showPairingCode(info, null);
      }
    }
  }

  async function showPairingCode(current: GetConnectionInfoResponse, code: PairingCodeResponse | null): Promise<void> {
    now = Date.now();
    pairingCode = code;
    qrDataUrl = await toDataURL(encodeConnectLink(current, code?.code ?? ''), { margin: 1, width: 220, errorCorrectionLevel: 'L' });
  }

  // The info prop changes whenever the panel reloads it; each new info mints a
  // fresh code, exactly like the Angular effect did.
  $effect(() => {
    void info;
    void start(info);
  });

  onDestroy(() => {
    generation += 1;
    stopPairingTimer();
  });
</script>

{#if qrDataUrl !== null}
  <div class="cq-qr">
    <img src={qrDataUrl} alt={translateKey(AppStrings.Shell.ConnectionPanel.QrAlt)} width="180" height="180" />
    {#if hint}
      <span class="cq-qr-hint">{hint}</span>
    {/if}
  </div>
{/if}

{#if groupedPairingCode !== null}
  <div class="cq-section">
    <span class="cq-label">{translateKey(AppStrings.Shell.ConnectionPanel.PairingCode)}</span>
    <span class="cq-pairing-code">{groupedPairingCode}</span>
    <span class="cq-expiry">
      {translateKey(AppStrings.Shell.ConnectionPanel.PairingCodeExpiresIn, { time: pairingCodeRemaining })}
    </span>
  </div>
{/if}

<style>
  .cq-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .cq-qr img {
    border-radius: var(--radius-md, 6px);
    background: #fff;
    padding: 4px;
  }

  .cq-qr-hint {
    color: var(--color-text-secondary);
    font-size: var(--text-sm, 0.875rem);
    text-align: center;
  }

  .cq-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: var(--space-3, 0.75rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
  }

  .cq-label {
    color: var(--color-text-secondary);
    font-size: var(--text-xs, 0.75rem);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .cq-pairing-code {
    font-family: var(--font-mono);
    font-size: var(--text-xl, 1.25rem);
    font-weight: var(--font-semibold, 600);
    letter-spacing: 0.12em;
    color: var(--color-text-primary);
  }

  .cq-expiry {
    color: var(--color-text-muted);
    font-size: var(--text-xs, 0.75rem);
  }
</style>
