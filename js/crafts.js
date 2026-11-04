// XENO NIGHTMARE — player craft roster. Three airframes with distinct stats and a
// passive that changes how you play. Pure data + helpers; no DOM or THREE.

export const CRAFT_KEYS = ['falcon', 'bastion', 'wraith'];

export const CRAFTS = {
  falcon: {
    key: 'falcon',
    name: { zh: '蒼隼', en: 'FALCON' },
    code: { zh: 'VX-01', en: 'VX-01' },
    role: { zh: '突擊型', en: 'ASSAULT' },
    color: 0x00e5ff,          // primary neon
    accent: 0xff2bd6,         // secondary neon
    trail: 0x66f0ff,
    hp: 3,
    speed: 1.14,              // move-speed multiplier
    dmg: 1.0,                 // damage multiplier
    charge: 1.0,              // ult / overdrive charge-rate multiplier
    odBonus: 0,               // extra OVERDRIVE seconds
    passive: { zh: '疾風引擎：移動 +14%，速度就係生存', en: 'GALE ENGINE: +14% speed — speed is life' },
    blurb: { zh: '制式突擊機體。最快最靈活，火同防禦均衡，適合任何玩家。', en: 'The standard assault frame. Fastest and most agile with even firepower and defence. Great for everyone.' },
  },
  bastion: {
    key: 'bastion',
    name: { zh: '壁壘', en: 'BASTION' },
    code: { zh: 'VX-02', en: 'VX-02' },
    role: { zh: '重裝型', en: 'DEFENDER' },
    color: 0x3bff8a,
    accent: 0xffc22b,
    trail: 0x8affc0,
    hp: 4,
    speed: 0.9,
    dmg: 0.88,
    charge: 1.0,
    odBonus: 0,
    regen: 8,                 // seconds without a hit to regenerate 1 shield
    passive: { zh: '納米裝甲：4 格護盾；8 秒無傷自動回復 1 格', en: 'NANO PLATING: 4 shields; regenerate 1 after 8s unhit' },
    blurb: { zh: '重型防禦機體。多 1 格護盾兼會自動修復，火力同速度稍弱。企得穩先贏得到。', en: 'Heavy defender. An extra shield that repairs itself, at the cost of some firepower and speed. Outlast everything.' },
  },
  wraith: {
    key: 'wraith',
    name: { zh: '幽影', en: 'WRAITH' },
    code: { zh: 'VX-03', en: 'VX-03' },
    role: { zh: '匿蹤型', en: 'INFILTRATOR' },
    color: 0xa78bff,
    accent: 0x00e5ff,
    trail: 0xcbb8ff,
    hp: 2,
    speed: 1.02,
    dmg: 1.28,
    charge: 1.4,              // powers charge much faster
    odBonus: 1.0,             // OVERDRIVE lasts 1s longer
    passive: { zh: '能量共振：傷害 +28%、充能 +40%、超載 +1 秒；但只有 2 格護盾', en: 'RESONANCE: +28% dmg, +40% charge, +1s OVERDRIVE — but only 2 shields' },
    blurb: { zh: '玻璃大砲。所有能量系統超頻，護盾薄弱——靠走位同大招活命。', en: 'A glass cannon. Every energy system overclocked with paper-thin shields — live on positioning and ultimates.' },
  },
};

export const COMBO = {
  window: 2.2,          // seconds between kills to keep the chain
  perTier: 3,           // kills per multiplier step
  maxMult: 8,
};
export const comboMult = (chain) => Math.min(COMBO.maxMult, 1 + Math.floor(chain / COMBO.perTier));

export function craftOf(key) { return CRAFTS[key] || CRAFTS.falcon; }
export function craftName(key, lang = 'zh') { const c = craftOf(key); return c.name[lang] || c.name.zh; }
