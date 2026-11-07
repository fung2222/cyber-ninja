// XENO NIGHTMARE 異域凶間 — every tuning constant lives here.
export const GAME_ID = 'cyber-ninja';

// Selectable run rules. Weapon damage/OD values remain in weapons.js; these
// multipliers only change enemy pressure, survivability and score risk/reward.
export const DIFFICULTIES = {
  story:     { key: 'story', enemyHp: 0.78, bossHp: 0.78, bulletSpeed: 0.72, fireRate: 0.62, bonusHp: 2, invuln: 2.2, drops: 1.5, score: 0.8 },
  normal:    { key: 'normal', enemyHp: 0.9, bossHp: 0.9, bulletSpeed: 0.86, fireRate: 0.82, bonusHp: 0, invuln: 1.85, drops: 1.2, score: 1 },
  nightmare: { key: 'nightmare', enemyHp: 1.12, bossHp: 1.1, bulletSpeed: 1.02, fireRate: 1.08, bonusHp: 0, invuln: 1.45, drops: 0.9, score: 1.5 },
};
export const difficultyOf = (key) => DIFFICULTIES[key] || DIFFICULTIES.normal;

// Play field (world units, xz plane). Far = -z = top of screen.
export const FIELD = { halfW: 6, top: -24, bottom: 3.2, playerMinZ: -21, playerMaxZ: 2.4 };

export const PLAYER = {
  radius: 0.42,            // hit radius (small, generous)
  hp: 3, maxHp: 3,
  invuln: 1.6,             // seconds after a hit
  dragGain: 1.35,          // finger travel -> ninja travel (relative drag)
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
  drone:    { hp: 4,  speed: 5.6, score: 60,  radius: 0.75, color: 0xff2bd6, fire: 2.4 },
  weaver:   { hp: 5,  speed: 4.4, score: 90,  radius: 0.8,  color: 0x00e5ff, fire: 2.6 },
  turret:   { hp: 11, speed: 3.0, score: 180, radius: 1.0, color: 0xffc22b, fire: 1.5 },
  dasher:   { hp: 4,  speed: 4.2, score: 140, radius: 0.75, color: 0xff3b5c, fire: 0 },
  splitter: { hp: 9,  speed: 3.2, score: 220, radius: 0.95, color: 0x7dff5e, fire: 2.8 },
  mite:     { hp: 1,  speed: 6.4, score: 25,  radius: 0.5,  color: 0xb8ff70, fire: 0 },
  boss:     { hp: 310, speed: 1.6, score: 3000, radius: 2.5, color: 0xa66bff, fire: 1 },
};
export const ENEMY_BULLET_SPEED = 6.5;   // aimed fire is slow enough to dodge without leaving your firing line
export const BOSS_EVERY = 5;
export const DROP_CHANCE = 0.11;      // power-up drop per kill (bosses always drop 3)

/**
 * Wave director: authored formations instead of random soup. Each event carries
 * a `pattern` that drives the enemy AI in main.js. Pure and unit-tested.
 */
export function waveSpec(n, rng = Math.random) {
  if (n % BOSS_EVERY === 0) return { boss: true, hp: bossHp(n), variant: bossVariant(n / BOSS_EVERY), events: [] };
  const events = [];
  const add = (type, x, t, pattern = 'dive', elite = false, role = null, lane = null, dir = 1) => {
    x = Math.max(-FIELD.halfW + 0.8, Math.min(FIELD.halfW - 0.8, x));
    const r = role || ((type === 'dasher' || type === 'mite') ? 'rusher' : 'shooter');
    events.push({ t, type, x, phase: rng() * 6.28, pattern, elite, role: r, lane, dir });
  };
  // Rushers dive straight through and never fire: they are the movement pressure.
  // Shooters hold behind them and fire telegraphed aimed bursts: they are the damage window.
  const rushers = (count, t0 = 0.7) => {
    for (let i = 0; i < count; i++) add('dasher', (i % 2 ? 1 : -1) * (1.2 + (i % 3) * 1.4), t0 + i * 0.26, 'charge', false, 'rusher');
  };
  const usable = n >= 6 ? ['line', 'pincer', 'wall', 'crossfire', 'rush', 'weave', 'elite', 'swarm'] : n >= 4 ? ['line', 'pincer', 'wall', 'crossfire', 'rush', 'weave', 'elite'] : n >= 3 ? ['line', 'pincer', 'wall', 'weave'] : ['line', 'pincer'];
  const recipe = n <= 2 ? usable[n - 1] : usable[(n + Math.floor(rng() * usable.length)) % usable.length];
  if (recipe === 'line') {
    // Phase 2 (1945 grammar): two diagonal streams cross the field and leave again. Nothing
    // parks above the player, so the firing line stays usable while they dodge.
    const per = n <= 2 ? 2 : 4 + Math.min(3, Math.floor(n / 5));
    for (let i = 0; i < per; i++) add('drone', -FIELD.halfW + 0.9, 0.6 + i * 0.55, 'pass', false, 'shooter', 0, 1);
    for (let i = 0; i < per; i++) add('drone', FIELD.halfW - 0.9, 1.0 + i * 0.55, 'pass', false, 'shooter', 0, -1);
    // keep the role split: roughly 1.7 rushers per pass-by shooter
    rushers(Math.max(6, Math.round(per * 2 * 1.7)), 1.2);
  } else if (recipe === 'pincer') {
    for (let i = 0; i < 2; i++) { add('drone', -4.8 + i * 0.9, 0.5 + i * 0.3, 'dive', false, 'shooter', -0.26); add('drone', 4.8 - i * 0.9, 0.75 + i * 0.3, 'dive', false, 'shooter', 0.26); }
    add('weaver', -2.2, 1.4, 'strafe'); add('weaver', 2.2, 1.7, 'strafe');
    rushers(8, 0.8);
  } else if (recipe === 'wall') {
    for (let i = 0; i < 4; i++) add('drone', (i - 1.5) * 1.9, 0.6 + i * 0.16, 'dive', false, 'shooter', 0);
    for (let i = 0; i < 2; i++) add('weaver', -3.5 + i * 7, 1.4 + i * 0.35, 'strafe');
    rushers(10, 0.7);
  } else if (recipe === 'crossfire') {
    // Side entries that fly across and fire ONE fixed volley near the middle — a moving
    // hazard you can read and step out of, never a chase.
    for (let i = 0; i < 4 + (n >= 10 ? 2 : 0); i++) add('drone', i % 2 ? FIELD.halfW - 0.9 : -FIELD.halfW + 0.9, 0.9 + i * 0.7, 'cross', false, 'shooter', 0, i % 2 ? -1 : 1);
    rushers(6, 1.0);
  } else if (recipe === 'rush') {
    rushers(10 + Math.min(6, Math.floor(n / 3)), 0.5);
    const flock = 4 + Math.min(2, Math.floor(n / 8));
    for (let i = 0; i < flock; i++) add('drone', (i - (flock - 1) / 2) * 2.6, 1.4 + i * 0.3, 'dive');
  } else if (recipe === 'weave') {
    for (let i = 0; i < 3 + (n >= 12 ? 1 : 0); i++) add('weaver', (i - 1) * 2.6, 0.5 + i * 0.4, 'edge');
    for (let i = 0; i < 3; i++) add('drone', (i - 1) * 3.0, 1.3 + i * 0.25, 'dive');
    rushers(8, 0.9);
  } else if (recipe === 'swarm') {
    const splitters = 2 + Math.min(2, Math.floor(n / 8));
    for (let i = 0; i < splitters; i++) add('splitter', (i - (splitters - 1) / 2) * 3.4, 0.6 + i * 0.5, 'dive', n >= 14 && i === 0);
    // A curtain of cheap mites falling in lanes: volume pressure with no aiming at all.
    const drops = 6 + Math.min(6, Math.floor(n / 3));
    for (let i = 0; i < drops; i++) add('mite', ((i % 5) - 2) * 2.1, 0.9 + i * 0.28, 'drop', false, 'rusher');
    for (let i = 0; i < 3; i++) add('drone', (i - 1) * 3.2, 1.2 + i * 0.3, 'dive');
    rushers(6, 1.0);
  } else {
    add('turret', 0, 0.8, 'hold', true);
    for (let i = 0; i < 2; i++) add('drone', (i - 0.5) * 3.0, 1.0 + i * 0.25, 'dive');
    rushers(6, 1.1);
  }
  // A wave is three assaults, not one: the opening formation, then two reinforcement
  // batches ~16 s apart. This is what gives a 關 its 45–60 s length (Roy: chapters should
  // last 3–5 minutes, "太快就無野食").
  const batch = (t, count, withTurret) => {
    rushers(count, t);
    add('drone', -2.4, t + 0.5, 'dive');
    add('drone', 2.4, t + 0.8, 'dive');
    if (withTurret) add('turret', (rng() > 0.5 ? 1 : -1) * 2.8, t + 1.2, 'hold', n >= 12);
  };
  if (n <= 2) {
    // Chapter 1 must stay readable: same light formation, but its entries are stretched
    // across ~27 s so the 關 still runs ~30 s instead of ending in one burst.
    const maxT = Math.max(...events.map((e) => e.t)) || 1;
    for (const e of events) e.t = 2.5 + (e.t / maxT) * 24;
  } else {
    batch(15 + rng() * 2, 5 + (n >= 6 ? 1 : 0), n >= 8);
    batch(30 + rng() * 3, 6 + (n >= 8 ? 1 : 0), n >= 10);
  }
  events.sort((a, b) => a.t - b.t);
  return { boss: false, events, recipe };
}
export const speedScale = (n) => 1 + Math.min(0.85, (n - 1) * 0.05);
// Smooth per-wave curve (no +40% cliff at every chapter start). Chapter 10 still lands at ×3.2.
export const hpScale = (n) => 1 + Math.min(2.2, Math.max(0, n - 1) * 0.045);   // capped at ×3.2 (endless stays playable)

export const ADS = { interstitialCooldownSec: 200, breaksBetweenInterstitials: 3, graceSec: 150, units: { android: {} } };

// ---------------------------------------------------------------- endless
/** boss HP for wave n: +90 per cycle, capped at 1100 so late bosses stay killable */
export const bossHp = (n) => Math.min(1100, ENEMIES.boss.hp + (n / BOSS_EVERY - 1) * 110);
const SPECIES = [['星海魔獸', 'COSMIC MONSTER'], ['深淵魔眼', 'ABYSS EYE'], ['等離子海妖', 'PLASMA KRAKEN'], ['虛空水母', 'VOID JELLY'], ['晶棘巨獸', 'CRYSTAL BEHEMOTH'], ['極光龍', 'AURORA WYRM']];
/** boss species for cycle c (1-based): authored names, then numbered Mk variants forever; fire-rate multiplier capped at 1.6 */
export function bossVariant(c) {
  const sp = SPECIES[(c - 1) % SPECIES.length], mk = Math.floor((c - 1) / SPECIES.length);
  return { zh: mk ? `${sp[0]} Mk.${mk + 1}` : sp[0], en: mk ? `${sp[1]} MK.${mk + 1}` : sp[1], hue: ((c - 1) * 0.13) % 1, rate: Math.min(1.6, 1 + (c - 1) * 0.06) };
}
/** every 10 waves = milestone: bonus score, full shields, district theme shift */
export const MILESTONE_EVERY = 10;
export const milestoneBonus = (n) => 5000 * (n / MILESTONE_EVERY);
