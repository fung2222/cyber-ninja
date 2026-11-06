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

test('both ability buttons carry a water-level fill and a numeric countdown', () => {
  assert.match(css, /\.action-dock \.cd-fill \{/);
  assert.match(css, /calc\(var\(--cool\) \* [.\d]+%\)/);
  assert.match(css, /\.ult-btn\.cooling #ult-sub \{ font-size: 22px/);
  assert.match(main, /setProperty\('--cool'/);
  assert.match(main, /ultLeftPct|odLeftPct/);
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
