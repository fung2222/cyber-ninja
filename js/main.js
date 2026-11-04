// XENO NIGHTMARE 異域凶間 — controller: drag-to-move auto-fire shooter, waves, cosmic monster bosses, ultimate, continue.
import * as THREE from 'three';
import { i18n, t, flags, createStore, createStage, ThemeController, themeFor, U, Particles, Shockwaves, FxState, createInput, CyberUI, Platform, createAds, readHub, returnToHub, shouldShowArcadeMenu} from 'cyber-kit';
import { GAME_ID, FIELD, PLAYER, ULT, ENEMIES, ENEMY_BULLET_SPEED, DROP_CHANCE, waveSpec, speedScale, hpScale, ADS, MILESTONE_EVERY, milestoneBonus } from './config.js';
import './strings.js?v=0.3.25';
import { World } from './world.js';
import { makeNinja, updateNinja, makeEnemy, makeBoss, updateBoss, BulletPool, makePickup, makeGem, makeRock } from './entities.js';
import { WEAPONS, WEAPON_KEYS, OD, WEAPON_ULT, fireSolution, weaponShort, ultName, ultShort, randomOtherWeapon } from './weapons.js?v=0.3.25';
import { CRAFTS, CRAFT_KEYS, craftOf, craftName, COMBO, comboMult } from './crafts.js?v=1.0';
import { NinjaAudio } from './audio.js?v=0.3.25';

const $ = (id) => document.getElementById(id);
const store = createStore(GAME_ID);
if (flags.reset) store.clear();
const ui = new CyberUI({ screens: ['start', 'pause', 'over'] });
const stage = createStage({ canvas: $('scene'), bloom: 0.95, bloomRadius: 0.5, bloomThreshold: 0.75, fov: 50, exposure: 1.05, onFatal: (m) => ui.fatal(m) });
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
let ninja = makeNinja(craftOf(savedCraft)); ninja.scale.setScalar(1.55); scene.add(ninja);
function setCraft(key, silent = false) {
  if (!CRAFTS[key]) key = 'falcon';
  S.craft = key;
  store.set('craft', key);
  scene.remove(ninja);
  ninja = makeNinja(craftOf(key)); ninja.scale.setScalar(1.55); scene.add(ninja);
  const C = craftOf(key);
  PLAYER.maxHp = C.hp;
  if (!silent && S.state === 'attract') { /* rebuilt under the start screen */ }
  updateHUD();
}
const pools = {
  pulse: new BulletPool(scene, 320, new THREE.BoxGeometry(0.09, 0.09, 0.75), WEAPONS.pulse.color),
  lance: new BulletPool(scene, 100, new THREE.BoxGeometry(0.16, 0.16, 3.2), WEAPONS.lance.color),
  nova: new BulletPool(scene, 100, new THREE.TorusGeometry(0.5, 0.09, 8, 24), WEAPONS.nova.color),
};
const ebullets = new BulletPool(scene, 500, new THREE.SphereGeometry(0.17, 10, 8), 0xff2bd6);
const ecores = new BulletPool(scene, 500, new THREE.SphereGeometry(0.08, 6, 4), 0xffffff);
// weapon-ultimate beam (laser) — a wide plane over the play field
const beam = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 38), new THREE.MeshBasicMaterial({ color: new THREE.Color(WEAPONS.lance.color).multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.35, -10); beam.visible = false; scene.add(beam);

const S = {
  state: 'attract', demo: !!flags.demo,
  x: 0, z: 1, vx: 0, hp: 3, invuln: 0, power: 1, fireT: 0, ult: 0, ultT: -1,
  weapon: 'pulse', weaponLevels: { pulse: 1, lance: 1, nova: 1 }, ults: { pulse: 0, lance: 0, nova: 0 },
  od: 0, odT: -1, noFireT: 0, ultMode: null, ultFireT: 0, novaR: 0,
  score: 0, wave: 1, spec: null, waveT: 0, nextEv: 0, enemies: [], boss: null, pickups: [], kills: 0,
  continued: false, betweenT: 0, t: 0, newRecord: false,
  hazards: [], hazardT: 7, gems: [], rocks: [], rockT: 9, district: 'city',
  craft: CRAFTS[savedCraft] ? savedCraft : 'falcon',
  combo: { chain: 0, timer: 0, mult: 1 }, gemChain: 0, gemChainT: 0, sinceHit: 99,
};
PLAYER.maxHp = craftOf(S.craft).hp;
window.__ninja = S;  // test hook
const C = () => craftOf(S.craft);            // current airframe
const chargeGain = (n) => n * C().charge;    // wraith charges faster

// ---------------------------------------------------------------- HUD
const setRing = (el, pct) => el.style.setProperty('--p', Math.max(0, Math.min(100, pct)).toFixed(1));
function updateHUD() {
  const lang = i18n.isZh() ? 'zh' : 'en';
  ui.setText('hud-score', S.score.toLocaleString('en-US'));
  ui.setText('hud-best', Math.max(store.best, S.score).toLocaleString('en-US'));
  ui.setText('hud-wave', S.wave);
  // shield pips (airframe-dependent count)
  const pips = $('hud-hp'); let h = ''; for (let i = 0; i < PLAYER.maxHp; i++) h += `<i class="${i < S.hp ? 'on' : ''}"></i>`; if (pips.innerHTML !== h) pips.innerHTML = h;
  // weapon chip: name + six level diamonds + ult charge
  $('hud-weapon').textContent = weaponShort(S.weapon, lang);
  $('hud-wlv').textContent = 'LV.' + S.power;
  const lv = $('hud-lv'); if (lv) { let lh = ''; for (let i = 1; i <= 6; i++) lh += `<i class="${i <= S.power ? 'on' : ''}"></i>`; if (lv.innerHTML !== lh) lv.innerHTML = lh; }
  $('hud-wfill').style.width = Math.min(100, S.ult).toFixed(0) + '%';
  $('hud-wult').textContent = ultName(S.weapon, lang);
  // combo chip
  const combo = $('combo-chip');
  if (combo) {
    const on = S.combo.mult > 1 && S.combo.timer > 0;
    combo.classList.toggle('on', on);
    if (on) { $('combo-mult').textContent = '×' + S.combo.mult; combo.style.setProperty('--cd', (S.combo.timer / COMBO.window).toFixed(2)); }
  }
  // action buttons with visible ring progress
  $('ult-label').textContent = ultShort(S.weapon, lang);
  $('ult-sub').textContent = S.ult >= 100 ? (lang === 'zh' ? '就緒' : 'READY') : Math.round(S.ult) + '%';
  setRing($('btn-ult'), S.ult);
  $('btn-ult').classList.toggle('ready', S.ult >= 100 && S.ultT < 0 && S.odT < 0);
  const odReady = S.od >= 100 && S.odT < 0 && S.noFireT <= 0 && S.ultT < 0;
  $('btn-od').classList.toggle('ready', odReady);
  $('btn-od').classList.toggle('active', S.odT >= 0);
  $('btn-od').classList.toggle('venting', S.noFireT > 0);
  const odDur = OD.duration + C().odBonus;
  const odPct = S.odT >= 0 ? Math.max(0, 100 - (S.odT / odDur) * 100) : S.od;
  setRing($('btn-od'), odPct);
  $('od-label').textContent = S.noFireT > 0 ? t('odVent') : S.odT >= 0 ? t('odActive') : t('odShort');
  $('od-sub').textContent = S.noFireT > 0 ? Math.ceil(S.noFireT) + 's' : S.odT >= 0 ? t('odS') : Math.min(100, S.od).toFixed(0) + '%';
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
}
function resetRun() {
  clearField();
  Object.assign(S, { x: 0, z: 1, tx: 0, tz: 1, vx: 0, hp: PLAYER.maxHp, invuln: 1.2, power: 1, fireT: 0, ult: 0, ultT: -1, score: 0, wave: 0, kills: 0, continued: false, newRecord: false, ultReadyShown: false, ultBossHit: false,
    weapon: 'pulse', weaponLevels: { pulse: 1, lance: 1, nova: 1 }, ults: { pulse: 0, lance: 0, nova: 0 }, od: 0, odT: -1, noFireT: 0, ultMode: null, ultFireT: 0, novaR: 0, hazards: [], hazardT: 7, gems: [], rocks: [], rockT: 9, district: 'city',
    combo: { chain: 0, timer: 0, mult: 1 }, gemChain: 0, gemChainT: 0, sinceHit: 99 });
  world.setDistrict('city');
  beam.visible = false; beam.material.opacity = 0;
  theme.set(1); audio.setBoss(false); nextWave();
}
function nextWave() {
  S.wave++; S.spec = waveSpec(S.wave); S.waveT = 0; S.nextEv = 0; S.betweenT = 0;
  const district = Math.floor((S.wave - 1) / 5) % 2 ? 'ruins' : 'city';
  const changed = world.setDistrict(district);
  const districtChanged = changed !== S.district; S.district = changed;
  if (S.spec.boss) {
    spawnBoss(S.spec.hp, S.spec.variant);
    if (S.state !== 'attract') { ui.banner(t('bossIncoming', { name: bossName() }), t('waveN', { n: S.wave }), t('warning')); audio.warn(); fx.kick({ glitch: 0.6, aberr: 1 }); }
  } else if (S.state !== 'attract' && S.wave > 1 && (S.wave - 1) % MILESTONE_EVERY === 0) milestone(S.wave - 1);
  else if (S.state !== 'attract' && S.wave > 1) ui.banner(t('waveN', { n: S.wave }), '', districtChanged ? t(changed === 'ruins' ? 'districtRuins' : 'districtCity') : (S.wave % 5 === 4 ? t('bossNext') : ''));
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
  ui.banner(t('waveN', { n: 1 }), '', t('firstHint'));
}
function showAttract() { setState('attract'); resetRun(); refreshStart(); }

// ---------------------------------------------------------------- spawning
function spawnEnemy(ev) {
  const def = ENEMIES[ev.type]; const g = makeEnemy(ev.type); const elite = !!ev.elite;
  g.scale.setScalar(1.45 * (elite ? 1.18 : 1)); scene.add(g);
  const e = {
    type: ev.type, def, g, x: ev.x, baseX: ev.x, z: FIELD.top - 1, t: 0, phase: ev.phase,
    hp: Math.ceil(def.hp * hpScale(S.wave) * (elite ? 1.8 : 1)), fireT: 0.7 + Math.random() * 0.8,
    flash: 0, mode: 0, stopZ: ev.type === 'turret' ? -17 + Math.random() * 4 : -15 + Math.random() * 5,
    vx: 0, vz: def.speed * speedScale(S.wave) * (elite ? 1.12 : 1),
    pattern: ev.pattern || 'dive', elite, level: S.wave, score: def.score * (elite ? 2.5 : 1),
  };
  if (elite && e.g.userData.mat) e.g.userData.mat.emissive = new THREE.Color(def.color).multiplyScalar(0.18);
  g.position.set(e.x, 0, e.z); S.enemies.push(e);
}
function spawnBoss(hp, variant = { zh: '星海魔獸', en: 'COSMIC MONSTER', rate: 1 }) {
  const g = makeBoss(); g.scale.setScalar(1.15); scene.add(g);
  S.boss = { g, x: 0, z: FIELD.top - 4, hp, maxHp: hp, t: 0, atk: 0, atkT: 2.5, spiralA: 0, spiralN: 0, seq: 0, phase: 1, entering: true, variant };
  refreshBossName();
  g.position.set(0, 0, S.boss.z);
}
function enemyFire(x, z, ang, speed = ENEMY_BULLET_SPEED) { ebullets.add(x, z, Math.sin(ang) * speed, Math.cos(ang) * speed); }
const aimAt = (x, z) => Math.atan2(S.x - x, S.z - z);

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
  const pts = Math.round((e.score || e.def.score) * S.combo.mult);
  S.score += pts; S.kills++;
  S.ult = Math.min(100, S.ult + chargeGain(ULT.perKill)); S.ults[S.weapon] = S.ult;
  S.od = Math.min(100, S.od + chargeGain(OD.perKill));
  if (S.ult >= 100 && !S.ultReadyShown) { S.ultReadyShown = true; if (S.state === 'playing') { audio.ready(); ui.toast(t('ultReady'), 1300); } }
  if (S.state !== 'attract') {
    audio.boom(big);
    if ((e.score || e.def.score) >= 120 || S.combo.mult > 1) { const sp = stage.toScreen(p); ui.popup(sp.x, sp.y, '+' + pts + (S.combo.mult > 1 ? ' ×' + S.combo.mult : ''), S.combo.mult >= 4 ? 'hot' : ''); }
  }
  dropGems(e);
  const wChance = e.elite ? 0.65 : 0;
  if (wChance && Math.random() < wChance) dropPickup(e.x, e.z, 'W', randomOtherWeapon(S.weapon));
  else if (!small && Math.random() < DROP_CHANCE) dropPickup(e.x, e.z);
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
function dropPickup(x, z, kind, weaponKey) {
  kind = kind || (S.power < 6 && Math.random() < 0.55 ? 'P' : Math.random() < 0.5 ? 'S' : 'E');
  const g = makePickup(kind, weaponKey); g.scale.setScalar(1.4); g.position.set(x, 0, z); scene.add(g); S.pickups.push({ g, kind, weaponKey, x, z, t: 0 });
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
  S.ult = Math.min(100, S.ult + chargeGain(ULT.perBossHit)); S.ults[S.weapon] = S.ult; S.od = Math.min(100, S.od + chargeGain(OD.perBossHit));
  particles.emit(new THREE.Vector3(B.x, 0.5, B.z + 0.5), new THREE.Vector3((Math.random() - 0.5) * 4, 2, 3), new THREE.Color(0xa66bff), { life: 0.3, size: 0.7 });
  if (B.hp <= 0) bossDown();
}
function hurtPlayer() {
  if (S.invuln > 0 || S.ultT >= 0) return;
  if (S.state === 'attract') { S.invuln = 1; return; }
  S.hp--; S.sinceHit = 0; S.invuln = PLAYER.invuln; S.power = Math.max(1, S.power - 1); S.weaponLevels[S.weapon] = S.power;
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
  if (S.ult < 100 || S.ultT >= 0 || S.odT >= 0 || S.noFireT > 0 || !(S.state === 'playing' || S.state === 'attract')) return;
  const mode = S.weapon;
  S.ult = 0; S.ults[mode] = 0; S.ultReadyShown = false; S.ultT = 0; S.ultFireT = 0; S.ultMode = mode; S.novaR = 2; S.invuln = Math.max(S.invuln, 0.35);
  beam.visible = mode === 'lance';
  if (mode === 'lance') { beam.position.x = S.x; beam.material.color.setHex(WEAPONS.lance.color).multiplyScalar(2.4); }
  for (const b of ebullets.list) particles.emit(new THREE.Vector3(b.x, 0, b.z), new THREE.Vector3(0, 2, 0), new THREE.Color(0xffffff), { life: 0.4, size: 0.8 });
  ebullets.clear();
  if (S.state !== 'attract') { audio.ult(mode); ui.banner(ultName(mode, i18n.isZh() ? 'zh' : 'en'), '', ''); Platform.haptic('heavy'); }
  const up = new THREE.Vector3(S.x, 0.5, S.z); particles.burst(up, new THREE.Color(WEAPONS[mode].color), 150, { speed: 14, up: 4, life: 1.1, size: 1.5, grav: 0 }); waves.spawn(up, new THREE.Color(WEAPONS[mode].color), { r0: 1, r1: 16, h: 2.4, dur: 1.0, a: 3 }); fx.kick({ slowmo: 0.7, aberr: 1.5, fovKick: 1, trauma: 0.4 }); ui.flash('rgba(255,255,255,0.3)', 480);
  updateHUD();
}
function doOverdrive() {
  if (S.od < 100 || S.odT >= 0 || S.noFireT > 0 || S.ultT >= 0 || !(S.state === 'playing' || S.state === 'attract')) return;
  S.od = 0; S.odT = 0; S.fireT = 0; S.invuln = Math.max(S.invuln, 0.6);
  if (S.state !== 'attract') { audio.ready(); ui.banner(t('odActive'), '', t('odS')); Platform.haptic('heavy'); }
  particles.burst(new THREE.Vector3(S.x, 0.5, S.z), new THREE.Color(0xff8a4d), 70, { speed: 10, up: 3, life: 0.8, size: 1.2, grav: 0 }); fx.kick({ aberr: 1, fovKick: 0.8, trauma: 0.2 }); ui.flash('rgba(255,122,59,0.32)', 420);
  updateHUD();
}

function gameOver() {
  S.state = 'dying'; S.dieT = 0;
  if (ui.el.banner) ui.el.banner.classList.add('hidden');
  const p = new THREE.Vector3(S.x, 0, S.z);
  particles.burst(p, new THREE.Color(0xff2bd6), 120, { speed: 9, up: 3, life: 1.2, size: 1.3, grav: 0, color2: new THREE.Color(0x00e5ff) }); audio.boom(true); audio.fail();
  ninja.visible = false; fx.kick({ slowmo: 0.9, glitch: 1 });
  setTimeout(() => {
    if (S.demo) { beginRun(); return; }
    S.newRecord = store.submitBest(S.score); store.setNum('bestWave', Math.max(store.getNum('bestWave', 0), S.wave));
    ui.setText('over-score', S.score.toLocaleString('en-US')); ui.setText('over-wave', S.wave); ui.setText('over-kills', S.kills); ui.setText('over-best', store.best.toLocaleString('en-US'));
    $('newrecord').classList.toggle('hidden', !S.newRecord);
    $('btn-revive').classList.toggle('hidden', S.continued || !ads.rewardedAvailable());
    ui.setText('revive-sub', t(ads.isNative ? 'reviveAd' : 'reviveFree'));
    setState('over'); audio.duckMusic();
  }, 1300);
}
async function revive() {
  if (S.state !== 'over' || S.continued) return; audio.click();
  const r = await ads.rewarded('continue'); if (!r.rewarded) { ui.toast(t('noReward')); return; }
  S.continued = true; S.hp = PLAYER.maxHp; S.sinceHit = 99; S.invuln = 3; ebullets.clear(); ninja.visible = true;
  S.ult = 100; S.ults[S.weapon] = 100; S.od = 100;
  // clean restart of the power systems: no stale overdrive / cease-fire / ult
  S.odT = -1; S.noFireT = 0; S.ultT = -1; S.ultMode = null; S.ultFireT = 0; S.novaR = 0;
  beam.visible = false; beam.material.opacity = 0;
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
createInput({
  anyGesture() { audio.init(); audio.startMusic(); },
  action(a) {
    if (ui.modalOpen) { if (a === 'pause') ui.closeModal(); return; }
    if (a === 'primary') { if (S.state === 'attract') beginRun(); else if (S.state === 'playing') doUlt(); else if (S.state === 'paused') resume(); else if (S.state === 'over') retry(); }
    else if (a === 'pause') { if (S.state === 'playing') pause(); else if (S.state === 'paused') resume(); }
    else if (a === 'mute') { audio.init(); ui.setMuted(audio.toggleMute()); }
    else if (a === 'ult') doUlt();
    else if (a === 'overdrive') doOverdrive();
    else if (a === 'restart' && S.state === 'over') retry();
    else if (a === 'fps') $('fps').classList.toggle('hidden');
  },
}, { swipe: 'once', actions: { KeyX: 'ult', KeyJ: 'ult', KeyK: 'ult', KeyQ: 'overdrive', KeyO: 'overdrive' } });
ui.on('btn-start', () => { audio.init(); beginRun(); });
const __hub = readHub();
if (shouldShowArcadeMenu(__hub)) { const b = document.getElementById('btn-arcade-menu'); if (b) b.classList.remove('hidden'); }
ui.on('btn-arcade-menu', () => { try { audio.back(); } catch {} returnToHub({ gameId: 'cyber-ninja', openStore: false }); });

ui.on('btn-resume', resume); ui.on('btn-quit', () => { audio.back(); showAttract(); });

// ---------------------------------------------------------------- start-screen: craft select + weapon tech tree
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const CRAFT_SVG = {
  falcon: (c, a) => `<svg viewBox="0 0 96 44"><path d="M48 6 L58 22 L92 34 L58 30 L48 40 L38 30 L4 34 L38 22 Z" fill="none" stroke="${c}" stroke-width="2"/><path d="M48 12 L53 22 L48 32 L43 22 Z" fill="${a}" opacity=".85"/><circle cx="48" cy="22" r="3" fill="${c}"/></svg>`,
  bastion: (c, a) => `<svg viewBox="0 0 96 44"><path d="M28 10 L68 10 L76 22 L68 34 L28 34 L20 22 Z" fill="none" stroke="${c}" stroke-width="2"/><path d="M40 16 L56 16 L60 22 L56 28 L40 28 L36 22 Z" fill="${a}" opacity=".85"/><path d="M10 22 L20 22 M76 22 L86 22" stroke="${c}" stroke-width="2"/></svg>`,
  wraith: (c, a) => `<svg viewBox="0 0 96 44"><path d="M48 4 L52 20 L48 38 L44 20 Z" fill="${a}" opacity=".9"/><path d="M16 8 L40 22 L16 36 M80 8 L56 22 L80 36" fill="none" stroke="${c}" stroke-width="2"/><circle cx="48" cy="20" r="2.5" fill="${c}"/></svg>`,
};
const statBars = (n) => `<span class="bars">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
function renderCraftSelect() {
  const lang = i18n.isZh() ? 'zh' : 'en';
  const row = $('craft-row'); if (!row) return;
  row.innerHTML = CRAFT_KEYS.map((k) => {
    const c = CRAFTS[k];
    const stats = [
      [t('statHp'), Math.round(c.hp / 4 * 5)],
      [t('statDmg'), Math.round(c.dmg / 1.3 * 5)],
      [t('statSpd'), Math.round(c.speed / 1.15 * 5)],
      [t('statChg'), Math.round(c.charge / 1.4 * 5)],
    ];
    return `<button type="button" class="craft-card ${S.craft === k ? 'sel' : ''}" data-craft="${k}" style="--cc:${hex(c.color)}">
      <span class="cc-svg">${CRAFT_SVG[k](hex(c.color), hex(c.accent))}</span>
      <span class="cc-info">
        <span class="cc-code">${c.code[lang]} · ${c.role[lang]}</span>
        <span class="cc-name">${c.name[lang]}</span>
        <span class="cc-passive">${c.passive[lang]}</span>
      </span>
      <span class="cc-stats">${stats.map(([l, n]) => `<span class="cc-stat"><em>${l}</em>${statBars(n)}</span>`).join('')}</span>
    </button>`;
  }).join('');
  for (const b of row.querySelectorAll('[data-craft]')) b.addEventListener('click', () => { if (S.craft === b.dataset.craft) return; audio.init(); audio.select(); setCraft(b.dataset.craft); renderCraftSelect(); });
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
let treeKey = 'pulse';
function renderTechTree() {
  const tabs = $('tree-tabs'), det = $('tree-detail');
  if (!tabs || !det) return;
  const lang = i18n.isZh() ? 'zh' : 'en';
  tabs.innerHTML = WEAPON_KEYS.map((k) => {
    const w = WEAPONS[k];
    return `<button type="button" class="tree-tab ${treeKey === k ? 'sel' : ''}" data-w="${k}" style="--tc:${hex(w.color)}">${w.short[lang]}<small>${w.name[lang === 'zh' ? 'en' : 'zh']}</small></button>`;
  }).join('');
  for (const b of tabs.querySelectorAll('[data-w]')) b.addEventListener('click', () => { treeKey = b.dataset.w; audio.init(); try { audio.click(); } catch (_) {} renderTechTree(); });
  const w = WEAPONS[treeKey];
  const nodes = w.levels.map((L, i) => `<div class="td-node"><div class="nd ${i === 5 ? 'max' : ''}"><i>${i + 1}</i></div><small>${levelStat(treeKey, i + 1)}<br>${L.dmg}${lang === 'zh' ? '傷' : 'DMG'}</small></div>`).join('');
  det.style.setProperty('--tc', hex(w.color));
  det.innerHTML = `
    <div class="td-head"><b>${w.name[lang]}</b><span>${w.name[lang === 'zh' ? 'en' : 'zh']}</span></div>
    <div class="td-desc">${t('techDesc')[treeKey]?.[lang === 'zh' ? 0 : 1] || ''}</div>
    <div class="td-nodes">${nodes}</div>
    <div class="td-ult"><span class="u-ico">${ULT_SVG[treeKey](hex(w.color))}</span><div><b>${w.ult[lang]}</b><small>${t('ultDesc')[treeKey]?.[lang === 'zh' ? 0 : 1] || ''}</small></div></div>
    <div class="td-foot">${t('techFoot')}</div>`;
}
renderCraftSelect(); renderTechTree();
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


i18n.onChange(() => { refreshBossName(); if (S.state === 'over') ui.setText('revive-sub', t(ads.isNative ? 'reviveAd' : 'reviveFree')); renderCraftSelect(); renderTechTree(); });
ui.on('btn-retry', retry); ui.on('btn-menu', overToMenu); ui.on('btn-revive', revive);
Platform.onBack(() => { if (ui.closeModal()) return true; if (S.state === 'playing') { pause(); return true; } if (S.state === 'paused') { resume(); return true; } if (S.state === 'over') { overToMenu(); return true; } return false; });
Platform.onPause(() => { if (!S.demo) pause(); });
S.api = {
  wave: (n) => { clearField(); S.wave = n - 1; nextWave(); },
  ult: () => { S.ult = 100; doUlt(); },
  overdrive: () => { S.od = 100; doOverdrive(); },
  craft: (key) => setCraft(key),
  weapon: (key, level = 1) => { if (!WEAPONS[key]) return; S.ults[S.weapon] = S.ult; S.weapon = key; S.weaponLevels[key] = Math.max(1, Math.min(6, level)); S.power = S.weaponLevels[key]; S.ult = S.ults[key]; S.fireT = 0; updateHUD(); },
  drop: (kind, key) => dropPickup(S.x, S.z - 1.2, kind, key),
  dropAt: (x, z, kind, key) => dropPickup(x, z, kind, key),
  shots: () => ({ pulse: pools.pulse.list.length, lance: pools.lance.list.length, nova: pools.nova.list.length }),
  pulseVectors: () => pools.pulse.list.map(b => ({ vx: b.vx, vz: b.vz })),
  clearShots: () => { for (const k of WEAPON_KEYS) pools[k].clear(); },
  threat: () => ({ enemies: S.enemies.length, bullets: ebullets.list.length, hazards: S.hazards.length, gems: S.gems.length, rocks: S.rocks.length, bossPhase: S.boss ? S.boss.phase : null }),
  hazard: () => spawnHazard(),
  rock: () => spawnRock(),
  spawn: (ev) => spawnEnemy(ev),
  killOne: () => { const e = S.enemies[0]; if (e) { e.hp = 0; killEnemy(e, 0); } },
  enemyFire: (x, z, ang, speed) => enemyFire(x, z, ang, speed),
  bossHurt: (dmg) => hurtBoss(dmg),
  charge: (n = 100) => { S.ult = Math.min(100, S.ult + n); S.ults[S.weapon] = S.ult; S.od = Math.min(100, S.od + n); updateHUD(); },
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
  // auto-fire through the current weapon
  S.fireT -= dt;
  if (S.fireT <= 0 && S.noFireT <= 0 && S.ultT < 0) {
    const sol = fireSolution(S.weapon, S.power, S.odT >= 0);
    S.fireT = sol.rate;
    const pool = pools[S.weapon];
    for (const [ox, ang] of sol.shots) {
      pool.add(S.x + ox, S.z - 0.6, Math.sin(ang) * sol.speed, -Math.cos(ang) * sol.speed, {
        kind: S.weapon, dmg: sol.dmg * C().dmg, pierce: sol.pierce || 0, aoe: sol.aoe || 0, hit: new Set(),
        scale: (sol.scale || 1) * (S.odT >= 0 ? 1.22 : 1), rotX: S.weapon === 'nova' ? Math.PI / 2 : 0,
      });
    }
    // muzzle flash
    particles.emit(new THREE.Vector3(S.x, 0.35, S.z - 0.8), new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.2, -4), new THREE.Color(C().color), { life: 0.14, size: 0.85, grav: 0 });
    if (S.state === 'playing') audio.shot(S.weapon);
  }
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
    spawnHazard(); S.hazardT = 8 + Math.random() * 5;
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
  if (S.rockT <= 0 && S.state === 'playing' && !S.demo && S.wave > 1) { spawnRock(); S.rockT = 8 + Math.random() * 5; }
  for (let i = S.rocks.length - 1; i >= 0; i--) {
    const r = S.rocks[i]; r.t += dt; r.x += r.vx * dt; r.z += r.vz * dt;
    r.g.position.set(r.x, 0.45 + Math.sin(r.t * 1.4) * 0.12, r.z);
    r.g.userData.spin.rotation.x += dt * 0.35; r.g.userData.spin.rotation.y += dt * 0.22;
    r.g.userData.glow.material.opacity = 0.26 + 0.13 * Math.sin(r.t * 6);
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
        S.od = Math.min(100, S.od + chargeGain(gm.energy * 0.6));
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
      else if (e.mode === 1) {
        e.holdT += dt;
        e.fireT -= dt * sc;
        if (e.fireT <= 0) {
          e.fireT = e.def.fire / sc;
          const a = aimAt(e.x, e.z);
          for (const o of (e.elite || S.wave > 7 ? [-0.22, -0.11, 0, 0.11, 0.22] : [-0.16, 0, 0.16])) enemyFire(e.x, e.z + 0.5, a + o, ENEMY_BULLET_SPEED * 1.02);
          if (S.state === 'playing') audio.enemyShot();
        }
        if (e.holdT > 7) e.mode = 2;
      } else e.z += e.vz * 1.5 * dt;
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
    // Drone/weaver/splitter fire aimed pressure; without this the player only ever dodges Dashers.
    if ((e.type === 'drone' || e.type === 'weaver' || e.type === 'splitter') && S.state === 'playing' && e.z > FIELD.top + 1 && e.z < S.z + 1) {
      e.fireT -= dt * sc;
      if (e.fireT <= 0) {
        e.fireT = e.def.fire / sc;
        const a = aimAt(e.x, e.z);
        if (e.type === 'weaver') {
          for (const o of (e.elite ? [-0.24, -0.12, 0, 0.12, 0.24] : [-0.18, 0, 0.18])) enemyFire(e.x, e.z + 0.4, a + o, ENEMY_BULLET_SPEED * 0.95);
        } else if (e.type === 'splitter') {
          for (const o of (e.elite ? [-0.2, 0, 0.2] : [-0.12, 0.12])) enemyFire(e.x, e.z + 0.4, a + o, ENEMY_BULLET_SPEED * 0.9);
        } else {
          enemyFire(e.x, e.z + 0.4, a, ENEMY_BULLET_SPEED * 1.05);
          if (e.elite || S.wave > 6) { enemyFire(e.x, e.z + 0.4, a - 0.12, ENEMY_BULLET_SPEED); enemyFire(e.x, e.z + 0.4, a + 0.12, ENEMY_BULLET_SPEED); }
        }
        if (S.state === 'playing') audio.enemyShot();
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
      const rate = (B.variant.rate || 1) * (1 + (p - 1) * 0.2);
      B.x = Math.sin(B.t * (0.5 + p * 0.08)) * (FIELD.halfW - 2.4);
      B.z = -15 + Math.sin(B.t * 0.7) * 1.0;
      B.atkT -= dt * rate;
      if (B.atkT <= 0) {
        const seq = p === 1 ? [0, 2, 0] : p === 2 ? [0, 1, 3, 2] : [0, 1, 3, 4, 2];
        B.atk = seq[B.seq++ % seq.length];
        const speed = ENEMY_BULLET_SPEED * (0.85 + p * 0.08);
        if (B.atk === 0) {
          const n = 12 + p * 4;
          for (let i = 0; i < n; i++) enemyFire(B.x, B.z, (i / n) * Math.PI * 2 + B.t * 0.8, speed * 0.9);
          B.atkT = p === 3 ? 1.1 : 1.5;
        } else if (B.atk === 1) {
          const n = 4 + p;
          for (let i = 0; i < n; i++) enemyFire(B.x, B.z, B.spiralA + (i / n) * Math.PI * 2, speed);
          B.spiralA += 0.55 + p * 0.12;
          B.atkT = 0.42;
          if ((B.spiralN = (B.spiralN || 0) + 1) % 4 === 0) B.atk = 2;
        } else if (B.atk === 2) {
          const a = aimAt(B.x, B.z);
          for (const o of [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]) enemyFire(B.x, B.z + 1.2, a + o, speed * 1.08);
          B.atkT = p === 3 ? 0.75 : 1.1;
        } else if (B.atk === 3) {
          // wall with a moving gap: the player has to commit to one side
          const gap = (Math.random() * 2 - 1) * 3.4;
          for (let x = -FIELD.halfW + 0.7; x <= FIELD.halfW - 0.7; x += 1.05) {
            if (Math.abs(x - gap) > 1.1) enemyFire(x, B.z + 0.5, 0, speed * 0.9);
          }
          B.atkT = p === 3 ? 0.95 : 1.35;
        } else {
          // crossfire from both sides, aimed at the player's current lane
          const a = aimAt(B.x, B.z);
          for (const side of [-1, 1]) {
            enemyFire(B.x + side * 2.2, B.z + 0.6, a + side * 0.34, speed);
            enemyFire(B.x + side * 2.2, B.z + 0.6, a + side * 0.16, speed);
          }
          B.atkT = 0.8;
        }
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
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (b.z < FIELD.top - 3 || Math.abs(b.x) > FIELD.halfW + 5) { b.dead = true; continue; }
      if (b.kind === 'nova') b.scale = (b.scale || 1) + dt * 0.25;
      for (let i = S.enemies.length - 1; i >= 0; i--) {
        const e = S.enemies[i];
        const rr = b.kind === 'nova' ? Math.max(0.8, b.aoe) : e.def.radius + 0.4;
        if (!b.hit.has(e) && Math.abs(e.z - b.z) < rr && Math.abs(e.x - b.x) < rr) {
          b.hit.add(e); hurtEnemy(e, i, b.dmg);
          if (b.pierce > 0) b.pierce--; else b.dead = true;
          if (b.dead) break;
        }
      }
      if (!b.dead && B && !B.entering && !b.hit.has(B) && Math.hypot(B.x - b.x, B.z - b.z) < (b.kind === 'nova' ? Math.max(2.5, b.aoe) : ENEMIES.boss.radius)) {
        b.hit.add(B); hurtBoss(b.dmg);
        if (b.pierce > 0) b.pierce--; else b.dead = true;
      }
    }
    pool.list = pool.list.filter(b => !b.dead);
  }
  // enemy bullets
  for (const b of ebullets.list) {
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
      while (S.ultFireT <= 0) {
        for (let i = S.enemies.length - 1; i >= 0; i--) {
          const e = S.enemies[i];
          if (Math.abs(e.x - S.x) < 2.2 && e.z < S.z + 1) hurtEnemy(e, i, 3.2 * C().dmg);
        }
        if (B && !B.entering && Math.abs(B.x - S.x) < 2.8) hurtBoss(5 * C().dmg);
        S.ultFireT += 0.09;
      }
    } else if (mode === 'nova') {
      S.novaR = 2 + k * 20;
      while (S.ultFireT <= 0) {
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
    if (k >= 1) { S.ultT = -1; S.ultMode = null; beam.visible = false; beam.material.opacity = 0; }
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
    p.g.position.set(p.x, 0.3 + Math.sin(p.t * 4) * 0.15, p.z); p.g.rotation.y = p.t * 2;
    if (d < (p.kind === 'W' ? 1.05 : 0.9)) {
      scene.remove(p.g); S.pickups.splice(i, 1);
      if (p.kind === 'P') {
        if (S.power < 6) { S.power++; S.weaponLevels[S.weapon] = S.power; } else { S.od = Math.min(100, S.od + 12); }
      } else if (p.kind === 'S') { S.hp = Math.min(PLAYER.maxHp, S.hp + 1); audio.shieldUp(); }
      else if (p.kind === 'E') { S.ult = Math.min(100, S.ult + chargeGain(35)); S.ults[S.weapon] = S.ult; S.od = Math.min(100, S.od + chargeGain(10)); }
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
        S.fireT = 0; S.od = Math.min(100, S.od + chargeGain(OD.perWeaponPickup));
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
  for (const k of WEAPON_KEYS) pools[k].sync(k === 'nova' ? 0.35 : 0.2);
  ebullets.sync(0.3); ecores.list = ebullets.list; ecores.sync(0.3);
  world.update(dt, S.t, S.state === 'paused' || S.state === 'over' ? 0.15 : 1);
  particles.update(dt); waves.update(dt);
  frameCamera(rawDt, time); fx.applyPost(stage, time); ui.tick(rawDt);
  stage.render(rawDt);
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
