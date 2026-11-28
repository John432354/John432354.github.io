/**
 * Bathymetric Ocean Backdrop, Caustic Sunbeams & Depth Ruler
 */

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpRgb(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

const DEPTH_PALETTE_STOPS = [
  { depth: 0, top: [14, 98, 128], bottom: [9, 60, 92] },
  { depth: 200, top: [10, 62, 95], bottom: [7, 38, 68] },
  { depth: 1000, top: [7, 34, 62], bottom: [4, 18, 38] },
  { depth: 4000, top: [4, 17, 36], bottom: [2, 9, 21] },
  { depth: 6000, top: [3, 10, 24], bottom: [1, 4, 11] },
  { depth: 7000, top: [2, 6, 16], bottom: [1, 2, 7] },
];

function sampleWaterColors(depthMeters) {
  const d = Math.max(0, depthMeters);
  for (let i = 0; i < DEPTH_PALETTE_STOPS.length - 1; i += 1) {
    const a = DEPTH_PALETTE_STOPS[i];
    const b = DEPTH_PALETTE_STOPS[i + 1];
    if (d >= a.depth && d <= b.depth) {
      const t = (d - a.depth) / Math.max(1, b.depth - a.depth);
      return {
        top: lerpRgb(a.top, b.top, t),
        bottom: lerpRgb(a.bottom, b.bottom, t),
      };
    }
  }
  const last = DEPTH_PALETTE_STOPS[DEPTH_PALETTE_STOPS.length - 1];
  return { top: last.top, bottom: last.bottom };
}

export function drawOceanBackdrop(ctx, width, height, currentDepth, timeSec) {
  const { top, bottom } = sampleWaterColors(currentDepth);
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, `rgb(${top[0]}, ${top[1]}, ${top[2]})`);
  grad.addColorStop(1, `rgb(${bottom[0]}, ${bottom[1]}, ${bottom[2]})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Surface sunlight rays (fade out completely by 600m)
  if (currentDepth < 600) {
    const alpha = Math.max(0, 1 - currentDepth / 600) * 0.13;
    ctx.save();
    for (let i = 0; i < 5; i += 1) {
      const xBase = width * (0.15 + i * 0.18) + Math.sin(timeSec * 0.4 + i) * 26;
      const rayGrad = ctx.createLinearGradient(xBase, 0, xBase + 70, height * 0.85);
      rayGrad.addColorStop(0, `rgba(120, 245, 255, ${alpha})`);
      rayGrad.addColorStop(1, 'rgba(120, 245, 255, 0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(xBase - 28, 0);
      ctx.lineTo(xBase + 38, 0);
      ctx.lineTo(xBase + 135, height * 0.85);
      ctx.lineTo(xBase - 75, height * 0.85);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Subtle Hadal trench walls below 4,500m
  if (currentDepth > 4200) {
    const wallAlpha = Math.min(0.45, ((currentDepth - 4200) / 2800) * 0.45);
    ctx.fillStyle = `rgba(6, 14, 28, ${wallAlpha})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let y = 0; y <= height; y += 60) {
      const worldY = currentDepth * 2 + y;
      const jut = 28 + Math.sin(worldY * 0.006) * 18 + Math.cos(worldY * 0.017) * 10;
      ctx.lineTo(jut, y);
    }
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(width, 0);
    for (let y = 0; y <= height; y += 60) {
      const worldY = currentDepth * 2 + y;
      const jut = 28 + Math.cos(worldY * 0.005) * 18 + Math.sin(worldY * 0.015) * 10;
      ctx.lineTo(width - jut, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  // Challenger Deep Ocean Floor near 7,000m
  const pxPerMeter = 2.2;
  const floorScreenY = height * 0.34 + (7000 - currentDepth) * pxPerMeter;
  if (floorScreenY < height + 140) {
    ctx.save();
    const sandGrad = ctx.createLinearGradient(0, floorScreenY - 30, 0, height);
    sandGrad.addColorStop(0, 'rgba(26, 38, 62, 0.92)');
    sandGrad.addColorStop(1, 'rgba(8, 13, 24, 0.98)');
    ctx.fillStyle = sandGrad;
    ctx.beginPath();
    ctx.moveTo(0, floorScreenY);
    for (let x = 0; x <= width; x += 48) {
      const ridge = Math.sin(x * 0.018) * 9 + Math.cos(x * 0.045) * 4;
      ctx.lineTo(x, floorScreenY + ridge);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 224, 102, 0.65)';
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('7,000 m · HADAL TRENCH FLOOR', 22, Math.min(height - 14, floorScreenY + 28));
    ctx.restore();
  }

  // Bathymetric depth tick marks along right margin
  drawDepthScale(ctx, width, height, currentDepth, pxPerMeter);
}

function drawDepthScale(ctx, width, height, currentDepth, pxPerMeter) {
  ctx.save();
  const centerY = height * 0.34;
  const minVisibleM = Math.max(0, Math.floor((currentDepth - centerY / pxPerMeter) / 100) * 100);
  const maxVisibleM = Math.ceil((currentDepth + (height - centerY) / pxPerMeter) / 100) * 100;

  ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'right';

  for (let m = minVisibleM; m <= maxVisibleM; m += 100) {
    const y = centerY + (m - currentDepth) * pxPerMeter;
    if (y < 52 || y > height - 10) continue;
    const isMajor = m % 500 === 0;
    ctx.strokeStyle = isMajor ? 'rgba(56, 242, 255, 0.34)' : 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width - (isMajor ? 18 : 9), y);
    ctx.lineTo(width, y);
    ctx.stroke();

    if (isMajor) {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.fillText(`${m.toLocaleString()}m`, width - 22, y + 3);
    }
  }
  ctx.restore();
}
