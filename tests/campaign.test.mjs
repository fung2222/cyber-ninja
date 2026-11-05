import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTER_COUNT, LEVELS_PER_CHAPTER, CAMPAIGN_LEVELS, campaignForWave, campaignLabel, normalizeProgress, isLevelUnlocked, recordLevel, recordChapter, chapterRecord, chapterBest, chapterClears, isChapterUnlocked, isDifficultyUnlocked } from '../js/campaign.js';
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

test('level records retain best scores and clears unlock only the next sortie', () => {
  let p = normalizeProgress(null);
  assert.equal(p.unlocked, 1);
  assert.equal(isLevelUnlocked(p, 1), true);
  assert.equal(isLevelUnlocked(p, 2), false);
  p = recordLevel(p, 1, 1200, false);
  assert.equal(p.records['1-1'].best, 1200);
  assert.equal(p.unlocked, 1);
  p = recordLevel(p, 1, 900, true);
  p = recordLevel(p, 1, 2400, true);
  assert.equal(p.records['1-1'].best, 2400);
  assert.equal(p.records['1-1'].clears, 2);
  assert.equal(p.unlocked, 2);
  assert.equal(isLevelUnlocked(p, 2), true);
  assert.equal(isLevelUnlocked(p, 3), false);
  p = recordLevel(p, 50, 99999, true);
  assert.equal(p.unlocked, 50, 'campaign unlock never spills into endless mode');
  const safe = normalizeProgress({ unlocked: 999, records: { '1-1': { best: -5, clears: '2' }, bad: { best: 99 } } });
  assert.equal(safe.unlocked, 50);
  assert.deepEqual(safe.records['1-1'], { best: 0, clears: 2 });
  assert.equal(safe.records.bad, undefined);
});

test('chapter entry unlocks only after all five stages, with per-difficulty records', () => {
  let p = normalizeProgress(null);
  assert.equal(isChapterUnlocked(p, 1), true);
  assert.equal(isChapterUnlocked(p, 2), false);
  assert.equal(isDifficultyUnlocked(p, 1, 'story'), true);
  assert.equal(isDifficultyUnlocked(p, 1, 'normal'), false);
  assert.equal(isDifficultyUnlocked(p, 1, 'nightmare'), false);
  for (let wave = 1; wave <= 4; wave++) p = recordLevel(p, wave, 100 * wave, true);
  assert.equal(isChapterUnlocked(p, 2), false, 'four stages do not open chapter two');
  p = recordLevel(p, 5, 500, true);
  p = recordChapter(p, 1, 'story', 1500, true);
  assert.equal(isChapterUnlocked(p, 2), true);
  assert.equal(chapterRecord(p, 1, 'story').best, 1500);
  assert.equal(chapterRecord(p, 1, 'story').clears, 1);
  assert.equal(isDifficultyUnlocked(p, 1, 'normal'), true);
  assert.equal(isDifficultyUnlocked(p, 1, 'nightmare'), false);
  p = recordChapter(p, 1, 'normal', 1300, true);
  assert.equal(isDifficultyUnlocked(p, 1, 'nightmare'), true);
  assert.equal(chapterBest(p, 1), 1500);
  assert.equal(chapterClears(p, 1), 2);
  p = recordChapter(p, 1, 'nightmare', 2400, false);
  assert.equal(chapterRecord(p, 1, 'nightmare').best, 2400, 'failed attempts still retain a best score');
  assert.equal(chapterRecord(p, 1, 'nightmare').clears, 0);
});

test('legacy completed chapters migrate without granting higher-difficulty clears', () => {
  const records = {};
  for (let wave = 1; wave <= 5; wave++) records[`1-${wave}`] = { best: wave * 100, clears: 1 };
  const p = normalizeProgress({ unlocked: 6, records });
  assert.equal(isChapterUnlocked(p, 2), true);
  assert.equal(chapterRecord(p, 1, 'story').best, 1500);
  assert.equal(chapterRecord(p, 1, 'story').clears, 1);
  assert.equal(isDifficultyUnlocked(p, 1, 'normal'), true);
  assert.equal(isDifficultyUnlocked(p, 1, 'nightmare'), false);
  const safe = normalizeProgress({ chapters: { 1: { difficulties: { story: { best: -50, clears: '2' }, bad: { best: 99 } } } } });
  assert.deepEqual(chapterRecord(safe, 1, 'story'), { best: 0, clears: 2 });
  assert.equal(chapterRecord(safe, 1, 'bad').best, 0);
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
