// Models + pools: the ninja, enemy archetypes, the cosmic monster boss, bolts, enemy bullets, power-ups.
import * as THREE from 'three';
import { U } from 'cyber-kit/core/theme.js';
import { ENEMIES } from './config.js';

const neonEdges = (geo, color, mult = 2.2, thresh = 20) => new THREE.LineSegments(new THREE.EdgesGeometry(geo, thresh), new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult) }));
const darkMetal = (tint = 0x120a24) => new THREE.MeshStandardMaterial({ color: tint, metalness: 0.75, roughness: 0.32, emissive: 0x000000 });

// ------------------------------------------------------------------ the ninja (original design: hover-glider rider)
export function makeNinja() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  // glider board
  const boardGeo = new THREE.CylinderGeometry(0.62, 0.9, 0.12, 6); boardGeo.scale(0.7, 1, 1.25);
  const board = new THREE.Mesh(boardGeo, darkMetal(0x0d0820)); board.position.y = -0.55; body.add(board);
  const bEdge = neonEdges(boardGeo, 0x00e5ff, 2.6); bEdge.position.copy(board.position); body.add(bEdge);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00e5ff).multiplyScalar(1.6), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.64; glow.scale.set(0.8, 1.3, 1); body.add(glow);
  // rider
  const suit = darkMetal(0x2a1a50); suit.emissive = new THREE.Color(0x120830);
  const torsoGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.62, 6); const torso = new THREE.Mesh(torsoGeo, suit); torso.position.y = -0.12; body.add(torso); const tEdge = neonEdges(torsoGeo, 0x00e5ff, 2.2); tEdge.position.copy(torso.position); body.add(tEdge);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), suit); head.position.y = 0.33; body.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2bd6).multiplyScalar(3) })); visor.position.set(0, 0.35, -0.16); body.add(visor);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.025, 6, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2bd6).multiplyScalar(2) })); band.rotation.x = Math.PI / 2; band.position.y = 0.42; body.add(band);
  // katana on the back (energy blade)
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00e5ff).multiplyScalar(3) }));
  blade.position.set(0.18, 0.05, 0.25); blade.rotation.set(0.9, 0, 0.4); body.add(blade);
  // scarf ribbon (trail follows motion)
  const N = 14; const scarfGeo = new THREE.PlaneGeometry(0.16, 1, 1, N - 1);
  const scarf = new THREE.Mesh(scarfGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2bd6).multiplyScalar(2), side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  scarf.frustumCulled = false; g.add(scarf);
  // shield bubble (invulnerability)
  const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00e5ff).multiplyScalar(1.2), wireframe: true, transparent: true, opacity: 0 }));
  g.add(shield);
  g.userData = { body, scarf, scarfPts: Array.from({ length: N }, () => new THREE.Vector3()), shield, glow, visor };
  return g;
}
export function updateNinja(g, dt, t, vx, invuln) {
  const u = g.userData;
  u.body.rotation.z = THREE.MathUtils.lerp(u.body.rotation.z, -vx * 0.05, Math.min(1, dt * 10));
  u.body.rotation.x = -0.18 + Math.sin(t * 3) * 0.03;
  u.body.position.y = Math.sin(t * 4) * 0.06;
  u.glow.material.opacity = 0.45 + Math.sin(t * 20) * 0.1;
  // scarf: head point follows, rest trails behind (+z) with flutter
  const pts = u.scarfPts; const head = new THREE.Vector3(0, 0.38, 0.12).add(g.position);
  pts[0].copy(head);
  for (let i = 1; i < pts.length; i++) {
    const target = pts[i - 1].clone().add(new THREE.Vector3(Math.sin(t * 9 + i * 0.7) * 0.025, 0.004, 0.065));
    pts[i].lerp(target, Math.min(1, dt * 22));
  }
  const pos = u.scarf.geometry.attributes.position;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]; const w = 0.045 * (1 - i / pts.length * 0.6);
    const sc = g.scale.x;
    pos.setXYZ(i * 2, (p.x - w - g.position.x) / sc, (p.y - g.position.y) / sc, (p.z - g.position.z) / sc);
    pos.setXYZ(i * 2 + 1, (p.x + w - g.position.x) / sc, (p.y - g.position.y) / sc, (p.z - g.position.z) / sc);
  }
  pos.needsUpdate = true;
  u.shield.material.opacity = invuln > 0 ? 0.25 + 0.2 * Math.sin(t * 30) : 0;
  u.shield.rotation.y = t * 1.5;
  g.visible = !(invuln > 0 && Math.sin(t * 40) > 0.6);
}

// ------------------------------------------------------------------ enemies
const GEO = {
  drone: new THREE.OctahedronGeometry(0.5, 0),
  droneRing: new THREE.TorusGeometry(0.62, 0.04, 6, 24),
  weaver: new THREE.TorusKnotGeometry(0.34, 0.1, 48, 6, 2, 3),
  turret: new THREE.CylinderGeometry(0.55, 0.7, 0.5, 8),
  barrel: new THREE.BoxGeometry(0.16, 0.16, 0.7),
  dasher: new THREE.ConeGeometry(0.42, 1.2, 4),
};
export function makeEnemy(type) {
  const def = ENEMIES[type]; const g = new THREE.Group(); const mat = darkMetal(); mat.emissive = new THREE.Color(0);
  let core;
  if (type === 'drone') { core = new THREE.Mesh(GEO.drone, mat); g.add(core, neonEdges(GEO.drone, def.color)); const ring = new THREE.Mesh(GEO.droneRing, new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(2) })); ring.rotation.x = Math.PI / 2; g.add(ring); g.userData.spin = ring; }
  else if (type === 'weaver') { core = new THREE.Mesh(GEO.weaver, new THREE.MeshStandardMaterial({ color: 0x06202a, emissive: new THREE.Color(def.color).multiplyScalar(0.6), metalness: 0.6, roughness: 0.3 })); g.add(core); g.userData.spin = core; }
  else if (type === 'turret') { core = new THREE.Mesh(GEO.turret, mat); g.add(core, neonEdges(GEO.turret, def.color)); const b = new THREE.Mesh(GEO.barrel, new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(2) })); b.position.set(0, 0, 0.45); const head = new THREE.Group(); head.add(b); g.add(head); g.userData.head = head; }
  else if (type === 'dasher') { core = new THREE.Mesh(GEO.dasher, mat); core.rotation.x = Math.PI / 2; g.add(core); const e = neonEdges(GEO.dasher, def.color); e.rotation.x = Math.PI / 2; g.add(e); }
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
  const tentacles = [];
  for (let k = 0; k < 6; k++) { const arr = []; for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.28 - i * 0.025, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1a0830, emissive: new THREE.Color(0xff2bd6).multiplyScalar(0.25 + i * 0.05), metalness: 0.5, roughness: 0.4 })); g.add(m); arr.push(m); } tentacles.push({ arr, a: (k / 6) * Math.PI * 2 + 0.3 }); }
  g.userData = { orb, eyeU, spikes, tentacles };
  return g;
}
export function updateBoss(g, dt, t, look, rage) {
  const u = g.userData; u.eyeU.uLook.value.lerp(look, Math.min(1, dt * 4)); u.eyeU.uHurt.value = Math.max(0, u.eyeU.uHurt.value - dt * 5); u.eyeU.uRage.value = rage;
  u.spikes.rotation.y = t * (0.6 + rage); const s = 1 + Math.sin(t * 2.2) * 0.04; u.orb.scale.setScalar(s);
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
    for (let i = 0; i < L.length; i++) { const b = L[i]; this.e.set(0, Math.atan2(b.vx, b.vz), 0); this.q.setFromEuler(this.e); this.p.set(b.x, y, b.z); const sc = b.scale || 1; this.s.set(sc, sc, sc); this.m.compose(this.p, this.q, this.s); this.mesh.setMatrixAt(i, this.m); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// power-ups: P = power, S = shield/HP, E = energy
export const PICKUPS = { P: { color: 0xfff35c, zh: '火力', en: 'POWER' }, S: { color: 0x3bff8a, zh: '護盾', en: 'SHIELD' }, E: { color: 0x00e5ff, zh: '能量', en: 'ENERGY' } };
export function makePickup(kind) {
  const g = new THREE.Group(); const c = PICKUPS[kind].color;
  const geo = new THREE.OctahedronGeometry(0.42, 0);
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.5), transparent: true, opacity: 0.6 })));
  g.add(neonEdges(geo, c, 3));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 6, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2) })); ring.rotation.x = Math.PI / 2; g.add(ring);
  g.userData.kind = kind; return g;
}
