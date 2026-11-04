# XENO NIGHTMARE 異域凶間 — Handoff

Status: **web build v1.3 mission/progression/combat-FX pass** · live https://fung2222.github.io/cyber-ninja/ · not yet packaged for Android.
2026-11-05: three-page craft → weapon → mission/difficulty flow, sequential level unlocks, per-level clears/best scores, ten chapter-specific boss attack families, vent-safe ultimate controls, six-level lance/nova visuals, lightning and multi-ring ultimates.
2026-11-04: full-width loadout redesign, real recorded max-power weapon previews, three difficulty modes, 10×5 campaign and 50 map fingerprints, outline-only dark-enemy readability, boss bullet/bloom tuning, ultimate-during-OVERDRIVE.
2026-11-03 core pass: three-weapon system + per-weapon ultimates + OVERDRIVE; authored wave formations, aimed enemy fire, map laser hazards, three-phase bosses, dynamic boss music. Earlier deep pass: [`docs/DEEP-AUDIT-2026-11-03.md`](DEEP-AUDIT-2026-11-03.md).
Series rules: `fung2222/cyber-arcade/docs/ARCADE-HANDOFF.md`. Concept only from SONO's canvas shooter; everything here is new code.

## 1. Design
- Vertical shooter seen from a high chase camera: the pilot rides a hover-glider above a neon megacity that scrolls far below (haze layer keeps gameplay readable), side towers give parallax, speed streaks.
- **Relative drag** anywhere moves the craft (finger never covers it), keyboard alternative. **Auto-fire** always on.
- **Airframes & hangar (three pages)**: the home screen is unchanged (brand + LAUNCH + records). Page 1 (`#screen-hangar`) is the full-width rotating 3D craft preview. Page 2 (`#screen-weapon`) uses `#weapon-video` real LV.6 + OVERDRIVE + ultimate recordings, rich stats, six-level tree and per-level visual-effect notes; it contains no difficulty controls. Page 3 (`#screen-mission`) has ten chapter tabs, five level cards, difficulty and the actual launch button. `normalizeProgress` / `recordLevel` in campaign.js validate local records; a clear unlocks only the next sortie. Cards show locked/available/cleared, clear count and per-level best (score delta from `levelStartScore`, not cumulative run score). `selWave` drives resetRun/start banners. Store keys: `craft`, `startWeapon`, `difficulty`, `missionProgress` (`{unlocked, records}`). Desktop uses wide layouts; phone mission content scrolls while launch stays fixed. Airframes: FALCON speed +14%, BASTION 4 shields + regen, WRAITH +28% dmg/+40% charge/+1s OD but 2 base shields.
- **i18n note**: cyber-kit `i18n.add()` flattens nested tables into [zh, en] pairs and **destroys nested objects** — use dotted flat keys (`techDesc.pulse`, registered as `"techDesc.pulse": [zh, en]`), never `techDesc: { pulse: [...] }`.
- **Enemy/obstacle readability**: dark-metal enemies (drone, turret, dasher) carry three whitened, slightly scaled additive **line-only** edge passes (`whiteOutline` in js/entities.js) so HIGH bloom creates a glowing silhouette without filling the hull; colourful bodies (weaver/splitter/mite) are untouched. Drifting rocks stay near-black with amber `EdgesGeometry` lines only (no under-glow).
- **Three weapons × six levels** (`js/weapons.js`): PULSE REPEATER (spread), PHASE LANCE (piercing line), NOVA SURGE (AoE). **W** canisters only drop from elites and bosses; they do **not** magnetise, and switching also raises that weapon by one level. **P** raises the current level.
- **Per-weapon ultimate** on Space / blue button: BULLET STORM (180° forward fan), PRISM PIERCE (wide lane beam + four satellite beams + procedural chain lightning), SINGULARITY (expanding nova + five rotating corona rings + meteor particles). The craft is invulnerable while active. Lance levels change bolt tint/width/length, linked decorative rails and forked lightning; nova levels add linked concentric rings and particles. Decorative pools follow real bullets but never add damage/collision. `weapons.js` numbers are unchanged.
- **OVERDRIVE** on Q / orange button: ascends the current weapon for 4 s (effective level +2, faster and stronger), then forces a **3 s normal-fire cease-fire**. A charged weapon ultimate can interrupt active OVERDRIVE and also fire during venting (`doUlt()` rejects neither `odT >= 0` nor `noFireT > 0`). The vent spinner is clipped inside the orange OD button; the separate blue ultimate remains hittable. OD cannot be started during an ultimate or venting.
- Enemies arrive in authored formations (`line`, `pincer`, `wall`, `crossfire`, `rush`, `weave`, `elite`), fire aimed patterns (drones single, weavers 3-way, turrets 5-way, elites denser), and scale speed/HP with the wave. Telegraphed **laser lanes** cut one lane of the map every 8–13 s.
- **Gems** are gold/white crystals (deliberately not magenta like enemy bullets or cyan like player shots); they wait 0.55 s, then spiral-home into the craft. Counts scale with enemy tier/level (boss burst 18–32). Gems add score plus a small amount of ultimate/OVERDRIVE charge.
- **Map**: drifting asteroids (`makeRock`) plus telegraphed laser lanes; both force lateral movement beyond the enemy waves.
- **Campaign & maps**: `js/campaign.js` defines 10 bilingual story chapters × 5 sorties. Waves/levels 1–50 map to CH.01-1…CH.10-5, with a boss at every stage 5; level 51 unlocks endless. Every one of the 50 entries has a unique map fingerprint. `World.setMission()` applies chapter theme/district plus per-level city grid, road width/glow, deterministic tower layout, ruins scale/turn/floor rotation, rail width, fog and hazard/rock cadence. The HUD mission line and chapter banners read `S.mission`.
- **Difficulty**: `DIFFICULTIES` in config.js scales enemy/boss HP, hostile bullet speed, enemy/boss fire rate, bonus shields, post-hit invulnerability, drops and score. Story has +2 shields and the lowest pressure; Normal is the gentler default; Nightmare pays 1.5× score. Wave 1 has six drones (not seven), wave 2 has a smaller pincer, early enemies approach/fire later, and terrain cadence also respects mission/difficulty.
- **HUD**: HP, weapon name/level/charge, score, campaign mission label, level and pause/mute are in the top strip. OVERDRIVE and weapon ultimate are stacked at the lower-left.
- **Full-field movement**: `FIELD.playerMinZ = -21`, so the craft can fly from the bottom to the top of the play field.
- **Boss every 5 waves — ten attack grammars**: `fireBossPattern()` reads `S.mission.chapter`. CH1 aimed fans/gap sweep; CH2 twin spirals; CH3 diagonal crossfire; CH4 mirrored wing bursts; CH5 gapped rings/snipers; CH6 telegraphed ruin lanes/scatter; CH7 layered petals; CH8 multi-arm/counter-rotating spirals; CH9 radial/aimed bursts with limited homing; CH10 hybrids switch by phase. All retain three HP phases at 66% / 33%, readable magenta shells/white cores and controlled bloom. Armour unfolds at phase 2 and the core opens in phase 3.
- Base shields are 2/3/4 by airframe; Story adds 2. A hit costs a shield + 1 power level, grants difficulty-based invulnerability and clears nearby bullets. Shield pickups top up automatically; there is no manual shield key. The two action buttons sit in a compact vertical dock at the lower left; pause/mute are labelled at the top right.
- Game over → **continue once** via rewarded hook (full shields, ult charged) or retry.
- Attract mode = the AI flies behind the start screen (invulnerable). `?demo=1` = the AI plays real runs on a loop.

## 2. Controls
Drag · arrows/WASD · Space/Enter/X/J weapon ultimate · Q/O OVERDRIVE · P/Esc pause · M mute · Enter retry on game over. Android back: dialog → pause → resume; game over → menu.

## 3. Tuning (`js/config.js` / `js/weapons.js`)
| Constant | Value |
|---|---|
| `FIELD` | halfW 6, top −24, bottom 3.2, player z −21…2.4 |
| `PLAYER` | radius 0.42, base hp/max 3; run max = airframe hp + difficulty bonus; dragGain 1.35, keySpeed 11 |
| `DIFFICULTIES` | Story: HP ×0.78, bullet speed ×0.72, fire rate ×0.62, +2 shields, 2.2 s invulnerability, drops ×1.5, score ×0.8; Normal: ×0.9 / ×0.86 / ×0.82 / +0 / 1.85 s / ×1.2 / ×1; Nightmare: enemy HP ×1.12 (boss ×1.1), bullet speed ×1.02, fire rate ×1.08, 1.45 s invulnerability, drops ×0.9, score ×1.5 |
| `WEAPONS` | 3 weapons × 6 levels; pulse 1→5 shots, lance pierce 2→7, nova AoE 2.2→3.8 |
| `WEAPON_ULT` | pulse 2.2 s, lance 1.3 s, nova 2.0 s |
| `OD` | duration 4 s, no-fire 3 s, +3.5/kill, +18/weapon pickup, +20/E |
| `ULT` | +5/kill, +0.15/boss hit (legacy constants; weapon ults use their own charge) |
| `ENEMIES` | drone 4hp/5.6spd · weaver 5/4.4 · turret 11/3.0 · dasher 4/4.2 · boss 240 |
| `ENEMY_BULLET_SPEED` / `BOSS_EVERY` / `DROP_CHANCE` | 9.0 / 5 / 0.11 |
| `waveSpec(n)` | authored recipes: line, pincer, wall, crossfire, rush, weave, elite; no turret before wave 3 |
| `speedScale` / `hpScale` | +5 %/wave (max +85 %) / +40 % HP per 5 waves (capped ×3.2) |
| `bossHp(n)` | 240 + 90 per cycle, capped at 1100 |
| `bossVariant(c)` | 6 species, then Mk.N variants; attack-rate ×(1+0.06(c−1)) capped at 1.6 |
| `boss phases` | 66 % / 33 % HP; ten chapter-specific drivers, final-boss hybrids |
| `hazard` | lane sweep every 8–13 s, 1.1 s warning then 1 s active |
| `gems` | gold/white crystals; tier 0/1/2 = 8/18/40 score; 0.55 s then spiral-home; boss burst 18–32 |
| `rocks` | drifting asteroids every 8–13 s; collision damage; scales 0.75–1.45 |
| `W` drops | elite 65 %, boss 1 guaranteed; no magnet; +1 level on pickup |
| `MILESTONE_EVERY` / `milestoneBonus(n)` | 10 waves / 5000 × (n/10) |
| `ADS` | interstitial cooldown 200 s, every 3rd game over, 150 s grace |

## 3b. Campaign transition, endless mode & i18n (v1.2)
- Levels 1–50 are the campaign; level 51 unlocks endless play. `campaignForWave(51+)` returns `campaign:false` and reuses deterministic map fingerprints while `waveSpec`/`bossHp`/`bossVariant` continue with capped scaling curves. Best level = endless record (`store bestWave`, shown on the start screen).
- Test hook: `__ninja.api.wave(n)` jumps to level n; `__ninja.api.difficulty(key)` selects Story/Normal/Nightmare.
- Strings: `js/strings.js` (`{key: [zh-HK, en]}` via cyber-kit v0.3.19 i18n). HTML uses `data-i18n*`; dynamic banners use `t()`. Language lives in the gear settings sheet; pause also has `#btn-lang2`. Language persists in `localStorage cyber.lang`; `?lang=en|zh` forces.

## 4. File map
```
index.html       HUD, craft / weapon / mission screens, level and difficulty selectors
css/game.css     responsive HUD + three-page loadout/mission layouts + safe action dock
assets/          three 4 s real-gameplay WebM previews + JPEG posters
js/config.js     difficulty table + constants + authored waveSpec (pure, unit-tested)
js/campaign.js   10×5 campaign/maps + validated sequential progression and per-level records
js/weapons.js    weapon table, level curves, OVERDRIVE solution, pickups
js/world.js      sky dome, scrolling megacity shader, mission map variations, towers, ruins, lights
js/entities.js   craft, line-only dark-enemy outlines, enemies, boss, bullet pools, pickups
js/audio.js      NinjaAudio (cyber-kit SynthAudio, 'drive' music)
js/main.js       states, input, combat simulation, campaign/difficulty wiring, real-video previews, ult/OVERDRIVE, ads hooks
vendor/cyber-kit cyber-kit v0.3.19
tests/           Node unit tests + browser combat/layout suites + record-previews.py
```
Test hook: `window.__ninja` (state, x, z, score, wave, hp, weapon, power, ult, od, boss, hazards, difficulty, mission; `api.wave/weapon/charge/ult/overdrive/drop/kill/boss/spawn/enemyFire/hazard/bossHurt/difficulty`). Additional guards: `api.progress()` returns validated level records; `api.fx()` returns lance/nova decoration, lightning, beam and corona-ring counts; `api.threat()` includes `bossChapter` / `bossPattern`.

## 5. Tests
`node --test tests/` · `python tests/weapons.py [url]` · `python tests/core.py [url]` · `python tests/ult-reset.py [url]` · `python tests/brand.py [url]` · `python tests/smoke.py [url] [out|none] [all|mobile|desktop]` — three-page navigation, locked levels, clear/best records, six visual densities per lance/nova, ultimate FX, vent-safe touch target, ten boss families, campaign/endless, real-video switching, movement/pause/gameover/demo/language and zero console errors. Browser waits follow game state rather than wall-clock frame counts under SwiftShader. Last run 2026-11-05: **10 Node tests PASS; weapons/core/ult-reset/brand PASS; complete mobile and desktop smoke suites PASS; all three refreshed 4 s WebM clips decode PASS; mobile/desktop mission layouts inspected with no horizontal overflow; zero console errors**.

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
