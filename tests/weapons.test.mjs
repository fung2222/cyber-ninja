import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, WEAPON_KEYS, WEAPON_ULT, OD, levelOf, fireSolution, randomOtherWeapon } from '../js/weapons.js';

test('three weapons, each with six levels and a distinct ultimate', () => {
  assert.equal(WEAPON_KEYS.length, 3);
  const ults = new Set();
  for (const key of WEAPON_KEYS) {
    const w = WEAPONS[key];
    assert.equal(w.levels.length, 6, `${key} has six levels`);
    assert.ok(w.name.zh && w.name.en && w.ult.zh && w.ult.en, `${key} is bilingual`);
    assert.ok(WEAPON_ULT[key] && WEAPON_ULT[key].duration > 0, `${key} has its own ultimate`);
    ults.add(w.ult.en);
  }
  assert.equal(ults.size, 3, 'ultimates are distinct');
});

test('weapon levels scale damage and never lose fire rate', () => {
  for (const key of WEAPON_KEYS) {
    let prev = levelOf(key, 1);
    for (let lv = 2; lv <= 6; lv++) {
      const cur = levelOf(key, lv);
      assert.ok(cur.dmg >= prev.dmg, `${key} L${lv} damage does not fall`);
      assert.ok(cur.rate <= prev.rate + 1e-9, `${key} L${lv} rate does not slow`);
      prev = cur;
    }
  }
});

test('overdrive raises the effective level and keeps the 4s/3s contract', () => {
  assert.equal(OD.duration, 4);
  assert.equal(OD.noFire, 3);
  const base = fireSolution('pulse', 2, false);
  const od = fireSolution('pulse', 2, true);
  assert.equal(od.dmg, levelOf('pulse', 4).dmg * 1.15);
  assert.ok(od.rate < base.rate);
  const max = fireSolution('nova', 6, true);
  assert.equal(max.dmg, levelOf('nova', 6).dmg * 1.35, 'max-level overdrive gets the bigger bonus');
});

test('a weapon pickup never offers the equipped weapon', () => {
  for (const key of WEAPON_KEYS) {
    for (let i = 0; i < 20; i++) assert.notEqual(randomOtherWeapon(key), key);
  }
});
