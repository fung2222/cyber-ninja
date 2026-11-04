// Backdrop: star-sea sky dome with nebula, a neon megacity far below scrolling past, side towers (parallax), speed streaks.
import * as THREE from 'three';
import { U } from 'cyber-kit/core/theme.js';

const HASH = /* glsl */`float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`;

export class World {
  constructor(scene) {
    this.scene = scene; this.speed = 1; this.scroll = 0;
    scene.fog = new THREE.FogExp2(0x0a0418, 0.009);   // was 0.012: less haze over the play field
    this.uScroll = { value: 0 };
    // sky dome
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTime: U.uTime, uC1: U.uC1, uC2: U.uC2, uH: U.uHorizon, uZ: U.uZenith, uScroll: this.uScroll },
      vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`uniform float uTime, uScroll; uniform vec3 uC1, uC2, uH, uZ; varying vec3 vD; ${HASH}
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
        void main(){
          float y = vD.y; vec3 col = mix(uH * 0.55, uZ, smoothstep(-0.25, 0.6, y));
          vec2 sp = vD.xz / (abs(vD.y) + 0.35) * 3.0 + vec2(0.0, uScroll * 0.002);
          float neb = fbm(sp * 0.8 + uTime * 0.01); float neb2 = fbm(sp * 1.6 - 3.0);
          col += uC2 * pow(neb, 3.0) * 0.55 + uC1 * pow(neb2, 4.0) * 0.4;
          vec2 g = sp * 18.0; vec2 id = floor(g); float s = h21(id); vec2 f = fract(g) - 0.5;
          float star = step(0.985, s) * smoothstep(0.12, 0.0, length(f)) * (0.6 + 0.4 * sin(uTime * 3.0 + s * 40.0));
          col += vec3(star) * 1.6;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    scene.add(this.sky);
    // megacity far below (procedural blocks, windows, glowing roads), scrolls toward the camera
    const city = new THREE.Mesh(new THREE.PlaneGeometry(700, 900, 1, 1), new THREE.ShaderMaterial({
      fog: false, uniforms: { uTime: U.uTime, uC1: U.uC1, uC2: U.uC2, uC3: U.uC3, uScroll: this.uScroll, uFog: U.uFogColor },
      vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`uniform float uTime, uScroll; uniform vec3 uC1, uC2, uC3, uFog; varying vec3 vW; ${HASH}
        void main(){
          vec2 p = vec2(vW.x, vW.z - uScroll);
          vec2 blk = floor(p / 9.0); vec2 f = fract(p / 9.0);
          float road = step(f.x, 0.035) + step(f.y, 0.035);
          float r = h21(blk);
          vec3 col = vec3(0.012, 0.01, 0.025);
          vec2 w = fract(p * 1.4); vec2 wid = floor(p * 1.4);
          float lit = step(0.72, h21(wid + blk * 7.0)) * step(0.15, w.x) * step(0.15, w.y) * (1.0 - min(road, 1.0));
          col += mix(uC1, uC3, step(0.6, r)) * lit * (0.07 + 0.06 * sin(uTime * 0.7 + r * 30.0));
          // road glow stays cool (cyan/blue): keeps the magenta reserved for enemy bullets
          col += mix(uC2, vec3(0.30, 0.55, 1.0), 0.45) * min(road, 1.0) * 0.15;
          // car streaks on roads
          float car = step(0.94, fract(p.y * 0.08 + h21(vec2(blk.x, 0.0)) + uTime * 0.6)) * step(f.x, 0.035);
          col += uC3 * car * 0.7;
          float dist = length(vW.xz - cameraPosition.xz);
          col = mix(col, uFog * 0.9, smoothstep(60.0, 330.0, dist));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    city.rotation.x = -Math.PI / 2; city.position.set(0, -46, -250); scene.add(city); this.city = city;
    // haze layer between the play field and the city: pushes the city far below and keeps gameplay readable
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uFog: U.uFogColor, uC2: U.uC2 },
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`uniform vec3 uFog, uC2; varying vec2 vUv; void main(){ float d = length(vUv - vec2(0.5, 0.52)); gl_FragColor = vec4(uFog * 0.35 + uC2 * 0.015, 0.62 - d * 0.3); }` }));
    haze.rotation.x = -Math.PI / 2; haze.position.set(0, -7, -60); haze.renderOrder = -1; scene.add(haze); this.haze = haze;
    // side towers (instanced, recycle)
    this.towerCount = 46;
    const tmat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uC1: U.uC1, uC2: U.uC2, uFog: U.uFogColor },
      vertexShader: /* glsl */`varying vec3 vW; varying vec3 vN; varying float vSeed; void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(instanceMatrix) * normal); vSeed = instanceMatrix[3][0] * 0.13 + instanceMatrix[1][1] * 0.07; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`uniform float uTime; uniform vec3 uC1, uC2, uFog; varying vec3 vW; varying vec3 vN; varying float vSeed; ${HASH}
        void main(){
          vec3 col = vec3(0.015, 0.012, 0.03) * (0.6 + 0.4 * max(vN.y, 0.0));
          vec2 uv = vec2(abs(vN.x) > 0.5 ? vW.z : vW.x, vW.y) * vec2(1.6, 1.2);
          vec2 id = floor(uv); vec2 f = fract(uv);
          float lit = step(0.8, h21(id + vSeed)) * step(0.2, f.x) * step(0.25, f.y) * step(f.y, 0.85) * (1.0 - step(0.5, vN.y));
          col += mix(uC1, uC2, step(0.5, h21(id * 0.3 + vSeed))) * lit * 0.8;
          float edge = step(0.96, fract(vW.y * 0.08 + vSeed)) * (1.0 - step(0.5, abs(vN.y)));
          col += uC2 * edge * 1.4;
          float d = length(vW - cameraPosition); col = mix(col, uFog, smoothstep(30.0, 160.0, d));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), tmat, this.towerCount);
    this.towerData = [];
    for (let i = 0; i < this.towerCount; i++) this.towerData.push(this.newTower(i, true));
    this.towers.frustumCulled = false; scene.add(this.towers);
    // speed streaks
    this.streakN = 70;
    this.streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.04, 3.5), new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), this.streakN);
    this.streakData = Array.from({ length: this.streakN }, () => ({ x: (Math.random() * 2 - 1) * 26, y: -2 - Math.random() * 14, z: -120 + Math.random() * 130, v: 50 + Math.random() * 40 }));
    this.streaks.material.opacity = 0.5;
    this.streaks.frustumCulled = false; scene.add(this.streaks);
    // playfield edge rails: twin animated energy beams framing the combat lane
    this.rails = [];
    const railGeo = new THREE.PlaneGeometry(0.5, 34, 1, 1);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: U.uTime, uC1: U.uC1, uC2: U.uC2, uSide: { value: side } },
        vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */`uniform float uTime; uniform vec3 uC1, uC2; varying vec2 vUv;
          void main(){
            float core = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
            float flow = 0.55 + 0.45 * sin(vUv.y * 26.0 - uTime * 5.0);
            float edge = smoothstep(0.16, 0.0, abs(vUv.x - 0.5)) * 1.6;
            vec3 col = mix(uC1, uC2, vUv.y) * (core * 0.5 * flow + edge * 0.5);
            gl_FragColor = vec4(col, core * 0.6);
          }`,
      }));
      rail.rotation.x = -Math.PI / 2;
      rail.position.set(side * (6 + 0.35), 0.06, -10.4);
      scene.add(rail); this.rails.push(rail);
    }
    // deep-space ruins: a second district built behind the same play field
    this.mode = 'city';
    this.ruins = this.makeRuins(); scene.add(this.ruins);
    this.ruinFloor = this.makeRuinFloor(); scene.add(this.ruinFloor);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3();
    // lights for enemy / player standard materials
    scene.add(new THREE.HemisphereLight(0x8a7aff, 0x140022, 0.9));
    const dl = new THREE.DirectionalLight(0xbfd0ff, 1.2); dl.position.set(-6, 20, 8); scene.add(dl);
    this.rim = new THREE.PointLight(0xff2bd6, 30, 30, 1.6); this.rim.position.set(0, 4, -6); scene.add(this.rim);
  }
  makeRuinFloor() {
    const mat = new THREE.ShaderMaterial({
      depthWrite: true,
      uniforms: { uTime: U.uTime, uC1: U.uC1, uC2: U.uC2 },
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`uniform float uTime; uniform vec3 uC1, uC2; varying vec2 vUv;
        void main(){
          vec2 p = vUv * 2.0 - 1.0; p.x *= 1.65;
          float r = length(p); float a = atan(p.y, p.x);
          float broken = abs(sin(r * 17.0 + sin(a * 5.0 + uTime * 0.1) * 0.7));
          float ring = smoothstep(0.025, 0.0, broken) * smoothstep(1.35, 0.45, r);
          float spokes = smoothstep(0.012, 0.0, abs(sin(a * 12.0 + r * 2.0))) * step(0.25, r) * smoothstep(1.3, 0.6, r);
          float dust = step(0.988, fract(sin(dot(floor(p*36.0), vec2(12.9898,78.233))) * 43758.5453));
          vec3 col = vec3(0.003, 0.005, 0.014) + uC1 * (ring * 0.22 + spokes * 0.16) + uC2 * dust * 0.35;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(460, 460), mat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -23, -90); floor.visible = false;
    return floor;
  }
  makeRuins() {
    const group = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0x070b18, metalness: 0.8, roughness: 0.55, emissive: 0x07112e });
    const line = new THREE.LineBasicMaterial({ color: 0x6f8cff, transparent: true, opacity: 0.78 });
    // broken orbital rings
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.TorusGeometry(18 + i * 6, 0.7 + i * 0.15, 6, 80, Math.PI * 1.3);
      const ring = new THREE.Mesh(geo, body);
      ring.rotation.x = -Math.PI / 2; ring.rotation.z = i * 0.7;
      ring.position.set(0, -4 - i * 3, -30 - i * 14);
      group.add(ring);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), line);
      edge.rotation.copy(ring.rotation); edge.position.copy(ring.position); group.add(edge);
    }
    // a broken gate gives the district an immediately readable silhouette
    const gate = (z, sx = 1) => {
      const mk = (geo, x, y, rz = 0) => {
        const m = new THREE.Mesh(geo, body); m.position.set(x, y, z); m.rotation.z = rz; group.add(m);
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), line); e.position.copy(m.position); e.rotation.copy(m.rotation); group.add(e);
      };
      mk(new THREE.BoxGeometry(1.6, 13, 1.6), -5 * sx, -2.5);
      mk(new THREE.BoxGeometry(1.6, 10, 1.6), 5 * sx, -4);
      mk(new THREE.BoxGeometry(10.5, 1.2, 1.6), 0, 3.4, 0.03);
      mk(new THREE.BoxGeometry(4.0, 1.2, 1.6), -5.8, 3.8, -0.12);
    };
    gate(-27, 1); gate(-52, 1.25);
    // framed broken columns just outside the playable lane
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const h = 8 + Math.random() * 5, geo = new THREE.BoxGeometry(1.5, h, 1.5);
        const m = new THREE.Mesh(geo, body);
        m.position.set(side * (7.4 + i * 1.1), -1.5 - i * 0.8, -16 - i * 7);
        m.rotation.z = (Math.random() - 0.5) * 0.18; group.add(m);
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), line); e.position.copy(m.position); e.rotation.copy(m.rotation); group.add(e);
      }
    }
    // broken monoliths silhouetted at the edges
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const w = 1.4 + Math.random() * 3.2, h = 10 + Math.random() * 26, d = 1.4 + Math.random() * 3.5;
      const geo = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Mesh(geo, body);
      m.position.set(side * (9 + Math.random() * 15), -9 - Math.random() * 3, -28 - Math.random() * 70);
      m.rotation.z = (Math.random() - 0.5) * 0.35; group.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), line); e.position.copy(m.position); e.rotation.copy(m.rotation); group.add(e);
    }
    group.visible = false;
    return group;
  }
  setDistrict(mode) {
    const next = mode === 'ruins' ? 'ruins' : 'city';
    if (next === this.mode) return next;
    this.mode = next;
    const ruins = next === 'ruins';
    this.city.visible = !ruins; this.towers.visible = !ruins; this.haze.visible = !ruins; this.ruins.visible = ruins; this.ruinFloor.visible = ruins;
    this.streaks.material.color.setHex(ruins ? 0x8f9dff : 0x8fdcff);
    this.scene.fog.density = ruins ? 0.0032 : 0.009;
    return next;
  }
  newTower(i, initial) {
    const side = i % 2 ? 1 : -1;
    const x = side * (13 + Math.random() * 26), w = 2.5 + Math.random() * 5, d = 2.5 + Math.random() * 5;
    const h = 20 + Math.random() * 40; const top = -9 - Math.random() * 16;
    const z = initial ? -150 + Math.random() * 170 : -150 - Math.random() * 20;
    return { x, w, d, h, top, z };
  }
  update(dt, t, speed = 1) {
    const v = 14 * speed; this.scroll += v * dt * 0.6; this.uScroll.value = this.scroll;
    for (let i = 0; i < this.towerCount; i++) {
      const T = this.towerData[i]; T.z += v * dt;
      if (T.z > 25) this.towerData[i] = this.newTower(i, false);
      const Q = this.towerData[i];
      this.p.set(Q.x, Q.top - Q.h / 2, Q.z); this.s.set(Q.w, Q.h, Q.d); this.m.compose(this.p, this.q, this.s); this.towers.setMatrixAt(i, this.m);
    }
    this.towers.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.streakN; i++) {
      const S = this.streakData[i]; S.z += S.v * speed * dt; if (S.z > 15) { S.z = -120; S.x = (Math.random() * 2 - 1) * 26; }
      this.p.set(S.x, S.y, S.z); this.s.set(1, 1, 0.6 + speed * 0.4); this.m.compose(this.p, this.q, this.s); this.streaks.setMatrixAt(i, this.m);
    }
    this.streaks.instanceMatrix.needsUpdate = true;
    if (this.ruins.visible) this.ruins.rotation.y = t * 0.008;
    this.rim.color.copy(U.uC2.value);
    this.scene.fog.color.copy(U.uFogColor.value);
  }
}
