/**
 * High-Precision Round Countdown Timer
 *
 * Uses `performance.now()` + `requestAnimationFrame`.
 * Freezes `elapsedMs` immediately upon submission so Kev AI inference time
 * never penalizes the player's answer speed or depth!
 */

export class RoundTimer {
  constructor() {
    this.durationMs = 25000;
    this.startTime = 0;
    this.frozenElapsedMs = null;
    this.rafId = null;
    this.running = false;
    this.onTick = null;
    this.onTimeout = null;
  }

  start(durationSec, { onTick, onTimeout } = {}) {
    this.stop();
    this.durationMs = Math.max(1000, Number(durationSec) * 1000);
    this.startTime = performance.now();
    this.frozenElapsedMs = null;
    this.running = true;
    this.onTick = onTick || null;
    this.onTimeout = onTimeout || null;

    const loop = (now) => {
      if (!this.running) return;
      const elapsedMs = Math.max(0, now - this.startTime);
      const remainingMs = Math.max(0, this.durationMs - elapsedMs);
      const ratioRemaining = remainingMs / this.durationMs;

      if (typeof this.onTick === 'function') {
        this.onTick({
          elapsedMs: Math.min(elapsedMs, this.durationMs),
          remainingMs,
          ratioRemaining,
          durationMs: this.durationMs,
        });
      }

      if (remainingMs <= 0) {
        this.frozenElapsedMs = this.durationMs;
        this.running = false;
        if (typeof this.onTimeout === 'function') {
          this.onTimeout();
        }
        return;
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  freeze() {
    if (this.running) {
      this.frozenElapsedMs = Math.min(
        this.durationMs,
        Math.max(0, performance.now() - this.startTime)
      );
      this.stop();
    }
    return this.frozenElapsedMs ?? this.durationMs;
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
