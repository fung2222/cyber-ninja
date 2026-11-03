// XENO NIGHTMARE 異域凶間 — every tuning constant lives here.
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

// Enemy archetypes. Speed is deliberately higher than the old build: the player
// should be moving before the first wave ends, not standing under a bullet hose.
export const ENEMIES = {
  drone:  { hp: 4,  speed: 5.6, score: 60,  radius: 0.75, color: 0xff2bd6, fire: 2.1 },
  weaver: { hp: 5,  speed: 4.4, score: 90,  radius: 0.8,  color: 0x00e5ff, fire: 2.3 },
  turret: { hp: 11, speed: 3.0, score: 180, radius: 1.0, color: 0xffc22b, fire: 1.5 },
  dasher: { hp: 4,  speed: 4.2, score: 140, radius: 0.75, color: 0xff3b5c, fire: 0 },
  boss:   { hp: 240, speed: 1.6, score: 3000, radius: 2.5, color: 0xa66bff, fire: 1 },
};
export const ENEMY_BULLET_SPEED = 9.0;
export const BOSS_EVERY = 5;
export const DROP_CHANCE = 0.11;      // power-up drop per kill (bosses always drop 3)

/**
 * Wave director: authored formations instead of random soup. Each event carries
 * a `pattern` that drives the enemy AI in main.js. Pure and unit-tested.
 */
export function waveSpec(n, rng = Math.random) {
  if (n % BOSS_EVERY === 0) return { boss: true, hp: bossHp(n), variant: bossVariant(n / BOSS_EVERY), events: [] };
  const events = [];
  const add = (type, x, t, pattern = 'dive', elite = false) => {
    x = Math.max(-FIELD.halfW + 0.8, Math.min(FIELD.halfW - 0.8, x));
    events.push({ t, type, x, phase: rng() * 6.28, pattern, elite });
  };
  const usable = n >= 4 ? ['line', 'pincer', 'wall', 'crossfire', 'rush', 'weave', 'elite'] : n >= 3 ? ['line', 'pincer', 'wall', 'weave'] : ['line', 'pincer'];
  const recipe = n <= 2 ? usable[n - 1] : usable[(n + Math.floor(rng() * usable.length)) % usable.length];
  if (recipe === 'line') {
    const count = 7 + Math.min(4, Math.floor(n / 3));
    for (let i = 0; i < count; i++) add('drone', (i - (count - 1) / 2) * 1.25, 0.6 + i * 0.16, 'dive');
  } else if (recipe === 'pincer') {
    for (let i = 0; i < 4; i++) { add('drone', -4.8 + i * 0.7, 0.5 + i * 0.25, 'dive'); add('drone', 4.8 - i * 0.7, 0.7 + i * 0.25, 'dive'); }
    for (let i = 0; i < 2; i++) add('weaver', -2.2 + i * 4.4, 1.4 + i * 0.5, 'strafe');
  } else if (recipe === 'wall') {
    const count = 8;
    for (let i = 0; i < count; i++) add('drone', (i - (count - 1) / 2) * 1.15, 0.6 + i * 0.1, i === 3 || i === 4 ? 'strafe' : 'dive');
    for (let i = 0; i < 2; i++) add('weaver', -3.5 + i * 7, 1.4 + i * 0.35, 'strafe');
  } else if (recipe === 'crossfire') {
    add('turret', -4.2, 0.7, 'hold', n >= 8); add('turret', 4.2, 0.9, 'hold', n >= 8);
    for (let i = 0; i < 5; i++) add('drone', (i - 2) * 1.4, 1.1 + i * 0.22, 'dive');
    for (let i = 0; i < 2; i++) add('weaver', -2.4 + i * 4.8, 1.8 + i * 0.3, 'strafe');
  } else if (recipe === 'rush') {
    for (let i = 0; i < 6; i++) add('dasher', (i % 2 ? 1 : -1) * (1.2 + (i % 3) * 1.2), 0.5 + i * 0.32, 'charge');
    for (let i = 0; i < 3; i++) add('drone', -2.5 + i * 2.5, 1.0 + i * 0.2, 'dive');
  } else if (recipe === 'weave') {
    for (let i = 0; i < 6; i++) add('weaver', (i - 2.5) * 1.5, 0.5 + i * 0.28, 'strafe');
    for (let i = 0; i < 3; i++) add('drone', -3.2 + i * 3.2, 1.3 + i * 0.25, 'dive');
  } else {
    add('turret', 0, 0.8, 'hold', true);
    for (let i = 0; i < 4; i++) add('drone', (i - 1.5) * 1.7, 1.0 + i * 0.25, 'dive');
    for (let i = 0; i < 3; i++) add('weaver', -3.0 + i * 3.0, 1.6 + i * 0.3, 'strafe');
  }
  events.sort((a, b) => a.t - b.t);
  return { boss: false, events, recipe };
}
export const speedScale = (n) => 1 + Math.min(0.85, (n - 1) * 0.05);
export const hpScale = (n) => 1 + Math.min(2.2, Math.floor((n - 1) / 5) * 0.4);   // capped at ×3.2 (endless stays playable)

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
