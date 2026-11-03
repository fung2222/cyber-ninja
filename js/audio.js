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
  shot() { if (++this._shot % 2) return; this.osc({ type: 'square', f: 1800, f2: 900, dur: 0.035, vol: 0.018, lp: 5000 }); }
  hit() { this.osc({ type: 'triangle', f: 700, f2: 400, dur: 0.04, vol: 0.03 }); }
  gem() { this.osc({ type: 'sine', f: 1480, f2: 2100, dur: 0.07, vol: 0.018, send: 0.25 }); }
  boom(big = false) {
    this.noiseHit({ dur: big ? 0.7 : 0.28, vol: big ? 0.22 : 0.1, type: 'lowpass', f: big ? 2400 : 1800, f2: 120, q: 0.8, a: 0.003 });
    this.osc({ type: 'sine', f: big ? 140 : 180, f2: 40, dur: big ? 0.6 : 0.22, vol: big ? 0.3 : 0.14 });
  }
  hurt() { this.osc({ type: 'sawtooth', f: 300, f2: 70, dur: 0.35, vol: 0.12, lp: 1600 }); this.noiseHit({ dur: 0.3, vol: 0.12, type: 'bandpass', f: 900, f2: 200, q: 1 }); }
  pickup() { [0, 7, 12].forEach((n, i) => this.osc({ type: 'square', f: mtof(76 + n), t: i * 0.05, dur: 0.08, vol: 0.05, lp: 4000, send: 0.3 })); }
  ult() { this.noiseHit({ dur: 0.9, vol: 0.18, type: 'bandpass', f: 400, f2: 6000, q: 1.2, a: 0.08 }); this.osc({ type: 'sawtooth', f: 80, f2: 900, dur: 0.6, vol: 0.12, lp: 3000, send: 0.4 }); this.osc({ type: 'sine', f: 60, f2: 30, t: 0.5, dur: 0.6, vol: 0.35 }); }
  ready() { this.osc({ type: 'sine', f: mtof(84), dur: 0.15, vol: 0.06, send: 0.4 }); this.osc({ type: 'sine', f: mtof(91), t: 0.1, dur: 0.25, vol: 0.06, send: 0.4 }); }
  warn() { for (let i = 0; i < 3; i++) this.osc({ type: 'square', f: 440, f2: 330, t: i * 0.45, dur: 0.3, vol: 0.06, lp: 2000 }); }
  enemyShot() { this.osc({ type: 'sine', f: 520, f2: 260, dur: 0.07, vol: 0.02 }); }
}
