# Acceptance — 0.3.1

Recorded on 2026-11-11 (Asia/Shanghai).

## Verified

- Magpie 0.1.3734 loads the local agent plugin; the Eagle entry and model picker
  were visible on its Agents page.
- 13 automated tests pass, with zero skips on a Mac with Eagle AI model suite
  1.0.0 installed. Tests use temporary configurations and a local model endpoint.
- Tests cover connection, switching, separate vision selection, following the
  language model, restart, restore, unrelated providers, manual changes, gateway
  failure, corrupt vision config on disconnect and paused edits.
- Simulated panel tests cover reloading a failed catalog, showing an unavailable
  saved model and disabling the selector while paused.
- An earlier live check using Node.js and the installed official Eagle SDK
  verified separate defaults, keeping vision when language changes, and restoring
  original provider settings/defaults. It did not upload media or run inference.
- A user screenshot confirms that the earlier text-input bridge panel runs in
  Eagle. This is not acceptance evidence for the newer dropdown.
- Package checks compare archived runtime files against source and exclude
  dependencies, abandoned implementations, private runtime data and local-only
  live-check tooling.

## Pending / limitations

- Current dropdown rendering and selection in a live Eagle renderer.
- Background operation after closing the window, login and system restart.
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
