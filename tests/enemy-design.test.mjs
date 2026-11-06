// Enemy design guard (Roy 2026-11-05): every wave must mix two roles.
// Shooters hold back and fire a telegraphed, slow 3-shot spread (the damage window);
// rushers dive through and never fire (the movement pressure). Aimed bullets stay slow
// enough that dodging does not force the player out of their own firing line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { waveSpec, ENEMY_BULLET_SPEED, BOSS_EVERY } from '../js/config.js';
import { CAMPAIGN_LEVELS } from '../js/campaign.js';

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

test('aimed enemy fire is slow enough to dodge in place', () => {
  assert.ok(ENEMY_BULLET_SPEED <= 7, `enemy aimed speed ${ENEMY_BULLET_SPEED} must stay <= 7`);
  assert.match(main, /telegraphT = 0\.5/, 'shooters keep a 0.5 s muzzle telegraph');
  assert.match(main, /e\.role === 'shooter'/, 'only shooters may fire');
});

test('every non-boss wave mixes shooters and rushers', () => {
  const rusherTypes = new Set(['dasher', 'mite']);
  for (let n = 1; n <= CAMPAIGN_LEVELS; n++) {
    if (n % BOSS_EVERY === 0) continue;
    const w = waveSpec(n, () => 0.42);
    const events = w.events;
    const shooters = events.filter(e => e.role === 'shooter');
    const rushers = events.filter(e => e.role === 'rusher');
    assert.ok(shooters.length >= 2, `wave ${n} needs at least 2 shooters (got ${shooters.length})`);
    assert.ok(rushers.length >= 6, `wave ${n} needs at least 6 rushers (got ${rushers.length})`);
    const share = shooters.length / events.length;
    assert.ok(share >= 0.25 && share <= 0.45, `wave ${n} shooter share ${(share * 100).toFixed(0)}% out of 25–45%`);
    for (const r of rushers) assert.ok(rusherTypes.has(r.type), `wave ${n}: rusher ${r.type} must never fire`);
    for (const s of shooters) assert.ok(!rusherTypes.has(s.type), `wave ${n}: shooter ${s.type} must be a firing type`);
  }
});

test('early waves stay readable and later waves keep the same role split', () => {
  const w1 = waveSpec(1, () => 0.42);
  assert.equal(w1.recipe, 'line');
  assert.ok(w1.events.length <= 14, 'wave 1 stays light');
  const w30 = waveSpec(29, () => 0.42);
  const share = w30.events.filter(e => e.role === 'shooter').length / w30.events.length;
  assert.ok(share >= 0.25 && share <= 0.45, 'role split holds in later chapters');
});
