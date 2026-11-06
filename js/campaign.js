// XENO NIGHTMARE campaign: 10 chapters × 5 sorties = 50 authored map variations.
// Pure data/helpers: safe for Node tests and shared by the renderer and HUD.
export const CHAPTER_COUNT = 10;
export const LEVELS_PER_CHAPTER = 5;
export const CAMPAIGN_LEVELS = CHAPTER_COUNT * LEVELS_PER_CHAPTER;

const CHAPTERS = [
  { id: 'neon', zh: '霓虹淪陷', en: 'NEON FALL', place: ['霓虹九龍', 'NEON KOWLOON'], theme: 1, district: 'city', story: ["噬界病毒由九龍碼頭登陸，一夜之間改寫街燈、招牌同市民記憶。蒼隼中隊由舊機場跑道緊急升空，要在訊號塔倒塌前奪回第一條航道。", "Ouroboros lands at the Kowloon docks and rewrites streetlights, signs and memories overnight. Falcon squadron scrambles from the old airport runway to retake the first lane before the signal towers fall."] },
  { id: 'ghost', zh: '幽靈頻道', en: 'GHOST CHANNEL', place: ['零號訊道', 'CHANNEL ZERO'], theme: 2, district: 'city', story: ["被刪除嘅市民意識困喺雜訊海，只剩下斷斷續續嘅求救脈衝。壁壘展開納米護盾，護送救援訊號穿過封鎖網，將仍然完整嘅意識逐個撈返出嚟。", "Deleted citizens drift in a sea of static, their SOS reduced to broken pulses. Bastion raises its nano-shield to escort the rescue signal through the blockade and pull intact minds back one by one."] },
  { id: 'forge', zh: '數據熔爐', en: 'DATA FURNACE', place: ['紅熱鑄域', 'EMBER FORGE'], theme: 3, district: 'city', story: ["病毒接管紅熱鑄域，將武器工廠變成會自我複製嘅兵巢。熔爐溫度每分鐘上升，三位駕駛員要喺核心過載之前切斷生產線。", "The virus seizes the Ember Forge and turns the weapons works into a self-replicating nest. With the furnace climbing every minute, the three pilots must cut the production line before the core overloads."] },
  { id: 'mirror', zh: '鏡像迷城', en: 'MIRROR MAZE', place: ['反射街區', 'REFLECTION WARD'], theme: 4, district: 'city', story: ["鏡像街區每條路都映出另一個被感染嘅未來，連雷達都開始講大話。幽影追住共振訊號，喺假地圖之中搵出唯一一條仍然真實嘅出口。", "Every road in the Reflection Ward mirrors an infected future and even the radar starts lying. Wraith follows the resonance signal to find the one exit that is still real."] },
  { id: 'blackout', zh: '熄燈協議', en: 'BLACKOUT PROTOCOL', place: ['暗網深井', 'DARKNET WELL'], theme: 5, district: 'city', story: ["熄燈協議啟動，全城光源被吞噬，只剩敵機輪廓同武器火光。中隊要守住最後備用電網，等市民意識完成離線備份。", "The blackout protocol devours every light until only hostile outlines and muzzle fire remain. The squadron holds the last backup grid while the citizens finish their offline backup."] },
  { id: 'ruins', zh: '遺跡回聲', en: 'ECHOES OF RUIN', place: ['深空廢墟', 'DEEP-SPACE RUINS'], theme: 6, district: 'ruins', story: ["戰線推進到被刪除嘅舊世界，殘破星門仍然記錄住病毒最初入侵嘅一刻。碎片之中有答案，亦有仍然守衛舊世界嘅殘存兵器。", "The front pushes into the deleted old world, where broken star gates still record the virus’s first incursion. The debris holds answers — and weapons that still guard the old world."] },
  { id: 'garden', zh: '腐化花園', en: 'CORRUPTED GARDEN', place: ['晶棘温室', 'CRYSTAL CONSERVATORY'], theme: 7, district: 'ruins', story: ["人造生命嘅溫室長滿惡意晶棘，孢子會將接觸到嘅意識同化成病毒分支。中隊要清除孢子母株，救出未被感染嘅新生意識。", "The synthetic-life conservatory is overgrown with malicious crystal, its spores assimilating any mind they touch. The squadron must burn the mother growth and rescue the newborn minds."] },
  { id: 'storm', zh: '記憶風暴', en: 'MEMORY STORM', place: ['迴響荒原', 'ECHO WASTES'], theme: 8, district: 'ruins', story: ["三人嘅戰鬥記憶被捲入迴響荒原，化成敵方幻影，連自己友嘅訊號都會變成陷阱。只有互相信任、保持編隊，才可以穿過呢片記憶風暴。", "The pilots’ combat memories are dragged into the Echo Wastes and turn into hostile phantoms; even friendly signals become traps. Only trust and tight formation carry them through."] },
  { id: 'crown', zh: '病毒王座', en: 'VIRAL THRONE', place: ['權限聖殿', 'ROOT CATHEDRAL'], theme: 9, district: 'ruins', story: ["噬界奪取最高權限，將自己封入病毒王座，並把守衛改寫成巨獸。突破王座外環，切斷感染源頭，係唯一終結方式。", "Ouroboros seizes root access, seals itself in the Viral Throne and rewrites its guards into monsters. Breaching the outer ring and severing the source is the only way to end it."] },
  { id: 'dawn', zh: '黎明重啟', en: 'REBOOT AT DAWN', place: ['創世中樞', 'GENESIS NEXUS'], theme: 10, district: 'ruins', story: ["最後五關直通世界中樞。三位駕駛員並肩發動總攻，將剩餘嘅乾淨記憶上傳，為 cyber world 重啟黎明。", "The final five sorties lead straight to the world kernel. The three pilots strike together, uploading what clean memory remains to reboot dawn for the cyber world."] },
];

const SORTIES = [
  { zh: '外圍突破', en: 'OUTER BREACH' },
  { zh: '訊號追蹤', en: 'SIGNAL TRACE' },
  { zh: '深層切入', en: 'DEEP INCURSION' },
  { zh: '防火牆崩解', en: 'FIREWALL COLLAPSE' },
  { zh: '守門巨獸', en: 'GATEKEEPER' },
];

export function campaignForWave(wave) {
  const n = Math.max(1, Math.floor(wave || 1));
  const campaign = n <= CAMPAIGN_LEVELS;
  const index = campaign ? n - 1 : (n - 1) % CAMPAIGN_LEVELS;
  const chapterIndex = Math.floor(index / LEVELS_PER_CHAPTER);
  const stageIndex = index % LEVELS_PER_CHAPTER;
  const ch = CHAPTERS[chapterIndex];
  const sortie = SORTIES[stageIndex];
  const seed = chapterIndex * 5 + stageIndex + 1;
  return {
    campaign, wave: n, chapter: chapterIndex + 1, stage: stageIndex + 1,
    key: `${chapterIndex + 1}-${stageIndex + 1}`, chapterId: ch.id,
    name: { zh: ch.zh, en: ch.en }, place: { zh: ch.place[0], en: ch.place[1] },
    stageName: { zh: sortie.zh, en: sortie.en }, story: { zh: ch.story[0], en: ch.story[1] },
    theme: ch.theme, district: ch.district, seed,
    // Every sortie has a distinct spatial fingerprint: city block/road scale,
    // tower density and ruins orientation all change with chapter and stage.
    map: {
      grid: 7.2 + chapterIndex * 0.43 + stageIndex * 0.72,
      road: 0.024 + ((chapterIndex + stageIndex * 2) % 5) * 0.005,
      glow: 0.82 + stageIndex * 0.09,
      tower: 0.86 + ((chapterIndex * 2 + stageIndex) % 6) * 0.075,
      ruinScale: 0.86 + ((chapterIndex + stageIndex * 3) % 7) * 0.055,
      ruinTurn: (chapterIndex * 0.31 + stageIndex * 0.47) % (Math.PI * 2),
      floorTurn: chapterIndex * 0.18 + stageIndex * 0.33,
      rail: 0.82 + stageIndex * 0.12,
      fog: 0.82 + ((chapterIndex + stageIndex) % 5) * 0.07,
      hazard: Math.max(0.78, 1.18 - chapterIndex * 0.035 - stageIndex * 0.025),
      rocks: Math.max(0.8, 1.2 - stageIndex * 0.04),
    },
  };
}

export function campaignLabel(m, lang = 'zh') {
  return `CH.${String(m.chapter).padStart(2, '0')}-${m.stage} · ${m.place[lang] || m.place.zh}`;
}

// Defensive local progression. Sortie records are retained for migration and
// detailed statistics, but sorties are no longer separate menu destinations.
// A chapter is one five-stage run; each chapter and threat level has its own
// best score and clear count. All of this lives in the current browser only.
export const DIFFICULTY_ORDER = ['story', 'normal', 'nightmare'];
const cleanScore = (v) => Math.max(0, Math.floor(Number(v) || 0));
const cleanRecord = (r) => ({
  best: cleanScore(r && typeof r === 'object' ? r.best : 0),
  clears: cleanScore(r && typeof r === 'object' ? r.clears : 0),
});

export function normalizeProgress(raw) {
  const records = {};
  const source = raw && typeof raw === 'object' && raw.records && typeof raw.records === 'object' ? raw.records : {};
  for (let wave = 1; wave <= CAMPAIGN_LEVELS; wave++) {
    const key = campaignForWave(wave).key;
    const r = cleanRecord(source[key]);
    if (r.best || r.clears) records[key] = r;
  }
  const chapters = {};
  const hasChapterData = !!(raw && typeof raw === 'object' && raw.chapters && typeof raw.chapters === 'object');
  const oldChapters = hasChapterData ? raw.chapters : {};
  for (let chapter = 1; chapter <= CHAPTER_COUNT; chapter++) {
    const old = oldChapters[chapter] && typeof oldChapters[chapter] === 'object' ? oldChapters[chapter] : {};
    const difficulties = {};
    for (const difficulty of DIFFICULTY_ORDER) difficulties[difficulty] = cleanRecord(old.difficulties?.[difficulty]);
    // Migrate a completed old-style chapter without inventing higher-difficulty
    // clears. Its story best is the sum of the five retained sortie records.
    const first = (chapter - 1) * LEVELS_PER_CHAPTER + 1;
    const oldClear = Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => records[campaignForWave(first + i).key]?.clears > 0).every(Boolean);
    if (!hasChapterData && oldClear && difficulties.story.clears === 0) {
      difficulties.story.clears = 1;
      difficulties.story.best = Math.max(difficulties.story.best, Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => records[campaignForWave(first + i).key]?.best || 0).reduce((a, b) => a + b, 0));
    }
    chapters[chapter] = { difficulties };
  }
  return {
    unlocked: Math.max(1, Math.min(CAMPAIGN_LEVELS, Math.floor(Number(raw?.unlocked) || 1))),
    records, chapters,
  };
}

export function chapterRecord(progress, chapter, difficulty = 'story') {
  const p = normalizeProgress(progress);
  return p.chapters[chapter]?.difficulties[difficulty] || { best: 0, clears: 0 };
}

export function chapterBest(progress, chapter) {
  const p = normalizeProgress(progress);
  return Math.max(0, ...DIFFICULTY_ORDER.map(d => p.chapters[chapter]?.difficulties[d]?.best || 0));
}

export function chapterClears(progress, chapter) {
  const p = normalizeProgress(progress);
  return DIFFICULTY_ORDER.reduce((n, d) => n + (p.chapters[chapter]?.difficulties[d]?.clears || 0), 0);
}

export function isChapterUnlocked(progress, chapter) {
  const p = normalizeProgress(progress);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > CHAPTER_COUNT) return false;
  return chapter === 1 || p.unlocked >= (chapter - 1) * LEVELS_PER_CHAPTER + 1 || chapterClears(p, chapter - 1) > 0;
}

export function isDifficultyUnlocked(progress, chapter, difficulty) {
  if (!isChapterUnlocked(progress, chapter) || !DIFFICULTY_ORDER.includes(difficulty)) return false;
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  return index === 0 || chapterRecord(progress, chapter, DIFFICULTY_ORDER[index - 1]).clears > 0;
}

export function isLevelUnlocked(progress, wave) {
  const p = normalizeProgress(progress);
  return Number.isInteger(wave) && wave >= 1 && wave <= p.unlocked && wave <= CAMPAIGN_LEVELS;
}

export function recordLevel(progress, wave, score, cleared) {
  const p = normalizeProgress(progress);
  if (!Number.isInteger(wave) || wave < 1 || wave > CAMPAIGN_LEVELS) return p;
  const key = campaignForWave(wave).key;
  const old = p.records[key] || { best: 0, clears: 0 };
  p.records[key] = { best: Math.max(old.best, cleanScore(score)), clears: old.clears + (cleared ? 1 : 0) };
  if (cleared) p.unlocked = Math.max(p.unlocked, Math.min(CAMPAIGN_LEVELS, wave + 1));
  return p;
}

export function recordChapter(progress, chapter, difficulty, score, cleared = true) {
  const p = normalizeProgress(progress);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > CHAPTER_COUNT || !DIFFICULTY_ORDER.includes(difficulty)) return p;
  const old = p.chapters[chapter].difficulties[difficulty];
  p.chapters[chapter].difficulties[difficulty] = {
    best: Math.max(old.best, cleanScore(score)),
    clears: old.clears + (cleared ? 1 : 0),
  };
  if (cleared && chapter < CHAPTER_COUNT) p.unlocked = Math.max(p.unlocked, chapter * LEVELS_PER_CHAPTER + 1);
  return p;
}
