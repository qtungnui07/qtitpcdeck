# qtitpcdeck

qtitpcdeck is my own rework of a macro-style deck for the desktop: widgets on a
grid that you press from a phone or from the admin UI, actions that launch apps
and scripts, and a phone client that connects over Wi-Fi.

This project is a **fork of [Macro Deck 3](https://github.com/Macro-Deck-App/Macro-Deck)**
(`Macro-Deck-App/Macro-Deck`, Apache-2.0), heavily reworked under the qtitpc
brand: most of the original product surface was removed or rebuilt, and the
development focus is a private, self-hosted deck for my own machines.

The companion phone client lives in
[qtitpcdeck-client](https://github.com/qtungnui07/qtitpcdeck-client)
(itself forked from `Macro-Deck-App/Macro-Deck-Client-App`).

## What is different from upstream

- The configuration UI (`/admin`) is a Svelte 5 rewrite with a Nord theme; the
  Angular build is kept only as a fallback for tooling.
- Dropping any file onto the deck creates a widget that opens it with its
  default handler - executables and shortcuts, but also images, songs,
  documents and folders.
- The phone client pairs once and stays connected (device credential plus a
  persisted refresh cookie, auto-connect on launch, grid re-lays out on
  rotation).
- Rebranded throughout (qtitpcdeck), library overview trimmed, and a small set
  of UX and bug fixes across deck rendering, sessions and auth.

## Layout

| Path        | What it is                                            |
| ----------- | ----------------------------------------------------- |
| `host/`     | .NET host: deck engine, sessions, API, integrations   |
| `ui/svelte` | The new desktop admin UI (Svelte 5 + Vite)            |
| `ui/runtime`| Framework-free widget renderer shared with the client |
| `ui/bootstrapper` | Tauri tray shell + NSIS/MSI packaging           |
| `sdk/`      | Plugin SDK an external plugin builds against          |
| `protocol/` | UI session protocol types                             |

## Building

Windows development loop:

```sh
make host-svelte   # host on :5191/:7193 with the Svelte admin at /admin
```

Packages:

```sh
ci/scripts/stage-host.sh win-x64 0.1.0 Production
cd ui/bootstrapper
MACRODECK_BUILD_CHANNEL=Production npx tauri build \
  --config release.conf.json --config version-override.json \
  --config unsigned-local.conf.json
```

Produces `qtitpcdeck_<version>_x64-setup.exe` under
`ui/bootstrapper/target/release/bundle/nsis/`.

## License

Apache-2.0, as upstream. Substantial portions (c) the Macro Deck authors; see
`NOTICE` and `THIRD-PARTY-NOTICES`.
