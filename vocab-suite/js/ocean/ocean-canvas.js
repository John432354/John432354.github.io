/**
 * 60fps Deep-Ocean Canvas Controller
 *
 * Smoothly animates depth camera descent, sea creatures, marine snow,
 * companion sprite, and 3-pass Kev sonar rings.
 */

import { drawOceanBackdrop } from './ocean-backdrop.js';
import { OceanCreatureField } from './ocean-creatures.js';
import { OceanParticleSystem } from './ocean-particles.js';
import { drawCompanionAndSonar } from './submarine-sprite.js';

export class OceanSceneRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.creatures = new OceanCreatureField(15);
    this.particles = new OceanParticleSystem();

    this.displayedDepth = 0;
    this.targetDepth = 0;
    this.companion = 'krill';
    this.isJudging = false;
    this.completedPasses = 0;
    this.pendingBurstTier = null;

    this.lastTimestamp = performance.now();
    this.rafId = null;
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  handleResize() {
    if (!this.canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = width;
    this.height = height;
  }

  setTargetDepth(meters, tier = null) {
    this.targetDepth = Math.max(0, Number(meters) || 0);
    if (this.reducedMotion) {
      this.displayedDepth = this.targetDepth;
    } else if (tier && tier.points > 0) {
      this.pendingBurstTier = tier;
    }
  }

  setCompanion(companion) {
    this.companion = companion || 'krill';
  }

  setSonarState({ isJudging = false, completedPasses = 0 }) {
    this.isJudging = Boolean(isJudging);
    this.completedPasses = Number(completedPasses) || 0;
  }

  start() {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTimestamp) / 1000));
      this.lastTimestamp = now;
      this.renderFrame(now / 1000, dt);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  renderFrame(timeSec, dt) {
    const { ctx, width, height } = this;
    if (!ctx || !width || !height) return;

    const diff = this.targetDepth - this.displayedDepth;
    let velocityMps = 0;

    if (Math.abs(diff) > 0.35 && !this.reducedMotion) {
      const step = diff * Math.min(1, dt * 3.4);
      this.displayedDepth += step;
      velocityMps = Math.max(0, step / dt);
    } else {
      this.displayedDepth = this.targetDepth;
    }

    const subX = width < 760 ? width * 0.5 : Math.min(width * 0.22, 230);
    const subY = width < 760 ? 112 : height * 0.34;

    if (this.pendingBurstTier) {
      this.particles.spawnTierBurst(subX, subY, this.pendingBurstTier);
      this.pendingBurstTier = null;
    }

    drawOceanBackdrop(ctx, width, height, this.displayedDepth, timeSec);
    this.creatures.draw(ctx, width, height, this.displayedDepth, timeSec);
    this.particles.updateAndDraw(ctx, width, height, dt, velocityMps, this.reducedMotion);

    drawCompanionAndSonar(ctx, {
      x: subX,
      y: subY,
      timeSec,
      companion: this.companion,
      velocityMps,
      isJudging: this.isJudging,
      completedPasses: this.completedPasses,
    });
  }
}
