/**
 * WebAudio Context Singleton & Mute Controller
 */

export class AudioEngineContext {
  constructor(enabled = true) {
    this.enabled = Boolean(enabled);
    this.ctx = null;
  }

  setEnabled(flag) {
    this.enabled = Boolean(flag);
  }

  getContext() {
    if (!this.enabled) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }
}
