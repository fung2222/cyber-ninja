// XENO NIGHTMARE campaign: 10 chapters × 5 sorties = 50 authored map variations.
// Pure data/helpers: safe for Node tests and shared by the renderer and HUD.
export const CHAPTER_COUNT = 10;
export const LEVELS_PER_CHAPTER = 5;
export const CAMPAIGN_LEVELS = CHAPTER_COUNT * LEVELS_PER_CHAPTER;

const CHAPTERS = [
  { id: 'neon', zh: '霓虹淪陷', en: 'NEON FALL', place: ['霓虹九龍', 'NEON KOWLOON'], theme: 1, district: 'city', story: ['數碼病毒「噬界」撕開城市防火牆，街道同記憶逐一被改寫。蒼隼率先升空，奪回第一條訊號航道。', 'The digital virus Ouroboros breaches the city firewall, rewriting streets and memories. Falcon launches to reclaim the first signal lane.'] },
  { id: 'ghost', zh: '幽靈頻道', en: 'GHOST CHANNEL', place: ['零號訊道', 'CHANNEL ZERO'], theme: 2, district: 'city', story: ['被刪除嘅市民意識困喺雜訊入面。壁壘展開納米護盾，掩護救援訊號穿過封鎖。', 'Deleted citizens are trapped in the static. Bastion raises its nano-shield to escort their rescue signal through the blockade.'] },
  { id: 'forge', zh: '數據熔爐', en: 'DATA FURNACE', place: ['紅熱鑄域', 'EMBER FORGE'], theme: 3, district: 'city', story: ['病毒將武器工廠變成自我複製嘅兵巢。三位駕駛員必須喺熔爐過載前摧毀核心。', 'The virus turns the weapons works into a self-replicating nest. The three pilots must break its core before the furnace overloads.'] },
  { id: 'mirror', zh: '鏡像迷城', en: 'MIRROR MAZE', place: ['反射街區', 'REFLECTION WARD'], theme: 4, district: 'city', story: ['每条路都映出另一個被感染嘅未來。幽影利用共振訊號，喺假地圖中搵出唯一真實出口。', 'Every road reflects an infected future. Wraith follows the resonance signal to find the one real exit in a city of false maps.'] },
  { id: 'blackout', zh: '熄燈協議', en: 'BLACKOUT PROTOCOL', place: ['暗網深井', 'DARKNET WELL'], theme: 5, district: 'city', story: ['全城光源被病毒吞食，只剩敵機輪廓同武器火光。守住最後嘅備用電網。', 'The virus devours every light until only hostile outlines and weapon fire remain. Hold the final backup grid.'] },
  { id: 'ruins', zh: '遺跡回聲', en: 'ECHOES OF RUIN', place: ['深空廢墟', 'DEEP-SPACE RUINS'], theme: 6, district: 'ruins', story: ['戰線延伸到被刪除嘅舊世界。殘破星門仍然保存住病毒最初嘅入侵紀錄。', 'The front reaches the deleted old world. Broken star gates still hold the record of the virus’s first incursion.'] },
  { id: 'garden', zh: '腐化花園', en: 'CORRUPTED GARDEN', place: ['晶棘温室', 'CRYSTAL CONSERVATORY'], theme: 7, district: 'ruins', story: ['曾經孕育人造生命嘅花園，如今長出惡意晶棘。清除孢子，救出未被感染嘅新生意識。', 'A garden that grew synthetic life now sprouts malicious crystal. Burn out the spores and rescue the newborn minds.'] },
  { id: 'storm', zh: '記憶風暴', en: 'MEMORY STORM', place: ['迴響荒原', 'ECHO WASTES'], theme: 8, district: 'ruins', story: ['三人嘅戰鬥記憶被捲入風暴，化成敵方幻影。只有互相信任先可以穿過呢片迴響。', 'The pilots’ combat memories become hostile phantoms in the storm. Only mutual trust will carry them through the echoes.'] },
  { id: 'crown', zh: '病毒王座', en: 'VIRAL THRONE', place: ['權限聖殿', 'ROOT CATHEDRAL'], theme: 9, district: 'ruins', story: ['噬界以最高權限重塑現實，將守衛化作巨獸。突破王座外環，切斷感染源頭。', 'Ouroboros rewrites reality with root access and turns its guards into monsters. Breach the throne and sever the source.'] },
  { id: 'dawn', zh: '黎明重啟', en: 'REBOOT AT DAWN', place: ['創世中樞', 'GENESIS NEXUS'], theme: 10, district: 'ruins', story: ['最後五關直通世界中樞。三位駕駛員並肩發動總攻，為 cyber world 重啟黎明。', 'The final five sorties lead to the world kernel. The three pilots strike together to reboot dawn for the cyber world.'] },
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

// Defensive local progression. Records are per sortie; a clear unlocks only the
// next sortie, so chapter buttons can never bypass the campaign sequence.
export function normalizeProgress(raw) {
  const records = {};
  const source = raw && typeof raw === 'object' && raw.records && typeof raw.records === 'object' ? raw.records : {};
  for (let wave = 1; wave <= CAMPAIGN_LEVELS; wave++) {
    const key = campaignForWave(wave).key;
    const r = source[key];
    if (!r || typeof r !== 'object') continue;
    const best = Math.max(0, Math.floor(Number(r.best) || 0));
    const clears = Math.max(0, Math.floor(Number(r.clears) || 0));
    if (best || clears) records[key] = { best, clears };
  }
  return { unlocked: Math.max(1, Math.min(CAMPAIGN_LEVELS, Math.floor(Number(raw?.unlocked) || 1))), records };
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
  p.records[key] = { best: Math.max(old.best, Math.max(0, Math.floor(Number(score) || 0))), clears: old.clears + (cleared ? 1 : 0) };
  if (cleared) p.unlocked = Math.max(p.unlocked, Math.min(CAMPAIGN_LEVELS, wave + 1));
  return p;
}
