// CYBER NINJA 賽博忍者：星海魔獸 — controller: drag-to-move auto-fire shooter, waves, cosmic monster bosses, ultimate, continue.
import * as THREE from 'three';
import { i18n, t, flags, createStore, createStage, ThemeController, themeFor, U, Particles, Shockwaves, FxState, createInput, CyberUI, Platform, createAds } from 'cyber-kit';
import { GAME_ID, FIELD, PLAYER, VOLLEYS, ULT, ENEMIES, ENEMY_BULLET_SPEED, DROP_CHANCE, waveSpec, speedScale, hpScale, ADS, MILESTONE_EVERY, milestoneBonus } from './config.js';
import './strings.js';
import { World } from './world.js';
import { makeNinja, updateNinja, makeEnemy, makeBoss, updateBoss, BulletPool, makePickup, PICKUPS } from './entities.js';
import { NinjaAudio } from './audio.js';

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

const ninja = makeNinja(); ninja.scale.setScalar(1.55); scene.add(ninja);
const bolts = new BulletPool(scene, 260, new THREE.BoxGeometry(0.09, 0.09, 0.75), 0x00e5ff);
const ebullets = new BulletPool(scene, 500, new THREE.SphereGeometry(0.17, 10, 8), 0xff2bd6);
const ecores = new BulletPool(scene, 500, new THREE.SphereGeometry(0.08, 6, 4), 0xffffff);
// ultimate slash wave
const slash = new THREE.Mesh(new THREE.PlaneGeometry(40, 2.4), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uA: { value: 0 }, uC: U.uC1 },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`uniform float uA; uniform vec3 uC; varying vec2 vUv; void main(){ float d = abs(vUv.y - 0.5) * 2.0; float core = exp(-d * 10.0); float a = (core * 1.6 + exp(-d * 3.0) * 0.5) * uA; gl_FragColor = vec4(mix(uC, vec3(1.0), core) * a * 2.5, 1.0); }` }));
slash.rotation.x = -Math.PI / 2; slash.visible = false; scene.add(slash);

const S = {
  state: 'attract', demo: !!flags.demo,
  x: 0, z: 1, vx: 0, hp: PLAYER.hp, invuln: 0, power: 1, fireT: 0, ult: 0, ultT: -1, slashZ: 0,
  score: 0, wave: 1, spec: null, waveT: 0, nextEv: 0, enemies: [], boss: null, pickups: [], kills: 0,
  continued: false, betweenT: 0, t: 0, newRecord: false,
};
window.__ninja = S;  // test hook

// ---------------------------------------------------------------- HUD
function updateHUD() {
  ui.setText('hud-score', S.score.toLocaleString('en-US'));
  ui.setText('hud-best', Math.max(store.best, S.score).toLocaleString('en-US'));
  ui.setText('hud-wave', S.wave);
  const pips = $('hud-hp'); let h = ''; for (let i = 0; i < PLAYER.maxHp; i++) h += `<i class="${i < S.hp ? 'on' : ''}"></i>`; if (pips.innerHTML !== h) pips.innerHTML = h;
  ui.setText('hud-power', 'P' + S.power);
  $('ult-fill').style.height = Math.min(100, S.ult).toFixed(0) + '%';
  $('btn-ult').classList.toggle('ready', S.ult >= 100);
  const bb = $('boss-bar'); bb.classList.toggle('hidden', !S.boss);
  if (S.boss) $('boss-fill').style.width = (Math.max(0, S.boss.hp / S.boss.maxHp) * 100).toFixed(1) + '%';
}
function refreshStart() { ui.setText('start-best', store.best.toLocaleString('en-US')); ui.setText('start-wave', store.getNum('bestWave', 0) || '—'); }
function setState(s) {
  S.state = s; ui.show({ attract: 'start', paused: 'pause', over: 'over' }[s] || null);
  ui.hud(s === 'playing' || s === 'paused' || s === 'over'); $('demo-tag').classList.toggle('hidden', !S.demo); updateHUD();
}

// ---------------------------------------------------------------- run flow
function clearField() {
  for (const e of S.enemies) scene.remove(e.g); S.enemies = [];
  if (S.boss) { scene.remove(S.boss.g); S.boss = null; }
  for (const p of S.pickups) scene.remove(p.g); S.pickups = [];
  bolts.clear(); ebullets.clear();
}
function resetRun() {
  clearField();
  Object.assign(S, { x: 0, z: 1, tx: 0, tz: 1, vx: 0, hp: PLAYER.hp, invuln: 1.2, power: 1, fireT: 0, ult: 0, ultT: -1, score: 0, wave: 0, kills: 0, continued: false, newRecord: false });
  theme.set(1); nextWave();
}
function nextWave() {
  S.wave++; S.spec = waveSpec(S.wave); S.waveT = 0; S.nextEv = 0; S.betweenT = 0;
  if (S.spec.boss) {
    spawnBoss(S.spec.hp, S.spec.variant);
    if (S.state !== 'attract') { ui.banner(t('bossIncoming', { name: bossName() }), t('waveN', { n: S.wave }), t('warning')); audio.warn(); fx.kick({ glitch: 0.6, aberr: 1 }); }
  } else if (S.state !== 'attract' && S.wave > 1 && (S.wave - 1) % MILESTONE_EVERY === 0) milestone(S.wave - 1);
  else if (S.state !== 'attract' && S.wave > 1) ui.banner(t('waveN', { n: S.wave }), '', S.wave % 5 === 4 ? t('bossNext') : '');
  audio.setLevel(1 + Math.floor((S.wave - 1) / 2));
}
function bossName(b = S.boss) { const v = b && b.variant; return v ? (i18n.isZh() ? v.zh : v.en) : ''; }
function refreshBossName() { ui.setText('bb-name', bossName()); ui.setText('bb-sub', S.boss ? t('waveN', { n: S.wave }) : ''); }
function milestone(n) {
  const pts = milestoneBonus(n); S.score += pts; S.hp = PLAYER.maxHp; theme.set(Math.floor(3 + n / MILESTONE_EVERY * 2));
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
  const def = ENEMIES[ev.type]; const g = makeEnemy(ev.type); g.scale.setScalar(1.45); scene.add(g);
  const e = { type: ev.type, def, g, x: ev.x, baseX: ev.x, z: FIELD.top - 1, t: 0, phase: ev.phase, hp: Math.ceil(def.hp * hpScale(S.wave)), fireT: 0.8 + Math.random(), flash: 0, mode: 0, stopZ: -15 + Math.random() * 5, vx: 0, vz: def.speed * speedScale(S.wave) };
  g.position.set(e.x, 0, e.z); S.enemies.push(e);
}
function spawnBoss(hp, variant = { zh: '星海魔獸', en: 'COSMIC MONSTER', rate: 1 }) {
  const g = makeBoss(); g.scale.setScalar(1.15); scene.add(g);
  S.boss = { g, x: 0, z: FIELD.top - 4, hp, maxHp: hp, t: 0, atk: 0, atkT: 2.5, spiralA: 0, entering: true, variant };
  refreshBossName();
  g.position.set(0, 0, S.boss.z);
}
function enemyFire(x, z, ang, speed = ENEMY_BULLET_SPEED) { ebullets.add(x, z, Math.sin(ang) * speed, Math.cos(ang) * speed); }
const aimAt = (x, z) => Math.atan2(S.x - x, S.z - z);

// ---------------------------------------------------------------- damage / kills
function killEnemy(e, i) {
  scene.remove(e.g); S.enemies.splice(i, 1);
  const c = new THREE.Color(e.def.color); const p = new THREE.Vector3(e.x, 0, e.z);
  particles.burst(p, c, 34, { speed: 7, up: 2, life: 0.7, size: 1, grav: 0, color2: new THREE.Color(0xffffff) });
  waves.spawn(p, c, { r0: 0.2, r1: 2.2, h: 0.5, dur: 0.4 });
  S.score += e.def.score; S.kills++; S.ult = Math.min(100, S.ult + ULT.perKill);
  if (S.ult >= 100 && !S.ultReadyShown) { S.ultReadyShown = true; if (S.state === 'playing') { audio.ready(); ui.toast(t('ultReady'), 1300); } }
  if (S.state !== 'attract') { audio.boom(false); if (e.def.score >= 120) { const sp = stage.toScreen(p); ui.popup(sp.x, sp.y, '+' + e.def.score); } }
  if (Math.random() < DROP_CHANCE) dropPickup(e.x, e.z);
  fx.kick({ trauma: 0.05 });
}
function dropPickup(x, z, kind) {
  kind = kind || (S.power < PLAYER.maxPower && Math.random() < 0.55 ? 'P' : Math.random() < 0.5 ? 'S' : 'E');
  const g = makePickup(kind); g.scale.setScalar(1.4); g.position.set(x, 0, z); scene.add(g); S.pickups.push({ g, kind, x, z, t: 0 });
}
function hurtPlayer() {
  if (S.invuln > 0 || S.ultT >= 0) return;
  if (S.state === 'attract') { S.invuln = 1; return; }
  S.hp--; S.invuln = PLAYER.invuln; S.power = Math.max(1, S.power - 1);
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
  S.score += ENEMIES.boss.score * (S.wave / 5); for (let i = 0; i < 3; i++) dropPickup(b.x + (i - 1) * 1.5, b.z, ['P', 'S', 'E'][i]);
  scene.remove(b.g); S.boss = null; ebullets.clear();
  if (S.state !== 'attract') ui.banner(t('bossDown'), `${bossName(b)} · +${(ENEMIES.boss.score * (S.wave / 5)).toLocaleString('en-US')}`, '');
  theme.set(1 + S.wave / 5);
}
function doUlt() {
  if (S.ult < 100 || S.ultT >= 0 || !(S.state === 'playing' || S.state === 'attract')) return;
  S.ult = 0; S.ultReadyShown = false; S.ultT = 0; S.slashZ = FIELD.bottom; slash.visible = true; S.ultBossHit = false;
  for (const b of ebullets.list) { particles.emit(new THREE.Vector3(b.x, 0, b.z), new THREE.Vector3(0, 2, 0), new THREE.Color(0xffffff), { life: 0.4, size: 0.8 }); }
  ebullets.clear();
  if (S.state !== 'attract') { audio.ult(); ui.banner(t('ultName'), '', ''); Platform.haptic('heavy'); }
  fx.kick({ slowmo: 0.7, aberr: 1.5, fovKick: 1, trauma: 0.3 }); ui.flash('rgba(0,229,255,0.35)', 500);
  updateHUD();
}

function gameOver() {
  S.state = 'dying'; S.dieT = 0;
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
  S.continued = true; S.hp = PLAYER.hp; S.invuln = 3; ebullets.clear(); ninja.visible = true; S.ult = 100;
  setState('playing'); audio.unduckMusic(); ui.banner(t('revived'), '', t('ultFull'));
}
async function retry() { if (S.state !== 'over') return; audio.click(); await ads.naturalBreak('gameover'); ninja.visible = true; beginRun(); }
async function overToMenu() { if (S.state !== 'over') return; await ads.naturalBreak('gameover'); ninja.visible = true; showAttract(); }
function pause() { if (S.state !== 'playing') return; setState('paused'); audio.duckMusic(); audio.back(); }
function resume() { if (S.state !== 'paused') return; setState('playing'); audio.unduckMusic(); audio.click(); }

// ---------------------------------------------------------------- input: relative drag + keys
const keys = new Set(); let drag = null;
addEventListener('keydown', (e) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) { keys.add(e.code); e.preventDefault(); } });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function worldPerPx() { const a = stage.toScreen(new THREE.Vector3(-FIELD.halfW, 0, 0)), b = stage.toScreen(new THREE.Vector3(FIELD.halfW, 0, 0)); return (FIELD.halfW * 2) / Math.max(40, b.x - a.x); }
const cv = $('scene');
cv.addEventListener('pointerdown', (e) => { if (S.state !== 'playing' || S.demo) return; drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: S.x, pz: S.z, k: worldPerPx() * PLAYER.dragGain }; try { cv.setPointerCapture(e.pointerId); } catch {} });
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
    else if (a === 'restart' && S.state === 'over') retry();
    else if (a === 'fps') $('fps').classList.toggle('hidden');
  },
}, { swipe: 'once', actions: { KeyX: 'ult', KeyJ: 'ult', KeyK: 'ult' } });
ui.on('btn-start', () => { audio.init(); beginRun(); });
ui.on('btn-resume', resume); ui.on('btn-quit', () => { audio.back(); showAttract(); }); ui.on('btn-pause', pause);
ui.on('btn-mute', () => { audio.init(); ui.setMuted(audio.toggleMute()); });
$('btn-ult').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); doUlt(); });
i18n.bindToggle($('btn-lang')); i18n.bindToggle($('btn-lang2'));
i18n.onChange(() => { refreshBossName(); if (S.state === 'over') ui.setText('revive-sub', t(ads.isNative ? 'reviveAd' : 'reviveFree')); });
ui.on('btn-retry', retry); ui.on('btn-menu', overToMenu); ui.on('btn-revive', revive);
Platform.onBack(() => { if (ui.closeModal()) return true; if (S.state === 'playing') { pause(); return true; } if (S.state === 'paused') { resume(); return true; } if (S.state === 'over') { overToMenu(); return true; } return false; });
Platform.onPause(() => { if (!S.demo) pause(); });
S.api = { wave: (n) => { clearField(); S.wave = n - 1; nextWave(); }, ult: () => { S.ult = 100; doUlt(); }, kill: () => { S.hp = 1; S.invuln = 0; hurtPlayer(); }, boss: () => { clearField(); S.wave = 4; nextWave(); } };

// ---------------------------------------------------------------- autopilot (demo / attract)
function autopilot(dt) {
  let tx = 0, best = 1e9;
  const targets = S.boss ? [S.boss] : S.enemies;
  for (const e of targets) { const d = Math.abs(e.z - S.z) * 0.3 + Math.abs(e.x - S.x); if (e.z < S.z && d < best) { best = d; tx = e.x; } }
  let push = 0;
  for (const b of ebullets.list) { const dz = S.z - b.z; if (dz > -0.5 && dz < 5) { const dx = S.x - b.x; if (Math.abs(dx) < 1.6) push += Math.sign(dx || 0.1) * (1.6 - Math.abs(dx)) * (1 - dz / 5) * 3; } }
  for (const e of S.enemies) if (e.type === 'dasher' && e.mode === 2) { const dx = S.x - e.x; if (Math.abs(dx) < 2.5) push += Math.sign(dx || 1) * 3; }
  S.tx = THREE.MathUtils.clamp(tx + push * 1.4, -FIELD.halfW + 0.5, FIELD.halfW - 0.5); S.tz = 1.2;
  if (S.ult >= 100 && (S.boss || S.enemies.length >= 6)) doUlt();
}

// ---------------------------------------------------------------- simulation
function sim(dt) {
  const T = S.t;
  // player movement
  if (S.state === 'attract' || S.demo) autopilot(dt);
  let kx = 0, kz = 0; if (keys.has('ArrowLeft') || keys.has('KeyA')) kx--; if (keys.has('ArrowRight') || keys.has('KeyD')) kx++; if (keys.has('ArrowUp') || keys.has('KeyW')) kz--; if (keys.has('ArrowDown') || keys.has('KeyS')) kz++;
  const px = S.x;
  if ((kx || kz) && S.state === 'playing' && !S.demo) { S.x += kx * PLAYER.keySpeed * dt; S.z += kz * PLAYER.keySpeed * dt; S.tx = S.x; S.tz = S.z; }
  else if (S.tx !== undefined) { const k = 1 - Math.exp(-dt * (drag ? 22 : 9)); S.x += (S.tx - S.x) * k; S.z += (S.tz - S.z) * k; }
  S.x = THREE.MathUtils.clamp(S.x, -FIELD.halfW + 0.4, FIELD.halfW - 0.4); S.z = THREE.MathUtils.clamp(S.z, FIELD.playerMinZ, FIELD.playerMaxZ);
  if (S.tx !== undefined) { S.tx = THREE.MathUtils.clamp(S.tx, -FIELD.halfW + 0.4, FIELD.halfW - 0.4); S.tz = THREE.MathUtils.clamp(S.tz, FIELD.playerMinZ, FIELD.playerMaxZ); }
  S.vx = (S.x - px) / Math.max(dt, 1e-4);
  S.invuln = Math.max(0, S.invuln - dt);
  ninja.position.set(S.x, 0, S.z);
  // auto-fire
  S.fireT -= dt;
  if (S.fireT <= 0 && S.ultT < 0) {
    S.fireT = PLAYER.fireRate * (S.power >= 4 ? 0.85 : 1);
    for (const [ox, ang] of VOLLEYS[S.power]) bolts.add(S.x + ox, S.z - 0.6, Math.sin(ang) * PLAYER.boltSpeed, -Math.cos(ang) * PLAYER.boltSpeed);
    if (S.state === 'playing') audio.shot();
  }
  // waves
  S.waveT += dt;
  if (!S.spec.boss) {
    const evs = S.spec.events;
    while (S.nextEv < evs.length && evs[S.nextEv].t <= S.waveT) spawnEnemy(evs[S.nextEv++]);
    if (S.nextEv >= evs.length && !S.enemies.length) { S.betweenT += dt; if (S.betweenT > 1.4) nextWave(); }
  } else if (!S.boss) { S.betweenT += dt; if (S.betweenT > 2.2) nextWave(); }
  // enemies
  const sc = speedScale(S.wave);
  for (let i = S.enemies.length - 1; i >= 0; i--) {
    const e = S.enemies[i]; e.t += dt; e.flash = Math.max(0, e.flash - dt * 6);
    if (e.type === 'drone') { e.z += e.vz * dt; e.x = e.baseX + Math.sin(e.t * 1.5 + e.phase) * 0.6; }
    else if (e.type === 'weaver') { e.z += e.vz * dt; e.x = THREE.MathUtils.clamp(e.baseX + Math.sin(e.t * 2 + e.phase) * 2.4, -FIELD.halfW + 0.6, FIELD.halfW - 0.6); }
    else if (e.type === 'turret') {
      if (e.mode === 0) { e.z += e.vz * dt; if (e.z >= e.stopZ) { e.mode = 1; e.holdT = 0; } }
      else if (e.mode === 1) { e.holdT += dt; e.fireT -= dt; if (e.fireT <= 0) { e.fireT = e.def.fire / sc; const a = aimAt(e.x, e.z); for (const o of (S.wave > 6 ? [-0.18, 0, 0.18] : [0])) enemyFire(e.x, e.z + 0.5, a + o); if (S.state === 'playing') audio.enemyShot(); } if (e.holdT > 6) e.mode = 2; }
      else e.z += e.vz * 1.5 * dt;
      if (e.g.userData.head) e.g.userData.head.rotation.y = aimAt(e.x, e.z);
    } else if (e.type === 'dasher') {
      if (e.mode === 0) { e.z += e.vz * 0.6 * dt; e.x += (S.x - e.x) * dt * 0.5; if (e.z > -12) { e.mode = 1; e.chargeT = 0.6; } }
      else if (e.mode === 1) { e.chargeT -= dt; e.flash = 0.6; if (e.chargeT <= 0) { e.mode = 2; const a = aimAt(e.x, e.z); e.dvx = Math.sin(a) * e.vz * 4.5; e.dvz = Math.cos(a) * e.vz * 4.5; } }
      else { e.x += e.dvx * dt; e.z += e.dvz * dt; }
      e.g.rotation.y = e.mode === 2 ? Math.atan2(e.dvx, e.dvz) : aimAt(e.x, e.z);
    }
    if (e.g.userData.spin) e.g.userData.spin.rotation.z += dt * 3;
    e.g.position.set(e.x, Math.sin(e.t * 3 + e.phase) * 0.15, e.z);
    e.g.userData.mat.emissive && e.g.userData.mat.emissive.setScalar(e.flash);
    if (e.z > FIELD.bottom + 2 || Math.abs(e.x) > FIELD.halfW + 4) { scene.remove(e.g); S.enemies.splice(i, 1); continue; }
    if (Math.hypot(e.x - S.x, e.z - S.z) < e.def.radius + PLAYER.radius) { hurtPlayer(); e.hp = 0; killEnemy(e, i); }
  }
  // boss
  const B = S.boss;
  if (B) {
    B.t += dt; const rage = B.hp < B.maxHp * 0.4 ? 1 : 0;
    if (B.entering) { B.z += 3 * dt; if (B.z >= -15) B.entering = false; }
    else { B.x = Math.sin(B.t * 0.5) * (FIELD.halfW - 2.5); B.z = -15 + Math.sin(B.t * 0.8) * 1.2; }
    B.atkT -= dt * (1 + rage * 0.5) * (B.variant.rate || 1);
    if (!B.entering) {
      if (B.atk === 0 && B.atkT <= 0) { const n = 14 + rage * 6; for (let i = 0; i < n; i++) enemyFire(B.x, B.z, (i / n) * Math.PI * 2 + B.t, ENEMY_BULLET_SPEED * 0.8); B.atk = 1; B.atkT = 1.8; if (S.state === 'playing') audio.enemyShot(); }
      else if (B.atk === 1) { B.spiralA += dt * 5; if ((B.t * 12 | 0) !== ((B.t - dt) * 12 | 0)) { enemyFire(B.x, B.z, B.spiralA, 6.5); enemyFire(B.x, B.z, B.spiralA + Math.PI, 6.5); if (rage) enemyFire(B.x, B.z, B.spiralA + Math.PI / 2, 6.5); } if (B.atkT <= 0) { B.atk = 2; B.atkT = 1.4; } }
      else if (B.atk === 2) { if (B.atkT <= 0) { const a = aimAt(B.x, B.z); for (const o of [-0.25, -0.12, 0, 0.12, 0.25]) enemyFire(B.x, B.z + 1.5, a + o, ENEMY_BULLET_SPEED * 1.1); B.atk = 0; B.atkT = 2.2; } }
    }
    B.g.position.set(B.x, 0.6, B.z);
    updateBoss(B.g, dt, T, new THREE.Vector2((S.x - B.x) / 8, -(S.z - B.z) / 20), rage);
    if (Math.hypot(B.x - S.x, B.z - S.z) < ENEMIES.boss.radius + PLAYER.radius) hurtPlayer();
  }
  // bolts
  for (const b of bolts.list) {
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (b.z < FIELD.top - 3) { b.dead = true; continue; }
    for (let i = S.enemies.length - 1; i >= 0; i--) { const e = S.enemies[i]; if (Math.abs(e.z - b.z) < e.def.radius + 0.4 && Math.abs(e.x - b.x) < e.def.radius + 0.1) { b.dead = true; e.hp -= PLAYER.boltDamage; e.flash = 1; if (S.state === 'playing') audio.hit(); particles.emit(new THREE.Vector3(b.x, 0, b.z + 0.3), new THREE.Vector3((Math.random() - 0.5) * 3, 1, 2), new THREE.Color(e.def.color), { life: 0.25, size: 0.6 }); if (e.hp <= 0) killEnemy(e, i); break; } }
    if (!b.dead && B && !B.entering && Math.hypot(B.x - b.x, B.z - b.z) < ENEMIES.boss.radius) { b.dead = true; B.hp -= PLAYER.boltDamage; B.g.userData.eyeU.uHurt.value = 0.4; S.ult = Math.min(100, S.ult + ULT.perBossHit); particles.emit(new THREE.Vector3(b.x, 0.5, b.z + 0.5), new THREE.Vector3((Math.random() - 0.5) * 4, 2, 3), new THREE.Color(0xa66bff), { life: 0.3, size: 0.7 }); if (B.hp <= 0) bossDown(); }
  }
  bolts.list = bolts.list.filter(b => !b.dead);
  // enemy bullets
  for (const b of ebullets.list) {
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (b.z > FIELD.bottom + 2 || b.z < FIELD.top - 4 || Math.abs(b.x) > FIELD.halfW + 3) b.dead = true;
    else if (Math.hypot(b.x - S.x, b.z - S.z) < PLAYER.radius + 0.12 && S.state !== 'dying') { b.dead = true; hurtPlayer(); }
  }
  ebullets.list = ebullets.list.filter(b => !b.dead);
  // ultimate slash sweep
  if (S.ultT >= 0) {
    S.ultT += dt; const k = S.ultT / ULT.duration; S.slashZ = FIELD.bottom + (FIELD.top - 4 - FIELD.bottom) * Math.min(1, k);
    slash.position.set(0, 0.4, S.slashZ); slash.material.uniforms.uA.value = Math.sin(Math.min(1, k) * Math.PI);
    for (let i = S.enemies.length - 1; i >= 0; i--) if (S.enemies[i].z > S.slashZ) killEnemy(S.enemies[i], i);
    if (B && !S.ultBossHit && B.z > S.slashZ) { S.ultBossHit = true; B.hp -= ULT.bossDamage; B.g.userData.eyeU.uHurt.value = 1; if (B.hp <= 0) bossDown(); }
    if (k >= 1) { S.ultT = -1; slash.visible = false; }
  }
  // pickups
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const p = S.pickups[i]; p.t += dt; const d = Math.hypot(p.x - S.x, p.z - S.z);
    if (d < 2.6) { p.x += (S.x - p.x) * dt * 6; p.z += (S.z - p.z) * dt * 6; } else p.z += 2.4 * dt;
    p.g.position.set(p.x, 0.3 + Math.sin(p.t * 4) * 0.15, p.z); p.g.rotation.y = p.t * 2;
    if (d < 0.9) {
      scene.remove(p.g); S.pickups.splice(i, 1);
      if (p.kind === 'P') S.power = Math.min(PLAYER.maxPower, S.power + 1); else if (p.kind === 'S') S.hp = Math.min(PLAYER.maxHp, S.hp + 1); else S.ult = Math.min(100, S.ult + 35);
      if (S.state === 'playing') { audio.pickup(); const sp = stage.toScreen(new THREE.Vector3(S.x, 0.8, S.z)); ui.popup(sp.x, sp.y - 30, t(p.kind), ''); Platform.haptic('light'); }
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
    updateNinja(ninja, dt, S.t, S.vx, S.invuln);
    if (S.state === 'playing') updateHUD();
  }
  bolts.sync(0.2); ebullets.sync(0.3); ecores.list = ebullets.list; ecores.sync(0.3);
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
