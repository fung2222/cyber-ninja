import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const src = readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');

test('xeno-nightmare BGM has no noise hats/snare', () => {
  assert.match(src, /hats: false/, 'drive preset noise hats must be disabled');
  assert.match(src, /playStep\(step, time, s16\)/, 'playStep override must exist');
  assert.match(src, /this\.noiseHit = \(\) => \{\}/, 'noise hits must be suppressed during BGM');
});
