// XENO NIGHTMARE — weapon table. Pure data + helpers; no DOM or THREE.
// Three weapons, six levels each. A pickup replaces the current weapon but keeps
// that weapon's own level, so experimenting never throws away progression.

export const WEAPON_KEYS = ['pulse', 'lance', 'nova'];

export const WEAPONS = {
  pulse: {
    key: 'pulse',
    color: 0x00e5ff,
    name: { zh: '脈衝連發', en: 'PULSE REPEATER' },
    short: { zh: '脈衝', en: 'PULSE' },
    ult: { zh: '彈幕洪流', en: 'BULLET STORM' },
    ultShort: { zh: '彈幕', en: 'STORM' },
    levels: [
      { rate: 0.130, dmg: 1.15, speed: 34, pierce: 0, shots: [[0, 0]] },
      { rate: 0.130, dmg: 1.25, speed: 34, pierce: 0, shots: [[-0.20, 0], [0.20, 0]] },
      { rate: 0.125, dmg: 1.35, speed: 34, pierce: 0, shots: [[-0.30, 0], [0, 0], [0.30, 0]], homing: 2 },
      { rate: 0.120, dmg: 1.45, speed: 35, pierce: 0, shots: [[-0.36, 0], [-0.12, 0], [0.12, 0], [0.36, 0]], homing: 2 },
      { rate: 0.115, dmg: 1.60, speed: 35, pierce: 0, shots: [[-0.44, 0], [-0.22, 0], [0, 0], [0.22, 0], [0.44, 0]], homing: 2 },
      { rate: 0.105, dmg: 1.80, speed: 36, pierce: 0, shots: [[-0.50, 0], [-0.25, 0], [0, 0], [0.25, 0], [0.50, 0]], homing: 2 },
    ],
  },
  lance: {
    key: 'lance',
    color: 0xa78bff,
    name: { zh: '相位長槍', en: 'PHASE LANCE' },
    short: { zh: '相位', en: 'LANCE' },
    ult: { zh: '稜鏡貫穿', en: 'PRISM PIERCE' },
    ultShort: { zh: '稜鏡', en: 'PRISM' },
    levels: [
      { rate: 0.260, dmg: 2.00, speed: 56, pierce: 2, shots: [[0, 0]] },
      { rate: 0.250, dmg: 2.20, speed: 57, pierce: 3, shots: [[0, 0]] },
      { rate: 0.240, dmg: 2.40, speed: 58, pierce: 4, shots: [[0, 0]], drones: 2 },
      { rate: 0.230, dmg: 2.60, speed: 59, pierce: 5, shots: [[0, 0]], drones: 2 },
      { rate: 0.220, dmg: 2.80, speed: 60, pierce: 6, shots: [[0, 0]], drones: 2 },
      { rate: 0.205, dmg: 2.90, speed: 62, pierce: 7, shots: [[0, 0]], drones: 2 },
    ],
  },
  nova: {
    key: 'nova',
    color: 0xff7a3b,
    name: { zh: '星爆震波', en: 'NOVA SURGE' },
    short: { zh: '震波', en: 'NOVA' },
    ult: { zh: '奇點爆發', en: 'SINGULARITY' },
    ultShort: { zh: '奇點', en: 'NOVA' },
    levels: [
      { rate: 0.600, dmg: 4.2, speed: 16, pierce: 0, aoe: 1.70, shots: [[0, 0]], scale: 1.00 },
      { rate: 0.580, dmg: 4.8, speed: 16, pierce: 0, aoe: 1.85, shots: [[0, 0]], scale: 1.05 },
      { rate: 0.560, dmg: 5.4, speed: 17, pierce: 0, aoe: 2.00, shots: [[0, 0]], scale: 1.10, bigEvery: 10 },
      { rate: 0.540, dmg: 6.0, speed: 17, pierce: 0, aoe: 2.15, shots: [[0, 0]], scale: 1.16, bigEvery: 10 },
      { rate: 0.520, dmg: 6.6, speed: 18, pierce: 0, aoe: 2.30, shots: [[0, 0]], scale: 1.22, bigEvery: 10 },
      { rate: 0.500, dmg: 7.2, speed: 18, pierce: 0, aoe: 2.40, shots: [[0, 0]], scale: 1.30, bigEvery: 10 },
    ],
  },
};

export const OD = {
  duration: 4.0,        // seconds of ascended fire
  noFire: 3.0,          // forced cease-fire afterwards
  cooldown: 8.0,        // fixed cooldown from activation (Roy 2026-11-05: no charge meter)
};

export const WEAPON_ULT = {
  pulse: { duration: 2.2, name: 'BULLET STORM' },
  lance: { duration: 1.3, name: 'PRISM PIERCE' },
  nova: { duration: 2.0, name: 'SINGULARITY' },
};

export function weaponOf(key) { return WEAPONS[key] || WEAPONS.pulse; }
export function levelOf(key, level) {
  const w = weaponOf(key);
  return w.levels[Math.max(0, Math.min(w.levels.length - 1, (level || 1) - 1))];
}
export function weaponName(key, lang = 'zh') { return weaponOf(key).name[lang] || weaponOf(key).name.zh; }
export function weaponShort(key, lang = 'zh') { return weaponOf(key).short[lang] || weaponOf(key).short.zh; }
export function ultName(key, lang = 'zh') { return weaponOf(key).ult[lang] || weaponOf(key).ult.zh; }
export function ultShort(key, lang = 'zh') { const u = weaponOf(key).ultShort; return (u && u[lang]) || weaponOf(key).ult[lang] || weaponOf(key).ult.zh; }

/** Fire solution after overdrive. Overdrive raises effective level by 2 (max 6),
 *  then adds a small damage bonus if the weapon was already at level 6. */
export function fireSolution(key, level, overdrive = false) {
  const base = levelOf(key, level);
  if (!overdrive) return { ...base, od: false };
  const boosted = levelOf(key, Math.min(6, level + 2));
  const alreadyMax = level >= 6;
  return {
    ...boosted,
    dmg: boosted.dmg * (alreadyMax ? 1.35 : 1.15),
    rate: boosted.rate * (alreadyMax ? 0.72 : 0.82),
    od: true,
  };
}

export function randomOtherWeapon(current, rng = Math.random) {
  const pool = WEAPON_KEYS.filter(k => k !== current);
  return pool[Math.floor(rng() * pool.length)] || 'pulse';
}
