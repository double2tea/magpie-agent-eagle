# Acceptance — 0.3.4

Recorded on 2026-11-11 (Asia/Shanghai).

Version 0.3.4 renames the Magpie plugin, Agent display name and Eagle companion
to `magpie-agent-eagle`. The Agent ID `eagle`, Eagle plugin ID
`zeezhi-magpie-bridge` and local data paths remain unchanged. Earlier live UI
records below use the names displayed by those versions; GUI rename acceptance
has not been repeated.

## Verified

- Magpie 0.1.3734 loads the local agent plugin; the Eagle entry and model picker
  were visible on its Agents page.
- 17 automated tests pass, with zero skips on a Mac with Eagle AI model suite
  1.0.0 installed. Tests use temporary configurations and a local model endpoint.
- Tests cover connection, switching, separate vision selection, following the
  language model, restart, restore, unrelated providers, manual changes, gateway
  failure, corrupt vision config on disconnect and paused edits.
- Simulated panel tests cover reloading a failed catalog, showing an unavailable
  saved model and disabling the selector while paused. The 0.3.3 regression test
  starts idle, then connects and verifies automatic catalog loading without
  re-sync; repeated connected reports do not reload it.
- An earlier live check using Node.js and the installed official Eagle SDK
  verified separate defaults, keeping vision when language changes, and restoring
  original provider settings/defaults. It did not upload media or run inference.
- Live Eagle renderer: the native vision dropdown lists Magpie's image-input
  models. Selecting “follow language” changes the official service's image
  default to `group/expert`; selecting `group/multimodal` changes it back.
  The panel, saved selection and official service readback agree.
- Closing the bridge window keeps its service running. Changing the language
  model via Magpie to `group/main` updates chat while image stays
  `group/multimodal`; the language choice was restored to `group/expert`.
- Eagle launches the bridge automatically as a service without opening its
  panel. With the vision default deliberately set to the language default
  before launch, the bridge restored the saved vision choice. A subsequent
  ordinary restart also preserved both defaults in the official readback.
- Configuration writes wait for SDK microtasks to flush. After apply/restore,
  the bridge refreshes the official service cache and verifies both defaults.
  A stale official readback fails validation instead of reporting connected.
- In v0.3.2, five additional consecutive full Eagle process restarts passed without
  clicking re-sync or changing settings. Each round verified the official
  HTTP defaults and a fresh SDK disk read before opening the bridge panel.
  The panel then showed connected, the saved dropdown selection and successful
  startup recovery. All five rounds exercised the targeted reset recovery.

  | Round | Time (Asia/Shanghai, 2026-11-11) | New Eagle PID | Chat | Image |
  | --- | --- | --- | --- | --- |
  | 1 | 19:38:48 | 84888 | group/expert | group/multimodal |
  | 2 | 19:40:07 | 85489 | group/expert | group/multimodal |
  | 3 | 19:41:06 | 86506 | group/expert | group/multimodal |
  | 4 | 19:42:23 | 87450 | group/expert | group/multimodal |
  | 5 | 19:43:18 | 87828 | group/expert | group/multimodal |
- Package checks compare archived runtime files against source and exclude
  dependencies, abandoned implementations, private runtime data and local-only
  live-check tooling.

## Pending / limitations

- **Startup recovery boundary:** intermittent cold-start visual-default overwrite.
  Local diagnostic traces show the official service receives
  `POST /api/default-model/image` selecting `group/expert` before bridge sync.
  Its installed settings-page component starts an async default read and,
  while local selection is still empty, also selects/persists the first
  available model. This ordering explains the observed intermittent overwrite;
  the trace does not independently identify the HTTP client's process.
  Waiting for service health alone did not resolve this. Startup recovery now
  handles the specific case where only the image default equals the prior chat
  default and the connection signature remains unchanged. It cannot distinguish
  that pattern from an identical manual change made before startup; such a
  change will also be reversed. Other mismatches remain conflicts.
- The deliberately simulated reset, its subsequent ordinary restart and five
  further consecutive restarts passed. This establishes the tested local
  restart behavior, not reliability across every machine or startup timing.
- No official SDK or settings-page modifications are included in this package.
  Temporary local instrumentation was removed and original files restored.
- Login and operating-system restart remain untested.
- End-to-end inference, model quality, third-party plugin cache refresh and
  behavior of AI Action, audio, video and image generation.
- SDK write methods come from the installed model suite and have no public,
  stable configuration contract. This release targets version 1.0.0.
- Magpie's agent row confirms connection-file state, not whether Eagle applied
  it. Consult the Eagle bridge panel.
- This release uses one Magpie agent entry. Vision selection is a dropdown in
  the Eagle bridge, populated from Magpie, rather than a second Magpie selector.

## Review fixes in 0.3.1

- Corrupt vision configuration no longer prevents disconnect restoration.
- Re-sync refreshes the model catalog after an initial failure.
- An unavailable current model remains visible instead of appearing blank.
- A paused bridge rejects visual-model edits and disables the selector.
- A failed apply is not reported connected solely because its old signature
  matches. Catalog requests time out and validate the response shape.

本方案已优先最短路径 + 未添加未要求兜底/扩展。
