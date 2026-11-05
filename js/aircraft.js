// Procedural cyberpunk airframes. Forward is -Z, up is +Y.
// The three silhouettes, materials and engine layouts are deliberately distinct;
// combat statistics remain in crafts.js and are not read or changed here.
import * as THREE from 'three';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const metal = (color, roughness = 0.34, metalness = 0.52) => new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
const lightMat = (color, intensity = 2, opacity = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: opacity < 1, opacity, blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: opacity >= 1, side: THREE.DoubleSide });

function prism(points, depth, material, bevel = 0.018) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: bevel > 0, bevelSegments: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 1 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, depth / 2, 0);
  return new THREE.Mesh(geo, material);
}

function outline(mesh, color, opacity = 0.72) {
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 24), new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.55), transparent: true, opacity, depthWrite: false }));
  lines.renderOrder = 2;
  mesh.add(lines);
  return mesh;
}

function mirrored(points, side) {
  const p = points.map(([x, z]) => [x * side, z]);
  return side < 0 ? p.reverse() : p;
}

function box(parent, size, position, material, rotation = null) {
  const m = new THREE.Mesh(UNIT_BOX, material);
  m.scale.set(...size); m.position.set(...position);
  if (rotation) m.rotation.set(...rotation);
  parent.add(m);
  return m;
}

function strip(parent, a, b, y, width, material) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  const m = box(parent, [length, 0.018, width], [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], material);
  m.rotation.y = -Math.atan2(dz, dx);
  return m;
}

function circuit(parent, points, y, color) {
  const geo = new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => new THREE.Vector3(x, y, z)));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, opacity: 0.9 }));
  parent.add(line);
  return line;
}

function verticalFin(x, points, depth, material, color, cant) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2); geo.translate(depth / 2, 0, 0);
  const fin = new THREE.Mesh(geo, material); fin.position.x = x; fin.rotation.z = cant;
  outline(fin, color, 0.65);
  return fin;
}

function canopy(parent, position, scale, accent, slit = false) {
  const glass = new THREE.MeshStandardMaterial({ color: 0x07101d, emissive: new THREE.Color(accent).multiplyScalar(0.07), metalness: 0.38, roughness: 0.24 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), glass);
  dome.position.set(...position); dome.scale.set(...scale); parent.add(dome);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 5, 28), lightMat(accent, 1.5, 0.72));
  rim.geometry.rotateX(Math.PI / 2); rim.position.set(position[0], position[1] - scale[1] * 0.35, position[2]);
  rim.scale.set(scale[0] * 1.02, 1, scale[2] * 1.02); parent.add(rim);
  if (slit) box(parent, [scale[0] * 1.3, 0.025, 0.035], [position[0], position[1] + scale[1] * 0.55, position[2] - scale[2] * 0.35], lightMat(accent, 2.4));
  return dome;
}

function flameMaterial(color, halfLength, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(2.2) }, uHalf: { value: halfLength }, uOpacity: { value: opacity } },
    vertexShader: `uniform float uHalf; varying float vAxial;
      void main() { vAxial = clamp(position.z / (2.0 * uHalf) + 0.5, 0.0, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vAxial;
      void main() { float fade = pow(1.0 - vAxial, 1.35);
      gl_FragColor = vec4(uColor * (1.0 + fade * 0.35), fade * uOpacity); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}

function engine(parent, x, y, rearZ, radius, length, color, materials, flames) {
  const root = new THREE.Group(); root.position.set(x, y, rearZ); parent.add(root);
  const barrelGeo = new THREE.CylinderGeometry(radius * 0.88, radius, length, 12, 1, false);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, materials.dark); barrel.position.z = -length / 2; root.add(barrel);
  const intake = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.9, radius * 0.12, 5, 16), materials.mid);
  intake.position.z = -length + 0.01; root.add(intake);
  for (const f of [0.28, 0.68]) {
    const cooling = new THREE.Mesh(new THREE.TorusGeometry(radius * (0.94 - f * 0.05), radius * 0.055, 4, 16), materials.panel);
    cooling.position.z = -length * f; root.add(cooling);
  }
  const nozzle = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.82, radius * 0.16, 6, 20), materials.panel); root.add(nozzle);
  const core = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.67, 18), lightMat(color, 2.5)); core.position.z = 0.012; root.add(core);
  const outerLen = 0.58 + radius * 0.45, innerLen = outerLen * 0.68;
  const outGeo = new THREE.ConeGeometry(radius * 0.64, outerLen, 16, 1, true); outGeo.rotateX(Math.PI / 2);
  const inGeo = new THREE.ConeGeometry(radius * 0.32, innerLen, 12, 1, true); inGeo.rotateX(Math.PI / 2);
  const flameOut = new THREE.Mesh(outGeo, flameMaterial(color, outerLen / 2, 0.72));
  const flameIn = new THREE.Mesh(inGeo, flameMaterial(0xe8ffff, innerLen / 2, 0.86));
  flameOut.position.z = outerLen / 2; flameIn.position.z = innerLen / 2;
  flameOut.userData.halfLength = outerLen / 2; flameIn.userData.halfLength = innerLen / 2;
  root.add(flameOut, flameIn);
  flames.push({ root, out: flameOut, inner: flameIn, phase: flames.length * 1.73 });
  return root;
}

function holoArc(parent, radius, y, color, arc, spinners, speed) {
  const geo = new THREE.TorusGeometry(radius, 0.012, 4, 48, arc); geo.rotateX(Math.PI / 2);
  const ring = new THREE.Mesh(geo, lightMat(color, 1.8, 0.46)); ring.position.y = y; parent.add(ring);
  spinners.push({ mesh: ring, speed });
  return ring;
}

function addFalcon(body, ctx) {
  const { C, A, color, accent, mats, flames, spinners } = ctx;
  const hull = prism([[0, -1.55], [0.17, -0.91], [0.25, -0.15], [0.22, 0.68], [0.12, 0.88], [-0.12, 0.88], [-0.22, 0.68], [-0.25, -0.15], [-0.17, -0.91]], 0.18, mats.mid);
  outline(hull, color, 0.56); body.add(hull);
  const belly = prism([[0, -1.35], [0.19, -0.35], [0.16, 0.74], [-0.16, 0.74], [-0.19, -0.35]], 0.09, mats.dark, 0.01);
  belly.position.y = -0.13; body.add(belly);
  const nose = prism([[0, -1.48], [0.105, -0.82], [0.12, -0.26], [-0.12, -0.26], [-0.105, -0.82]], 0.065, mats.light, 0.008);
  nose.position.y = 0.115; body.add(nose);
  canopy(body, [0, 0.18, -0.49], [0.145, 0.105, 0.34], accent);

  const wing = [[0.15, -0.50], [0.55, -0.34], [1.24, 0.24], [1.18, 0.50], [0.34, 0.34], [0.20, 0.67]];
  const wingPanel = [[0.30, -0.25], [0.56, -0.16], [1.00, 0.28], [0.43, 0.17]];
  const canard = [[0.12, -0.76], [0.55, -0.48], [0.50, -0.32], [0.15, -0.45]];
  for (const s of [-1, 1]) {
    const w = prism(mirrored(wing, s), 0.07, mats.dark, 0.012); w.position.y = -0.025; outline(w, color, 0.78); body.add(w);
    const p = prism(mirrored(wingPanel, s), 0.035, mats.panel, 0.006); p.position.y = 0.055; body.add(p);
    const cn = prism(mirrored(canard, s), 0.045, mats.mid, 0.008); cn.position.y = 0.015; outline(cn, accent, 0.5); body.add(cn);
    strip(body, [s * 0.29, -0.29], [s * 1.10, 0.29], 0.092, 0.024, mats.neon);
    strip(body, [s * 0.44, 0.25], [s * 1.02, 0.40], 0.085, 0.016, mats.accent);
    box(body, [0.075, 0.10, 0.35], [s * 1.16, 0.005, 0.34], mats.mid, [0, s * -0.15, 0]);
    box(body, [0.04, 0.035, 0.16], [s * 1.18, 0.065, 0.26], mats.accent);
    const fin = verticalFin(s * 0.39, [[0.22, 0.02], [0.75, 0.02], [0.61, 0.49], [0.43, 0.40]], 0.055, mats.mid, color, s * -0.19);
    body.add(fin);
    circuit(body, [[s * 0.09, -1.10], [s * 0.09, -0.82], [s * 0.16, -0.72], [s * 0.16, -0.25]], 0.167, color);
  }
  engine(body, -0.36, -0.035, 0.80, 0.17, 1.03, color, mats, flames);
  engine(body, 0.36, -0.035, 0.80, 0.17, 1.03, color, mats, flames);
  strip(body, [-0.12, 0.52], [0.12, 0.52], 0.13, 0.035, mats.accent);
  holoArc(body, 0.82, -0.22, color, Math.PI * 1.45, spinners, 0.55);
  holoArc(body, 0.66, -0.21, accent, Math.PI * 0.72, spinners, -0.9);
  ctx.tips = [-1.19, 1.19];
}

function addBastion(body, ctx) {
  const { A, color, accent, mats, flames, spinners } = ctx;
  const hull = prism([[0, -1.20], [0.43, -1.00], [0.67, -0.43], [0.70, 0.61], [0.43, 0.88], [-0.43, 0.88], [-0.70, 0.61], [-0.67, -0.43], [-0.43, -1.00]], 0.34, mats.mid, 0.035);
  outline(hull, color, 0.6); body.add(hull);
  const lower = prism([[0, -1.12], [0.56, -0.70], [0.61, 0.72], [-0.61, 0.72], [-0.56, -0.70]], 0.14, mats.dark, 0.018);
  lower.position.y = -0.23; body.add(lower);
  const chest = prism([[0, -1.05], [0.34, -0.80], [0.43, -0.12], [0.29, 0.28], [-0.29, 0.28], [-0.43, -0.12], [-0.34, -0.80]], 0.12, mats.light, 0.02);
  chest.position.y = 0.21; outline(chest, accent, 0.42); body.add(chest);
  canopy(body, [0, 0.34, -0.46], [0.24, 0.105, 0.26], accent, true);

  const shoulder = [[0.48, -0.66], [0.91, -0.49], [1.16, -0.02], [1.12, 0.62], [0.65, 0.73], [0.51, 0.30]];
  const shoulderPanel = [[0.66, -0.42], [0.89, -0.30], [1.00, 0.02], [0.96, 0.43], [0.70, 0.48]];
  for (const s of [-1, 1]) {
    const armor = prism(mirrored(shoulder, s), 0.25, mats.dark, 0.028); armor.position.y = 0.005; outline(armor, color, 0.75); body.add(armor);
    const plate = prism(mirrored(shoulderPanel, s), 0.10, mats.panel, 0.015); plate.position.y = 0.18; body.add(plate);
    box(body, [0.40, 0.11, 0.42], [s * 0.80, 0.29, 0.18], mats.light);
    box(body, [0.31, 0.035, 0.055], [s * 0.80, 0.36, 0.04], mats.accent);
    strip(body, [s * 0.60, -0.42], [s * 1.02, -0.08], 0.265, 0.035, mats.neon);
    strip(body, [s * 0.64, 0.55], [s * 1.00, 0.51], 0.26, 0.024, mats.accent);
    for (const dz of [-0.58, -0.42]) {
      const gunGeo = new THREE.CylinderGeometry(0.047, 0.068, 0.64, 8); gunGeo.rotateX(Math.PI / 2);
      const gun = new THREE.Mesh(gunGeo, mats.panel); gun.position.set(s * 0.91, 0.08, dz); body.add(gun);
      const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.014, 5, 12), mats.accent); muzzle.position.set(s * 0.91, 0.08, dz - 0.32); body.add(muzzle);
    }
    for (const z of [-0.15, 0.12, 0.39]) box(body, [0.035, 0.035, 0.035], [s * 0.61, 0.37, z], mats.accent);
  }
  box(body, [0.46, 0.12, 0.44], [0, 0.35, 0.38], mats.dark);
  box(body, [0.28, 0.05, 0.30], [0, 0.43, 0.38], mats.panel);
  circuit(body, [[-0.22, -0.82], [-0.22, -0.20], [0, -0.04], [0.22, -0.20], [0.22, -0.82]], 0.345, color);
  for (const x of [-0.72, -0.27, 0.27, 0.72]) engine(body, x, -0.08, 0.80, Math.abs(x) > 0.5 ? 0.135 : 0.16, 0.72, color, mats, flames);
  holoArc(body, 0.91, -0.31, color, Math.PI * 1.78, spinners, 0.32);
  holoArc(body, 0.73, -0.30, accent, Math.PI * 0.62, spinners, -0.72);
  ctx.tips = [-1.10, 1.10];
}

function addWraith(body, ctx) {
  const { A, color, accent, mats, flames, spinners } = ctx;
  const plan = [[0, -1.48], [0.39, -0.77], [1.29, 0.22], [1.38, 0.49], [0.49, 0.35], [0.20, 0.75], [0, 0.59], [-0.20, 0.75], [-0.49, 0.35], [-1.38, 0.49], [-1.29, 0.22], [-0.39, -0.77]];
  const wing = prism(plan, 0.105, mats.dark, 0.016); outline(wing, color, 0.82); body.add(wing);
  const under = prism(plan.map(([x, z]) => [x * 0.91, z * 0.91]), 0.07, mats.mid, 0.008); under.position.y = -0.09; body.add(under);
  const spine = prism([[0, -1.40], [0.17, -0.63], [0.24, 0.35], [0.13, 0.57], [-0.13, 0.57], [-0.24, 0.35], [-0.17, -0.63]], 0.085, mats.panel, 0.012);
  spine.position.y = 0.075; body.add(spine);
  const facet = [[0.10, -1.05], [0.34, -0.57], [1.08, 0.28], [0.43, 0.14], [0.20, 0.39]];
  const flap = [[0.50, 0.23], [1.19, 0.39], [0.51, 0.29]];
  for (const s of [-1, 1]) {
    const f = prism(mirrored(facet, s), 0.035, mats.mid, 0.005); f.position.y = 0.068; body.add(f);
    const fl = prism(mirrored(flap, s), 0.025, mats.light, 0.004); fl.position.y = 0.075; body.add(fl);
    strip(body, [s * 0.28, -0.72], [s * 1.22, 0.30], 0.105, 0.022, mats.neon);
    strip(body, [s * 0.47, 0.18], [s * 1.03, 0.34], 0.105, 0.018, mats.accent);
    circuit(body, [[s * 0.10, -1.10], [s * 0.10, -0.74], [s * 0.22, -0.58], [s * 0.22, 0.24], [s * 0.36, 0.31]], 0.145, accent);
    for (const x of [0.55, 0.78, 1.01]) box(body, [0.06, 0.018, 0.025], [s * x, 0.105, 0.20 + x * 0.08], mats.neon);
  }
  canopy(body, [0, 0.135, -0.53], [0.13, 0.055, 0.29], accent, true);
  engine(body, -0.27, -0.015, 0.57, 0.125, 0.60, color, mats, flames);
  engine(body, 0.27, -0.015, 0.57, 0.125, 0.60, color, mats, flames);
  holoArc(body, 0.89, -0.18, color, Math.PI * 1.15, spinners, -0.72);
  holoArc(body, 0.67, -0.17, accent, Math.PI * 1.62, spinners, 0.52);
  holoArc(body, 0.46, -0.16, color, Math.PI * 0.55, spinners, -1.1);
  ctx.tips = [-1.33, 1.33];
}

export function makeNinja(craft) {
  const c = craft || { color: 0x00e5ff, accent: 0xff2bd6, key: 'falcon' };
  const C = new THREE.Color(c.color), A = new THREE.Color(c.accent);
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const mats = {
    dark: metal(c.key === 'wraith' ? 0x111625 : 0x182130, 0.36),
    mid: metal(c.key === 'bastion' ? 0x3e5149 : 0x3b4b61, 0.31),
    light: metal(c.key === 'wraith' ? 0x34384f : 0x68768b, 0.28),
    panel: metal(0x252f40, 0.26),
    neon: lightMat(c.color, 2.1),
    accent: lightMat(c.accent, 2.25),
  };
  const flames = [], spinners = [];
  const ctx = { C, A, color: c.color, accent: c.accent, mats, flames, spinners, tips: [-1, 1] };
  if (c.key === 'bastion') addBastion(body, ctx);
  else if (c.key === 'wraith') addWraith(body, ctx);
  else addFalcon(body, ctx);

  for (const x of ctx.tips) {
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), x < 0 ? mats.accent : mats.neon);
    nav.position.set(x, 0.10, c.key === 'falcon' ? 0.32 : 0.38); body.add(nav);
  }
  const glow = new THREE.Mesh(new THREE.CircleGeometry(c.key === 'bastion' ? 0.98 : 0.84, 32), lightMat(c.color, 1.45, 0.24));
  glow.geometry.rotateX(-Math.PI / 2); glow.position.y = c.key === 'bastion' ? -0.34 : -0.25; glow.scale.set(1, 1, 1.35); body.add(glow);
  const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(c.key === 'bastion' ? 1.35 : 1.25, 2), new THREE.MeshBasicMaterial({ color: C.clone().multiplyScalar(1.2), wireframe: true, transparent: true, opacity: 0, depthWrite: false }));
  shield.scale.y = 0.55; g.add(shield);
  const first = flames[0];
  g.userData = { body, shield, glow, thruster: first.root, flameOut: first.out, flameIn: first.inner, flames, spinners, craftColor: C, craftAccent: A, airframe: c.key, engineCount: flames.length };
  return g;
}

export function disposeNinja(g) {
  if (!g) return;
  const geometries = new Set(), materials = new Set();
  g.traverse(o => {
    if (o.geometry && o.geometry !== UNIT_BOX) geometries.add(o.geometry);
    if (Array.isArray(o.material)) for (const m of o.material) materials.add(m);
    else if (o.material) materials.add(o.material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

export function updateNinja(g, dt, t, vx, invuln, thrust = 1) {
  const u = g.userData;
  u.body.rotation.z = THREE.MathUtils.lerp(u.body.rotation.z, -vx * 0.05, Math.min(1, dt * 10));
  u.body.rotation.x = -0.08 + Math.sin(t * 3) * 0.018;
  u.body.position.y = Math.sin(t * 4) * 0.035;
  u.glow.material.opacity = 0.20 + Math.sin(t * 12) * 0.045;
  const fl = thrust * (0.88 + Math.sin(t * 41) * 0.13 + Math.sin(t * 97) * 0.06);
  for (const f of u.flames) {
    const pulse = Math.max(0.22, fl * (1 + Math.sin(t * 33 + f.phase) * 0.055));
    f.out.scale.set(1, 1, pulse); f.inner.scale.set(1, 1, Math.max(0.2, pulse * 1.12));
    f.out.position.z = f.out.userData.halfLength * pulse;
    f.inner.position.z = f.inner.userData.halfLength * pulse * 1.12;
    f.out.material.uniforms.uOpacity.value = 0.60 + 0.16 * Math.min(1, pulse);
  }
  for (const s of u.spinners) s.mesh.rotation.y = t * s.speed;
  u.shield.material.opacity = invuln > 0 ? 0.22 + 0.16 * Math.sin(t * 30) : 0;
  u.shield.rotation.y = t * 1.5;
  g.visible = !(invuln > 0 && Math.sin(t * 40) > 0.6);
}
