// XENO NIGHTMARE sounds — punchy synth SFX + 'drive' synthwave music (all generated in code).
import { SynthAudio, mtof } from 'cyber-kit/audio/synth.js';
export class NinjaAudio extends SynthAudio {
  constructor(store) {
    super({ store, music: 'drive', sfxTrimDb: -4.5 });
    // Roy's audio rule: the BGM must not carry a continuous noise bed.
    // Keep the drive preset's tonal kick/bass/pad/arp, but drop noise hats.
    this.preset = { ...this.preset, hats: false, bpm: 112, bpmMax: 168, bpmPerLevel: 5, pad: 0.026 };
    this._shot = 0;
    this.bossMode = false;
  }
  setBoss(on) { this.bossMode = !!on; }
  // The base drive preset adds a noise snare at steps 4/12 and noise hats.
  // Suppress only noise during the music step; SFX keep their transients.
  playStep(step, time, s16) {
    const n = this.noiseHit;
    this.noiseHit = () => {};
    try { super.playStep(step, time, s16); } finally { this.noiseHit = n; }
    // Boss layer: a tonal counter-line, never noise. It makes the last third of
    // every fifth wave feel like a different track without breaking the no-hiss rule.
    if (this.bossMode && this.ctx) {
      const t = time - this.ctx.currentTime; if (t < -0.01) return;
      const bar = Math.floor(step / 16) % 4, s = step % 16;
      if (s % 2 === 0) {
        const root = this.preset.roots[bar], chord = this.preset.chords[bar];
        const iv = chord[(s / 2) % chord.length] + 12;
        this.osc({ type: 'square', f: mtof(root + 36 + iv), t, dur: s16 * 1.4, vol: 0.026, lp: 4200, q: 2, out: this.musicFilter, send: 0.2 });
      }
      if (s === 0 || s === 6 || s === 10) this.osc({ type: 'sawtooth', f: mtof(this.preset.roots[bar] - 24), t, dur: s16 * 1.6, vol: 0.055, lp: 380, q: 4, out: this.musicFilter });
    }
  }
  shot(kind = 'pulse') {
    this._shot++;
    const v = 0.94 + Math.random() * 0.12;   // per-shot pitch variance: the auto-fire never sounds static
    if (kind === 'pulse') {
      if (this._shot % 2) return;
      this.osc({ type: 'square', f: 1800 * v, f2: 900 * v, dur: 0.035, vol: 0.018, lp: 5000 });
    } else if (kind === 'lance') {
      if (this._shot % 2) return;
      this.osc({ type: 'sawtooth', f: 880 * v, f2: 280 * v, dur: 0.055, vol: 0.022, lp: 3000 });
    } else {
      if (this._shot % 3) return;
      this.osc({ type: 'sine', f: 190 * v, f2: 70 * v, dur: 0.11, vol: 0.045 });
      this.osc({ type: 'triangle', f: 620 * v, f2: 240 * v, dur: 0.035, vol: 0.012, lp: 1800 });
    }
  }
  hit() { const v = 0.92 + Math.random() * 0.16; this.osc({ type: 'triangle', f: 700 * v, f2: 400 * v, dur: 0.04, vol: 0.03 }); }
  gem(chain = 0) { const base = 1480 * Math.pow(1.059, Math.min(12, chain)); this.osc({ type: 'sine', f: base, f2: base * 1.42, dur: 0.07, vol: 0.018, send: 0.25 }); }
  // combo milestone: short rising arp, one blip per multiplier step
  combo(mult = 2) {
    const n = Math.min(8, mult);
    for (let i = 0; i < Math.min(4, n); i++) this.osc({ type: 'square', f: mtof(76 + i * 5), t: i * 0.04, dur: 0.06, vol: 0.032, lp: 5200, send: 0.3 });
  }
  comboLost() { this.osc({ type: 'sawtooth', f: 320, f2: 140, dur: 0.12, vol: 0.03, lp: 1400 }); }
  shieldUp() { [0, 5, 12].forEach((n, i) => this.osc({ type: 'sine', f: mtof(81 + n), t: i * 0.06, dur: 0.14, vol: 0.04, send: 0.35 })); }
  select() { this.osc({ type: 'square', f: mtof(81), dur: 0.05, vol: 0.04, lp: 4200 }); this.osc({ type: 'square', f: mtof(88), t: 0.06, dur: 0.09, vol: 0.04, lp: 4200, send: 0.25 }); }
  heartbeat() { this.osc({ type: 'sine', f: 68, f2: 40, dur: 0.14, vol: 0.1 }); this.osc({ type: 'sine', f: 60, f2: 36, t: 0.18, dur: 0.12, vol: 0.08 }); }
  boom(big = false) {
    this.noiseHit({ dur: big ? 0.7 : 0.28, vol: big ? 0.22 : 0.1, type: 'lowpass', f: big ? 2400 : 1800, f2: 120, q: 0.8, a: 0.003 });
    this.osc({ type: 'sine', f: big ? 140 : 180, f2: 40, dur: big ? 0.6 : 0.22, vol: big ? 0.3 : 0.14 });
  }
  hurt() { this.osc({ type: 'sawtooth', f: 300, f2: 70, dur: 0.35, vol: 0.12, lp: 1600 }); this.noiseHit({ dur: 0.3, vol: 0.12, type: 'bandpass', f: 900, f2: 200, q: 1 }); }
  pickup() { [0, 7, 12].forEach((n, i) => this.osc({ type: 'square', f: mtof(76 + n), t: i * 0.05, dur: 0.08, vol: 0.05, lp: 4000, send: 0.3 })); }
  ult(kind = 'pulse') {
    if (kind === 'lance') {
      this.osc({ type: 'sawtooth', f: 140, f2: 1600, dur: 0.7, vol: 0.14, lp: 4200, send: 0.4 });
      this.osc({ type: 'sine', f: 1200, f2: 2200, dur: 0.45, vol: 0.06, send: 0.5 });
      return;
    }
    if (kind === 'nova') {
      this.noiseHit({ dur: 0.7, vol: 0.12, type: 'lowpass', f: 1800, f2: 100, a: 0.01 });
      this.osc({ type: 'sine', f: 70, f2: 26, dur: 0.9, vol: 0.34 });
      this.osc({ type: 'triangle', f: 260, f2: 60, dur: 0.45, vol: 0.12 });
      return;
    }
    this.noiseHit({ dur: 0.9, vol: 0.18, type: 'bandpass', f: 400, f2: 6000, q: 1.2, a: 0.08 });
    this.osc({ type: 'sawtooth', f: 80, f2: 900, dur: 0.6, vol: 0.12, lp: 3000, send: 0.4 });
    this.osc({ type: 'sine', f: 60, f2: 30, t: 0.5, dur: 0.6, vol: 0.35 });
  }
  ready() { this.osc({ type: 'sine', f: mtof(84), dur: 0.15, vol: 0.06, send: 0.4 }); this.osc({ type: 'sine', f: mtof(91), t: 0.1, dur: 0.25, vol: 0.06, send: 0.4 }); }
  warn() { for (let i = 0; i < 3; i++) this.osc({ type: 'square', f: 440, f2: 330, t: i * 0.45, dur: 0.3, vol: 0.06, lp: 2000 }); }
  enemyShot() { this.osc({ type: 'sine', f: 520, f2: 260, dur: 0.07, vol: 0.02 }); }
}
