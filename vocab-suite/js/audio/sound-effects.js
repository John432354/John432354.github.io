/**
 * Synthesized Deep-Ocean Submarine & Sonar Sound Effects
 *
 * Pure procedural WebAudio synthesis — zero external MP3/WAV files needed.
 */

import { AudioEngineContext } from './audio-context.js';

export class OceanSoundEffects {
  constructor(enabled = true) {
    this.audio = new AudioEngineContext(enabled);
  }

  setEnabled(flag) {
    this.audio.setEnabled(flag);
  }

  playTone({ freq = 440, type = 'sine', duration = 0.18, gain = 0.08, delay = 0, slideTo = null }) {
    const ctx = this.audio.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + duration);
    }

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playSonarPing() {
    this.playTone({ freq: 1180, type: 'sine', duration: 0.32, gain: 0.055, slideTo: 1140 });
    this.playTone({ freq: 2360, type: 'sine', duration: 0.16, gain: 0.018, delay: 0.04 });
  }

  playPassTick(passNum = 1, passed = true) {
    const base = passed ? 520 + passNum * 130 : 320 - passNum * 25;
    this.playTone({ freq: base, type: 'triangle', duration: 0.11, gain: 0.045 });
  }

  playDescentReward(tierId) {
    if (tierId === 'one_in_a_krillion') {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((n, idx) => {
        this.playTone({ freq: n, type: 'sine', duration: 0.35, gain: 0.06, delay: idx * 0.065 });
      });
      return;
    }
    const notes = [392.0, 493.88, 587.33, 783.99];
    notes.forEach((n, idx) => {
      this.playTone({ freq: n, type: 'triangle', duration: 0.26, gain: 0.05, delay: idx * 0.06 });
    });
  }

  playNoEcho() {
    this.playTone({ freq: 185, type: 'sawtooth', duration: 0.28, gain: 0.045, slideTo: 95 });
  }

  playDiveComplete() {
    const chord = [261.63, 329.63, 392.0, 523.25];
    chord.forEach((n, idx) => {
      this.playTone({ freq: n, type: 'sine', duration: 0.55, gain: 0.045, delay: idx * 0.08 });
    });
  }
}
