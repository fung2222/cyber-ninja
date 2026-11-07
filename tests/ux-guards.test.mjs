// Source-level guards for the 2026-11-05 UX pass:
// cooldown readout must stay inside the buttons, drops must stay 3D silhouettes,
// and the campaign must keep rolling + saving a resume point.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('..' + p, import.meta.url), 'utf8');
const css = read('/css/game.css');
const main = read('/js/main.js');
const entities = read('/js/entities.js');

test('ability buttons show only a static ring plus the numeric readout', () => {
  // Roy 2026-11-05: no water level and no refilling gauge after using a skill.
  assert.ok(!css.includes('.cd-fill'), 'water-level fill must stay deleted');
  assert.match(css, /\.ult-btn\.cooling::after,\s*\n\.action-dock \.od-btn\.active::after,\s*\n\.action-dock \.od-btn\.venting::after \{ content: none; \}/);
  assert.match(css, /\.ult-btn\.cooling #ult-sub \{ font-size: 22px/);
  assert.ok(!main.includes("setProperty('--cool'"), 'no cooldown fill value should be written');
  assert.match(css, /\.ult-btn::after \{ content: none; \}/);
  assert.match(css, /\.od-btn::after \{ content: none; \}/);
});

test('pickups are distinct 3D silhouettes, including the repair medkit', () => {
  for (const fn of ['medkit(', 'shieldIcon(', 'boltIcon(', 'powerIcon(']) assert.ok(entities.includes(fn), `${fn} missing`);
  assert.match(entities, /H: \{ color: 0xff5c6e/);
  assert.match(entities, /kind === 'W' && weaponKey === 'lance'/);
  assert.match(entities, /kind === 'W' && weaponKey === 'nova'/);
  assert.match(entities, /kind === 'W' && weaponKey === 'pulse'/);
});

test('weapon canisters expire after ten seconds with a blink', () => {
  assert.match(main, /const W_LIFE = 10, W_BLINK = 2;/);
  assert.match(main, /p\.g\.visible = Math\.sin/);
});

test('campaign rolls on and keeps a resume save point', () => {
  assert.match(main, /Continuous campaign \(Roy 2026-11-05\)/);
  assert.match(main, /RESUME_KEY/);
  assert.match(main, /addEventListener\('pagehide'/);
  assert.match(main, /quickStart\(\)/);
});

test('both skill buttons breathe on the same slow ready glow', () => {
  const css = readFileSync(new URL('../css/game.css', import.meta.url), 'utf8');
  for (const sel of ['.ult-btn.ready', '.od-btn.ready']) {
    const hits = [...css.matchAll(new RegExp(sel.replace('.', '\\.'), 'g'))].map((m) => css.slice(m.index, m.index + 200));
    assert.ok(hits.some((b) => /readyGlow 2\.4s/.test(b)), `${sel} must have a 2.4s readyGlow rule`);
    assert.ok(!/ultPulse|\.odPulse/.test(hits.filter((b) => /readyGlow/.test(b)).join('')), `${sel} must not keep the fast pulse`);
  }
});
