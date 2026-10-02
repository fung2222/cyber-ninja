// CYBER NINJA 賽博忍者：星海魔獸 — every tuning constant lives here.
export const GAME_ID = 'cyber-ninja';

// Play field (world units, xz plane). Far = -z = top of screen.
export const FIELD = { halfW: 6, top: -24, bottom: 3.2, playerMinZ: -8, playerMaxZ: 2.4 };

export const PLAYER = {
  radius: 0.42,            // hit radius (small, generous)
  hp: 3, maxHp: 5,
  invuln: 1.6,             // seconds after a hit
  dragGain: 1.15,          // finger travel -> ninja travel (relative drag)
  keySpeed: 11,            // units / s with keyboard
  fireRate: 0.12,          // seconds between volleys
  boltSpeed: 30, boltDamage: 1,
  maxPower: 5,
};
// volley patterns per power level: list of [x offset, angle (rad)]
export const VOLLEYS = [
  null,
  [[0, 0]],
  [[-0.22, 0], [0.22, 0]],
  [[-0.3, -0.06], [0, 0], [0.3, 0.06]],
  [[-0.36, -0.1], [-0.12, 0], [0.12, 0], [0.36, 0.1]],
  [[-0.44, -0.16], [-0.22, -0.05], [0, 0], [0.22, 0.05], [0.44, 0.16]],
];

export const ULT = { perKill: 5, perBossHit: 0.15, bossDamage: 28, duration: 0.6 };

// Enemy archetypes
export const ENEMIES = {
  drone:  { hp: 2,  speed: 4.2, score: 50,  radius: 0.75, color: 0xff2bd6, fire: 0 },
  weaver: { hp: 3,  speed: 3.4, score: 80,  radius: 0.8,  color: 0x00e5ff, fire: 0 },
  turret: { hp: 7,  speed: 2.4, score: 150, radius: 1.0, color: 0xffc22b, fire: 1.6 },
  dasher: { hp: 2,  speed: 3.0, score: 120, radius: 0.75, color: 0xff3b5c, fire: 0 },
  boss:   { hp: 160, speed: 1.6, score: 3000, radius: 2.5, color: 0xa66bff, fire: 1 },
};
export const ENEMY_BULLET_SPEED = 7.5;
export const BOSS_EVERY = 5;
export const DROP_CHANCE = 0.09;      // power-up drop per kill (bosses always drop 3)

/**
 * Wave schedule (pure; unit-tested). Returns [{t, type, x, pattern}] spawn events for wave n (1-based)
 * or {boss:true} for boss waves.
 */
export function waveSpec(n, rng = Math.random) {
  if (n % BOSS_EVERY === 0) return { boss: true, hp: bossHp(n), variant: bossVariant(n / BOSS_EVERY), events: [] };
  const types = ['drone'];
  if (n >= 2) types.push('weaver');
  if (n >= 3) types.push('turret');
  if (n >= 4) types.push('dasher');
  const groups = Math.min(4 + Math.floor(n * 0.8), 12);
  const events = []; let t = 0.8;
  for (let g = 0; g < groups; g++) {
    const type = types[Math.floor(rng() * types.length)];
    const count = type === 'turret' ? 1 + (n > 6 ? 1 : 0) : type === 'dasher' ? 2 : 3 + Math.min(3, Math.floor(n / 3));
    const formation = ['line', 'v', 'column', 'scatter'][Math.floor(rng() * 4)];
    const cx = (rng() * 2 - 1) * (FIELD.halfW - 2);
    for (let i = 0; i < count; i++) {
      let x = cx, dt = 0;
      if (formation === 'line') x = (i - (count - 1) / 2) * 1.6;
      else if (formation === 'v') { x = cx + (i - (count - 1) / 2) * 1.2; dt = Math.abs(i - (count - 1) / 2) * 0.25; }
      else if (formation === 'column') dt = i * 0.45;
      else { x = (rng() * 2 - 1) * (FIELD.halfW - 1); dt = rng() * 1.2; }
      x = Math.max(-FIELD.halfW + 0.8, Math.min(FIELD.halfW - 0.8, x));
      events.push({ t: t + dt, type, x, phase: rng() * 6.28 });
    }
    t += Math.max(1.1, 2.6 - n * 0.08);
  }
  events.sort((a, b) => a.t - b.t);
  return { boss: false, events };
}
export const speedScale = (n) => 1 + Math.min(0.6, (n - 1) * 0.04);
export const hpScale = (n) => 1 + Math.min(2.5, Math.floor((n - 1) / 5) * 0.5);   // capped at ×3.5 (endless stays playable)

export const ADS = { interstitialCooldownSec: 200, breaksBetweenInterstitials: 3, graceSec: 150, units: { android: {} } };

// ---------------------------------------------------------------- endless
/** boss HP for wave n: +90 per cycle, capped at 1100 so late bosses stay killable */
export const bossHp = (n) => Math.min(1100, ENEMIES.boss.hp + (n / BOSS_EVERY - 1) * 90);
const SPECIES = [['星海魔獸', 'COSMIC MONSTER'], ['深淵魔眼', 'ABYSS EYE'], ['等離子海妖', 'PLASMA KRAKEN'], ['虛空水母', 'VOID JELLY'], ['晶棘巨獸', 'CRYSTAL BEHEMOTH'], ['極光龍', 'AURORA WYRM']];
/** boss species for cycle c (1-based): authored names, then numbered Mk variants forever; fire-rate multiplier capped at 1.6 */
export function bossVariant(c) {
  const sp = SPECIES[(c - 1) % SPECIES.length], mk = Math.floor((c - 1) / SPECIES.length);
  return { zh: mk ? `${sp[0]} Mk.${mk + 1}` : sp[0], en: mk ? `${sp[1]} MK.${mk + 1}` : sp[1], hue: ((c - 1) * 0.13) % 1, rate: Math.min(1.6, 1 + (c - 1) * 0.06) };
}
/** every 10 waves = milestone: bonus score, full shields, district theme shift */
export const MILESTONE_EVERY = 10;
export const milestoneBonus = (n) => 5000 * (n / MILESTONE_EVERY);
