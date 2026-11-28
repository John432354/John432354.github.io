/**
 * Bioluminescent Krill & Deep-Sea Research Submersible Companion Renderer
 *
 * Includes expanding 3-ring Kev Classifier Sonar waves when judging answers.
 */

export function drawCompanionAndSonar(ctx, {
  x,
  y,
  timeSec,
  companion = 'krill',
  velocityMps = 0,
  isJudging = false,
  completedPasses = 0,
}) {
  ctx.save();
  ctx.translate(x, y);

  // Kev 3-Pass Sonar Pulse Rings
  if (isJudging) {
    for (let ring = 0; ring < 3; ring += 1) {
      const phase = (timeSec * 1.45 + ring * 0.33) % 1;
      const radius = 18 + phase * 82;
      const alpha = (1 - phase) * 0.48;
      const lit = ring < completedPasses;
      ctx.strokeStyle = lit
        ? `rgba(52, 245, 166, ${alpha * 1.3})`
        : `rgba(56, 242, 255, ${alpha})`;
      ctx.lineWidth = lit ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Slight pitch downward during descent
  const diveTilt = Math.min(0.42, velocityMps * 0.0012);
  const idleBob = Math.sin(timeSec * 2.6) * 3.5;
  ctx.translate(0, idleBob);
  ctx.rotate(diveTilt);

  if (companion === 'submersible') {
    drawSubmersible(ctx, timeSec);
  } else {
    drawBioluminescentKrill(ctx, timeSec);
  }

  ctx.restore();
}

function drawBioluminescentKrill(ctx, t) {
  // Soft cyan bioluminescence aura
  const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
  aura.addColorStop(0, 'rgba(56, 242, 255, 0.30)');
  aura.addColorStop(1, 'rgba(56, 242, 255, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();

  // Segmented translucent shrimp/krill carapace
  ctx.fillStyle = 'rgba(255, 138, 128, 0.88)';
  ctx.strokeStyle = '#7df9ff';
  ctx.lineWidth = 1.4;

  // Tail fan
  ctx.beginPath();
  ctx.moveTo(-18, 2);
  ctx.lineTo(-27, -4);
  ctx.lineTo(-25, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Abdomen segments + cephalothorax
  ctx.beginPath();
  ctx.ellipse(-8, 0, 11, 5.5, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 164, 142, 0.94)';
  ctx.beginPath();
  ctx.ellipse(6, -1, 11, 6.8, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Glowing photophore dots along belly
  ctx.fillStyle = '#38f2ff';
  for (let i = -12; i <= 8; i += 5) {
    ctx.beginPath();
    ctx.arc(i, 3, 1.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Swimming pleopods (legs)
  ctx.strokeStyle = 'rgba(255, 198, 185, 0.8)';
  ctx.lineWidth = 1.2;
  for (let i = -11; i <= 4; i += 3.8) {
    const swing = Math.sin(t * 14 + i) * 3.5;
    ctx.beginPath();
    ctx.moveTo(i, 5);
    ctx.lineTo(i - 2 + swing, 11);
    ctx.stroke();
  }

  // Long sweeping antennae
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.75)';
  ctx.beginPath();
  ctx.moveTo(16, -2);
  ctx.quadraticCurveTo(28, -9 + Math.sin(t * 4) * 2, 37, -4 + Math.cos(t * 3) * 3);
  ctx.moveTo(16, 0);
  ctx.quadraticCurveTo(27, 4 + Math.cos(t * 4) * 2, 35, 7);
  ctx.stroke();

  // Eye
  ctx.fillStyle = '#041224';
  ctx.beginPath();
  ctx.arc(13, -3, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(13.7, -3.6, 0.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawSubmersible(ctx, t) {
  // Headlight beam
  const beam = ctx.createLinearGradient(16, 0, 92, 18);
  beam.addColorStop(0, 'rgba(255, 240, 150, 0.28)');
  beam.addColorStop(1, 'rgba(255, 240, 150, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(18, -3);
  ctx.lineTo(95, -22);
  ctx.lineTo(95, 26);
  ctx.lineTo(18, 5);
  ctx.closePath();
  ctx.fill();

  // Conning tower
  ctx.fillStyle = '#eab308';
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-5, -16, 12, 9, 3);
  ctx.fill();
  ctx.stroke();

  // Hull
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Viewport porthole
  ctx.fillStyle = '#38f2ff';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(9, -1, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Spinning stern propeller
  const bladeH = 2 + Math.abs(Math.sin(t * 22)) * 6;
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-26, -bladeH, 3.5, bladeH * 2);
}
