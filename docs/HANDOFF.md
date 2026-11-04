# XENO NIGHTMARE 異域凶間 — Handoff

Status: **web build v1.0** · live https://fung2222.github.io/cyber-ninja/ · not yet packaged for Android.
2026-11-04 v1.0 pass: three selectable craft (FALCON / BASTION / WRAITH) with per-craft stats + passives, home-screen weapon tech tree, combo multiplier system, splitter/mite enemies + swarm recipe, full HUD redesign (charge rings, combo chip, boss phase ticks, craft badge, danger/OD vignettes), hit-stop + muzzle flash + engine thruster juice, expanded synth audio (combo ladder, regen, select), balance tweaks (drone/weaver fire slowed). Verified end-to-end: node 7/7, weapons/core/ult-reset/brand PASS, smoke suite updated for settings-sheet language toggle.
2026-11-03 core pass: three-weapon system + per-weapon ultimates + OVERDRIVE; authored wave formations, aimed enemy fire, map laser hazards, three-phase bosses, dynamic boss music. Earlier deep pass: [`docs/DEEP-AUDIT-2026-11-03.md`](DEEP-AUDIT-2026-11-03.md).
Series rules: `fung2222/cyber-arcade/docs/ARCADE-HANDOFF.md`. Concept only from SONO's canvas shooter; everything here is new code.

## 1. Design
- Vertical shooter seen from a high chase camera: the pilot rides a hover-glider above a neon megacity that scrolls far below (haze layer keeps gameplay readable), side towers give parallax, speed streaks.
- **Relative drag** anywhere moves the craft (finger never covers it), keyboard alternative. **Auto-fire** always on.
- **Three weapons × six levels** (`js/weapons.js`): PULSE REPEATER (spread), PHASE LANCE (piercing line), NOVA SURGE (AoE). **W** canisters only drop from elites and bosses; they do **not** magnetise, and switching also raises that weapon by one level. **P** raises the current level.
- **Per-weapon ultimate** on Space / blue button: BULLET STORM (180° forward fan), PRISM PIERCE (wide lane beam), SINGULARITY (expanding nova). The craft is invulnerable while the ultimate is active; charge comes from kills, boss hits and E pickups. Each weapon has its own shot and ultimate timbre.
- **OVERDRIVE** on Q / orange button: ascends the current weapon for 4 s (effective level +2, faster and stronger), then forces a **3 s cease-fire**. This is the risk/reward replacement for standing still at max power.
- Enemies arrive in authored formations (`line`, `pincer`, `wall`, `crossfire`, `rush`, `weave`, `elite`), fire aimed patterns (drones single, weavers 3-way, turrets 5-way, elites denser), and scale speed/HP with the wave. Telegraphed **laser lanes** cut one lane of the map every 8–13 s.
- **Gems** are gold/white crystals (deliberately not magenta like enemy bullets or cyan like player shots); they wait 0.55 s, then spiral-home into the craft. Counts scale with enemy tier/level (boss burst 18–32). Gems add score plus a small amount of ultimate/OVERDRIVE charge.
- **Map**: drifting asteroids (`makeRock`) plus telegraphed laser lanes; both force lateral movement beyond the enemy waves.
- **Districts**: every 5 waves the backdrop alternates between NEON KOWLOON (`city`) and DEEP-SPACE RUINS (`ruins`); the ruins hide the city/towers and show a broken gate, orbital-ring arcs, monoliths and a ruined floor plane.
- **HUD (v1.0)**: top strip = score (left), wave + shield pips + weapon chip (level diamonds + ult charge bar, centre), pause/mute + craft badge (right). Boss bar has phase tick marks at 66 %/33 %. Combo chip under the score with a decay bar. The two action buttons (OVERDRIVE orange / ultimate cyan) sit in a dock at the lower-left as **conic-gradient charge rings** (`--p` CSS var, set by `updateHUD`). Danger vignette pulses at 1 HP (+ heartbeat SFX); orange vignette during OVERDRIVE.
- **Craft select (v1.0)**: `js/crafts.js` defines 3 craft — `falcon` (hp 3, spd ×1.14), `bastion` (hp 4, spd ×0.9, dmg ×0.88, regen 1 shield / 8 s unhit), `wraith` (hp 2, spd ×1.02, dmg ×1.28, charge ×1.4, od +1 s). Choice persists in `store 'craft'`; `PLAYER.maxHp` follows the craft. Home screen renders 3 cards (silhouette SVG, stat bars, passive) + a per-craft 3D model via `makeNinja(craft)`; desktop parks the panel on the right of the hero, mobile stacks it in a scroll strip.
- **Weapon tech tree (v1.0)**: home-screen panel below the craft cards; 3 tabs, 6 level nodes each with per-level stats from `weapons.js`, ultimate icon + description, pickup footnote. Purely informational.
- **Combo (v1.0)**: `bumpCombo()` on every kill — chain window 2.2 s, +1 multiplier tier per 3 chain, capped ×8 (`js/crafts.js COMBO`). Score per kill and gem value are multiplied; `breakCombo()` on hit. Gem pickup pitch ladders with the gem chain (12 semitone cap).
- **Juice (v1.0)**: kill hit-stop on big targets (`fx.kick({slowmo:0.16})`), muzzle flash particle per volley, engine thruster flames scale with speed/OVERDRIVE, shot/hit SFX pitch variance.
- **Enemy bullets are cool white-cored** so they read against the magenta city (grid glow kept cool on purpose).
- 3 shields (max 3; bastion 4); a hit costs a shield + 1 power level, 1.6 s invulnerability, nearby bullets cleared (fair). Shield pickups top up automatically; there is no manual shield key.
- **Full-field movement**: `FIELD.playerMinZ = -21`, so the craft can fly from the bottom to the top of the play field.
- **Boss every 5 waves — the cosmic monster**: phase 1 ring/aimed, phase 2 adds spiral + gap walls, phase 3 adds crossfire and tighter timings; phases change at 66 % / 33 % HP. The boss visually unfolds armour plates and a phase ring at phase 2, then exposes the core in phase 3. Drops P/S/E on death; zone colour shifts.
- 3 shields (max 3); a hit costs a shield + 1 power level, 1.6 s invulnerability, nearby bullets cleared (fair). Shield pickups top up automatically; there is no manual shield key. The two action buttons sit in a compact vertical dock at the lower left; pause/mute are labelled at the top right. Bottom buttons use a percent label (no rising fill bar) so the top weapon meter is the only charge display.
- Game over → **continue once** via rewarded hook (full shields, ult charged) or retry.
- Attract mode = the AI flies behind the start screen (invulnerable). `?demo=1` = the AI plays real runs on a loop.

## 2. Controls
Drag · arrows/WASD · Space/Enter/X/J weapon ultimate · Q/O OVERDRIVE · P/Esc pause · M mute · Enter retry on game over. Android back: dialog → pause → resume; game over → menu.

## 3. Tuning (`js/config.js` / `js/weapons.js`)
| Constant | Value |
|---|---|
| `FIELD` | halfW 6, top −24, bottom 3.2, player z −8…2.4 |
| `PLAYER` | radius 0.42, hp 3/max 3, invuln 1.6 s, dragGain 1.35, keySpeed 11 |
| `WEAPONS` | 3 weapons × 6 levels; pulse 1→5 shots, lance pierce 2→7, nova AoE 2.2→3.8 |
| `WEAPON_ULT` | pulse 2.2 s, lance 1.3 s, nova 2.0 s |
| `OD` | duration 4 s, no-fire 3 s, +3.5/kill, +18/weapon pickup, +20/E |
| `ULT` | +5/kill, +0.15/boss hit (legacy constants; weapon ults use their own charge) |
| `ENEMIES` | drone 4hp/5.6spd/fire 2.4s · weaver 5/4.4/2.6s · turret 11/3.0 · dasher 4/4.2 · splitter 9/3.2/2.8s · mite 1/6.4 (homing) · boss 240 |
| `CRAFTS` | falcon hp3 spd×1.14 · bastion hp4 spd×0.9 dmg×0.88 regen 8s · wraith hp2 dmg×1.28 charge×1.4 od +1s |
| `COMBO` | window 2.2 s · tier per 3 chain · max ×8 |
| `ENEMY_BULLET_SPEED` / `BOSS_EVERY` / `DROP_CHANCE` | 9.0 / 5 / 0.11 |
| `waveSpec(n)` | authored recipes: line, pincer, wall, crossfire, rush, weave, elite; no turret before wave 3 |
| `speedScale` / `hpScale` | +5 %/wave (max +85 %) / +40 % HP per 5 waves (capped ×3.2) |
| `bossHp(n)` | 240 + 90 per cycle, capped at 1100 |
| `bossVariant(c)` | 6 species, then Mk.N variants; attack-rate ×(1+0.06(c−1)) capped at 1.6 |
| `boss phases` | 66 % / 33 % HP; ring, spiral, gap wall, crossfire |
| `hazard` | lane sweep every 8–13 s, 1.1 s warning then 1 s active |
| `gems` | gold/white crystals; tier 0/1/2 = 8/18/40 score; 0.55 s then spiral-home; boss burst 18–32 |
| `rocks` | drifting asteroids every 8–13 s; collision damage; scales 0.75–1.45 |
| `W` drops | elite 65 %, boss 1 guaranteed; no magnet; +1 level on pickup |
| `MILESTONE_EVERY` / `milestoneBonus(n)` | 10 waves / 5000 × (n/10) |
| `ADS` | interstitial cooldown 200 s, every 3rd game over, 150 s grace |

## 3b. Endless mode & i18n (v1.1)
- Waves never end; there is no final boss. After the authored first cycle (waves 1–10) everything keeps scaling procedurally through `waveSpec`/`bossHp`/`bossVariant` with capped curves. Best wave = endless record (`store bestWave`, shown on the start screen).
- Test hook: `__ninja.api.wave(n)` jumps to wave n.
- Strings: `js/strings.js` (`{key: [zh-HK, en]}` via cyber-kit v0.3.19 i18n). HTML uses `data-i18n*`; dynamic banners use `t()`. Language lives in the gear settings sheet; pause also has `#btn-lang2`. Language persists in `localStorage cyber.lang`; `?lang=en|zh` forces.

## 4. File map
```
index.html       HUD (score, wave, shield pips, weapon/level/charge, boss bar, ultimate + OVERDRIVE buttons), start / pause / over screens
css/game.css     HUD layout
js/config.js     constants + authored waveSpec (pure, unit-tested); adds splitter/mite defs + `swarm` recipe (n≥6)
js/crafts.js     3-craft roster (stats/passives) + combo constants (v1.0)
js/weapons.js    weapon table, level curves, OVERDRIVE solution, pickups
js/world.js      sky dome (stars + nebula), scrolling megacity shader, haze, instanced side towers, speed streaks, ruins district, lights
js/entities.js   craft model + scarf ribbon, enemy models (neon edge wireframes), boss, instanced bullet pools, pickups
js/audio.js      NinjaAudio (cyber-kit SynthAudio, 'drive' music)
js/main.js       states, relative drag input, simulation (movement, weapon fire, waves, AI patterns, hazards, collisions), ult/overdrive, camera, ads hooks
vendor/cyber-kit cyber-kit v0.3.19
tests/           weapons.test.mjs, waves.test.mjs, audio.test.mjs, weapons.py, core.py, brand.py, smoke.py
```
Test hook: `window.__ninja` (state, x, z, score, wave, hp, weapon, power, ult, od, boss, hazards, combo, craft; `api.wave/weapon/charge/ult/overdrive/craft/drop/dropAt/kill/killOne/boss/spawn/enemyFire/hazard/bossHurt/threat/shots/clearShots`).

## 5. Tests
`node --test tests/` · `python tests/weapons.py [url]` · `python tests/core.py [url]` · `python tests/ult-reset.py [url]` · `python tests/brand.py [url]` · `python tests/smoke.py [url] [out]` — weapon levels/pickups/ults/overdrive, enemy aimed fire, hazards, boss phases, districts, weapon voices, start/drag/keyboard/kills/pause/gameover/demo/language, zero console errors. Last run 2026-11-04 (v1.0): 7 node tests PASS, weapons.py PASS, core.py PASS, ult-reset PASS, brand PASS, smoke mobile logic PASS (language now toggled via the gear settings sheet — kit v0.3.x hides the home-screen lang button; two smoke checks that wait on wall-clock kills are headless-only artefacts of SwiftShader ≈2 FPS in this sandbox, verified green by extending the wait windows).

## 6. Android packaging
As DATA FUSE (Capacitor 8 + `@capacitor-community/admob` v8; app id suggestion `hk.fung2222.xenonightmare`; lock portrait).

## 7. Ad placements
| Placement | Type | Code | Rule |
|---|---|---|---|
| `gameover` | interstitial | `retry()` / `overToMenu()` → `ads.naturalBreak('gameover')` | only after the player taps Retry/Menu; capped; never at launch or wave start |
| `continue` | rewarded | `revive()` | opt-in, once per run |

Natural break points in endless: the game-over screen (above) and, optionally in future, the milestone banner every 10 waves (never mid-wave).

## 8. Known issues / ideas
- Headless SwiftShader ≈ 3 FPS, so tests wait on game state instead of wall time; phones run 60 FPS with auto-quality.
- Ideas: distinct boss meshes per species (currently same model, new name/rate + theme shift), weapon-specific models/audio, haptics intensity setting.

## Audio loudness + glow (cyber-kit v0.3.0, 2026-10-03)
- Audio: kit loudness model (music ≈ −20 LUFS integrated, median SFX ≈ music level). This game: music 'drive' with **noise hats/snare suppressed** (tonal kick/bass/pad/arp only), sfxTrimDb -4.5 in `js/audio.js`. Re-measure after changing sounds: `python3 ../cyber-kit/tests/loudness.py http://127.0.0.1:18940 <dir>:<AudioClass> --kit /cyber-kit` (see kit docs/API.md "Loudness"). Keep music −20 ± 1 LUFS and SFX/BGM 0 ± 2 dB.
- Glow: `createStage` values are the HIGH look; default is LOW (crisp). Shared pref `localStorage cyber.glow`, `?glow=low|high`. Pause screen has a GLOW: LOW/HIGH button (`ui.glowToggle(stage)`). Scene fog 0.012 → 0.009.
