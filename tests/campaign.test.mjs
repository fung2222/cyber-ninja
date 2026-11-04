import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTER_COUNT, LEVELS_PER_CHAPTER, CAMPAIGN_LEVELS, campaignForWave, campaignLabel } from '../js/campaign.js';
import { DIFFICULTIES, difficultyOf } from '../js/config.js';

test('campaign has ten chapters, five sorties each and fifty distinct maps', () => {
  assert.equal(CHAPTER_COUNT, 10);
  assert.equal(LEVELS_PER_CHAPTER, 5);
  assert.equal(CAMPAIGN_LEVELS, 50);
  const keys = new Set();
  const fingerprints = new Set();
  for (let wave = 1; wave <= 50; wave++) {
    const m = campaignForWave(wave);
    assert.equal(m.chapter, Math.floor((wave - 1) / 5) + 1);
    assert.equal(m.stage, (wave - 1) % 5 + 1);
    assert.ok(m.campaign && m.story.zh && m.story.en && m.name.zh && m.name.en);
    assert.ok(m.map.grid > 0 && m.map.road > 0 && m.map.tower > 0);
    keys.add(m.key);
    fingerprints.add(JSON.stringify(m.map));
    assert.ok(campaignLabel(m, 'en').includes(`CH.${String(m.chapter).padStart(2, '0')}-${m.stage}`));
  }
  assert.equal(keys.size, 50);
  assert.equal(fingerprints.size, 50);
  assert.equal(campaignForWave(51).campaign, false);
});

test('three difficulty contracts are ordered and fall back safely', () => {
  assert.deepEqual(Object.keys(DIFFICULTIES), ['story', 'normal', 'nightmare']);
  assert.ok(DIFFICULTIES.story.bulletSpeed < DIFFICULTIES.normal.bulletSpeed);
  assert.ok(DIFFICULTIES.normal.bulletSpeed < DIFFICULTIES.nightmare.bulletSpeed);
  assert.ok(DIFFICULTIES.story.fireRate < DIFFICULTIES.normal.fireRate);
  assert.ok(DIFFICULTIES.nightmare.score > DIFFICULTIES.normal.score);
  assert.equal(DIFFICULTIES.story.bonusHp, 2);
  assert.equal(difficultyOf('bad-value').key, 'normal');
});
