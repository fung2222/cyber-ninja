// Balance guard for XENO NIGHTMARE (Roy 2026-11-05).
// Baseline = the starter loadout on chapter 1: a direct nova shell must kill the
// weakest trash in one hit, and difficulty must climb smoothly per wave instead of
// jumping +40% at every chapter border.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES, hpScale } from '../js/config.js';
import { WEAPONS, pierceDamage, novaSplash } from '../js/weapons.js';
import { readFileSync } from 'node:fs';
const mainSrc = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

const lvl = (key, n) => WEAPONS[key].levels[n - 1];

test('nova kills a chapter-1 drone with one direct hit at level 1', () => {
  const droneHp = ENEMIES.drone.hp * hpScale(1);
  assert.ok(lvl('nova', 1).dmg >= droneHp,
    `nova L1 ${lvl('nova', 1).dmg} must cover drone hp ${droneHp}`);
});

test('every weapon family stays usable: monotonic damage, local nova blast', () => {
  for (const key of ['pulse', 'lance', 'nova']) {
    const levels = WEAPONS[key].levels;
    assert.equal(levels.length, 6);
    for (let i = 1; i < 6; i++) assert.ok(levels[i].dmg >= levels[i - 1].dmg, `${key} L${i + 1} damage does not fall`);
  }
  assert.ok(lvl('nova', 6).aoe <= 2.4, 'nova blast stays local');
  assert.ok(lvl('lance', 6).dmg < 3, 'lance keeps its lower per-shot damage');
  assert.equal(lvl('pulse', 3).homing, 2, 'pulse homing identity is kept');
});

test('difficulty rises per wave with no chapter cliff', () => {
  assert.equal(hpScale(1), 1);
  for (let n = 2; n <= 50; n++) {
    const ratio = hpScale(n) / hpScale(n - 1);
    assert.ok(ratio <= 1.06, `wave ${n} jumps ${ratio.toFixed(3)}x`);
  }
  assert.ok(Math.abs(hpScale(46) - 3.0) < 0.2, `chapter 10 starts near x3.0 (${hpScale(46)})`);
  assert.ok(hpScale(10000) <= 3.2, 'endless stays capped');
});

test('trash still needs more than one shot later, so levels matter', () => {
  assert.ok(lvl('nova', 1).dmg < ENEMIES.drone.hp * hpScale(21), 'chapter 5 trash survives a base nova');
  assert.ok(lvl('nova', 6).dmg > lvl('nova', 1).dmg * 1.5, 'level-ups remain meaningful');
});

// Sustained single-target DPS (every projectile of the volley assumed to connect).
const dps = (key, lv) => { const l = lvl(key, lv); return l.dmg * l.shots.length / l.rate; };

test('weapon DPS profile keeps each weapon worth choosing', () => {
  const [p1, l1, n1] = [dps('pulse', 1), dps('lance', 1), dps('nova', 1)];
  assert.ok(p1 > n1, `pulse L1 (${p1.toFixed(1)}) must out-dps nova L1 (${n1.toFixed(1)})`);
  assert.ok(p1 > l1, `pulse L1 (${p1.toFixed(1)}) must out-dps lance L1 (${l1.toFixed(1)})`);
  assert.ok(lvl('nova', 1).aoe >= 1.5, 'nova pays for its lower DPS with area damage');
  assert.ok(lvl('lance', 1).pierce >= 2, 'lance pays for its lower DPS with pierce');
  const [p6, l6, n6] = [dps('pulse', 6), dps('lance', 6), dps('nova', 6)];
  assert.ok(p6 > n6 && p6 > l6, `pulse L6 (${p6.toFixed(1)}) leads sustained DPS`);
  assert.ok(n6 > n1 * 1.8, 'nova still scales meaningfully');
});

test('pierce costs 20% per target with a 40% floor', () => {
  assert.equal(pierceDamage(2.1, 0), 2.1);
  assert.ok(Math.abs(pierceDamage(2.1, 1) - 1.68) < 1e-9, 'second target takes 80%');
  assert.ok(Math.abs(pierceDamage(2.1, 2) - 1.344) < 1e-9, 'third target takes 64%');
  assert.ok(Math.abs(pierceDamage(2.1, 9) - 2.1 * 0.4) < 1e-9, 'floor stays at 40%');
});

test('nova splash tapers from 80% centre to under 45% at the edge', () => {
  const n = lvl('nova', 1);
  assert.ok(Math.abs(novaSplash(n.dmg, 0, n.aoe) - n.dmg * 0.8) < 1e-9);
  assert.ok(novaSplash(n.dmg, n.aoe, n.aoe) <= n.dmg * 0.45);
  assert.ok(novaSplash(n.dmg, n.aoe / 2, n.aoe) > novaSplash(n.dmg, n.aoe, n.aoe));
});

test('power pity guarantees an upgrade after 8 dry kills', () => {
  assert.match(mainSrc, /killsSinceP >= 8/);
  assert.match(mainSrc, /if \(kind === 'P'\) killsSinceP = 0;/);
});
