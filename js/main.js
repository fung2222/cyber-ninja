// XENO NIGHTMARE 異域凶間 — controller: drag-to-move auto-fire shooter, waves, cosmic monster bosses, ultimate, continue.
import * as THREE from 'three';
import { i18n, t, flags, createStore, createStage, ThemeController, themeFor, U, Particles, Shockwaves, FxState, createInput, CyberUI, Platform, createAds, readHub, returnToHub, shouldShowArcadeMenu} from 'cyber-kit';
import { GAME_ID, FIELD, PLAYER, ULT, ENEMIES, ENEMY_BULLET_SPEED, DROP_CHANCE, DIFFICULTIES, difficultyOf, waveSpec, speedScale, hpScale, ADS, MILESTONE_EVERY, milestoneBonus } from './config.js?v=1.6';
import { CAMPAIGN_LEVELS, CHAPTER_COUNT, LEVELS_PER_CHAPTER, DIFFICULTY_ORDER, campaignForWave, campaignLabel, normalizeProgress, chapterRecord, chapterBest, chapterClears, isChapterUnlocked, isDifficultyUnlocked, recordLevel, recordChapter } from './campaign.js?v=1.5';
import './strings.js?v=1.9';
import { World } from './world.js';
import { makeNinja, updateNinja, disposeNinja, makeEnemy, makeBoss, updateBoss, BulletPool, makePickup, makeGem, makeRock } from './entities.js?v=1.6';
import { WEAPONS, WEAPON_KEYS, OD, WEAPON_ULT, fireSolution, weaponShort, ultName, ultShort, randomOtherWeapon, pierceDamage, novaSplash } from './weapons.js?v=1.6';
import { CRAFTS, CRAFT_KEYS, craftOf, craftName, COMBO, comboMult } from './crafts.js?v=1.0';
import { NinjaAudio } from './audio.js?v=0.3.25';

const $ = (id) => document.getElementById(id);
const store = createStore(GAME_ID);
if (flags.reset) store.clear();
const ui = new CyberUI({ screens: ['start', 'pause', 'over'] });
const stage = createStage({ canvas: $('scene'), bloom: 0.78, bloomRadius: 0.34, bloomThreshold: 0.92, glowLevels: { high: { strength: 0.72, radius: 0.62, threshold: 0.08 }, low: { strength: 0.4, radius: 0.45 } }, fov: 50, exposure: 1.05, onFatal: (m) => ui.fatal(m) });
ui.glowToggle(stage);   // cyber-kit v0.3.0: GLOW LOW/HIGH button in the pause screen (shared preference, LOW = crisp default)
const { scene, camera } = stage;
const theme = new ThemeController(); theme.set(1, true);
const world = new World(scene);
const particles = new Particles(scene, 3000, { floorY: -60 });
stage.onResize((w, h, pr) => particles.resize(h, pr));
const waves = new Shockwaves(scene, 10);
const fx = new FxState();
const audio = new NinjaAudio(store); ui.setMuted(audio.muted);
const ads = createAds({ gameId: GAME_ID, ...ADS, onAdOpen: (on) => audio.duckAll(on) });

// ---------------------------------------------------------------- player craft (selectable airframe)
const savedCraft = store.get('craft', 'falcon');
const savedStartWeapon = store.get('startWeapon', 'pulse');
const savedDifficulty = store.get('difficulty', 'normal');
let selWeapon = WEAPON_KEYS.includes(savedStartWeapon) ? savedStartWeapon : 'pulse';
let selDifficulty = DIFFICULTIES[savedDifficulty] ? savedDifficulty : 'normal';
let missionProgress = normalizeProgress(store.getJSON('missionProgress', null));
let selWave = Math.min(missionProgress.unlocked, CAMPAIGN_LEVELS);
let selChapter = Math.ceil(selWave / LEVELS_PER_CHAPTER);
const D = () => difficultyOf(selDifficulty);
function saveMissionProgress() { store.setJSON('missionProgress', missionProgress); }
function saveLevelResult(wave, score, cleared) {
  if (wave < 1 || wave > CAMPAIGN_LEVELS) return;
  missionProgress = recordLevel(missionProgress, wave, score, cleared);
  saveMissionProgress();
}
const craftModelScale = (key) => key === 'bastion' ? 1.15 : key === 'wraith' ? 1.12 : 1.22;
let ninja = makeNinja(craftOf(savedCraft)); ninja.scale.setScalar(craftModelScale(savedCraft)); scene.add(ninja);
function setCraft(key, silent = false) {
  if (!CRAFTS[key]) key = 'falcon';
  S.craft = key;
  store.set('craft', key);
  scene.remove(ninja); disposeNinja(ninja);
  ninja = makeNinja(craftOf(key)); ninja.scale.setScalar(craftModelScale(key)); scene.add(ninja);
  const C = craftOf(key);
  PLAYER.maxHp = C.hp + D().bonusHp;
  if (!silent && S.state === 'attract') { /* rebuilt under the start screen */ }
  updateHUD();
  renderCraftSelect(); renderCraftInfo();
  if (pv) pvSetModel(C);
}
const pools = {
  pulse: new BulletPool(scene, 320, new THREE.BoxGeometry(0.09, 0.09, 0.75), WEAPONS.pulse.color),
  lance: new BulletPool(scene, 100, new THREE.BoxGeometry(0.16, 0.16, 3.2), WEAPONS.lance.color),
  nova: new BulletPool(scene, 100, new THREE.TorusGeometry(0.5, 0.09, 8, 24), WEAPONS.nova.color),
};
const ebullets = new BulletPool(scene, 500, new THREE.SphereGeometry(0.19, 10, 8), 0xff2bd6);
const ecores = new BulletPool(scene, 500, new THREE.SphereGeometry(0.085, 6, 4), 0xffffff);
// Keep hostile bullets as separate magenta shells with a small raised white core.
// Excess HDR brightness made adjacent bullets fuse together under HIGH bloom.
ebullets.mesh.material.color.setHex(0xff2bd6).multiplyScalar(1.3);
ecores.mesh.material.color.setHex(0xffffff).multiplyScalar(0.9);
// weapon-ultimate beam (laser) — a wide plane over the play field
const beam = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 38), new THREE.MeshBasicMaterial({ color: new THREE.Color(WEAPONS.lance.color).multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.35, -10); beam.visible = false; scene.add(beam);

// Level-dependent weapon visuals are decorative pools linked to real bullets.
// They add no damage or collision, preserving the tested weapon number table.
const decorPools = {
  lance: new BulletPool(scene, 220, new THREE.BoxGeometry(.075, .075, 3.5), 0x8ed8ff),
  nova: new BulletPool(scene, 180, new THREE.TorusGeometry(.5, .026, 6, 32), 0xffb05c),
};
for (const p of Object.values(decorPools)) { p.mesh.material.transparent = true; p.mesh.material.opacity = .72; p.mesh.material.blending = THREE.AdditiveBlending; p.mesh.material.depthWrite = false; }
const LANCE_COLORS = [0xa78bff, 0x91b8ff, 0x78d9ff, 0xb8a0ff, 0x78f2ff, 0xe0d2ff].map(c => new THREE.Color(c));
const NOVA_COLORS = [0xff7a3b, 0xffa53b, 0xffcf5c, 0xff6c9e, 0xff9e63, 0xffe2a1].map(c => new THREE.Color(c));
function spawnWeaponDecor(b, key, level, overdrive) {
  if (!b || key === 'pulse') return;
  const count = key === 'lance' ? level - 1 : level;
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
    decorPools[key].add(b.x, b.z, b.vx, b.vz, {
      source: b, ox: key === 'lance' ? side * (.17 + row * .13) : 0, oz: key === 'lance' ? row * .08 : i * .025,
      scale: key === 'lance' ? .8 : .55 + i * .14, scaleX: key === 'lance' ? .65 : 1,
      color: key === 'lance' ? LANCE_COLORS[(i + level) % 6] : NOVA_COLORS[(i + level) % 6], phase: i * .7,
    });
  }
}

// Procedural lightning: readable jagged 3D lines, brief enough to avoid bloom soup.
const lightningBolts = [];
function strikeLightning(x, z, length = 7, color = 0x9feaff, spread = 1.1) {
  if (lightningBolts.length > 48) return;
  const pts = [], drift = (Math.random() - .5) * spread;
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    pts.push(new THREE.Vector3(x + drift * k + (i === 0 || i === 10 ? 0 : (Math.random() - .5) * spread), .48 + Math.sin(k * Math.PI) * .16, z - length * k));
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(line); lightningBolts.push({ line, life: .16 + Math.random() * .1, max: .26 });
}
const beamExtras = Array.from({ length: 4 }, (_, i) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(i < 2 ? .28 : .13, 38), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x77eaff : 0xe1c8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, .38 + i * .015, -10); m.visible = false; scene.add(m); return m;
});
const novaUlt = new THREE.Group(); novaUlt.visible = false; scene.add(novaUlt);
const novaUltRings = Array.from({ length: 5 }, (_, i) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1, .025 + i * .005, 6, 64), new THREE.MeshBasicMaterial({ color: NOVA_COLORS[i], transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = Math.PI / 2 + (i - 2) * .08; novaUlt.add(m); return m;
});
const novaCore = new THREE.Mesh(new THREE.IcosahedronGeometry(.65, 1), new THREE.MeshBasicMaterial({ color: 0xffd29a, wireframe: true, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); novaUlt.add(novaCore);

// LV.3 Phase Lance deploys two real support drones. Their bolts use the normal
// collision pool with pierce=0, so the companions deal actual non-piercing damage.
const lanceDrones = [-1, 1].map(side => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(.24, 0), new THREE.MeshStandardMaterial({ color: 0x33245d, emissive: 0x6d4fd0, emissiveIntensity: .65, metalness: .75, roughness: .28 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.34, .025, 6, 24), new THREE.MeshBasicMaterial({ color: 0x8cecff, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = Math.PI / 2; g.add(body, ring); g.visible = false; g.userData.side = side; scene.add(g); return g;
});
function updateWeaponFx(dt) {
  for (const [key, pool] of Object.entries(decorPools)) {
    for (const d of pool.list) {
      const b = d.source;
      if (!b || b.dead) { d.dead = true; continue; }
      d.x = b.x + d.ox; d.z = b.z + d.oz; d.vx = b.vx; d.vz = b.vz;
      if (key === 'nova') d.scale = (b.scale || 1) * (.55 + d.phase * .2) * (1 + Math.sin(S.t * 9 + d.phase) * .07);
    }
    pool.list = pool.list.filter(d => !d.dead);
  }
  for (let i = lightningBolts.length - 1; i >= 0; i--) {
    const b = lightningBolts[i]; b.life -= dt; b.line.material.opacity = Math.max(0, b.life / b.max);
    if (b.life <= 0) { scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); lightningBolts.splice(i, 1); }
  }
}

const S = {
  state: 'attract', demo: !!flags.demo,
  x: 0, z: 1, vx: 0, hp: 3, invuln: 0, power: 1, fireT: 0, ult: 0, ultT: -1,
  weapon: 'pulse', weaponLevels: { pulse: 1, lance: 1, nova: 1 }, ults: { pulse: 0, lance: 0, nova: 0 },
  odT: -1, odCd: 0, noFireT: 0, ultMode: null, ultFireT: 0, novaR: 0,
  novaShots: 0, novaBigShots: 0, homingShots: 0, droneShots: 0, droneFireT: 0, chapterClear: false,
  score: 0, wave: 1, spec: null, waveT: 0, nextEv: 0, enemies: [], boss: null, pickups: [], kills: 0,
  continued: false, betweenT: 0, t: 0, newRecord: false,
  hazards: [], hazardT: 7, gems: [], rocks: [], rockT: 9, district: 'city',
  craft: CRAFTS[savedCraft] ? savedCraft : 'falcon', difficulty: selDifficulty, mission: campaignForWave(1),
  combo: { chain: 0, timer: 0, mult: 1 }, gemChain: 0, gemChainT: 0, sinceHit: 99,
};
PLAYER.maxHp = craftOf(S.craft).hp + D().bonusHp;
window.__ninja = S;  // test hook
window.__audio = audio;  // music state probe for the home-screen BGM guard
const C = () => craftOf(S.craft);            // current airframe
const chargeGain = (n) => n * C().charge;    // wraith charges faster

// ---------------------------------------------------------------- HUD
const setRing = (el, pct) => el.style.setProperty('--p', Math.max(0, Math.min(100, pct)).toFixed(1));
function updateHUD() {
  const lang = i18n.isZh() ? 'zh' : 'en';
  ui.setText('hud-score', S.score.toLocaleString('en-US'));
  ui.setText('hud-best', Math.max(store.best, S.score).toLocaleString('en-US'));
  ui.setText('hud-wave', S.wave);
  ui.setText('hud-mission', campaignLabel(S.mission || campaignForWave(S.wave), lang) + (S.wave > CAMPAIGN_LEVELS ? ' · ∞' : ''));
  // Bottom-left combat readout: weapon + level pips + shield pips/value.
  const pips = $('cr-hp'); let h = ''; for (let i = 0; i < PLAYER.maxHp; i++) h += `<i class="${i < S.hp ? 'on' : ''}"></i>`; if (pips && pips.innerHTML !== h) pips.innerHTML = h;
  const hpNum = $('cr-hp-num'); if (hpNum) hpNum.textContent = `${Math.max(0, S.hp)}/${PLAYER.maxHp}`;
  const wName = $('cr-weapon'); if (wName) wName.textContent = weaponShort(S.weapon, lang);
  const wLv = $('cr-wlv'); if (wLv) wLv.textContent = 'LV.' + S.power;
  const lv = $('cr-lv'); if (lv) { let lh = ''; for (let i = 1; i <= 6; i++) lh += `<i class="${i <= S.power ? 'on' : ''}"></i>`; if (lv.innerHTML !== lh) lv.innerHTML = lh; }
  // combo chip
  const combo = $('combo-chip');
  if (combo) {
    const on = S.combo.mult > 1 && S.combo.timer > 0;
    combo.classList.toggle('on', on);
    if (on) { $('combo-mult').textContent = '×' + S.combo.mult; combo.style.setProperty('--cd', (S.combo.timer / COMBO.window).toFixed(2)); }
  }
  // Both cooldowns live inside their own circular button. No external bar or
  // decorative layer is allowed to intercept the other skill's touch target.
  const ultDur = WEAPON_ULT[S.ultMode || S.weapon]?.duration || ULT.duration;
  const ultCooling = S.ultT >= 0;
  $('ult-label').textContent = ultShort(S.weapon, lang);
  $('ult-sub').textContent = ultCooling ? Math.max(0, Math.ceil(ultDur - S.ultT)) + 's' : S.ult >= 100 ? (lang === 'zh' ? '就緒' : 'READY') : Math.round(S.ult) + '%';
  const ultLeftPct = ultCooling ? Math.max(0, 100 - (S.ultT / ultDur) * 100) : 0;
  setRing($('btn-ult'), ultCooling ? ultLeftPct : S.ult);
  $('btn-ult').classList.toggle('ready', S.ult >= 100 && !ultCooling);
  $('btn-ult').classList.toggle('cooling', ultCooling);
  const odReady = S.odCd <= 0 && S.odT < 0 && S.noFireT <= 0 && S.ultT < 0;
  $('btn-od').classList.toggle('ready', odReady);
  $('btn-od').classList.toggle('active', S.odT >= 0);
  $('btn-od').classList.toggle('venting', S.noFireT > 0);
  const odDur = OD.duration + C().odBonus;
  setRing($('btn-od'), S.odCd > 0 ? Math.max(0, 100 - (S.odCd / OD.cooldown) * 100) : 100);
  $('od-label').textContent = S.noFireT > 0 ? t('odVent') : S.odT >= 0 ? t('odActive') : t('odShort');
  $('od-sub').textContent = S.odCd > 0 ? Math.ceil(S.odCd) + 's' : (lang === 'zh' ? '就緒' : 'READY');
  // craft badge
  const badge = $('hud-craft'); if (badge) { badge.textContent = C().code[lang] + ' · ' + craftName(S.craft, lang); badge.style.setProperty('--cc', '#' + C().color.toString(16).padStart(6, '0')); }
  // boss bar with phase segments
  const bb = $('boss-bar'); bb.classList.toggle('hidden', !S.boss);
  if (S.boss) $('boss-fill').style.width = (Math.max(0, S.boss.hp / S.boss.maxHp) * 100).toFixed(1) + '%';
}
function refreshStart() { ui.setText('start-best', store.best.toLocaleString('en-US')); ui.setText('start-wave', store.getNum('bestWave', 0) || '—'); }
function setState(s) {
  S.state = s; ui.show({ attract: 'start', paused: 'pause', over: 'over' }[s] || null);
  ui.hud(s === 'playing' || s === 'paused' || s === 'over'); $('demo-tag').classList.toggle('hidden', !S.demo); updateHUD();
  const lang = i18n.isZh() ? 'zh' : 'en';
  const craftLine = C().code[lang] + ' · ' + craftName(S.craft, lang) + ' · ' + C().role[lang];
  if ($('pause-craft')) $('pause-craft').textContent = craftLine;
  if ($('over-craft')) $('over-craft').textContent = craftLine;
}

// ---------------------------------------------------------------- run flow
function clearField() {
  for (const e of S.enemies) scene.remove(e.g); S.enemies = [];
  if (S.boss) { scene.remove(S.boss.g); S.boss = null; }
  for (const p of S.pickups) scene.remove(p.g); S.pickups = [];
  for (const h of S.hazards) scene.remove(h.g); S.hazards = [];
  for (const g of (S.gems || [])) scene.remove(g.g); S.gems = [];
  for (const r of (S.rocks || [])) scene.remove(r.g); S.rocks = [];
  for (const k of WEAPON_KEYS) pools[k].clear();
  ebullets.clear(); beam.visible = false; beam.material.opacity = 0;
  for (const p of Object.values(decorPools)) p.clear();
  for (const b of lightningBolts) { scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); } lightningBolts.length = 0;
  for (const m of beamExtras) { m.visible = false; m.material.opacity = 0; }
  novaUlt.visible = false;
  for (const d of lanceDrones) d.visible = false;
}
function resetRun() {
  clearField();
  const startWave = S.demo || flags.autostart ? 1 : selWave;
  Object.assign(S, { x: 0, z: 1, tx: 0, tz: 1, vx: 0, hp: PLAYER.maxHp, invuln: 1.2, power: 1, fireT: 0, ult: 0, ultT: -1, score: 0, wave: startWave - 1, runStartWave: startWave, kills: 0, continued: false, newRecord: false, ultReadyShown: false, ultBossHit: false,
    weapon: selWeapon, difficulty: selDifficulty, mission: campaignForWave(startWave), weaponLevels: { pulse: 1, lance: 1, nova: 1 }, ults: { pulse: 0, lance: 0, nova: 0 }, odT: -1, odCd: 0, noFireT: 0, ultMode: null, ultFireT: 0, novaR: 0, novaShots: 0, novaBigShots: 0, homingShots: 0, droneShots: 0, droneFireT: 0, chapterClear: false, hazards: [], hazardT: 7, gems: [], rocks: [], rockT: 9, district: 'city',
    combo: { chain: 0, timer: 0, mult: 1 }, gemChain: 0, gemChainT: 0, sinceHit: 99 });
  world.setDistrict('city');
  beam.visible = false; beam.material.opacity = 0;
  theme.set(1); audio.setBoss(false); nextWave();
}
function nextWave() {
  if (S.state === 'playing' && !S.demo && S.wave >= S.runStartWave && S.wave <= CAMPAIGN_LEVELS) saveLevelResult(S.wave, S.score - (S.levelStartScore || 0), true);
  if (S.state === 'playing' && !S.demo && S.wave >= S.runStartWave && S.wave <= CAMPAIGN_LEVELS && S.wave % LEVELS_PER_CHAPTER === 0) {
    const ch = Math.ceil(S.wave / LEVELS_PER_CHAPTER);
    missionProgress = recordChapter(missionProgress, ch, selDifficulty, S.score, true);
    saveMissionProgress();
    store.setJSON(RESUME_KEY, { chapter: Math.min(CHAPTER_COUNT, ch + 1), difficulty: selDifficulty, at: Date.now() });
    if (ch >= CHAPTER_COUNT) { finishChapter(); return; }
    // Continuous campaign (Roy 2026-11-05): clearing a chapter heals and rolls straight
    // into the next chapter instead of ending the run; only chapter 10 shows the result.
    S.hp = PLAYER.maxHp; S.sinceHit = 99;
    ui.toast(t('chapterClearToast', { chapter: ch }), 2200);
    audio.ready(); Platform.haptic('success'); fx.kick({ aberr: .5 }); updateHUD();
  }
  S.wave++; S.spec = waveSpec(S.wave); S.waveT = 0; S.nextEv = 0; S.betweenT = 0; S.levelStartScore = S.score;
  const m = campaignForWave(S.wave); S.mission = m;
  const changed = world.setMission(m);
  const districtChanged = changed !== S.district; S.district = changed;
  theme.set(m.theme);
  const lang = i18n.isZh() ? 'zh' : 'en';
  if (S.spec.boss) {
    spawnBoss(Math.round(S.spec.hp * D().bossHp), S.spec.variant);
    if (S.state !== 'attract') { ui.banner(t('bossIncoming', { name: bossName() }), `${campaignLabel(m, lang)} · ${m.stageName[lang]}`, ''); audio.warn(); fx.kick({ glitch: 0.6, aberr: 1 }); }
  } else if (S.state !== 'attract' && S.wave > 1 && (S.wave - 1) % MILESTONE_EVERY === 0) milestone(S.wave - 1);
  else if (S.state !== 'attract' && S.wave > 1) {
    const title = m.campaign ? t('chapterStage', { chapter: m.chapter, stage: m.stage, name: m.name[lang] }) : t('waveN', { n: S.wave });
    if (m.stage === 1) ui.banner(lang === 'zh' ? `第 ${m.chapter} 章` : `CHAPTER ${m.chapter}`, m.name[lang], '');
    else ui.banner(title, m.stageName[lang], S.wave % 5 === 4 ? t('bossNext') : '');
  }
  if (S.wave === CAMPAIGN_LEVELS + 1 && S.state !== 'attract') ui.toast(t('endlessUnlocked'), 2600);
  audio.setBoss(!!S.spec.boss); audio.setLevel(S.spec.boss ? 10 : 1 + Math.floor((S.wave - 1) / 2));
}
function bossName(b = S.boss) { const v = b && b.variant; return v ? (i18n.isZh() ? v.zh : v.en) : ''; }
function refreshBossName() { ui.setText('bb-name', bossName()); ui.setText('bb-sub', S.boss ? t('waveN', { n: S.wave }) : ''); }
function milestone(n) {
  const pts = milestoneBonus(n); S.score += pts; S.hp = PLAYER.maxHp; S.sinceHit = 99; theme.set(Math.floor(3 + n / MILESTONE_EVERY * 2));
  ui.banner(t('milestone', { n }), t('milestoneS', { pts: pts.toLocaleString('en-US') }), t('waveN', { n: S.wave }));
  audio.ready(); fx.kick({ aberr: 1, glitch: 0.4 }); Platform.haptic('success'); updateHUD();
}
function beginRun() {
  audio.init(); audio.startMusic(); audio.unduckMusic();
  resetRun(); setState('playing'); audio.confirm();
  const m = S.mission, lang = i18n.isZh() ? 'zh' : 'en';
  ui.banner(i18n.isZh() ? `第 ${m.chapter} 章` : `CHAPTER ${m.chapter}`, m.name[lang], '');
}
function showAttract() { closeHangar(); closeWeapon(); closeMission(); closeDifficulty(); audio.init(); audio.startMusic(); audio.unduckMusic(); if (!S.demo) { selWave = missionProgress.unlocked; selChapter = Math.ceil(selWave / LEVELS_PER_CHAPTER); } setState('attract'); resetRun(); refreshStart(); }

// ---------------------------------------------------------------- spawning
function spawnEnemy(ev) {
  const def = ENEMIES[ev.type]; const g = makeEnemy(ev.type); const elite = !!ev.elite;
  g.scale.setScalar(1.45 * (elite ? 1.18 : 1)); scene.add(g);
  const e = {
    type: ev.type, def, g, x: ev.x, baseX: ev.x, z: FIELD.top - 1, t: 0, phase: ev.phase,
    hp: Math.ceil(def.hp * hpScale(S.wave) * D().enemyHp * (elite ? 1.8 : 1)), fireT: (S.wave <= 2 ? 1.35 : 0.7) + Math.random() * 0.9,
    flash: 0, mode: 0, stopZ: ev.type === 'turret' ? -17 + Math.random() * 4 : -15 + Math.random() * 5,
    vx: 0, vz: def.speed * speedScale(S.wave) * (elite ? 1.12 : 1) * (S.wave <= 2 ? 0.88 : 1),
    pattern: ev.pattern || 'dive', elite, level: S.wave, score: def.score * (elite ? 2.5 : 1),
    role: ev.role || ((ev.type === 'dasher' || ev.type === 'mite') ? 'rusher' : 'shooter'), telegraphT: 0,
  };
  if (elite && e.g.userData.mat) e.g.userData.mat.emissive = new THREE.Color(def.color).multiplyScalar(0.18);
  g.position.set(e.x, 0, e.z); S.enemies.push(e);
}
function spawnBoss(hp, variant = { zh: '星海魔獸', en: 'COSMIC MONSTER', rate: 1 }) {
  const g = makeBoss(); g.scale.setScalar(1.15); scene.add(g);
  S.boss = { g, x: 0, z: FIELD.top - 4, hp, maxHp: hp, t: 0, atk: 0, atkT: 2.5, spiralA: 0, spiralN: 0, seq: 0, phase: 1, entering: true, variant, chapter: S.mission.chapter, lastPattern: 'entry' };
  refreshBossName();
  g.position.set(0, 0, S.boss.z);
}
function enemyFire(x, z, ang, speed = ENEMY_BULLET_SPEED, extra = {}) { const v = speed * D().bulletSpeed; return ebullets.add(x, z, Math.sin(ang) * v, Math.cos(ang) * v, extra); }
const aimAt = (x, z) => Math.atan2(S.x - x, S.z - z);

// Each chapter has its own boss grammar, not merely a recolour or faster rate.
function fireBossPattern(B, p) {
  const speed = ENEMY_BULLET_SPEED * (0.78 + p * 0.07), seq = B.seq++;
  let chapter = B.chapter;
  if (chapter === 10) chapter = [1, 2, 3, 7, 9][(seq + p) % 5];
  B.lastPattern = `ch${chapter}-p${p}-${seq % 4}`;
  const aimed = aimAt(B.x, B.z);
  if (chapter === 1) {
    if (seq % 3 === 2) {
      const gap = Math.sin(B.t * 0.7) * 3.2;
      for (let x = -FIELD.halfW + .7; x < FIELD.halfW; x += 1.25) if (Math.abs(x - gap) > 1.45) enemyFire(x, B.z + .5, 0, speed * .88);
    } else for (const o of [-.38, -.22, -.08, .08, .22, .38]) enemyFire(B.x, B.z + 1, aimed + o, speed);
    B.atkT = 1.15;
  } else if (chapter === 2) {
    const arms = 2 + (p === 3 ? 1 : 0);
    for (let i = 0; i < arms; i++) enemyFire(B.x, B.z, B.spiralA + i * Math.PI * 2 / arms, speed);
    B.spiralA += .43 + p * .06; B.atkT = .22;
    if (seq % 8 === 7) for (const o of [-.18, 0, .18]) enemyFire(B.x, B.z, aimed + o, speed * 1.12);
  } else if (chapter === 3) {
    for (const side of [-1, 1]) for (const slope of [.25, .48, .72]) enemyFire(B.x + side * 1.8, B.z + .5, side * slope + (side > 0 ? Math.PI : 0), speed * .9);
    if (p > 1) enemyFire(B.x, B.z, aimed, speed * 1.15);
    B.atkT = .85;
  } else if (chapter === 4) {
    const side = seq % 2 ? 1 : -1;
    for (const mirror of [-1, 1]) {
      const x = B.x + mirror * 2.5, a = aimAt(x, B.z);
      for (const o of [-.18, 0, .18]) enemyFire(x, B.z + .4, a + o * side, speed * (mirror === side ? 1.08 : .92));
    }
    B.atkT = .72;
  } else if (chapter === 5) {
    const n = 15 + p * 2, gap = Math.floor((aimed + Math.PI * 4) / (Math.PI * 2) * n) % n;
    for (let i = 0; i < n; i++) if (Math.abs(i - gap) > 1) enemyFire(B.x, B.z, i * Math.PI * 2 / n + B.t * .22, speed * .8);
    if (seq % 2) enemyFire(B.x, B.z, aimed, speed * 1.5, { scale: 1.3 });
    B.atkT = 1.15;
  } else if (chapter === 6) {
    spawnHazard(); // orange lane telegraphs precede the actual damaging ruin laser
    for (const o of [-.45, -.22, 0, .22, .45]) enemyFire(B.x, B.z, aimed + o, speed * .9);
    B.atkT = 1.65;
  } else if (chapter === 7) {
    const n = 8 + p * 2;
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + B.t * .55 + layer * .16 + Math.sin(i * Math.PI * 4 / n) * .19;
      enemyFire(B.x, B.z, a, speed * (layer ? .72 : .94));
    }
    B.atkT = 1.05;
  } else if (chapter === 8) {
    const arms = 4 + p;
    for (let i = 0; i < arms; i++) enemyFire(B.x, B.z, B.spiralA + i * Math.PI * 2 / arms, speed * .85);
    for (let i = 0; i < 3; i++) enemyFire(B.x, B.z, -B.spiralA * .7 + i * Math.PI * 2 / 3, speed * .72);
    B.spiralA += .34; B.atkT = .36;
  } else {
    if (seq % 3 === 0) for (let i = 0; i < 12 + p * 2; i++) enemyFire(B.x, B.z, i * Math.PI * 2 / (12 + p * 2), speed * .82);
    else {
      for (const o of [-.28, -.14, 0, .14, .28]) enemyFire(B.x, B.z, aimed + o, speed, o === 0 ? { homing: .8, turn: 1.25 } : {});
    }
    B.atkT = .95;
  }
}

// ---------------------------------------------------------------- damage / kills
function bumpCombo() {
  S.combo.chain++; S.combo.timer = COMBO.window;
  const m = comboMult(S.combo.chain);
  if (m > S.combo.mult) {
    S.combo.mult = m;
    if (S.state === 'playing') {
      audio.combo(m);
      const sp = stage.toScreen(new THREE.Vector3(S.x, 0.8, S.z - 1.4));
      ui.popup(sp.x, sp.y, '×' + m, 'combo-pop');
    }
  }
}
function breakCombo(silent = false) {
  if (S.combo.mult >= 4 && !silent && S.state === 'playing') audio.comboLost();
  S.combo.chain = 0; S.combo.timer = 0; S.combo.mult = 1;
}
function spawnMites(x, z, n, elite = false) {
  for (let i = 0; i < n; i++) {
    const g = makeEnemy('mite'); g.scale.setScalar(1.2); scene.add(g);
    const a = (i / n) * Math.PI * 2 + Math.random();
    const e = {
      type: 'mite', def: ENEMIES.mite, g, x, baseX: x, z, t: 0, phase: Math.random() * 6.28,
      hp: 1, fireT: 999, flash: 0, mode: 0, stopZ: 0,
      vx: Math.sin(a) * 5.5, vz: Math.cos(a) * 4.5 + 2,
      pattern: 'swarm', elite: false, level: S.wave, score: ENEMIES.mite.score,
    };
    g.position.set(x, 0, z); S.enemies.push(e);
  }
}
function killEnemy(e, i) {
  scene.remove(e.g); S.enemies.splice(i, 1);
  // a destroyed brood carrier releases its swarm
  if (e.type === 'splitter') spawnMites(e.x, e.z, e.elite ? 5 : 3, e.elite);
  const big = e.type === 'turret' || e.elite, small = e.type === 'mite';
  const c = new THREE.Color(e.def.color); const p = new THREE.Vector3(e.x, 0, e.z);
  particles.burst(p, c, small ? 14 : big ? 52 : 34, { speed: big ? 9 : 7, up: 2, life: small ? 0.5 : 0.75, size: big ? 1.3 : 1, grav: 0, color2: new THREE.Color(0xffffff) });
  waves.spawn(p, c, { r0: 0.2, r1: big ? 3.4 : 2.2, h: 0.5, dur: big ? 0.55 : 0.4 });
  // combo + score
  bumpCombo();
  const pts = Math.round((e.score || e.def.score) * S.combo.mult * D().score);
  S.score += pts; S.kills++;
  S.ult = Math.min(100, S.ult + chargeGain(ULT.perKill)); S.ults[S.weapon] = S.ult;
  if (S.ult >= 100 && !S.ultReadyShown) { S.ultReadyShown = true; if (S.state === 'playing') { audio.ready(); ui.toast(t('ultReady'), 1300); } }
  if (S.state !== 'attract') {
    audio.boom(big);
    if ((e.score || e.def.score) >= 120 || S.combo.mult > 1) { const sp = stage.toScreen(p); ui.popup(sp.x, sp.y, '+' + pts + (S.combo.mult > 1 ? ' ×' + S.combo.mult : ''), S.combo.mult >= 4 ? 'hot' : ''); }
  }
  dropGems(e);
  const wChance = e.elite ? 0.65 : 0;
  killsSinceP++;
  if (wChance && Math.random() < wChance) dropPickup(e.x, e.z, 'W', randomOtherWeapon(S.weapon));
  else if (!small && Math.random() < DROP_CHANCE * D().drops) dropPickup(e.x, e.z);
  else if (S.power < 6 && killsSinceP >= 8) dropPickup(e.x, e.z, 'P');   // pity: never starve the upgrade curve
  fx.kick({ trauma: small ? 0.03 : big ? 0.12 : 0.06 });
  if (big && S.state === 'playing') fx.kick({ slowmo: 0.16, aberr: 0.35 });   // hit-stop on chunky kills
}
function spawnGem(x, z, tier = 0) {
  const g = makeGem(tier); g.scale.setScalar(1.45); g.position.set(x, 0.35, z); scene.add(g);
  S.gems.push({
    g, x, z, t: 0, tier,
    vx: (Math.random() - 0.5) * 4.2, vz: (Math.random() - 0.5) * 4.2 + 1.6,
    value: tier === 2 ? 40 : tier === 1 ? 18 : 8,
    energy: tier === 2 ? 2.2 : tier === 1 ? 1.1 : 0.45,
  });
}
function dropGems(e, boss = false) {
  const level = e.level || S.wave;
  const base = boss ? 18 + Math.min(14, Math.floor(level / 2)) : e.type === 'turret' ? 3 : e.type === 'dasher' ? 2 : 1;
  const count = base + Math.floor(level / 3) + (e.elite ? 4 : 0);
  const tier = boss ? 2 : e.elite ? 1 : 0;
  for (let i = 0; i < count; i++) spawnGem(e.x, e.z, tier);
}
let killsSinceP = 0;   // pity counter: a power pickup is guaranteed after 8 dry kills
function dropPickup(x, z, kind, weaponKey) {
  if (!kind) {
    const r = Math.random();
    // repair packs are rarer than power/shield, and only when the player is actually hurt
    if (r < 0.40) kind = S.power < 6 ? 'P' : 'E';
    else if (r < 0.66) kind = 'S';
    else if (r < 0.86) kind = 'E';
    else kind = S.hp < PLAYER.maxHp ? 'H' : 'S';
  }
  if (kind === 'P') killsSinceP = 0;
  const g = makePickup(kind, weaponKey); g.scale.setScalar(1.55); g.position.set(x, 0, z); scene.add(g); S.pickups.push({ g, kind, weaponKey, x, z, t: 0 });
}
function spawnHazard() {
  let x = (Math.random() * 2 - 1) * (FIELD.halfW - 1);
  if (Math.abs(x - S.x) < 1.6) x = x > 0 ? x - 2.8 : x + 2.8;
  x = THREE.MathUtils.clamp(x, -FIELD.halfW + 0.8, FIELD.halfW - 0.8);
  const g = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 34), new THREE.MeshBasicMaterial({ color: 0xff7a3b, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.position.set(x, 0.18, -10.5); scene.add(g);
  S.hazards.push({ g, x, t: 0 });
  if (S.state === 'playing') { audio.warn(); fx.kick({ trauma: 0.12 }); }
}
function spawnRock() {
  let x = (Math.random() * 2 - 1) * (FIELD.halfW - 1.2);
  if (Math.abs(x - S.x) < 1.8) x = x > 0 ? x - 3.2 : x + 3.2;
  x = THREE.MathUtils.clamp(x, -FIELD.halfW + 1, FIELD.halfW - 1);
  const g = makeRock(); const scale = 0.75 + Math.random() * 0.7; g.scale.setScalar(scale);
  g.position.set(x, 0.45, FIELD.top - 5); scene.add(g);
  S.rocks.push({ g, x, z: FIELD.top - 5, t: 0, scale, r: 1.05 * scale, vx: (Math.random() - 0.5) * 0.7, vz: 2.6 + Math.random() * 1.2 });
}
function hurtEnemy(e, i, dmg) {
  e.hp -= dmg; e.flash = 1;
  if (S.state === 'playing') audio.hit();
  particles.emit(new THREE.Vector3(e.x, 0, e.z + 0.3), new THREE.Vector3((Math.random() - 0.5) * 3, 1, 2), new THREE.Color(e.def.color), { life: 0.25, size: 0.6 });
  if (e.hp <= 0) killEnemy(e, i);
}
function hurtBoss(dmg) {
  const B = S.boss; if (!B || B.entering || B.hp <= 0) return;
  B.hp -= dmg * C().dmg; B.g.userData.eyeU.uHurt.value = 0.4;
  S.ult = Math.min(100, S.ult + chargeGain(ULT.perBossHit)); S.ults[S.weapon] = S.ult;
  particles.emit(new THREE.Vector3(B.x, 0.5, B.z + 0.5), new THREE.Vector3((Math.random() - 0.5) * 4, 2, 3), new THREE.Color(0xa66bff), { life: 0.3, size: 0.7 });
  if (B.hp <= 0) bossDown();
}
function detonateBullet(b, primary = null) {
  const radius = b.aoe || 0;
  b.dead = true;
  if (radius <= 0) return;
  const p = new THREE.Vector3(b.x, .18, b.z);
  waves.spawn(p, new THREE.Color(b.kind === 'nova' ? WEAPONS.nova.color : 0xffc766), { r0: .25, r1: radius, h: .25, dur: b.novaBig ? .65 : .35, a: b.novaBig ? 2.2 : 1 });
  particles.burst(p, new THREE.Color(b.kind === 'nova' ? 0xffa34d : 0xffd57a), b.novaBig ? 48 : 18, { speed: b.novaBig ? 9 : 5, up: 1.5, life: .45, size: .75, grav: 0 });
  const splashBase = b.kind === 'nova' ? 'nova' : 'flat';
  for (let i = S.enemies.length - 1; i >= 0; i--) {
    const e = S.enemies[i];
    const dist = Math.hypot(e.x - b.x, e.z - b.z);
    if (e !== primary && dist <= radius + e.def.radius * .35) {
      hurtEnemy(e, i, splashBase === 'nova' ? novaSplash(b.dmg, dist, radius) : b.dmg * .5);
    }
  }
  const B = S.boss;
  if (B && B !== primary && !B.entering) { const bd = Math.hypot(B.x - b.x, B.z - b.z); if (bd <= radius + ENEMIES.boss.radius * .35) hurtBoss(splashBase === 'nova' ? novaSplash(b.dmg, bd, radius) : b.dmg * .5); }
}
function homingTarget(b) {
  let target = null, best = Infinity;
  for (const e of S.enemies) {
    if (b.hit.has(e)) continue;
    const d = Math.hypot(e.x - b.x, e.z - b.z);
    if (d < best) { best = d; target = e; }
  }
  const B = S.boss;
  if (B && !B.entering && !b.hit.has(B)) {
    const d = Math.hypot(B.x - b.x, B.z - b.z);
    if (d < best) target = B;
  }
  return target;
}
function hurtPlayer() {
  if (S.invuln > 0 || S.ultT >= 0) return;
  if (S.state === 'attract') { S.invuln = 1; return; }
  S.hp--; S.sinceHit = 0; S.invuln = D().invuln; S.power = Math.max(1, S.power - 1); S.weaponLevels[S.weapon] = S.power;
  breakCombo();
  audio.hurt(); fx.kick({ trauma: 0.5, aberr: 1.2, glitch: 0.5 }); ui.flash('rgba(255,40,90,0.4)', 380); Platform.haptic('heavy');
  for (const b of ebullets.list) if (Math.hypot(b.x - S.x, b.z - S.z) < 3.5) b.dead = true;
  updateHUD();
  if (S.hp <= 0) gameOver();
}
function bossDown() {
  const b = S.boss; const p = new THREE.Vector3(b.x, 0, b.z);
  for (let i = 0; i < 4; i++) setTimeout(() => { particles.burst(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3)), new THREE.Color().setHSL(Math.random(), 1, 0.6), 80, { speed: 10, up: 3, life: 1.2, size: 1.4, grav: 0 }); audio.boom(true); }, i * 160);
  waves.spawn(p, new THREE.Color(0xa66bff), { r0: 1, r1: 18, h: 2.5, dur: 1.2, a: 3 });
  fx.kick({ trauma: 0.8, aberr: 1.5, glitch: 0.8, slowmo: 0.9 }); ui.flash('rgba(255,255,255,0.6)', 600); Platform.haptic('success');
  S.score += ENEMIES.boss.score * (S.wave / 5); dropGems({ x: b.x, z: b.z, level: S.wave, elite: false }, true);
  for (let i = 0; i < 3; i++) dropPickup(b.x + (i - 1) * 1.5, b.z, ['P', 'S', 'E'][i]);
  dropPickup(b.x, b.z - 1.2, 'W', randomOtherWeapon(S.weapon));
  scene.remove(b.g); S.boss = null; ebullets.clear();
  if (S.state !== 'attract') ui.banner(t('bossDown'), `${bossName(b)} · +${(ENEMIES.boss.score * (S.wave / 5)).toLocaleString('en-US')}`, '');
  theme.set(1 + S.wave / 5); audio.setBoss(false);
}
function doUlt() {
  if (S.ult < 100 || S.ultT >= 0 || !(S.state === 'playing' || S.state === 'attract')) return;
  const mode = S.weapon;
  S.ult = 0; S.ults[mode] = 0; S.ultReadyShown = false; S.ultT = 0; S.ultFireT = 0; S.ultMode = mode; S.novaR = 2; S.invuln = Math.max(S.invuln, 0.35);
  beam.visible = mode === 'lance'; novaUlt.visible = mode === 'nova';
  for (const m of beamExtras) m.visible = mode === 'lance';
  if (mode === 'lance') {
    beam.position.x = S.x; beam.material.color.setHex(WEAPONS.lance.color).multiplyScalar(2.4);
    for (let i = 0; i < 7; i++) strikeLightning(S.x + (Math.random() - .5) * 2.4, S.z - 1 - i * 2.2, 5 + Math.random() * 4, i % 2 ? 0xc7b5ff : 0x8cecff, 1.8);
  } else if (mode === 'nova') {
    novaUlt.position.set(S.x, .4, S.z);
    for (let i = 0; i < 4; i++) waves.spawn(new THREE.Vector3(S.x, 0, S.z), NOVA_COLORS[i], { r0: .6 + i * .4, r1: 7 + i * 3, h: 1 + i * .25, dur: .75 + i * .12, a: 2.5 });
  }
  for (const b of ebullets.list) particles.emit(new THREE.Vector3(b.x, 0, b.z), new THREE.Vector3(0, 2, 0), new THREE.Color(0xffffff), { life: 0.4, size: 0.8 });
  ebullets.clear();
  if (S.state !== 'attract') { audio.ult(mode); ui.banner(ultName(mode, i18n.isZh() ? 'zh' : 'en'), '', ''); Platform.haptic('heavy'); }
  const up = new THREE.Vector3(S.x, 0.5, S.z); particles.burst(up, new THREE.Color(WEAPONS[mode].color), 150, { speed: 14, up: 4, life: 1.1, size: 1.5, grav: 0 }); waves.spawn(up, new THREE.Color(WEAPONS[mode].color), { r0: 1, r1: 16, h: 2.4, dur: 1.0, a: 3 }); fx.kick({ slowmo: 0.7, aberr: 1.5, fovKick: 1, trauma: 0.4 }); ui.flash('rgba(255,255,255,0.3)', 480);
  updateHUD();
}
function doOverdrive() {
  if (S.odCd > 0 || S.odT >= 0 || S.noFireT > 0 || S.ultT >= 0 || !(S.state === 'playing' || S.state === 'attract')) return;
  S.odCd = OD.cooldown; S.odT = 0; S.fireT = 0; S.invuln = Math.max(S.invuln, 0.6);
  if (S.state !== 'attract') { audio.ready(); ui.banner(t('odActive'), '', t('odS')); Platform.haptic('heavy'); }
  particles.burst(new THREE.Vector3(S.x, 0.5, S.z), new THREE.Color(0xff8a4d), 70, { speed: 10, up: 3, life: 0.8, size: 1.2, grav: 0 }); fx.kick({ aberr: 1, fovKick: 0.8, trauma: 0.2 }); ui.flash('rgba(255,122,59,0.32)', 420);
  updateHUD();
}

function showRunResult(clear) {
  S.chapterClear = clear;
  $('over-kicker').textContent = t(clear ? 'chapterCompleteKicker' : 'signalLost');
  $('over-title').textContent = t(clear ? 'chapterComplete' : 'failed');
  $('over-title').classList.toggle('danger', !clear);
  $('over-kicker').classList.toggle('danger', !clear);
  $('over-subtitle').textContent = clear ? t('chapterCompleteS', { chapter: S.mission.chapter }) : t('overS');
  ui.setText('over-score', S.score.toLocaleString('en-US')); ui.setText('over-wave', S.wave); ui.setText('over-kills', S.kills); ui.setText('over-best', store.best.toLocaleString('en-US'));
  $('newrecord').classList.toggle('hidden', !S.newRecord);
  $('btn-revive').classList.toggle('hidden', clear || S.continued || !ads.rewardedAvailable());
  ui.setText('revive-sub', t(ads.isNative ? 'reviveAd' : 'reviveFree'));
}
function finishChapter() {
  const chapter = S.mission.chapter;
  missionProgress = recordChapter(missionProgress, chapter, selDifficulty, S.score, true);
  saveMissionProgress();
  S.newRecord = store.submitBest(S.score); store.setNum('bestWave', Math.max(store.getNum('bestWave', 0), S.wave));
  clearField(); audio.setBoss(false); audio.ready(); Platform.haptic('success');
  showRunResult(true); setState('over'); audio.duckMusic();
}
function gameOver() {
  S.state = 'dying'; S.dieT = 0; S.chapterClear = false;
  if (ui.el.banner) ui.el.banner.classList.add('hidden');
  const p = new THREE.Vector3(S.x, 0, S.z);
  particles.burst(p, new THREE.Color(0xff2bd6), 120, { speed: 9, up: 3, life: 1.2, size: 1.3, grav: 0, color2: new THREE.Color(0x00e5ff) }); audio.boom(true); audio.fail();
  ninja.visible = false; fx.kick({ slowmo: 0.9, glitch: 1 });
  setTimeout(() => {
    if (S.demo) { beginRun(); return; }
    S.newRecord = store.submitBest(S.score); store.setNum('bestWave', Math.max(store.getNum('bestWave', 0), S.wave));
    if (S.wave <= CAMPAIGN_LEVELS) {
      saveLevelResult(S.wave, S.score - (S.levelStartScore || 0), false);
      missionProgress = recordChapter(missionProgress, S.mission.chapter, selDifficulty, S.score, false); saveMissionProgress();
    }
    showRunResult(false);
    setState('over'); audio.duckMusic();
  }, 1300);
}
async function revive() {
  if (S.state !== 'over' || S.continued) return; audio.click();
  const r = await ads.rewarded('continue'); if (!r.rewarded) { ui.toast(t('noReward')); return; }
  S.continued = true; S.hp = PLAYER.maxHp; S.sinceHit = 99; S.invuln = 3; ebullets.clear(); ninja.visible = true;
  S.ult = 100; S.ults[S.weapon] = 100;
  // clean restart of the power systems: no stale overdrive / cease-fire / ult
  S.odT = -1; S.noFireT = 0; S.ultT = -1; S.ultMode = null; S.ultFireT = 0; S.novaR = 0;
  beam.visible = false; beam.material.opacity = 0; novaUlt.visible = false; for (const m of beamExtras) { m.visible = false; m.material.opacity = 0; }
  setState('playing'); audio.unduckMusic(); ui.banner(t('revived'), '', t('ultFull'));
}
async function retry() { if (S.state !== 'over') return; audio.click(); await ads.naturalBreak('gameover'); ninja.visible = true; beginRun(); }
async function overToMenu() { if (S.state !== 'over') return; await ads.naturalBreak('gameover'); ninja.visible = true; showAttract(); }
function pause() { if (S.state !== 'playing') return; if (ui.el.banner) ui.el.banner.classList.add('hidden'); setState('paused'); audio.duckMusic(); audio.back(); }
function resume() { if (S.state !== 'paused') return; setState('playing'); audio.unduckMusic(); audio.click(); }

// ---------------------------------------------------------------- input: relative drag + keys
const keys = new Set(); let drag = null;
addEventListener('keydown', (e) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) { keys.add(e.code); e.preventDefault(); } });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function worldPerPx() { const a = stage.toScreen(new THREE.Vector3(-FIELD.halfW, 0, 0)), b = stage.toScreen(new THREE.Vector3(FIELD.halfW, 0, 0)); return (FIELD.halfW * 2) / Math.max(40, b.x - a.x); }
const cv = $('scene');
cv.addEventListener('pointerdown', (e) => { if (S.state !== 'playing' || S.demo) return; drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: S.x, pz: S.z, k: worldPerPx() * PLAYER.dragGain * C().speed }; try { cv.setPointerCapture(e.pointerId); } catch {} });
cv.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; S.tx = drag.px + (e.clientX - drag.sx) * drag.k; S.tz = drag.pz + (e.clientY - drag.sy) * drag.k * 1.25; });
const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

// ——— Hangar: craft page → weapon page → mission / difficulty → launch ———
const LOADOUT_KEY = 'lastLoadout';
const readLoadout = () => {
  const v = store.getJSON(LOADOUT_KEY, null);
  if (!v || !CRAFTS[v.craft] || !WEAPON_KEYS.includes(v.weapon)) return null;
  return v;
};
const saveLoadout = () => store.setJSON(LOADOUT_KEY, { craft: S.craft, weapon: selWeapon, chapter: selChapter, difficulty: selDifficulty });
// Save point (Roy 2026-11-05): abandoning mid-run stores the chapter being played, and the
// next launch restarts that chapter from its first stage. `resume` wins over `lastLoadout`.
const RESUME_KEY = 'resume';
const readResume = () => {
  const v = store.getJSON(RESUME_KEY, null);
  return v && Number.isFinite(v.chapter) ? v : null;
};
function saveResume() {
  if (S.demo || flags.autostart) return;
  const ch = Math.max(1, Math.min(CHAPTER_COUNT, Math.ceil(Math.min(S.wave, CAMPAIGN_LEVELS) / LEVELS_PER_CHAPTER)));
  store.setJSON(RESUME_KEY, { chapter: ch, difficulty: selDifficulty, at: Date.now() });
}
/** One-tap launch: reuse the saved airframe / weapon / chapter without the three pages.
 *  Returns false when nothing valid is stored yet, so the first run still shows the pages. */
function quickStart() {
  const v = readLoadout();
  const r = readResume();
  if (!v && !r) return false;
  let ch = Math.max(1, Math.min(CHAPTER_COUNT, Math.round((r && r.chapter) || (v && v.chapter) || 1)));
  if (!isChapterUnlocked(missionProgress, ch)) ch = Math.max(1, Math.min(CHAPTER_COUNT, Math.round((v && v.chapter) || 1)));
  if (!isChapterUnlocked(missionProgress, ch)) return false;
  // if that chapter is already cleared but progress has moved on, continue where the player is now
  const ahead = Math.max(1, Math.min(CHAPTER_COUNT, Math.ceil(missionProgress.unlocked / LEVELS_PER_CHAPTER)));
  if (ahead > ch && chapterClears(missionProgress, ch) > 0 && isChapterUnlocked(missionProgress, ahead)) ch = ahead;
  let diff = DIFFICULTIES[(r && r.difficulty) || (v && v.difficulty)] ? ((r && r.difficulty) || v.difficulty) : 'story';
  if (!isDifficultyUnlocked(missionProgress, ch, diff)) diff = 'story';
  if (!isDifficultyUnlocked(missionProgress, ch, diff)) return false;
  setCraft((v && v.craft) || S.craft, true);
  selWeapon = (v && v.weapon) || selWeapon; store.set('startWeapon', selWeapon);
  selDifficulty = diff; store.set('difficulty', diff); S.difficulty = diff;
  PLAYER.maxHp = C().hp + D().bonusHp;
  selChapter = ch; selWave = (ch - 1) * LEVELS_PER_CHAPTER + 1;
  startSelectedMission();
  return true;
}
const hangarOpen = () => !$('screen-hangar').classList.contains('hidden');
const weaponOpen = () => !$('screen-weapon').classList.contains('hidden');
const missionOpen = () => !$('screen-mission').classList.contains('hidden');
const difficultyOpen = () => !$('screen-difficulty').classList.contains('hidden');
function openHangar() { renderCraftSelect(); renderCraftInfo(); ensurePreview(); closeWeapon(); closeMission(); $('screen-hangar').classList.remove('hidden'); }
function closeHangar() { $('screen-hangar').classList.add('hidden'); }
function openWeapon() { renderWeaponSelect(); renderWeaponInfo(); renderTechTree(); closeMission(); $('screen-hangar').classList.add('hidden'); $('screen-weapon').classList.remove('hidden'); syncWeaponVideo(); }
function closeWeapon() { $('screen-weapon').classList.add('hidden'); const v = $('weapon-video'); if (v) v.pause(); }
function closeMission() { $('screen-mission').classList.add('hidden'); }
function confirmWeapon() { closeWeapon(); closeHangar(); openDifficulty(); }
function startSelectedMission() {
  if (!isChapterUnlocked(missionProgress, selChapter) || !isDifficultyUnlocked(missionProgress, selChapter, selDifficulty)) return;
  selWave = (selChapter - 1) * LEVELS_PER_CHAPTER + 1;
  saveLoadout(); saveResume();
  closeMission(); closeWeapon(); closeHangar(); beginRun();
}

createInput({
  anyGesture() { audio.init(); audio.startMusic(); },
  action(a) {
    if (ui.modalOpen) { if (a === 'pause') ui.closeModal(); return; }
    if (a === 'primary') { if (S.state === 'attract') { if (difficultyOpen()) startFromDifficulty(); else if (weaponOpen()) confirmWeapon(); else if (hangarOpen()) openWeapon(); else if (missionOpen()) showAttract(); else openHangar(); } else if (S.state === 'playing') doUlt(); else if (S.state === 'paused') resume(); else if (S.state === 'over') retry(); }
    else if (a === 'pause') { if (difficultyOpen()) { closeDifficulty(); openWeapon(); } else if (missionOpen()) { showAttract(); } else if (weaponOpen()) { closeWeapon(); openHangar(); } else if (hangarOpen()) closeHangar(); else if (S.state === 'playing') pause(); else if (S.state === 'paused') resume(); }
    else if (a === 'mute') { audio.init(); ui.setMuted(audio.toggleMute()); }
    else if (a === 'ult') doUlt();
    else if (a === 'overdrive') doOverdrive();
    else if (a === 'restart' && S.state === 'over') retry();
    else if (a === 'fps') $('fps').classList.toggle('hidden');
  },
}, { swipe: 'once', actions: { KeyX: 'ult', KeyJ: 'ult', KeyK: 'ult', KeyQ: 'overdrive', KeyO: 'overdrive' } });
ui.on('btn-start', () => { audio.init(); if (S.demo || flags.autostart) beginRun(); else openHangar(); });
ui.on('btn-chapters', () => { audio.init(); try { audio.select(); } catch (_) {} openChapters(); });
ui.on('btn-difficulty-back', () => { audio.back(); closeDifficulty(); openWeapon(); });
ui.on('btn-difficulty-go', () => { audio.init(); try { audio.click(); } catch (_) {} startFromDifficulty(); });
ui.on('btn-hangar-next', () => { audio.init(); try { audio.click(); } catch (_) {} openWeapon(); });
ui.on('btn-hangar-back', () => { audio.back(); closeHangar(); });
ui.on('btn-weapon-back', () => { audio.back(); closeWeapon(); openHangar(); });
ui.on('btn-weapon-go', () => { audio.init(); audio.click(); confirmWeapon(); });
ui.on('btn-mission-back', () => { audio.back(); closeMission(); openWeapon(); });
ui.on('btn-mission-back', () => { audio.back(); showAttract(); });
const __hub = readHub();
if (shouldShowArcadeMenu(__hub)) { const b = document.getElementById('btn-arcade-menu'); if (b) b.classList.remove('hidden'); }
ui.on('btn-arcade-menu', () => { try { audio.back(); } catch {} returnToHub({ gameId: 'cyber-ninja', openStore: false }); });

ui.on('btn-resume', resume); ui.on('btn-quit', () => { if (S.state === 'playing' || S.state === 'paused') saveResume(); audio.back(); showAttract(); });
addEventListener('pagehide', () => { if (S.state === 'playing' || S.state === 'paused') saveResume(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && (S.state === 'playing' || S.state === 'paused')) saveResume(); });

// ---------------------------------------------------------------- start-screen: craft select + weapon tech tree
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const CRAFT_SVG = {
  falcon: (c, a) => `<svg viewBox="0 0 96 48" aria-hidden="true"><path d="M48 3 L52 15 L61 21 L89 34 L86 39 L59 33 L55 42 L48 45 L41 42 L37 33 L10 39 L7 34 L35 21 L44 15 Z" fill="rgba(8,16,29,.9)" stroke="${c}" stroke-width="1.4"/><path d="M48 7 L51 20 L48 31 L45 20 Z" fill="${a}" opacity=".8"/><path d="M37 19 L24 18 L16 23 M59 19 L72 18 L80 23 M40 32 L38 41 M56 32 L58 41" fill="none" stroke="${c}" stroke-width="1.2"/><circle cx="42" cy="38" r="2" fill="${a}"/><circle cx="54" cy="38" r="2" fill="${a}"/></svg>`,
  bastion: (c, a) => `<svg viewBox="0 0 96 48" aria-hidden="true"><path d="M48 4 L59 10 L64 15 L77 13 L86 22 L84 38 L66 41 L58 45 L38 45 L30 41 L12 38 L10 22 L19 13 L32 15 L37 10 Z" fill="rgba(8,16,29,.92)" stroke="${c}" stroke-width="1.5"/><path d="M48 8 L58 16 L56 32 L48 37 L40 32 L38 16 Z" fill="${a}" opacity=".32" stroke="${a}"/><path d="M18 20 L29 22 L28 35 L17 33 Z M78 20 L67 22 L68 35 L79 33 Z" fill="none" stroke="${c}"/><path d="M14 15 L14 29 M82 15 L82 29" stroke="${a}" stroke-width="2"/><circle cx="35" cy="40" r="2" fill="${a}"/><circle cx="43" cy="42" r="2" fill="${c}"/><circle cx="53" cy="42" r="2" fill="${c}"/><circle cx="61" cy="40" r="2" fill="${a}"/></svg>`,
  wraith: (c, a) => `<svg viewBox="0 0 96 48" aria-hidden="true"><path d="M48 3 L55 15 L91 35 L90 40 L58 32 L53 44 L48 40 L43 44 L38 32 L6 40 L5 35 L41 15 Z" fill="rgba(8,12,25,.94)" stroke="${c}" stroke-width="1.4"/><path d="M48 7 L51 22 L48 35 L45 22 Z" fill="${a}" opacity=".55"/><path d="M44 17 L17 34 M52 17 L79 34 M39 29 L20 36 M57 29 L76 36" fill="none" stroke="${a}" stroke-width="1" opacity=".85"/><path d="M43 37 L46 36 M50 36 L53 37" stroke="${c}" stroke-width="2.5"/></svg>`,
};
const statBars = (n) => `<span class="bars">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
function renderCraftSelect() {
  const lang = i18n.isZh() ? 'zh' : 'en';
  const row = $('craft-row'); if (!row) return;
  row.innerHTML = CRAFT_KEYS.map((k) => {
    const c = CRAFTS[k];
    return `<button type="button" class="hs-btn ${S.craft === k ? 'sel' : ''}" data-craft="${k}" style="--cc:${hex(c.color)}">
      <span class="hs-svg">${CRAFT_SVG[k](hex(c.color), hex(c.accent))}</span>
      <span class="hs-name">${c.name[lang]}</span>
      <span class="hs-code">${c.code[lang]} · ${c.role[lang]}</span>
    </button>`;
  }).join('');
  for (const b of row.querySelectorAll('[data-craft]')) b.addEventListener('click', () => { if (S.craft === b.dataset.craft) return; audio.init(); audio.select(); setCraft(b.dataset.craft); });
}
function renderCraftInfo() {
  const lang = i18n.isZh() ? 'zh' : 'en';
  const c = craftOf(S.craft);
  const info = $('craft-info');
  if (info) info.style.setProperty('--cc', hex(c.color));
  const idEl = $('craft-id');
  if (idEl) idEl.innerHTML = `<b style="--cc:${hex(c.color)}">${c.name[lang]}</b><span style="--cc:${hex(c.color)}">${c.code[lang]} · ${c.role[lang]}</span>`;
  const pvEl = $('craft-passive');
  if (pvEl) pvEl.textContent = c.passive[lang];
  const blEl = $('craft-blurb');
  if (blEl) blEl.textContent = c.blurb[lang];
  const stEl = $('craft-stats');
  if (stEl) {
    const stats = [
      [t('statHp'), Math.round(c.hp / 4 * 5)],
      [t('statDmg'), Math.round(c.dmg / 1.3 * 5)],
      [t('statSpd'), Math.round(c.speed / 1.15 * 5)],
      [t('statChg'), Math.round(c.charge / 1.4 * 5)],
    ];
    stEl.style.setProperty('--cc', hex(c.color));
    stEl.innerHTML = stats.map(([l, n]) => `<span class="cc-stat"><em>${l}</em>${statBars(n)}</span>`).join('');
  }
}
const ULT_SVG = {
  pulse: (c) => `<svg viewBox="0 0 30 30"><g fill="none" stroke="${c}" stroke-width="1.6"><path d="M15 26 L15 4 M15 26 L6 10 M15 26 L24 10 M15 26 L2 18 M15 26 L28 18"/></g></svg>`,
  lance: (c) => `<svg viewBox="0 0 30 30"><path d="M15 2 L18 12 L28 15 L18 18 L15 28 L12 18 L2 15 L12 12 Z" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="15" cy="15" r="3" fill="${c}"/></svg>`,
  nova: (c) => `<svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="4" fill="${c}"/><circle cx="15" cy="15" r="9" fill="none" stroke="${c}" stroke-width="1.4" opacity=".8"/><circle cx="15" cy="15" r="13.5" fill="none" stroke="${c}" stroke-width="1" opacity=".5"/></svg>`,
};
function levelStat(key, lv) {
  const L = WEAPONS[key].levels[lv - 1];
  const lang = i18n.isZh() ? 'zh' : 'en';
  if (key === 'pulse') return lang === 'zh' ? `${L.shots.length}彈` : `${L.shots.length}SH`;
  if (key === 'lance') return lang === 'zh' ? `貫${L.pierce}` : `P${L.pierce}`;
  return lang === 'zh' ? `範${L.aoe}` : `R${L.aoe}`;
}
// the 6-level tech tree now lives on the weapon page and follows the selected weapon
function renderTechTree() {
  const det = $('tree-detail'); if (!det) return;
  const lang = i18n.isZh() ? 'zh' : 'en';
  const key = selWeapon;
  const w = WEAPONS[key];
  const nodes = w.levels.map((L, i) => `<div class="td-node"><div class="nd ${i === 5 ? 'max' : ''}"><i>${i + 1}</i></div><small>${levelStat(key, i + 1)}<br>${L.dmg}${lang === 'zh' ? '傷' : 'DMG'}</small></div>`).join('');
  det.style.setProperty('--tc', hex(w.color));
  det.innerHTML = `
    <div class="td-evolution">${t('levelFx.' + key)}</div>
    <div class="td-ult"><span class="u-ico">${ULT_SVG[key](hex(w.color))}</span><div><b>${w.ult[lang]}</b><small>${t('ultDesc.' + key)}</small></div></div>
    <div class="td-nodes">${nodes}</div>`;
}

// ---------------------------------------------------------------- hangar 3D preview (top stage)
let pv = null;
function ensurePreview() {
  if (pv) return pv;
  const canvas = $('craft-canvas'); if (!canvas) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const sc = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  cam.position.set(0, 2.35, 6.8); cam.lookAt(0, -0.08, 0);
  sc.add(new THREE.HemisphereLight(0x9fc0ff, 0x1a0b2e, 1.5));
  const keyL = new THREE.DirectionalLight(0xffffff, 2.0); keyL.position.set(2.5, 4, 3); sc.add(keyL);
  const rimL = new THREE.DirectionalLight(0xff2bd6, 1.5); rimL.position.set(-3, 1.5, -2.5); sc.add(rimL);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.55, 40), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -0.62; sc.add(disc);
  pv = { renderer, sc, cam, disc, model: null };
  pvSetModel(craftOf(S.craft));
  return pv;
}
function pvSetModel(c) {
  if (!pv) return;
  if (pv.model) { pv.sc.remove(pv.model); disposeNinja(pv.model); }
  const m = makeNinja(c); m.scale.setScalar(1.42); m.rotation.y = Math.PI + 0.55; pv.sc.add(m); pv.model = m;
  pv.disc.material.color.setHex(c.color);
}
function sizePreview() {
  if (!pv) return;
  const canvas = pv.renderer.domElement;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const pr = pv.renderer.getPixelRatio();
  if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) {
    pv.renderer.setSize(w, h, false);
    pv.cam.aspect = w / h; pv.cam.updateProjectionMatrix();
  }
}
function renderPreview(dt) {
  if (!pv || !hangarOpen()) return;
  sizePreview();
  pv.model.rotation.y += dt * 0.65;
  updateNinja(pv.model, dt, S.t, 0, 0, 0.55);
  pv.renderer.render(pv.sc, pv.cam);
}

// ---------------------------------------------------------------- weapon-select page: captured real gameplay
// The clips are recorded from this game's actual renderer at LV.6 and include
// each weapon's ultimate. Video uses one lightweight element instead of a second
// WebGL scene, leaving the phone's GPU budget for the craft preview and gameplay.
function syncWeaponVideo() {
  const v = $('weapon-video'); if (!v) return;
  const src = `./assets/weapon-${selWeapon}.webm`;
  const poster = `./assets/weapon-${selWeapon}-poster.jpg`;
  if (v.dataset.weapon !== selWeapon) {
    v.pause(); v.dataset.weapon = selWeapon; v.poster = poster; v.src = src; v.load();
  }
  if (weaponOpen()) v.play().catch(() => { /* poster remains until a user gesture */ });
}
function renderWeaponSelect() {
  const lang = i18n.isZh() ? 'zh' : 'en';
  const row = $('weapon-row'); if (!row) return;
  row.innerHTML = WEAPON_KEYS.map((k) => {
    const w = WEAPONS[k];
    return `<button type="button" class="hs-btn ${selWeapon === k ? 'sel' : ''}" data-wsel="${k}" style="--cc:${hex(w.color)}">
      <span class="hs-svg">${ULT_SVG[k](hex(w.color))}</span>
      <span class="hs-name">${w.short[lang]}</span>
      <span class="hs-code">${w.name[lang === 'zh' ? 'en' : 'zh']}</span>
    </button>`;
  }).join('');
  for (const b of row.querySelectorAll('[data-wsel]')) b.addEventListener('click', () => { if (selWeapon === b.dataset.wsel) return; audio.init(); audio.select(); selWeapon = b.dataset.wsel; store.set('startWeapon', selWeapon); renderWeaponSelect(); renderWeaponInfo(); renderTechTree(); syncWeaponVideo(); });
}
function renderWeaponInfo() {
  const lang = i18n.isZh() ? 'zh' : 'en';
  const w = WEAPONS[selWeapon];
  const L = w.levels[0];
  const idEl = $('weapon-id');
  if (idEl) idEl.innerHTML = `<b style="--tc:${hex(w.color)}">${w.name[lang]}</b><span style="--tc:${hex(w.color)}">${w.name[lang === 'zh' ? 'en' : 'zh']}</span>`;
  const sEl = $('weapon-stats');
  if (sEl) {
    sEl.style.setProperty('--cc', hex(w.color));
    const trait = selWeapon === 'pulse' ? (lang === 'zh' ? '直射＋追蹤' : 'DIRECT + HOMING') : selWeapon === 'lance' ? (lang === 'zh' ? `貫穿 ×${L.pierce}` : `PIERCE ${L.pierce}`) : (lang === 'zh' ? `命中爆炸 ${L.aoe}` : `IMPACT AOE ${L.aoe}`);
    sEl.innerHTML = [
      [lang === 'zh' ? '傷害' : 'DMG', L.dmg],
      [lang === 'zh' ? '彈數' : 'SHOTS', L.shots.length],
      [lang === 'zh' ? '射速' : 'RATE', (1 / L.rate).toFixed(1) + '/s'],
      [lang === 'zh' ? '特性' : 'TRAIT', trait],
    ].map(([l, v]) => `<span class="ws-stat"><em>${l}</em><b>${v}</b></span>`).join('');
  }
}
const difficultyAnywhere = (k) => {
  if (k === 'story') return true;
  const need = k === 'normal' ? 'story' : 'normal';
  return Object.values(missionProgress.chapters).some(c => ((c.difficulties?.[need]?.clears) || 0) > 0);
};
function renderDifficultyCards() {
  const row = $('difficulty-row2'); if (!row) return;
  row.innerHTML = DIFFICULTY_ORDER.map(k => {
    const unlocked = difficultyAnywhere(k);
    return `<button type="button" class="diff-btn ${selDifficulty === k ? 'sel' : ''}" data-diff="${k}" ${unlocked ? '' : 'disabled'}><b>${unlocked ? t('diff.' + k) : '◇ ' + t('diff.' + k)}</b><small>${unlocked ? t('diffTag.' + k) : t('difficultyLocked')}</small></button>`;
  }).join('');
  const desc = $('difficulty-desc2'); if (desc) desc.textContent = t('diffDesc.' + selDifficulty);
  const orb = $('diff-orb');
  if (orb) {
    orb.className = 'diff-orb ' + selDifficulty;
    const sym = selDifficulty === 'story' ? '◇' : selDifficulty === 'normal' ? '◈' : '◆';
    for (const f of orb.querySelectorAll('.face')) f.textContent = sym;
  }
  const idEl = $('difficulty-id');
  if (idEl) idEl.innerHTML = `<b>${t('diff.' + selDifficulty)}</b><span>${t('diffTag.' + selDifficulty)}</span>`;
  for (const b of row.querySelectorAll('[data-diff]')) b.addEventListener('click', () => {
    const key = b.dataset.diff;
    if (!difficultyAnywhere(key) || selDifficulty === key) return;
    audio.init(); audio.select(); selDifficulty = key; S.difficulty = selDifficulty; store.set('difficulty', selDifficulty);
    PLAYER.maxHp = C().hp + D().bonusHp; renderDifficultyCards();
  });
}
function openDifficulty() {
  if (!difficultyAnywhere(selDifficulty)) selDifficulty = 'story';
  S.difficulty = selDifficulty; PLAYER.maxHp = C().hp + D().bonusHp;
  renderDifficultyCards(); $('screen-difficulty').classList.remove('hidden');
}
function closeDifficulty() { $('screen-difficulty').classList.add('hidden'); }
function startFromDifficulty() {
  if (!difficultyAnywhere(selDifficulty)) return;
  const scr = $('screen-difficulty');
  if (scr) {
    scr.classList.add('deploying');
    audio.ready(); try { audio.confirm(); } catch (_) {}
    Platform.haptic('heavy');
    setTimeout(() => { scr.classList.remove('deploying'); launchFromDifficulty(); }, 520);
    return;
  }
  launchFromDifficulty();
}
function launchFromDifficulty() {
  if (!difficultyAnywhere(selDifficulty)) return;
  selChapter = 1; selWave = 1;
  saveLoadout(); saveResume();
  closeDifficulty(); closeWeapon(); closeHangar();
  beginRun();
}
function openChapters() { renderChapters(); $('screen-mission').classList.remove('hidden'); }
function renderChapters() {
  const nav = $('chapter-nav'); if (!nav) return;
  const lang = i18n.isZh() ? 'zh' : 'en';
  nav.innerHTML = Array.from({ length: CHAPTER_COUNT }, (_, i) => {
    const chapter = i + 1, first = i * LEVELS_PER_CHAPTER + 1;
    const unlocked = isChapterUnlocked(missionProgress, chapter), cleared = chapterClears(missionProgress, chapter) > 0;
    const m = campaignForWave(first);
    return `<button type="button" class="chapter-btn ${selChapter === chapter ? 'sel' : ''} ${cleared ? 'done' : ''}" data-chapter="${chapter}" ${unlocked ? '' : 'disabled'}><b>${String(chapter).padStart(2, '0')}</b><span>${unlocked ? m.name[lang] : t('locked')}</span></button>`;
  }).join('');
  for (const b of nav.querySelectorAll('[data-chapter]')) b.addEventListener('click', () => {
    const chapter = Number(b.dataset.chapter);
    if (!isChapterUnlocked(missionProgress, chapter)) return;
    audio.select(); selChapter = chapter; renderChapters();
  });
  const selected = campaignForWave((selChapter - 1) * LEVELS_PER_CHAPTER + 1);
  const idx = $('record-index');
  if (idx) idx.textContent = lang === 'zh' ? `第 ${selChapter} 章` : `CHAPTER ${selChapter}`;
  const nameEl = $('mission-name'); if (nameEl) nameEl.textContent = selected.name[lang];
  const storyEl = $('mission-story'); if (storyEl) storyEl.textContent = selected.story[lang];
  const bestEl = $('chapter-best'); if (bestEl) bestEl.textContent = chapterBest(missionProgress, selChapter).toLocaleString('en-US');
}
renderCraftSelect(); renderCraftInfo(); renderTechTree(); renderWeaponSelect(); renderWeaponInfo(); renderDifficultyCards();
ui.on('btn-settings-pause', () => { try { audio.click(); } catch (_) {} ui.settings({ audio, stage, onOpen: () => { try { audio.click(); } catch (_) {} } }); }); ui.on('btn-pause', pause);
ui.on('btn-mute', () => { audio.init(); ui.setMuted(audio.toggleMute()); });
$('btn-ult').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); doUlt(); });
$('btn-od').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); doOverdrive(); });
i18n.bindToggle($('btn-lang')); const lang2btn = $('btn-lang2'); if (lang2btn) i18n.bindToggle(lang2btn);

ui.mountHowto({
  privacyUrl: './privacy.html',
  onOpen: () => { try { audio.click(); } catch (_) {} },
  getContent: () => ({
    kicker: 'XENO NIGHTMARE',
    title: t('kit.howto'),
    sections: [
      { heading: t('kit.rules'), body: t('help.rules') },
      { heading: t('kit.controls'), body: t('help.controls') },
    ],
  }),
});
ui.mountSettings({
  audio, stage,
  onOpen: () => { try { audio.click(); } catch (_) {} },
});


i18n.onChange(() => { refreshBossName(); if (S.state === 'over') showRunResult(S.chapterClear); renderCraftSelect(); renderCraftInfo(); renderTechTree(); renderWeaponSelect(); renderWeaponInfo(); renderDifficultyCards(); renderChapters(); });
ui.on('btn-retry', retry); ui.on('btn-menu', overToMenu); ui.on('btn-revive', revive);
Platform.onBack(() => { if (ui.closeModal()) return true; if (S.state === 'playing') { pause(); return true; } if (S.state === 'paused') { resume(); return true; } if (S.state === 'over') { overToMenu(); return true; } return false; });
Platform.onPause(() => { if (!S.demo) pause(); });
S.api = {
  wave: (n) => { clearField(); const state = S.state; S.state = 'attract'; S.wave = n - 1; nextWave(); S.state = state; },
  clearStage: () => { if (S.state !== 'playing') return; for (const e of S.enemies) scene.remove(e.g); S.enemies = []; if (S.boss) { scene.remove(S.boss.g); S.boss = null; } nextWave(); },
  ult: () => { S.ult = 100; doUlt(); },
  overdrive: () => { S.odCd = 0; doOverdrive(); },
  craft: (key) => setCraft(key),
  airframe: () => {
    let meshes = 0, vertices = 0;
    ninja.traverse(o => { if (o.isMesh) { meshes++; vertices += o.geometry.attributes.position.count; } });
    return { key: ninja.userData.airframe, engines: ninja.userData.engineCount, meshes, vertices, holoArcs: ninja.userData.spinners.length };
  },
  weapon: (key, level = 1) => { if (!WEAPONS[key]) return; S.ults[S.weapon] = S.ult; S.weapon = key; S.weaponLevels[key] = Math.max(1, Math.min(6, level)); S.power = S.weaponLevels[key]; S.ult = S.ults[key]; S.fireT = 0; updateHUD(); },
  difficulty: (key) => { if (!DIFFICULTIES[key]) return; selDifficulty = key; S.difficulty = key; PLAYER.maxHp = C().hp + D().bonusHp; S.hp = Math.min(S.hp, PLAYER.maxHp); renderDifficultyCards(); updateHUD(); },
  drop: (kind, key) => dropPickup(S.x, S.z - 1.2, kind, key),
  dropAt: (x, z, kind, key) => dropPickup(x, z, kind, key),
  shots: () => ({ pulse: pools.pulse.list.length, lance: pools.lance.list.length, nova: pools.nova.list.length }),
  fx: () => ({ lanceDecor: decorPools.lance.list.length, novaDecor: decorPools.nova.list.length, lightning: lightningBolts.length, beamExtras: beamExtras.filter(m => m.visible).length, novaRings: novaUlt.visible ? novaUltRings.length : 0 }),
  specials: () => ({ homingShots: S.homingShots, homingActive: pools.pulse.list.filter(b => b.homing > 0).length, drones: lanceDrones.filter(d => d.visible).length, droneShots: S.droneShots, supportActive: pools.lance.list.filter(b => b.support).length, novaShots: S.novaShots, novaBigShots: S.novaBigShots, novaBigActive: pools.nova.list.filter(b => b.novaBig).length }),
  bulletData: (kind) => (pools[kind]?.list || []).map(b => ({ x: b.x, z: b.z, vx: b.vx, vz: b.vz, dmg: b.dmg, pierce: b.pierce, aoe: b.aoe, homing: b.homing || 0, support: !!b.support, big: !!b.novaBig })),
  progress: () => JSON.parse(JSON.stringify(missionProgress)),
  pulseVectors: () => pools.pulse.list.map(b => ({ vx: b.vx, vz: b.vz })),
  clearShots: () => { for (const k of WEAPON_KEYS) pools[k].clear(); for (const p of Object.values(decorPools)) p.clear(); },
  threat: () => ({ enemies: S.enemies.length, bullets: ebullets.list.length, hazards: S.hazards.length, gems: S.gems.length, rocks: S.rocks.length, bossPhase: S.boss ? S.boss.phase : null, bossChapter: S.boss ? S.boss.chapter : null, bossPattern: S.boss ? S.boss.lastPattern : null }),
  hazard: () => spawnHazard(),
  rock: () => spawnRock(),
  spawn: (ev) => spawnEnemy(ev),
  killOne: () => { const e = S.enemies[0]; if (e) { e.hp = 0; killEnemy(e, 0); } },
  enemyFire: (x, z, ang, speed) => enemyFire(x, z, ang, speed),
  bossHurt: (dmg) => hurtBoss(dmg),
  charge: (n = 100) => { S.ult = Math.min(100, S.ult + n); S.ults[S.weapon] = S.ult; updateHUD(); },
  kill: () => { S.hp = 1; S.invuln = 0; hurtPlayer(); },
  boss: () => { clearField(); S.wave = 4; nextWave(); },
};

// ---------------------------------------------------------------- autopilot (demo / attract)
function autopilot(dt) {
  let tx = 0, best = 1e9;
  const targets = S.boss ? [S.boss] : S.enemies;
  for (const e of targets) { const d = Math.abs(e.z - S.z) * 0.3 + Math.abs(e.x - S.x); if (e.z < S.z && d < best) { best = d; tx = e.x; } }
  let push = 0;
  for (const b of ebullets.list) { const dz = S.z - b.z; if (dz > -0.5 && dz < 5) { const dx = S.x - b.x; if (Math.abs(dx) < 1.6) push += Math.sign(dx || 0.1) * (1.6 - Math.abs(dx)) * (1 - dz / 5) * 3; } }
  for (const e of S.enemies) if (e.type === 'dasher' && e.mode === 2) { const dx = S.x - e.x; if (Math.abs(dx) < 2.5) push += Math.sign(dx || 1) * 3; }
  for (const e of S.enemies) if (e.type === 'mite') { const dx = S.x - e.x, dz = S.z - e.z, d = Math.hypot(dx, dz); if (d < 3.2 && d > 0.01) push += Math.sign(dx || 0.1) * (3.2 - d) * 0.9; }
  S.tx = THREE.MathUtils.clamp(tx + push * 1.4, -FIELD.halfW + 0.5, FIELD.halfW - 0.5); S.tz = 1.2;
  if (S.ult >= 100 && (S.boss || S.enemies.length >= 6)) doUlt();
}

// ---------------------------------------------------------------- simulation
function sim(dt) {
  const T = S.t;
  // player movement
  if (S.state === 'attract' || S.demo) autopilot(dt);
  let kx = 0, kz = 0; if (keys.has('ArrowLeft') || keys.has('KeyA')) kx--; if (keys.has('ArrowRight') || keys.has('KeyD')) kx++; if (keys.has('ArrowUp') || keys.has('KeyW')) kz--; if (keys.has('ArrowDown') || keys.has('KeyS')) kz++;
  const spd = C().speed;
  const px = S.x;
  if ((kx || kz) && S.state === 'playing' && !S.demo) { S.x += kx * PLAYER.keySpeed * spd * dt; S.z += kz * PLAYER.keySpeed * spd * dt; S.tx = S.x; S.tz = S.z; }
  else if (S.tx !== undefined) { const k = 1 - Math.exp(-dt * (drag ? 28 : 9)); S.x += (S.tx - S.x) * k; S.z += (S.tz - S.z) * k; }
  S.x = THREE.MathUtils.clamp(S.x, -FIELD.halfW + 0.4, FIELD.halfW - 0.4); S.z = THREE.MathUtils.clamp(S.z, FIELD.playerMinZ, FIELD.playerMaxZ);
  if (S.tx !== undefined) { S.tx = THREE.MathUtils.clamp(S.tx, -FIELD.halfW + 0.4, FIELD.halfW - 0.4); S.tz = THREE.MathUtils.clamp(S.tz, FIELD.playerMinZ, FIELD.playerMaxZ); }
  S.vx = (S.x - px) / Math.max(dt, 1e-4);
  S.invuln = Math.max(0, S.invuln - dt);
  ninja.position.set(S.x, 0, S.z);
  // combo decay
  if (S.combo.timer > 0) { S.combo.timer -= dt; if (S.combo.timer <= 0) breakCombo(); }
  S.gemChainT = Math.max(0, S.gemChainT - dt); if (S.gemChainT <= 0) S.gemChain = 0;
  // bastion nano-plating: regenerate a shield after a calm streak
  S.sinceHit += dt;
  const regen = C().regen;
  if (regen && S.sinceHit >= regen && S.hp < PLAYER.maxHp && S.state === 'playing') {
    S.hp++; S.sinceHit = 0; audio.shieldUp(); updateHUD();
    const sp = stage.toScreen(new THREE.Vector3(S.x, 0.9, S.z)); ui.popup(sp.x, sp.y, t('shieldUp'), 'shield-pop');
    particles.burst(new THREE.Vector3(S.x, 0.4, S.z), new THREE.Color(0x3bff8a), 24, { speed: 4, up: 3, life: 0.6, size: 0.9, grav: 0 });
  }
  // overdrive burn / forced cease-fire
  if (S.odT >= 0) {
    S.odT += dt;
    if (S.odT >= OD.duration + C().odBonus) {
      S.odT = -1; S.noFireT = OD.noFire;
      if (S.state === 'playing') { audio.warn(); ui.toast(t('odVent'), 1200); }
    }
  }
  S.noFireT = Math.max(0, S.noFireT - dt);
  S.odCd = Math.max(0, S.odCd - dt);   // fixed 8s overdrive cooldown, no charge meter
  // auto-fire through the current weapon
  S.fireT -= dt;
  if (S.fireT <= 0 && S.noFireT <= 0 && S.ultT < 0) {
    const sol = fireSolution(S.weapon, S.power, S.odT >= 0);
    S.fireT = sol.rate;
    const pool = pools[S.weapon];
    const visualLevel = Math.min(6, S.power + (S.odT >= 0 ? 2 : 0));
    let novaBig = false;
    if (S.weapon === 'nova') {
      S.novaShots++;
      novaBig = visualLevel >= 3 && S.novaShots % 10 === 0;
      if (novaBig) S.novaBigShots++;
    }
    for (const [ox, ang] of sol.shots) {
      const b = pool.add(S.x + ox, S.z - 0.6, Math.sin(ang) * sol.speed, -Math.cos(ang) * sol.speed, {
        kind: S.weapon, level: visualLevel, dmg: sol.dmg * C().dmg * (novaBig ? 1.3 : 1), pierce: sol.pierce || 0, aoe: (sol.aoe || 0) * (novaBig ? 2.15 : 1), hit: new Set(), novaBig,
        scale: (sol.scale || 1) * (S.odT >= 0 ? 1.22 : 1) * (novaBig ? 1.75 : 1), rotX: S.weapon === 'nova' ? Math.PI / 2 : 0,
        scaleX: S.weapon === 'lance' ? .72 + visualLevel * .14 : 1, scaleZ: S.weapon === 'lance' ? .85 + visualLevel * .08 : 1,
        color: S.weapon === 'lance' ? LANCE_COLORS[visualLevel - 1] : S.weapon === 'nova' ? (novaBig ? new THREE.Color(0xffe1a1) : NOVA_COLORS[visualLevel - 1]) : BulletPool.white,
      });
      spawnWeaponDecor(b, S.weapon, visualLevel, S.odT >= 0);
      if (S.weapon === 'lance' && visualLevel >= 3) {
        const forks = 1 + Math.floor((visualLevel - 3) / 2) + (S.odT >= 0 ? 1 : 0);
        for (let j = 0; j < forks; j++) strikeLightning(S.x + ox, S.z - .7, 3.2 + visualLevel * .45, visualLevel >= 5 ? 0xa8f6ff : 0xbca8ff, .65 + visualLevel * .12);
      } else if (S.weapon === 'nova' && visualLevel >= 3) {
        for (let j = 0; j < Math.min(4, visualLevel - 1); j++) particles.emit(new THREE.Vector3(S.x + ox, .38, S.z - .6), new THREE.Vector3((Math.random() - .5) * visualLevel, .5, -2 - Math.random() * 3), NOVA_COLORS[(j + visualLevel) % 6], { life: .28, size: .7, grav: 0 });
      }
    }
    if (S.weapon === 'pulse' && visualLevel >= 3) {
      for (const side of [-1, 1]) {
        pools.pulse.add(S.x + side * .62, S.z - .25, side * 5.5, -20, {
          kind: 'pulse', level: visualLevel, dmg: sol.dmg * C().dmg * .85, pierce: 0, aoe: 1.25, explosive: true, homing: 5, turn: 5.8, hit: new Set(),
          scale: 1.2, scaleZ: 1.25, color: new THREE.Color(0xffcf66),
        });
        S.homingShots++;
      }
    }
    // muzzle flash
    particles.emit(new THREE.Vector3(S.x, 0.35, S.z - 0.8), new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.2, -4), new THREE.Color(C().color), { life: 0.14, size: 0.85, grav: 0 });
    if (S.state === 'playing') audio.shot(S.weapon);
  }
  // Phase Lance support drones follow both wings and fire independent real bolts.
  const droneLevel = Math.min(6, S.power + (S.odT >= 0 ? 2 : 0));
  const dronesDeployed = S.weapon === 'lance' && droneLevel >= 3;
  for (const d of lanceDrones) {
    d.visible = dronesDeployed;
    if (!dronesDeployed) continue;
    const side = d.userData.side;
    d.position.set(S.x + side * 1.28, .36 + Math.sin(S.t * 5 + side) * .08, S.z + .12);
    d.rotation.y += dt * side * 1.8;
    if (d.children[1]) d.children[1].rotation.z += dt * side * 2.5;
  }
  if (dronesDeployed && S.noFireT <= 0 && S.ultT < 0) {
    S.droneFireT -= dt;
    if (S.droneFireT <= 0) {
      const sol = fireSolution('lance', S.power, S.odT >= 0);
      S.droneFireT = Math.max(.18, sol.rate * 1.5);
      for (const d of lanceDrones) {
        const b = pools.lance.add(d.position.x, d.position.z - .25, 0, -sol.speed * .9, {
          kind: 'lance', level: droneLevel, dmg: sol.dmg * C().dmg * .42, pierce: 0, aoe: 0, hit: new Set(), support: true,
          scale: .68, scaleX: .7, scaleZ: .72, color: new THREE.Color(0x8cecff),
        });
        spawnWeaponDecor(b, 'lance', Math.min(droneLevel, 2), false);
        S.droneShots++;
      }
    }
  } else S.droneFireT = 0;
  // waves
  S.waveT += dt;
  if (!S.spec.boss) {
    const evs = S.spec.events;
    while (S.nextEv < evs.length && evs[S.nextEv].t <= S.waveT) spawnEnemy(evs[S.nextEv++]);
    if (S.nextEv >= evs.length && !S.enemies.length) { S.betweenT += dt; if (S.betweenT > 1.4) nextWave(); }
  } else if (!S.boss) { S.betweenT += dt; if (S.betweenT > 2.2) nextWave(); }
  // terrain hazard: a telegraphed vertical sweep cuts one lane of the map
  S.hazardT -= dt;
  if (S.hazardT <= 0 && S.state === 'playing' && !S.demo && S.wave > 1) {
    spawnHazard(); S.hazardT = (8 + Math.random() * 5) * (S.mission?.map.hazard || 1) / D().fireRate;
  }
  for (let i = S.hazards.length - 1; i >= 0; i--) {
    const h = S.hazards[i]; h.t += dt;
    const warn = h.t < 1.1;
    h.g.material.color.setHex(warn ? 0xffc22b : 0xff2b5c);
    h.g.material.opacity = warn ? 0.10 + 0.10 * Math.sin(h.t * 18) : 0.42;
    h.g.scale.x = warn ? 0.55 : 1;
    if (!warn && h.t < 2.1 && S.state === 'playing' && Math.abs(S.x - h.x) < 0.55) hurtPlayer();
    if (h.t > 2.2) { scene.remove(h.g); S.hazards.splice(i, 1); }
  }
  // drifting debris: slow map obstacles that force a lateral decision
  S.rockT -= dt;
  if (S.rockT <= 0 && S.state === 'playing' && !S.demo && S.wave > 1) { spawnRock(); S.rockT = (8 + Math.random() * 5) * (S.mission?.map.rocks || 1) / D().fireRate; }
  for (let i = S.rocks.length - 1; i >= 0; i--) {
    const r = S.rocks[i]; r.t += dt; r.x += r.vx * dt; r.z += r.vz * dt;
    r.g.position.set(r.x, 0.45 + Math.sin(r.t * 1.4) * 0.12, r.z);
    r.g.userData.spin.rotation.x += dt * 0.35; r.g.userData.spin.rotation.y += dt * 0.22;
    if (S.state === 'playing' && Math.hypot(r.x - S.x, r.z - S.z) < r.r + PLAYER.radius) hurtPlayer();
    if (r.z > FIELD.bottom + 3) { scene.remove(r.g); S.rocks.splice(i, 1); }
  }
  // gems: scatter briefly, then home into the craft automatically
  for (let i = S.gems.length - 1; i >= 0; i--) {
    const gm = S.gems[i]; gm.t += dt;
    if (gm.t < 0.55) {
      gm.x += gm.vx * dt; gm.z += gm.vz * dt; gm.vx *= 0.94; gm.vz *= 0.94;
    } else {
      const dx = S.x - gm.x, dz = S.z - gm.z, d = Math.max(0.001, Math.hypot(dx, dz));
      const pull = 26 + Math.min(40, gm.t * 10), swirl = gm.tier === 2 ? 3.4 : 2.4;
      gm.vx += ((dx / d) * pull + (-dz / d) * swirl) * dt; gm.vz += ((dz / d) * pull + (dx / d) * swirl) * dt;
      gm.vx *= 0.97; gm.vz *= 0.97;
      gm.x += gm.vx * dt; gm.z += gm.vz * dt;
      if (d < 0.9) {
        S.score += gm.value * S.combo.mult;
        S.gemChain = Math.min(24, S.gemChain + 1); S.gemChainT = 0.9;
        S.ult = Math.min(100, S.ult + chargeGain(gm.energy)); S.ults[S.weapon] = S.ult;
        
        if (S.state === 'playing' && (gm.tier === 2 || Math.random() < 0.22)) audio.gem(S.gemChain);
        particles.emit(new THREE.Vector3(gm.x, 0.3, gm.z), new THREE.Vector3(0, 1.5, 0), new THREE.Color(gm.tier === 2 ? 0xffc22b : gm.tier === 1 ? 0xff2bd6 : 0x00e5ff), { life: 0.3, size: 0.5 });
        scene.remove(gm.g); S.gems.splice(i, 1); continue;
      }
    }
    gm.g.position.set(gm.x, 0.35 + Math.sin(gm.t * 8) * 0.08, gm.z); gm.g.rotation.y = gm.t * 4; gm.g.rotation.z = gm.t * 2.2;
    if (gm.g.userData.halo) gm.g.userData.halo.rotation.z = gm.t * 5;
  }
  const sc = speedScale(S.wave);
  for (let i = S.enemies.length - 1; i >= 0; i--) {
    const e = S.enemies[i]; e.t += dt; e.flash = Math.max(0, e.flash - dt * 6);
    if (e.type === 'drone') {
      e.z += e.vz * dt;
      const chase = e.pattern === 'dive' ? 0.85 : 0.25;
      e.x += (S.x - e.x) * dt * chase;
      e.x += Math.sin(e.t * 2.2 + e.phase) * dt * (e.pattern === 'strafe' ? 2.4 : 0.5);
      e.x = THREE.MathUtils.clamp(e.x, -FIELD.halfW + 0.5, FIELD.halfW - 0.5);
    } else if (e.type === 'weaver') {
      e.z += e.vz * dt;
      e.x = THREE.MathUtils.clamp(e.baseX + Math.sin(e.t * 2.6 + e.phase) * 3.0, -FIELD.halfW + 0.5, FIELD.halfW - 0.5);
    } else if (e.type === 'turret') {
      if (e.mode === 0) { e.z += e.vz * dt; if (e.z >= e.stopZ) { e.mode = 1; e.holdT = 0; } }
      else if (e.mode === 1) { e.holdT += dt; if (e.holdT > 7) e.mode = 2; }
      else e.z += e.vz * 1.5 * dt;
      if (e.g.userData.head) e.g.userData.head.rotation.y = aimAt(e.x, e.z);
    } else if (e.type === 'dasher') {
      if (e.mode === 0) { e.z += e.vz * 0.7 * dt; e.x += (S.x - e.x) * dt * 0.6; if (e.z > -12) { e.mode = 1; e.chargeT = 0.55; } }
      else if (e.mode === 1) { e.chargeT -= dt; e.flash = 0.6; if (e.chargeT <= 0) { e.mode = 2; const a = aimAt(e.x, e.z); e.dvx = Math.sin(a) * e.vz * 5.0; e.dvz = Math.cos(a) * e.vz * 5.0; } }
      else { e.x += e.dvx * dt; e.z += e.dvz * dt; }
      e.g.rotation.y = e.mode === 2 ? Math.atan2(e.dvx, e.dvz) : aimAt(e.x, e.z);
    } else if (e.type === 'splitter') {
      // brood carrier drifts toward mid-field, swaying; pops mites when destroyed
      e.z += e.vz * dt;
      e.x += (S.x - e.x) * dt * 0.3 + Math.sin(e.t * 1.8 + e.phase) * dt * 0.9;
      e.x = THREE.MathUtils.clamp(e.x, -FIELD.halfW + 0.5, FIELD.halfW - 0.5);
    } else if (e.type === 'mite') {
      // burst out of the wreck, then hunt the player with ramping speed
      if (e.t < 0.38) { e.x += e.vx * dt; e.z += e.vz * dt; }
      else {
        const sp = Math.min(10.5, e.def.speed * (1 + Math.min(1.4, e.t * 0.4)));
        const a = Math.atan2(S.x - e.x, S.z - e.z);
        e.x += Math.sin(a) * sp * dt; e.z += Math.cos(a) * sp * dt;
        e.g.rotation.y = a; e.g.rotation.x += dt * 9;
      }
    }
    // Shooters only: a 0.5 s muzzle telegraph, then a slow 3-shot aimed spread.
    // Rushers never fire, so the player always has a window where moving is safe and shots still land.
    if (e.role === 'shooter' && S.state === 'playing' && e.z > FIELD.top + 1 && e.z < S.z + 1) {
      if (e.telegraphT > 0) {
        e.telegraphT -= dt;
        e.flash = Math.max(e.flash, 0.5);
        if (e.telegraphT <= 0) {
          const a = aimAt(e.x, e.z);
          const spread = e.elite ? [-0.22, -0.11, 0, 0.11, 0.22] : [-0.14, 0, 0.14];
          for (const o of spread) enemyFire(e.x, e.z + 0.4, a + o, ENEMY_BULLET_SPEED);
          e.fireT = e.def.fire / sc;
          if (S.state === 'playing') audio.enemyShot();
        }
      } else {
        e.fireT -= dt * sc * D().fireRate;
        if (e.fireT <= 0) e.telegraphT = 0.5;
      }
    }
    if (e.g.userData.spin) e.g.userData.spin.rotation.z += dt * 3;
    e.g.position.set(e.x, Math.sin(e.t * 3 + e.phase) * 0.15, e.z);
    e.g.userData.mat.emissive && e.g.userData.mat.emissive.setScalar(e.flash);
    if (e.z > FIELD.bottom + 2 || Math.abs(e.x) > FIELD.halfW + 4) { scene.remove(e.g); S.enemies.splice(i, 1); continue; }
    if (Math.hypot(e.x - S.x, e.z - S.z) < e.def.radius + PLAYER.radius) { hurtPlayer(); e.hp = 0; killEnemy(e, i); }
  }
  // boss: three phases, each with a different pressure pattern
  const B = S.boss;
  if (B) {
    B.t += dt;
    if (B.entering) { B.z += 3 * dt; if (B.z >= -15) { B.entering = false; B.phase = 1; B.atk = 0; B.atkT = 1.2; } }
    else {
      const phase = B.hp > B.maxHp * 0.66 ? 1 : B.hp > B.maxHp * 0.33 ? 2 : 3;
      if (phase !== B.phase) {
        B.phase = phase; B.atkT = 0.9; B.phaseT = 0;
        if (S.state === 'playing') { ui.banner(t('bossPhase', { n: phase }), '', t('bossPhaseS')); audio.warn(); fx.kick({ aberr: 1.2, glitch: 0.5 }); }
        const bp = new THREE.Vector3(B.x, 0.6, B.z); waves.spawn(bp, new THREE.Color(0xff8a4d), { r0: 1, r1: 9 + phase * 3, h: 2, dur: 0.8, a: 2 }); particles.burst(bp, new THREE.Color(0xff8a4d), 70, { speed: 9, up: 2, life: 0.9, size: 1.2, grav: 0 });
      }
      B.phaseT += dt;
      const p = B.phase;
      const rate = (B.variant.rate || 1) * (1 + (p - 1) * 0.16) * D().fireRate;
      B.x = Math.sin(B.t * (0.5 + p * 0.08)) * (FIELD.halfW - 2.4);
      B.z = -15 + Math.sin(B.t * 0.7) * 1.0;
      B.atkT -= dt * rate;
      if (B.atkT <= 0) {
        fireBossPattern(B, p);
        if (S.state === 'playing') audio.enemyShot();
      }
    }
    const rage = (B.phase || 1) / 3;
    B.g.position.set(B.x, 0.6, B.z);
    updateBoss(B.g, dt, T, new THREE.Vector2((S.x - B.x) / 8, -(S.z - B.z) / 20), rage, B.phase || 1);
    if (Math.hypot(B.x - S.x, B.z - S.z) < ENEMIES.boss.radius + PLAYER.radius) hurtPlayer();
  }
  // player bolts: pulse / lance / nova
  for (const kind of WEAPON_KEYS) {
    const pool = pools[kind];
    for (const b of pool.list) {
      if (b.homing > 0) {
        b.homing -= dt;
        const target = homingTarget(b);
        if (target) {
          const speed = Math.hypot(b.vx, b.vz), current = Math.atan2(b.vx, b.vz);
          const desired = Math.atan2(target.x - b.x, target.z - b.z);
          let delta = desired - current; delta = Math.atan2(Math.sin(delta), Math.cos(delta));
          const next = current + THREE.MathUtils.clamp(delta, -(b.turn || 5) * dt, (b.turn || 5) * dt);
          b.vx = Math.sin(next) * speed; b.vz = Math.cos(next) * speed; b.rotZ = -next;
        }
      }
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (b.z < FIELD.top - 3 || b.z > FIELD.bottom + 3 || Math.abs(b.x) > FIELD.halfW + 5) { b.dead = true; continue; }
      if (b.kind === 'nova') b.scale = (b.scale || 1) + dt * 0.25;
      for (let i = S.enemies.length - 1; i >= 0; i--) {
        const e = S.enemies[i];
        const rr = e.def.radius + .4 * (b.scale || 1);
        if (!b.hit.has(e) && Math.hypot(e.z - b.z, e.x - b.x) < rr) {
          const dmgNow = b.pierce > 0 ? pierceDamage(b.dmg, b.pierceN || 0) : b.dmg;
          b.hit.add(e); hurtEnemy(e, i, dmgNow);
          if (b.pierce > 0) b.pierceN = (b.pierceN || 0) + 1;
          if (b.kind === 'nova' || b.explosive) detonateBullet(b, e);
          else if (b.pierce > 0) b.pierce--; else b.dead = true;
          if (b.dead) break;
        }
      }
      if (!b.dead && B && !B.entering && !b.hit.has(B) && Math.hypot(B.x - b.x, B.z - b.z) < ENEMIES.boss.radius + .25 * (b.scale || 1)) {
        b.hit.add(B); hurtBoss(b.pierce > 0 ? pierceDamage(b.dmg, b.pierceN || 0) : b.dmg);
        if (b.pierce > 0) b.pierceN = (b.pierceN || 0) + 1;
        if (b.kind === 'nova' || b.explosive) detonateBullet(b, B);
        else if (b.pierce > 0) b.pierce--; else b.dead = true;
      }
    }
    pool.list = pool.list.filter(b => !b.dead);
  }
  // enemy bullets
  for (const b of ebullets.list) {
    if (b.homing > 0) {
      b.homing -= dt;
      const speed = Math.hypot(b.vx, b.vz), current = Math.atan2(b.vx, b.vz);
      let delta = aimAt(b.x, b.z) - current; delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      const next = current + THREE.MathUtils.clamp(delta, -(b.turn || 1) * dt, (b.turn || 1) * dt);
      b.vx = Math.sin(next) * speed; b.vz = Math.cos(next) * speed;
    }
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (b.z > FIELD.bottom + 2 || b.z < FIELD.top - 4 || Math.abs(b.x) > FIELD.halfW + 3) b.dead = true;
    else if (Math.hypot(b.x - S.x, b.z - S.z) < PLAYER.radius + 0.12 && S.state !== 'dying') { b.dead = true; hurtPlayer(); }
  }
  ebullets.list = ebullets.list.filter(b => !b.dead);
  // weapon ultimate
  if (S.ultT >= 0) {
    S.ultT += dt;
    const mode = S.ultMode || 'pulse';
    const dur = (WEAPON_ULT[mode] && WEAPON_ULT[mode].duration) || ULT.duration;
    const k = Math.min(1, S.ultT / dur);
    S.ultFireT -= dt;
    if (mode === 'pulse') {
      while (S.ultFireT <= 0) {
        const n = 19;
        for (let i = 0; i < n; i++) {
          // 180° forward fan (left -> up -> right), never backwards
          const a = Math.PI + (i / (n - 1) - 0.5) * Math.PI;
          pools.pulse.add(S.x, S.z - 0.4, Math.sin(a) * 24, Math.cos(a) * 24, { kind: 'pulse', dmg: 1.6 * C().dmg, pierce: 1, hit: new Set(), scale: 1.15, rotX: 0 });
        }
        particles.emit(new THREE.Vector3(S.x, 0.5, S.z - 0.5), new THREE.Vector3(0, 3, 0), new THREE.Color(0x00e5ff), { life: 0.35, size: 1.4 });
        S.ultFireT += 0.12;
      }
    } else if (mode === 'lance') {
      beam.position.x = S.x; beam.material.opacity = Math.sin(k * Math.PI) * 0.8;
      beamExtras.forEach((m, i) => { m.position.x = S.x + (i - 1.5) * .65 + Math.sin(S.ultT * 28 + i) * .13; m.material.opacity = Math.sin(k * Math.PI) * (.45 + i * .08); });
      while (S.ultFireT <= 0) {
        for (let j = 0; j < 3; j++) strikeLightning(S.x + (Math.random() - .5) * 3.4, S.z - Math.random() * 9, 6 + Math.random() * 8, j % 2 ? 0xcdb9ff : 0x8cf4ff, 2.1);
        particles.burst(new THREE.Vector3(S.x + (Math.random() - .5) * 2, .5, S.z - 3 - Math.random() * 9), new THREE.Color(0x9feaff), 8, { speed: 5, up: 1, life: .35, size: .75, grav: 0 });
        for (let i = S.enemies.length - 1; i >= 0; i--) {
          const e = S.enemies[i];
          if (Math.abs(e.x - S.x) < 2.2 && e.z < S.z + 1) hurtEnemy(e, i, 3.2 * C().dmg);
        }
        if (B && !B.entering && Math.abs(B.x - S.x) < 2.8) hurtBoss(5 * C().dmg);
        S.ultFireT += 0.09;
      }
    } else if (mode === 'nova') {
      S.novaR = 2 + k * 20;
      novaUlt.position.set(S.x, .42, S.z); novaUlt.rotation.y += dt * 1.8;
      novaUltRings.forEach((m, i) => { const r = S.novaR * (.17 + i * .075) * (1 + Math.sin(S.ultT * 8 + i) * .06); m.scale.setScalar(r); m.rotation.z += dt * (i % 2 ? -2.4 : 2.1); m.material.opacity = .35 + Math.sin(k * Math.PI) * .55; });
      novaCore.scale.setScalar(1 + k * 4); novaCore.rotation.y += dt * 5; novaCore.rotation.x += dt * 3;
      while (S.ultFireT <= 0) {
        particles.burst(new THREE.Vector3(S.x, .45, S.z), NOVA_COLORS[Math.floor(S.ultFireT * 20 + 6) % 6], 28, { speed: 10 + k * 10, up: 3, life: .65, size: 1.1, grav: 0 });
        for (let i = S.enemies.length - 1; i >= 0; i--) {
          const e = S.enemies[i];
          if (Math.hypot(e.x - S.x, e.z - S.z) < S.novaR) hurtEnemy(e, i, 2.5 * C().dmg);
        }
        if (B && !B.entering && Math.hypot(B.x - S.x, B.z - S.z) < S.novaR) hurtBoss(3.5 * C().dmg);
        for (const b of ebullets.list) if (Math.hypot(b.x - S.x, b.z - S.z) < S.novaR) b.dead = true;
        waves.spawn(new THREE.Vector3(S.x, 0, S.z), new THREE.Color(WEAPONS.nova.color), { r0: S.novaR * 0.8, r1: S.novaR, h: 0.2, dur: 0.5 });
        S.ultFireT += 0.14;
      }
    }
    if (k >= 1) { S.ultT = -1; S.ultMode = null; beam.visible = false; beam.material.opacity = 0; novaUlt.visible = false; for (const m of beamExtras) { m.visible = false; m.material.opacity = 0; } }
  }
  // pickups: P/S/E magnetise; weapon canisters never do — the player must choose to fly into them
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const p = S.pickups[i]; p.t += dt;
    let d = Math.hypot(p.x - S.x, p.z - S.z);
    if (p.kind === 'W') {
      // weapon canisters stay where they dropped; no magnet and no drift
    } else if (d < 2.6) {
      p.x += (S.x - p.x) * dt * 6; p.z += (S.z - p.z) * dt * 6;
      d = Math.hypot(p.x - S.x, p.z - S.z);
    } else p.z += 2.4 * dt;
    // weapon canisters expire: 10 s lifetime, the last 2 s blink so the player knows it is going
    if (p.kind === 'W') {
      const W_LIFE = 10, W_BLINK = 2;
      if (p.t >= W_LIFE) { scene.remove(p.g); S.pickups.splice(i, 1); continue; }
      const left = W_LIFE - p.t;
      if (left <= W_BLINK) {
        const fast = left < 1 ? 18 : 10;
        p.g.visible = Math.sin(p.t * fast) > -0.15;
        p.g.scale.setScalar(1.55 * (0.86 + 0.14 * (left / W_BLINK)));
      } else p.g.visible = true;
    }
    p.g.position.set(p.x, 0.3 + Math.sin(p.t * 4) * 0.15, p.z); p.g.rotation.y = p.t * 2;
    if (d < (p.kind === 'W' ? 1.05 : 0.9)) {
      scene.remove(p.g); S.pickups.splice(i, 1);
      if (p.kind === 'P') {
        if (S.power < 6) { S.power++; S.weaponLevels[S.weapon] = S.power; } 
      } else if (p.kind === 'S') { S.hp = Math.min(PLAYER.maxHp, S.hp + 1); audio.shieldUp(); }
      else if (p.kind === 'H') {
        if (S.hp < PLAYER.maxHp) { S.hp = Math.min(PLAYER.maxHp, S.hp + 2); audio.shieldUp(); }
        else { S.ult = Math.min(100, S.ult + chargeGain(18)); S.ults[S.weapon] = S.ult; }
      }
      else if (p.kind === 'E') { S.ult = Math.min(100, S.ult + chargeGain(35)); S.ults[S.weapon] = S.ult; }
      else if (p.kind === 'W' && p.weaponKey) {
        S.ults[S.weapon] = S.ult;
        if (p.weaponKey === S.weapon) {
          S.power = Math.min(6, S.power + 1); S.weaponLevels[S.weapon] = S.power;
        } else {
          S.weapon = p.weaponKey;
          S.power = Math.min(6, (S.weaponLevels[S.weapon] || 1) + 1);
          S.weaponLevels[S.weapon] = S.power;
          S.ult = S.ults[S.weapon] || 0;
        }
        S.fireT = 0;
        if (S.state === 'playing') ui.banner(WEAPONS[S.weapon].name[i18n.isZh() ? 'zh' : 'en'], `LV.${S.power}`, t('weaponSwap'));
      }
      if (S.state === 'playing') { audio.pickup(); const sp = stage.toScreen(new THREE.Vector3(S.x, 0.8, S.z)); ui.popup(sp.x, sp.y - 30, t(p.kind), ''); Platform.haptic('light'); }
      updateHUD();
    } else if (p.z > FIELD.bottom + 2) { scene.remove(p.g); S.pickups.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- camera
const camPos = new THREE.Vector3(0, 20, 8), camLook = new THREE.Vector3(0, 0, -9), tP = new THREE.Vector3(), tL = new THREE.Vector3();
function frameCamera(dt, now, instant = false) {
  const aspect = stage.width / stage.height, portrait = aspect < 0.9;
  const vfov = 50; camera.fov = vfov + fx.fovKick * 4; camera.updateProjectionMatrix();
  const pitch = THREE.MathUtils.degToRad(portrait ? 62 : 56);
  const hw = FIELD.halfW + 0.6, zc = (FIELD.top + FIELD.bottom) / 2 + 0.6, hd = (FIELD.bottom - FIELD.top) / 2;
  const tanV = Math.tan(THREE.MathUtils.degToRad(vfov / 2)), tanH = tanV * aspect;
  const dW = hw / tanH + hd * Math.cos(pitch) * 0.6, dH = hd * Math.sin(pitch) / (tanV * (portrait ? 0.95 : 0.98));
  let d = portrait ? Math.max(dW, dH * 0.8) : dH;
  const att = S.state === 'attract';
  const yaw = att ? Math.sin(now * 0.15) * 0.25 : S.x * 0.006;
  tL.set(S.x * 0.12 + (att && !portrait ? -4 : 0), 0, zc + (att ? 0 : 0));
  tP.set(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d).add(tL);
  const k = instant ? 1 : 1 - Math.exp(-dt * 4);
  camPos.lerp(tP, k); camLook.lerp(tL, k); camera.position.copy(camPos); camera.lookAt(camLook); fx.shake(camera, now, 0.8);
}

// ---------------------------------------------------------------- loop
function tick(rawDt, time) {
  const dt = rawDt * fx.timeScale; S.t += dt; U.uTime.value = time;
  theme.update(rawDt); fx.update(rawDt);
  if (S.state === 'playing' || S.state === 'attract' || S.state === 'dying') {
    if (S.state === 'dying') { S.dieT += dt; } else sim(dt);
    const thrust = 1 + (S.odT >= 0 ? 0.85 : 0) + Math.min(0.6, Math.abs(S.vx) * 0.02);
    updateNinja(ninja, dt, S.t, S.vx, S.invuln, thrust);
    if (S.state === 'playing') updateHUD();
  }
  // screen overlays: danger vignette at 1 shield, overdrive burn glow
  const vd = $('vignette-danger'), vo = $('vignette-od');
  if (vd) vd.classList.toggle('on', S.state === 'playing' && S.hp === 1);
  if (vo) vo.classList.toggle('on', S.odT >= 0);
  // low-shield heartbeat
  S.heartT = (S.heartT || 0) - rawDt;
  if (S.state === 'playing' && S.hp === 1 && S.heartT <= 0) { audio.heartbeat(); S.heartT = 1.1; }
  updateWeaponFx(dt);
  for (const k of WEAPON_KEYS) pools[k].sync(k === 'nova' ? 0.35 : 0.2);
  decorPools.lance.sync(.24); decorPools.nova.sync(.39);
  ebullets.sync(0.3); ecores.list = ebullets.list; ecores.sync(0.47);
  world.update(dt, S.t, S.state === 'paused' || S.state === 'over' ? 0.15 : 1);
  particles.update(dt); waves.update(dt);
  frameCamera(rawDt, time); fx.applyPost(stage, time); ui.tick(rawDt);
  stage.render(rawDt);
  renderPreview(rawDt);
}

async function boot() {
  if (document.fonts) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
  if (S.demo || flags.autostart) beginRun(); else showAttract();
  frameCamera(0, 0, true); ui.loaded();
  stage.loop(tick, { isActive: () => S.state === 'playing' || S.state === 'attract', fpsEl: $('fps') });
  if (flags.fps) $('fps').classList.remove('hidden');
  ads.init().catch(() => {});
}
boot().catch((e) => { console.error(e); ui.fatal(t('fatal') + ': ' + e.message); });
