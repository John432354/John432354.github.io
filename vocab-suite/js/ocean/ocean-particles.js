/**
 * Marine Snow, Bubbles, Descent Rush Lines & Tier Starburst Particles
 */

export class OceanParticleSystem {
  constructor() {
    this.snow = Array.from({ length: 58 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.7 + Math.random() * 1.7,
      alpha: 0.14 + Math.random() * 0.36,
      drift: (Math.random() - 0.5) * 12,
    }));
    this.bursts = [];
  }

  spawnTierBurst(x, y, tier) {
    if (!tier || tier.points <= 0) return;
    const count = 14 + tier.stars * 4;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 45 + Math.random() * 155;
      this.bursts.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.75 + Math.random() * 0.55,
        size: 1.8 + Math.random() * 2.8,
        color: tier.color || '#38f2ff',
        isStar: i < tier.stars,
      });
    }
  }

  updateAndDraw(ctx, width, height, dt, depthVelocityMps, reducedMotion = false) {
    if (reducedMotion) return;

    // 1. Marine snow scrolling upward as depth increases
    ctx.save();
    for (const p of this.snow) {
      p.y -= (depthVelocityMps * 2.2 + 8) * dt / Math.max(1, height);
      p.x += (p.drift * dt) / Math.max(1, width);
      if (p.y < 0) p.y += 1;
      if (p.y > 1) p.y -= 1;
      if (p.x < 0) p.x += 1;
      if (p.x > 1) p.x -= 1;

      const px = p.x * width;
      const py = p.y * height;

      if (depthVelocityMps > 90) {
        // Rush streak lines during fast descent
        const streakLen = Math.min(44, depthVelocityMps * 0.06);
        ctx.strokeStyle = `rgba(125, 249, 255, ${p.alpha * 0.75})`;
        ctx.lineWidth = p.r * 0.85;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + streakLen);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(203, 245, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Active celebration bursts
    for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
      const b = this.bursts[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.96;
      b.vy *= 0.96;
      b.life -= b.decay * dt;
      if (b.life <= 0) {
        this.bursts.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = Math.max(0, b.life);
      ctx.fillStyle = b.color;
      if (b.isStar) {
        drawFourPointStar(ctx, b.x, b.y, b.size * 2.4);
      } else {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function drawFourPointStar(ctx, cx, cy, radius) {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.35;
    const angle = (i * Math.PI) / 4;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
