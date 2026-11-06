# XENO NIGHTMARE 異域凶間 — Handoff

Status: **web build v1.5 unified chapters + weapon balance** · live https://fung2222.github.io/cyber-ninja/ · not yet packaged for Android.
2026-11-05 v1.5: numeric cooldowns inside both skill balls; one-page weapon briefing; touch-scrollable chapter rail; one five-stage entry per chapter; Story → Normal → Nightmare unlocks; JSON-backed chapter/difficulty records; pulse homing missiles, non-piercing lance drones and impact-detonating nova with every-tenth-shot large blast.
2026-11-05 v1.4: three distinct reference-inspired procedural aircraft—FALCON swept-wing twin-engine fighter, BASTION armored four-engine gunship, WRAITH stealth flying wing—with layered metallic panels, canopies, intakes, neon circuits, animated holographic arcs, fading energy flames and new selector silhouettes. Airframe stats/passives, weapons, campaign and home flow are unchanged.
2026-11-05: three-page craft → weapon → mission/difficulty flow, sequential level unlocks, per-level clears/best scores, ten chapter-specific boss attack families, vent-safe ultimate controls, six-level lance/nova visuals, lightning and multi-ring ultimates.
2026-11-04: full-width loadout redesign, real recorded max-power weapon previews, three difficulty modes, 10×5 campaign and 50 map fingerprints, outline-only dark-enemy readability, boss bullet/bloom tuning, ultimate-during-OVERDRIVE.
2026-11-03 core pass: three-weapon system + per-weapon ultimates + OVERDRIVE; authored wave formations, aimed enemy fire, map laser hazards, three-phase bosses, dynamic boss music. Earlier deep pass: [`docs/DEEP-AUDIT-2026-11-03.md`](DEEP-AUDIT-2026-11-03.md).
Series rules: `fung2222/cyber-arcade/docs/ARCADE-HANDOFF.md`. Concept only from SONO's canvas shooter; everything here is new code.

## 1. Design
- Vertical shooter seen from a high chase camera: a cyberpunk combat aircraft flies above a neon megacity that scrolls far below (haze layer keeps gameplay readable), side towers give parallax, speed streaks.
- **Relative drag** anywhere moves the craft (finger never covers it), keyboard alternative. **Auto-fire** always on.
- **2026-11-05 QA pass (ChatGPT static review follow-up)**: `KIT_VERSION` in the vendored kit now matches the deployed `?v=0.3.22` (README/HANDOFF synced); `tests/hub-params.py` proves the hub contract (`hub=1`, `tier`, `ads=0|1`, `trial`, `trialLeft`, same-origin `ret`, cross-origin `ret` rejected, home navigation); `tests/balance.test.mjs` adds a DPS profile so PULSE stays the sustained-DPS leader while NOVA/LANCE buy area/pierce. Known edge: `?hub=1` with no `?ret` and no usable history leaves the home button a no-op (the real hub launch always has history).
- **2026-11-05 skill recovery (Roy)**: 超載/OVERDRIVE no longer charges from kills or pickups — it is a fixed **8 s cooldown** from activation (`OD.cooldown`, `S.odCd`), counted down in the button and shared by the 4 s ascend + 3 s cease-fire window. The weapon ultimate keeps the **charge meter (%)**. Buttons show only a hollow ring + label + readout (no dark disc, no water fill, no conic wedge).
- **2026-11-05 pass (Roy feedback)**:
  - Cooldown UI: `.cd-fill` inside `#btn-ult` / `#btn-od` drains as a water level (`--cool` %), with a large numeric countdown (22px ult / 17px OD). The buttons stay the topmost hit target (`elementFromPoint` = the button), so a cooldown never reads as "covered".
  - Balance: nova L1 dmg 4.2 (one-shots a chapter-1 drone), L6 7.2; lance 2.0–2.9; pulse homing unchanged. `hpScale` is now smooth per wave (`1 + (n-1)*0.045`, cap 3.2) instead of a +40% cliff every 5 waves. Guard: `tests/balance.test.mjs`.
  - Pickups are 3D silhouettes: `H` repair medkit (new, +2 HP; converts to energy at full HP), `S` extruded shield, `E` lightning bolt, `P` chevrons, and weapon canisters show their own shape (pulse arrows / lance needle+fins / nova ring+core). Weapon canisters expire after 10 s with a 2 s blink.
  - Continuous campaign: a chapter clear records the chapter, heals, and rolls into the next chapter; only chapter 10 ends the run.
  - Save point: JSON `resume` `{chapter, difficulty}` is written on launch, on chapter transitions, on quit and on pagehide/visibilitychange; `quickStart()` prefers it and always restarts that chapter at stage 1.
  - Layout: the weapon tech tree sits lower in its column (34px diamonds on phones); the mission page adds a five-stage strip (`#chapter-stages`) so the middle band carries information instead of blank space.
- **Airframes & hangar (three pages)**: the home screen is brand + LAUNCH + LOADOUT + records. START is one-tap: `quickStart()` reads JSON `lastLoadout` (`{craft, weapon, chapter, difficulty}`), validates it against `missionProgress` (falls back to the three pages when nothing valid is stored), and calls `startSelectedMission()`; the first-ever launch still opens page 1. `btn-loadout` always opens the pages. `startSelectedMission()` writes `lastLoadout`. Page 1 (`#screen-hangar`) is the full-width rotating 3D craft preview. Page 2 (`#screen-weapon`) uses `#weapon-video` real LV.6 + OVERDRIVE + ultimate recordings, compact stats, one LV.3 mechanic summary, ultimate and six-level tree; long descriptions and pickup help were removed, and the phone layout needs no scrolling. Page 3 (`#screen-mission`) has ten horizontally swipeable chapter tabs (`data-scroll` is required because cyber-kit otherwise cancels touchmove), one large `#chapter-entry`, difficulty and launch. Each entry starts at stage 1 and plays five stages consecutively; `finishChapter()` records the full-run score and shows a success result instead of rolling directly into another chapter. `normalizeProgress`, `recordLevel`, `recordChapter`, `isChapterUnlocked` and `isDifficultyUnlocked` validate/migrate local data. Store keys: `craft`, `startWeapon`, `difficulty`, JSON `lastLoadout`, and JSON `missionProgress` (`{unlocked, records, chapters}`). **Use `store.getJSON/setJSON`, not get/set**, for the progress object. A chapter clear opens the next chapter; each chapter's Story clear opens Normal and Normal clear opens Nightmare. Each difficulty stores its own best/clears; failed attempts can set a best but not a clear. Desktop uses wide layouts; phone launch stays fixed. Airframes: FALCON speed +14%, BASTION 4 shields + regen, WRAITH +28% dmg/+40% charge/+1s OD but 2 base shields.
- **Airframe modeling (`js/aircraft.js`)**: `makeNinja()` builds three original procedural Three.js geometries with forward −Z / up +Y. FALCON has a pointed single-seat fuselage, swept wings, canards, twin canted tails and two engines; BASTION has a broad deep hull, layered shoulder armor, four gun barrels and four engines; WRAITH is a thin blended flying wing with flush canopy and embedded twin engines. Shared helpers generate extruded armor plates, panel strips, circuits, metallic materials, nozzles, shader-faded flames and rotating holographic arcs. `updateNinja()` animates banking, hover, every engine and arc without per-frame vector allocations; `disposeNinja()` releases replaced preview/combat geometries and materials while retaining the shared unit box. `entities.js` re-exports the model API; combat stats remain only in `crafts.js`. Preview scale is 1.42, gameplay scales are FALCON 1.22 / BASTION 1.15 / WRAITH 1.12 to preserve fit and readability; the collision radius stays 0.42.
- **i18n note**: cyber-kit `i18n.add()` flattens nested tables into [zh, en] pairs and **destroys nested objects** — use dotted flat keys (`techDesc.pulse`, registered as `"techDesc.pulse": [zh, en]`), never `techDesc: { pulse: [...] }`.
- **Enemy/obstacle readability**: dark-metal enemies (drone, turret, dasher) carry three whitened, slightly scaled additive **line-only** edge passes (`whiteOutline` in js/entities.js) so HIGH bloom creates a glowing silhouette without filling the hull; colourful bodies (weaver/splitter/mite) are untouched. Drifting rocks stay near-black with amber `EdgesGeometry` lines only (no under-glow).
- **Three weapons × six levels** (`js/weapons.js`): PULSE main bolts are straight and stronger (1.15→1.8); LV.3+ fires two homing explosive missiles per volley. PHASE LANCE retains pierce 2→7 but main damage falls to 1.65→2.7; LV.3+ deploys two visible drones whose pool bolts deal 42% solution damage with `pierce:0`. NOVA has `pierce:0`, direct impact plus 62% splash in a 1.5→2.4 radius; LV.3+ every tenth shot gets 2.15× radius, 1.3× damage and `novaBig`. Counters/test hooks: `homingShots`, `droneShots`, `novaShots`, `novaBigShots`. **W** canisters only drop from elites and bosses; they do **not** magnetise, and switching also raises that weapon by one level. **P** raises the current level.
- **Per-weapon ultimate** on Space / blue button: BULLET STORM (180° forward fan), PRISM PIERCE (wide lane beam + four satellite beams + procedural chain lightning), SINGULARITY (expanding nova + five rotating corona rings + meteor particles). The craft is invulnerable while active. Lance levels change bolt tint/width/length, linked decorative rails and forked lightning; nova levels add linked concentric rings and particles. Decorative pools follow real bullets but never add damage/collision; the new homing missiles, drone bolts and nova splash use real damage/collision paths.
- **OVERDRIVE** on Q / orange button: ascends the current weapon for 4 s (effective level +2, faster and stronger), then forces a **3 s normal-fire cease-fire**. A charged weapon ultimate can interrupt active OVERDRIVE and also fire during venting (`doUlt()` rejects neither `odT >= 0` nor `noFireT > 0`). `updateHUD()` puts `ceil(duration-elapsed)` seconds inside both skill balls during ultimate/OD/venting. Both buttons clip their graphics, all pseudo/text layers have `pointer-events:none`, and there are no external cooldown bars. OD cannot be started during an ultimate or venting.
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
| `WEAPONS` | pulse 1→5 straight shots + two LV.3 homing missiles; lance damage 1.65→2.7 / pierce 2→7 + two LV.3 non-piercing drones; nova impact AoE 1.5→2.4 / no pierce / every tenth LV.3 shot is large |
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
- Strings: `js/strings.js` (`{key: [zh-HK, en]}` via cyber-kit v0.3.22 i18n). HTML uses `data-i18n*`; dynamic banners use `t()`. Language lives in the gear settings sheet; pause also has `#btn-lang2`. Language persists in `localStorage cyber.lang`; `?lang=en|zh` forces.

## 4. File map
```
index.html       HUD, craft / weapon screens, unified chapter entry and difficulty selectors
css/game.css     responsive HUD + three-page loadout/mission layouts + safe action dock
assets/          three 4 s real-gameplay WebM previews + JPEG posters
js/config.js     difficulty table + constants + authored waveSpec (pure, unit-tested)
js/campaign.js   10×5 campaign/maps + chapter/difficulty unlocks, migration and JSON-ready records
js/weapons.js    weapon table, level curves, OVERDRIVE solution, pickups
js/world.js      sky dome, scrolling megacity shader, mission map variations, towers, ruins, lights
js/aircraft.js   three procedural cyberpunk player airframes + engine/holo animation
js/entities.js   re-exports craft API; line-only dark-enemy outlines, enemies, boss, bullet pools, pickups
js/audio.js      NinjaAudio (cyber-kit SynthAudio, 'drive' music)
js/main.js       states, input, combat simulation, campaign/difficulty wiring, real-video previews, ult/OVERDRIVE, ads hooks
vendor/cyber-kit cyber-kit v0.3.22
tests/           Node unit tests + browser combat/layout suites + record-previews.py
```
Test hook: `window.__ninja` (state, x, z, score, wave, hp, weapon, power, ult, od, boss, hazards, difficulty, mission; `api.wave/weapon/charge/ult/overdrive/drop/kill/boss/spawn/enemyFire/hazard/bossHurt/difficulty`). Additional guards: `api.airframe()` returns the live model key, engine/mesh/vertex/holo-arc counts; `api.progress()` returns validated level/chapter/difficulty records; `api.fx()` returns decoration counts; `api.specials()` and `api.bulletData(kind)` expose real homing/drone/nova attacks; `api.clearStage()` drives chapter completion tests; `api.threat()` includes `bossChapter` / `bossPattern`.

## 5. Tests
`node --test tests/` · `python tests/aircraft.py [url] [out|none] [all|mobile|desktop]` · `python tests/weapons.py [url]` · `python tests/campaign.py [url]` · `python tests/core.py [url]` · `python tests/quickstart.py [url]` · `python tests/hub-params.py [url]` · `python tests/ult-reset.py [url]` · `python tests/brand.py [url]` · `python tests/smoke.py [url] [out|none] [all|mobile|desktop]` — distinct airframe geometry/engine/holo layouts, live combat rebuilds and selection persistence; three-page navigation, unified chapter entry, real touch scrolling, per-difficulty unlocks and persisted clear/best records, six visual densities per lance/nova, real homing/drone/nova collision damage, ultimate FX, both in-ball countdown touch targets, ten boss families, campaign/endless, real-video switching, movement/pause/gameover/demo/language and zero console errors. Browser waits follow game state rather than wall-clock frame counts under SwiftShader. Last run 2026-11-05 v1.5: **10 Node tests PASS; weapons/core/campaign browser suites PASS; complete mobile and desktop smoke PASS, including final demo checks; chapter rail touch scroll changed scrollLeft 0→201; chapter and difficulty records survived reload; weapon briefing had no vertical overflow; v1.5 weapon/mission screenshots visually inspected; zero console errors**.

## 6. Android packaging
As DATA FUSE (Capacitor 8 + `@capacitor-community/admob` v8; app id suggestion `hk.fung2222.xenonightmare`; lock portrait).

## 7. Ad placements
| Placement | Type | Code | Rule |
|---|---|---|---|
| `gameover` | interstitial | `retry()` / `overToMenu()` → `ads.naturalBreak('gameover')` | only after the player taps Retry/Menu; capped; never at launch or wave start |
| `continue` | rewarded | `revive()` | opt-in, once per run |

Natural break points in endless: the game-over screen (above) and, optionally in future, the milestone banner every 10 waves (never mid-wave).

## 8. Known issues / ideas
- Headless SwiftShader ≈ 3 FPS, so tests wait on game state instead of wall time; allow up to 10 minutes for the full desktop smoke suite (a 5-minute external timeout can cut off the final demo step). Phones run 60 FPS with auto-quality.
- Ideas: distinct boss meshes per species (currently same model, new name/rate + theme shift), weapon-specific models/audio, haptics intensity setting.

## Audio loudness + glow (cyber-kit v0.3.0, 2026-10-03)
- Audio: kit loudness model (music ≈ −20 LUFS integrated, median SFX ≈ music level). This game: music 'drive' with **noise hats/snare suppressed** (tonal kick/bass/pad/arp only), sfxTrimDb -4.5 in `js/audio.js`. Re-measure after changing sounds: `python3 ../cyber-kit/tests/loudness.py http://127.0.0.1:18940 <dir>:<AudioClass> --kit /cyber-kit` (see kit docs/API.md "Loudness"). Keep music −20 ± 1 LUFS and SFX/BGM 0 ± 2 dB.
- Glow: `createStage` values are the HIGH look; default is LOW (crisp). Shared pref `localStorage cyber.glow`, `?glow=low|high`. Pause screen has a GLOW: LOW/HIGH button (`ui.glowToggle(stage)`). Scene fog 0.012 → 0.009.
