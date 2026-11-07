// Bullet-shape helpers. Pure functions so the geometry can be unit-tested without WebGL.
//
// Angle convention matches the game: 0 = straight down the field (towards the player),
// positive = to the right of that axis, negative = to the left. Every helper that takes a
// `gap` leaves that slice EMPTY — fixed patterns are only fair if they carry a safe lane.

/** `count` evenly spaced angles centred on `center`, spanning `spread` radians. */
export function fan(center, spread, count) {
  if (count <= 0) return [];
  if (count === 1) return [center];
  const step = spread / (count - 1);
  return Array.from({ length: count }, (_, i) => center - spread / 2 + i * step);
}

/** Drop the angles inside ±half of `gap` so one slice of the fan stays open. */
export function withGap(angles, gap, half) {
  return angles.filter((a) => Math.abs(a - gap) > half);
}

/**
 * Horizontal volley across the field: x positions from -halfW to +halfW every `step`,
 * skipping anything within `gapHalf` of `gapX`. Returns x positions, all fired straight down.
 */
export function lanes(halfW, step, gapX = 0, gapHalf = 1.2) {
  const out = [];
  for (let x = -halfW + step * 0.5; x < halfW; x += step) {
    if (Math.abs(x - gapX) <= gapHalf) continue;
    out.push(x);
  }
  return out;
}

/**
 * Two mirrored fans aimed inward from the flanks, with the centre of the field left open.
 * `side` is -1 (left) or +1 (right); angles point towards the middle / downward.
 */
export function flankFan(side, spread, count, tilt = 0.35) {
  return fan(side * tilt, spread, count);
}

/** Ring of `n` angles, one wedge removed (the safe wedge) centred on `gap`. */
export function ringWithGap(n, gap, half, offset = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = offset + (i * Math.PI * 2) / n;
    const d = Math.atan2(Math.sin(a - gap), Math.cos(a - gap));
    if (Math.abs(d) > half) out.push(a);
  }
  return out;
}

/**
 * Lane shooters take turns instead of firing together: returns true on the frame where
 * this index should fire. `every` = seconds between shots per lane, `offset` staggers them.
 */
export function laneTurn(t, index, every = 0.55, offset = 0) {
  const slot = Math.floor((t - offset) / every);
  return slot >= 0 && slot % 1 === 0 && Math.abs((t - offset) % every) < 0.02 && slot % 3 === index % 3;
}
