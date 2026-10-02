import { bossHp, bossVariant, milestoneBonus, hpScale, waveSpec, FIELD, BOSS_EVERY } from '../js/config.js';
import assert from 'node:assert/strict';
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let n = 1; n <= 30; n++) {
  const w = waveSpec(n, rng);
  if (n % BOSS_EVERY === 0) { assert.ok(w.boss && w.hp > 0); continue; }
  assert.ok(w.events.length >= 6, 'wave has enemies');
  for (const e of w.events) { assert.ok(Math.abs(e.x) <= FIELD.halfW - 0.8 + 1e-9); assert.ok(e.t > 0); }
  for (let i = 1; i < w.events.length; i++) assert.ok(w.events[i].t >= w.events[i - 1].t);
  if (n < 3) assert.ok(!w.events.some(e => e.type === 'turret'));
}
assert.ok(waveSpec(10, rng).hp > waveSpec(5, rng).hp);
{ // endless: boss hp, enemy hp scale and fire rate are capped; species keep coming
  assert.ok(bossHp(5000) <= 1100); assert.ok(hpScale(10000) <= 3.5); const v = bossVariant(40); assert.ok(v.rate <= 1.6 && v.zh && v.en.includes('MK')); assert.notEqual(bossVariant(1).en, bossVariant(2).en); const w = waveSpec(250); assert.ok(w.boss && w.variant); const n = waveSpec(203); assert.ok(n.events.length > 0); assert.equal(milestoneBonus(30), 15000); }
console.log('ALL PASSED (waves 1-30)');
