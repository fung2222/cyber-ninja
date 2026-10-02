# CYBER NINJA 賽博忍者：星海魔獸 — Handoff

Status: **web build done (v1.0)** · live https://fung2222.github.io/cyber-ninja/ · not yet packaged for Android.
Series rules: `fung2222/cyber-arcade/docs/ARCADE-HANDOFF.md`. Concept only from SONO's canvas shooter; everything here is new code.

## 1. Design
- Vertical shooter seen from a high chase camera: the ninja rides a hover-glider above a neon megacity that scrolls far below (haze layer keeps gameplay readable), side towers give parallax, speed streaks.
- **Relative drag** anywhere moves the ninja (finger never covers it), keyboard alternative. **Auto-fire** always on; power 1–5 widens the volley.
- **Ultimate 霓虹居合斬 NEON IAI SLASH**: meter from kills (+5 each) / boss hits / E pickups. A slash wave sweeps bottom→top: clears all enemy bullets, kills every normal enemy it passes, 28 damage to the boss, slow-mo + flash.
- Enemies: drone (sway), weaver (sine), turret (stops, aimed shots; triple shot after wave 6), dasher (locks on, charges). Speed and HP scale with the wave.
- **Boss every 5 waves — the cosmic monster** (eye-orb with orbiting crystal spikes and tentacles, original design): ring burst → twin spiral → aimed 5-way fan, rage below 40 % HP. Drops P/S/E on death; the zone colour theme changes.
- 3 shields (max 5); a hit costs a shield + 1 power level, 1.6 s invulnerability, nearby bullets cleared (fair).
- Game over → **continue once** via rewarded hook (full shields, ult charged) or retry.
- Attract mode = the AI flies behind the start screen (invulnerable). `?demo=1` = the AI plays real runs on a loop.

## 2. Controls
Drag · arrows/WASD · Space/Enter/X/J ult · P/Esc pause · M mute · Enter retry on game over. Android back: dialog → pause → resume; game over → menu.

## 3. Tuning (`js/config.js`)
| Constant | Value |
|---|---|
| `FIELD` | halfW 6, top −24, bottom 3.2, player z −8…2.4 |
| `PLAYER` | radius 0.42, hp 3/max 5, invuln 1.6 s, dragGain 1.15, keySpeed 11, fireRate 0.12 s, boltSpeed 30 |
| `VOLLEYS` | 1…5 bolts per power level |
| `ULT` | +5 per kill, +0.15 per boss hit, 28 boss damage, 0.6 s sweep |
| `ENEMIES` | drone 2hp/50 · weaver 3/80 · turret 7/150 · dasher 2/120 · boss 160+90 per cycle/3000×cycle |
| `ENEMY_BULLET_SPEED` / `BOSS_EVERY` / `DROP_CHANCE` | 7.5 / 5 / 0.09 |
| `waveSpec(n)` | groups = min(4+0.8n, 12); types unlock at waves 1/2/3/4; formations line / V / column / scatter |
| `speedScale` / `hpScale` | +4 %/wave (max +60 %) / +50 % HP per 5 waves |
| `ADS` | interstitial cooldown 200 s, every 3rd game over, 150 s grace |

## 4. File map
```
index.html       HUD (score, wave, shield pips, power, boss bar, ult button), start / pause / over screens
css/game.css     HUD layout
js/config.js     constants + waveSpec (pure, unit-tested)
js/world.js      sky dome (stars + nebula), scrolling megacity shader, haze, instanced side towers, speed streaks, lights
js/entities.js   ninja model + scarf ribbon, enemy models (neon edge wireframes), boss, instanced bullet pools, pickups
js/audio.js      NinjaAudio (cyber-kit SynthAudio, 'drive' music)
js/main.js       states, relative drag input, simulation (movement, fire, waves, AI patterns, collisions), ult, camera, ads hooks
vendor/cyber-kit cyber-kit v0.1.0
tests/           waves.test.mjs, smoke.py
```
Test hook: `window.__ninja` (state, x, z, score, wave, hp, ult, boss, `api.ult/kill/boss`).

## 5. Tests
`node tests/waves.test.mjs` · `python tests/smoke.py [url] [out]` — 412×915 touch + 1280×800: start, drag, keyboard, auto-fire kills, ultimate, boss wave, pause/resume, game over, continue, demo, zero console errors. Last run 2026-10-02: ALL PASSED.

## 6. Android packaging
As DATA FUSE (Capacitor 8 + `@capacitor-community/admob` v8; app id suggestion `hk.fung2222.cyberninja`; lock portrait).

## 7. Ad placements
| Placement | Type | Code | Rule |
|---|---|---|---|
| `gameover` | interstitial | `retry()` / `overToMenu()` → `ads.naturalBreak('gameover')` | only after the player taps Retry/Menu; capped; never at launch or wave start |
| `continue` | rewarded | `revive()` | opt-in, once per run |

## 8. Known issues / ideas
- Headless SwiftShader ≈ 3 FPS, so tests wait on game state instead of wall time; phones run 60 FPS with auto-quality.
- Ideas: more boss species per cycle, weapon types (homing kunai), haptics intensity setting.
