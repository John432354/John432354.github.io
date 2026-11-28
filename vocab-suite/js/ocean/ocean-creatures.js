/**
 * Ambient Pelagic Sea Life Renderer (Jellyfish, Squid, Anglerfish, Comb Jellies)
 */

export class OceanCreatureField {
  constructor(count = 14) {
    this.creatures = Array.from({ length: count }, (_, idx) => ({
      seed: idx * 17.31,
      xFrac: (idx * 0.6180339) % 1,
      worldDepthM: 80 + idx * 510 + (idx % 3) * 110,
      speed: (idx % 2 === 0 ? 1 : -1) * (8 + (idx % 4) * 4),
      kind: idx % 4, // 0: jelly, 1: fish/squid, 2: angler, 3: comb jelly
    }));
  }

  draw(ctx, width, height, currentDepth, timeSec) {
    const pxPerMeter = 2.2;
    const anchorY = height * 0.34;

    ctx.save();
    for (const c of this.creatures) {
      // Wrap creature depth around camera window so ocean always feels alive
      const span = 1800;
      let relDepth = ((c.worldDepthM - currentDepth) % span + span) % span - span * 0.45;
      const screenY = anchorY + relDepth * pxPerMeter;
      if (screenY < -60 || screenY > height + 60) continue;

      const driftX = ((c.xFrac * width + timeSec * c.speed) % (width + 120) + (width + 120)) % (width + 120) - 60;
      const bobY = screenY + Math.sin(timeSec * 1.6 + c.seed) * 7;

      const effectiveDepth = Math.max(0, currentDepth + relDepth);
      if (effectiveDepth < 900) {
        this.drawJellyfish(ctx, driftX, bobY, timeSec + c.seed);
      } else if (effectiveDepth < 3600) {
        this.drawBiolumSquid(ctx, driftX, bobY, timeSec + c.seed, c.speed > 0);
      } else {
        this.drawAnglerGlow(ctx, driftX, bobY, timeSec + c.seed, c.speed > 0);
      }
    }
    ctx.restore();
  }

  drawJellyfish(ctx, x, y, t) {
    const pulse = 1 + Math.sin(t * 3.1) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(94, 234, 255, 0.16)';
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 11 * pulse, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 3.2, 0);
      ctx.quadraticCurveTo(
        i * 3.8 + Math.sin(t * 3 + i) * 3,
        9,
        i * 3.0 + Math.cos(t * 2.5 + i) * 3,
        18
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBiolumSquid(ctx, x, y, t, facingRight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facingRight ? 1 : -1, 1);
    ctx.fillStyle = 'rgba(129, 140, 248, 0.2)';
    ctx.strokeStyle = 'rgba(165, 180, 252, 0.38)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing photophores
    ctx.fillStyle = 'rgba(56, 242, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(4, -1, 1.5, 0, Math.PI * 2);
    ctx.arc(-2, 1, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Trailing tentacles
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-12, i * 2);
      ctx.lineTo(-21 - Math.sin(t * 4 + i) * 3, i * 3.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawAnglerGlow(ctx, x, y, t, facingRight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facingRight ? 1 : -1, 1);

    ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bioluminescent esca lure
    const lureX = 15;
    const lureY = -7 + Math.sin(t * 2.8) * 2.5;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.beginPath();
    ctx.moveTo(4, -4);
    ctx.quadraticCurveTo(11, -12, lureX, lureY);
    ctx.stroke();

    const glow = ctx.createRadialGradient(lureX, lureY, 0.5, lureX, lureY, 11);
    glow.addColorStop(0, 'rgba(255, 224, 102, 0.9)');
    glow.addColorStop(1, 'rgba(255, 224, 102, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lureX, lureY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
