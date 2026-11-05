// Models + pools: the craft, enemy archetypes, the cosmic monster boss, bolts, enemy bullets, power-ups.
import * as THREE from 'three';
import { U } from 'cyber-kit/core/theme.js';
import { ENEMIES } from './config.js';
import { WEAPONS } from './weapons.js';

const neonEdges = (geo, color, mult = 2.2, thresh = 20) => new THREE.LineSegments(new THREE.EdgesGeometry(geo, thresh), new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult) }));
// silhouette outline for dark-bodied craft: a brighter, whitened second edge pass —
// lines only, no glow disc, so the near-black hulls read against the dark ruins
const whiteOutline = (geo, color, mult = 4.2) => {
  const group = new THREE.Group();
  const c = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.52).multiplyScalar(mult);
  // Three line-only passes create a bloom-readable silhouette without filling or
  // highlighting the near-black hull. WebGL ignores lineWidth, so use scale layers.
  for (const scale of [1.035, 1.075, 1.12]) {
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: c.clone(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.scale.setScalar(scale); line.renderOrder = 2; group.add(line);
  }
  return group;
};
const darkMetal = (tint = 0x120a24) => new THREE.MeshStandardMaterial({ color: tint, metalness: 0.75, roughness: 0.32, emissive: 0x000000 });

// Player airframes live in a dedicated procedural modeling module.
export { makeNinja, updateNinja, disposeNinja } from './aircraft.js?v=1.4';

// ------------------------------------------------------------------ enemies
const GEO = {
  drone: new THREE.OctahedronGeometry(0.5, 0),
  droneRing: new THREE.TorusGeometry(0.62, 0.04, 6, 24),
  weaver: new THREE.TorusKnotGeometry(0.34, 0.1, 48, 6, 2, 3),
  turret: new THREE.CylinderGeometry(0.55, 0.7, 0.5, 8),
  barrel: new THREE.BoxGeometry(0.16, 0.16, 0.7),
  dasher: new THREE.ConeGeometry(0.42, 1.2, 4),
  splitter: new THREE.IcosahedronGeometry(0.62, 0),
  mite: new THREE.TetrahedronGeometry(0.34, 0),
};
export function makeEnemy(type) {
  const def = ENEMIES[type]; const g = new THREE.Group(); const mat = darkMetal(); mat.emissive = new THREE.Color(0);
  let core;
  if (type === 'drone') { core = new THREE.Mesh(GEO.drone, mat); g.add(core, neonEdges(GEO.drone, def.color), whiteOutline(GEO.drone, def.color)); const ring = new THREE.Mesh(GEO.droneRing, new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(2) })); ring.rotation.x = Math.PI / 2; g.add(ring); g.userData.spin = ring; }
  else if (type === 'weaver') { core = new THREE.Mesh(GEO.weaver, new THREE.MeshStandardMaterial({ color: 0x06202a, emissive: new THREE.Color(def.color).multiplyScalar(1.0), metalness: 0.6, roughness: 0.3 })); g.add(core); g.userData.spin = core; }
  else if (type === 'turret') { core = new THREE.Mesh(GEO.turret, mat); g.add(core, neonEdges(GEO.turret, def.color), whiteOutline(GEO.turret, def.color)); const b = new THREE.Mesh(GEO.barrel, new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(2) })); b.position.set(0, 0, 0.45); const head = new THREE.Group(); head.add(b); g.add(head); g.userData.head = head; }
  else if (type === 'dasher') { core = new THREE.Mesh(GEO.dasher, mat); core.rotation.x = Math.PI / 2; g.add(core); const e = neonEdges(GEO.dasher, def.color); e.rotation.x = Math.PI / 2; g.add(e); const o = whiteOutline(GEO.dasher, def.color); o.rotation.x = Math.PI / 2; g.add(o); }
  else if (type === 'splitter') {
    // brood carrier: pulsing egg-core in a neon cage with three orbit pods
    core = new THREE.Mesh(GEO.splitter, new THREE.MeshStandardMaterial({ color: 0x0a1f08, emissive: new THREE.Color(def.color).multiplyScalar(0.5), metalness: 0.5, roughness: 0.35 }));
    g.add(core, neonEdges(GEO.splitter, def.color));
    const pods = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const pod = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(2.2) }));
      const a = i / 3 * Math.PI * 2; pod.position.set(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85); pods.add(pod);
    }
    g.add(pods); g.userData.spin = pods;
  }
  else if (type === 'mite') {
    // kamikaze swarmer: bright tumbling shard
    core = new THREE.Mesh(GEO.mite, new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(2.4) }));
    g.add(core, neonEdges(GEO.mite, def.color, 1.6));
    g.userData.spin = core;
  }
  g.userData.core = core; g.userData.mat = core.material;
  return g;
}

// the cosmic monster: pulsing eye-orb with orbiting crystal spikes and waving tentacles (original design)
export function makeBoss() {
  const g = new THREE.Group();
  const eyeU = { uTime: U.uTime, uC1: U.uC1, uC2: U.uC2, uLook: { value: new THREE.Vector2() }, uHurt: { value: 0 }, uRage: { value: 0 } };
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1.7, 40, 28), new THREE.ShaderMaterial({
    uniforms: eyeU,
    vertexShader: /* glsl */`varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`uniform float uTime, uHurt, uRage; uniform vec3 uC1, uC2; uniform vec2 uLook; varying vec3 vN; varying vec3 vP;
      void main(){ vec3 n = normalize(vP); float fres = pow(1.0 - abs(vN.z), 2.0);
        vec3 col = vec3(0.05, 0.0, 0.08) + uC2 * fres * 0.8;
        float veins = abs(sin(n.x * 12.0 + sin(n.y * 9.0 + uTime) * 2.0) * sin(n.z * 10.0 + uTime * 0.7));
        col += mix(uC2, vec3(1.0, 0.2, 0.3), uRage) * smoothstep(0.92, 1.0, 1.0 - veins) * 0.9;
        vec2 e = n.xy - uLook * 0.25; float eye = length(e) * step(0.0, n.z);
        col = mix(col, vec3(1.0, 0.85, 0.4) * 1.3, smoothstep(0.42, 0.36, eye) * step(0.0, n.z));
        col = mix(col, vec3(0.0), smoothstep(0.2, 0.16, length(e * vec2(2.2, 1.0))) * step(0.0, n.z));
        col += vec3(1.0) * uHurt * 0.8;
        gl_FragColor = vec4(col, 1.0); }`,
  }));
  orb.rotation.x = -Math.PI / 2 + 0.35; g.add(orb);
  const spikes = new THREE.Group(); g.add(spikes);
  const spikeGeo = new THREE.OctahedronGeometry(0.35, 0); spikeGeo.scale(0.6, 0.6, 2);
  for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(spikeGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa66bff).multiplyScalar(2.4) })); const a = i / 8 * Math.PI * 2; s.position.set(Math.cos(a) * 2.7, 0, Math.sin(a) * 2.7); s.lookAt(0, 0, 0); spikes.add(s); }
  // phase armour: hidden in phase 1, unfolds for phases 2 and 3
  const armor = new THREE.Group(); armor.visible = false;
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x1b0b38, metalness: 0.8, roughness: 0.35, emissive: new THREE.Color(0x3a165f) });
  for (let i = 0; i < 6; i++) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 2.15), plateMat);
    const a = i / 6 * Math.PI * 2; plate.position.set(Math.cos(a) * 2.45, 0, Math.sin(a) * 2.45); plate.rotation.y = -a; armor.add(plate);
  }
  const phaseRing = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.055, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a4d).multiplyScalar(2.2), transparent: true, opacity: 0.8 }));
  phaseRing.rotation.x = Math.PI / 2; armor.add(phaseRing);
  g.add(armor);
  const tentacles = [];
  for (let k = 0; k < 6; k++) { const arr = []; for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.28 - i * 0.025, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1a0830, emissive: new THREE.Color(0xff2bd6).multiplyScalar(0.25 + i * 0.05), metalness: 0.5, roughness: 0.4 })); g.add(m); arr.push(m); } tentacles.push({ arr, a: (k / 6) * Math.PI * 2 + 0.3 }); }
  g.userData = { orb, eyeU, spikes, tentacles, armor, phaseRing };
  return g;
}
export function updateBoss(g, dt, t, look, rage, phase = 1) {
  const u = g.userData; u.eyeU.uLook.value.lerp(look, Math.min(1, dt * 4)); u.eyeU.uHurt.value = Math.max(0, u.eyeU.uHurt.value - dt * 5); u.eyeU.uRage.value = rage;
  u.spikes.rotation.y = t * (0.6 + rage);
  u.armor.visible = phase >= 2;
  if (u.armor.visible) {
    u.armor.rotation.y = -t * (0.35 + phase * 0.18);
    u.armor.scale.setScalar(1 + (phase - 2) * 0.12 + Math.sin(t * 2.4) * 0.02);
    u.phaseRing.rotation.z = t * (phase === 3 ? 1.5 : 0.7);
    u.phaseRing.material.opacity = phase === 3 ? 0.55 + 0.35 * Math.sin(t * 6) : 0.65;
  }
  const s = 1 + Math.sin(t * 2.2) * 0.04 + (phase - 1) * 0.035; u.orb.scale.setScalar(s);
  for (const T of u.tentacles) T.arr.forEach((m, i) => { const a = T.a + Math.sin(t * 1.8 + i * 0.5 + T.a) * 0.35; const r = 1.6 + i * 0.42; m.position.set(Math.cos(a) * r, -0.4 - i * 0.12 + Math.sin(t * 2 + i) * 0.15, Math.sin(a) * r * 0.55 - 0.6); });
}

// ------------------------------------------------------------------ instanced bullet pools
export class BulletPool {
  constructor(scene, max, geo, color) {
    this.max = max; this.n = 0; this.list = [];
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3) }), max);
    this.mesh.count = 0; this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(1, 1, 1); this.p = new THREE.Vector3(); this.e = new THREE.Euler();
  }
  add(x, z, vx, vz, extra = {}) { if (this.list.length >= this.max) return null; const b = { x, z, vx, vz, ...extra }; this.list.push(b); return b; }
  clear() { this.list.length = 0; }
  sync(y = 0) {
    const L = this.list; this.mesh.count = L.length;
    for (let i = 0; i < L.length; i++) {
      const b = L[i]; this.e.set(b.rotX || 0, Math.atan2(b.vx, b.vz), b.rotZ || 0); this.q.setFromEuler(this.e); this.p.set(b.x, b.y ?? y, b.z);
      const sc = b.scale || 1; this.s.set(sc * (b.scaleX || 1), sc * (b.scaleY || 1), sc * (b.scaleZ || 1)); this.m.compose(this.p, this.q, this.s); this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, b.color || BulletPool.white);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
BulletPool.white = new THREE.Color(0xffffff);

// power-ups: P = power (weapon level), S = shield/HP, E = energy, W = weapon swap
export const PICKUPS = {
  P: { color: 0xfff35c, zh: '火力', en: 'POWER' },
  S: { color: 0x3bff8a, zh: '護盾', en: 'SHIELD' },
  E: { color: 0x00e5ff, zh: '能量', en: 'ENERGY' },
  W: { color: 0xffffff, zh: '武器', en: 'WEAPON' },
};
export function makePickup(kind, weaponKey) {
  const g = new THREE.Group();
  const w = kind === 'W' ? WEAPONS[weaponKey] : null;
  const c = w ? w.color : PICKUPS[kind].color;
  let geo;
  if (kind === 'W' && weaponKey === 'pulse') {
    // pulse = three compact chevron shards, reads as a bullet cluster
    geo = new THREE.TetrahedronGeometry(0.34, 0);
    for (let i = 0; i < 3; i++) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.72), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.4) }));
      shard.position.set((i - 1) * 0.28, 0, 0); shard.rotation.y = (i - 1) * 0.08; g.add(shard);
    }
  } else if (kind === 'W' && weaponKey === 'lance') {
    // lance = a long needle with a bright core
    geo = new THREE.OctahedronGeometry(0.22, 0);
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.4) }));
    needle.rotation.z = Math.PI / 2; g.add(needle);
  } else if (kind === 'W' && weaponKey === 'nova') {
    // nova = a ring with a heavy core
    geo = new THREE.IcosahedronGeometry(0.3, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 8, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2) }));
    ring.rotation.x = Math.PI / 2; g.add(ring);
  } else {
    geo = kind === 'W' ? new THREE.IcosahedronGeometry(0.5, 0) : new THREE.OctahedronGeometry(0.42, 0);
  }
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.5), transparent: true, opacity: 0.6 })));
  g.add(neonEdges(geo, c, 3));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(kind === 'W' ? 0.72 : 0.6, 0.03, 6, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2) }));
  ring.rotation.x = Math.PI / 2; g.add(ring);
  g.userData.kind = kind; g.userData.weapon = weaponKey || null;
  return g;
}

// GEM = auto-collected score/charge shard. Tier 0 common, 1 elite, 2 boss.
// Loot colours deliberately avoid magenta (enemy bullets) and cyan (player shots).
const GEM_COLORS = [0xffd166, 0xf2e9ff, 0x9dffcf];
export function makeGem(tier = 0) {
  const c = GEM_COLORS[Math.min(2, tier)] || GEM_COLORS[0];
  const geo = new THREE.OctahedronGeometry(0.2 + tier * 0.035, 0); geo.scale(1, 1.55, 1);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.8), transparent: true, opacity: 0.92 })));
  g.add(neonEdges(geo, c, 3.2));
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.09 + tier * 0.012, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  g.add(core);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.38 + tier * 0.04, 0.018, 6, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.3), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.rotation.x = Math.PI / 2; g.add(halo);
  g.userData.tier = tier; g.userData.core = core; g.userData.halo = halo;
  return g;
}


// Drifting debris: a physical map obstacle, deliberately duller than loot and bullets.
const ROCK_GEO = new THREE.DodecahedronGeometry(1.05, 0);
export function makeRock() {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(ROCK_GEO, new THREE.MeshStandardMaterial({ color: 0x1c1226, metalness: 0.5, roughness: 0.8, emissive: 0x30184a }));
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(ROCK_GEO, 18), new THREE.LineBasicMaterial({ color: new THREE.Color(0xffb35c).multiplyScalar(1.5) }));
  const spin = new THREE.Group(); spin.add(mesh, edge); g.add(spin);
  // rocks stay near-black with amber edge lines only — no glow/highlight
  g.userData.edge = edge; g.userData.spin = spin;
  return g;
}
