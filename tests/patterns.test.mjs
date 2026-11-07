import test from 'node:test';
import assert from 'node:assert/strict';
import { fan, withGap, lanes, flankFan, ringWithGap } from '../js/patterns.js';
import { readFileSync } from 'node:fs';

test('fan is symmetric and spans the requested arc', () => {
  const f = fan(0, 1, 5);
  assert.equal(f.length, 5);
  assert.ok(Math.abs(f[0] + 0.5) < 1e-9 && Math.abs(f[4] - 0.5) < 1e-9);
  assert.ok(Math.abs(f[2]) < 1e-9);
});

test('withGap removes the wedge around the gap', () => {
  const g = withGap(fan(0, 0.9, 5), 0, 0.13);
  assert.ok(g.every((a) => Math.abs(a) > 0.13));
  assert.ok(g.length < 5);
});

test('lanes leaves a walkable hole in the wall', () => {
  const xs = lanes(6, 1.25, 1.0, 1.2);
  assert.ok(xs.every((x) => Math.abs(x - 1.0) > 1.2));
  assert.ok(xs.length >= 6);
});

test('flankFan tilts one way and mirrors cleanly', () => {
  // +1 = shots lean right (used on the LEFT flank, so they travel into the middle)
  const right = flankFan(1, 0.46, 3, 0.34);
  const left = flankFan(-1, 0.46, 3, 0.34);
  assert.ok(right.every((a) => a > 0 && a < 0.6));
  assert.ok(left.every((a) => a < 0 && a > -0.6));
  const r2 = right.map((a) => -a).sort((x, y) => x - y), l2 = [...left].sort((x, y) => x - y);
  r2.forEach((a, i) => assert.ok(Math.abs(a - l2[i]) < 1e-9, `${a} vs ${l2[i]}`));
});

test('ringWithGap always keeps one wedge open', () => {
  for (const gap of [-1.2, 0, 0.7, 2.5]) {
    const r = ringWithGap(10, gap, 0.38);
    assert.ok(r.length >= 7 && r.length <= 9, `kept ${r.length} of 10`);
    assert.ok(r.every((a) => Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap))) > 0.38));
  }
});

test('boss chapters 4 and 6 fire fixed patterns, not aimed shots', () => {
  const src = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function fireBossPattern'), src.indexOf('// ---------------------------------------------------------------- damage / kills'));
  const ch4 = body.slice(body.indexOf('chapter === 4'), body.indexOf('chapter === 5'));
  const ch6 = body.slice(body.indexOf('chapter === 6'), body.indexOf('chapter === 7'));
  assert.ok(!ch4.includes('aimAt('), 'chapter 4 flanks must be a fixed fan');
  assert.ok(!ch6.includes('aimAt('), 'chapter 6 fan must be a fixed fan with a gap');
  assert.ok(ch4.includes('flankFan(') && ch6.includes('withGap('));
});

test('wall and pincer waves fire their own lanes instead of aiming', async () => {
  const { waveSpec } = await import('../js/config.js');
  const wall = waveSpec(3, () => 0.99);   // n=3, rng high -> wall/pincer family
  const laneEvents = wall.events.filter((e) => e.lane !== null && e.lane !== undefined);
  assert.ok(laneEvents.length >= 2, `expected lane shooters, got ${laneEvents.length}`);
  assert.ok(laneEvents.every((e) => Math.abs(e.lane) <= 0.3));
});

test('every non-boss wave keeps spawning for at least ~25 s (chapters run 3–5 min)', async () => {
  const { waveSpec } = await import('../js/config.js');
  for (const n of [1, 2, 3, 4, 6, 7, 8, 9, 11]) {
    const w = waveSpec(n, () => 0.42);
    const last = Math.max(...w.events.map((e) => e.t));
    assert.ok(last >= 25, `wave ${n} lasts only ${last.toFixed(1)}s of spawns`);
  }
  assert.ok(waveSpec(1, () => 0.42).events.length <= 14, 'wave 1 stays readable');
});

test('phase 2 formations use pass-by and cross patterns, not hovering turrets', async () => {
  const { waveSpec } = await import('../js/config.js');
  for (let n = 3; n <= 30; n++) {
    if (n % 5 === 0) continue;
    for (const rng of [0.1, 0.5, 0.9]) {
      const w = waveSpec(n, () => rng);
      if (w.recipe === 'line') {
        const passers = w.events.filter((e) => e.pattern === 'pass');
        assert.ok(passers.length >= 4, `wave ${n}: line needs pass-by enemies`);
      }
      if (w.recipe === 'crossfire') {
        assert.ok(w.events.filter((e) => e.pattern === 'cross').length >= 4, `wave ${n}: crossfire needs cross entries`);
        // reinforcements may add a turret, but the opening wave must be pure crossings
        assert.ok(!w.events.some((e) => e.type === 'turret' && e.t < 5), `wave ${n}: crossfire must not open with parked turrets`);
      }
      if (w.recipe === 'rush') {
        const rushers = w.events.filter((e) => e.role === 'rusher').length;
        assert.ok(rushers >= 10, `wave ${n}: rush should be dense`);
      }
    }
  }
});
