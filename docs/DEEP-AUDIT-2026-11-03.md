# XENO NIGHTMARE — deep audit 2026-11-03

Scope: 390px start / play / pause, plus source review of BGM, run reset and HUD. Read-only audit first; fixes tracked below.

## Findings

### 1. BGM still had noise percussion (high)
`NinjaAudio` used the kit `drive` preset, whose `playStep` adds a noise snare at steps 4/12 and noise hats. Same headphone hiss Roy rejected in the other CYBER games.

Fix: clone the preset with `hats: false`, and suppress `noiseHit` only inside the game's `playStep` override. Kick, tonal snare body, bass, pad and arp remain; SFX noise stays transient.

### 2. New run did not re-arm `ultReadyShown` (low)
`resetRun()` did not clear `S.ultReadyShown`. If a previous run ended with a charged ultimate, the next run's first full charge would not show the "ult ready" toast/audio. `resetRun()` now clears `ultReadyShown`, `ultBossHit`, `slashZ` and hides the slash beam.

## UI check
390px start / play / pause: title, start CTA, HUD panels, ult button (80×80 at the right, above pause/mute) and records fit; no horizontal overflow or console errors. Full smoke not run in this pass.

## Verification
- `node tests/waves.test.mjs` — ALL PASSED (waves 1–30)
- `node --test tests/audio.test.mjs` — 1/1 PASS
- `python tests/ult-reset.py` — PASS (state playing, ultReadyShown false, ult 0)
