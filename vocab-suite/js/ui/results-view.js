/**
 * Post-Dive Bathymetric Logbook & SVG Descent Profile View
 */

import { getZoneForDepth } from '../config/ocean-zones.js';
import {
  escapeHtml,
  formatMeters,
  formatPercent,
  formatSeconds,
} from './dom-helpers.js';

export class DiveResultsView {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
  }

  render(session) {
    if (!session) return;
    const rounds = session.completedRounds || [];
    const maxPossibleMeters = rounds.length * 1000;
    const finalZone = getZoneForDepth(session.totalDepthMeters);
    const validRounds = rounds.filter((r) => r.isValid);
    const avgSpeedMs =
      validRounds.length > 0
        ? validRounds.reduce((acc, r) => acc + r.elapsedMs, 0) / validRounds.length
        : 0;

    this.container.innerHTML = `
      <section class="results-shell">
        <div class="results-hero glass-card">
          <div class="results-summary-top">
            <div>
              <span class="eyebrow-badge">DIVE COMPLETE · BATHYMETRIC LOGBOOK</span>
              <h1 style="color: ${finalZone.accent}">${formatMeters(session.totalDepthMeters)}</h1>
              <p class="zone-reached">
                Reached <strong>${escapeHtml(finalZone.name)}</strong> (${escapeHtml(finalZone.scientific)})
                · ${escapeHtml(finalZone.description)}
              </p>
            </div>
            <div class="results-kpis">
              <div class="kpi-chip">
                <span>SCORE</span>
                <strong>${session.totalPoints} / ${rounds.length * 100} pts</strong>
              </div>
              <div class="kpi-chip">
                <span>KEV VERIFIED</span>
                <strong>${validRounds.length} / ${rounds.length} rounds</strong>
              </div>
              <div class="kpi-chip">
                <span>AVG ANSWER SPEED</span>
                <strong>${validRounds.length > 0 ? formatSeconds(avgSpeedMs) : '—'}</strong>
              </div>
            </div>
          </div>

          <div class="dive-chart-box">
            ${this.buildBathymetricSvg(rounds, maxPossibleMeters)}
          </div>

          <div class="results-cta-row">
            <button type="button" class="btn btn-primary" id="results-replay-btn">
              🌊 New Random Krillion (Same Topics)
            </button>
            <button type="button" class="btn btn-secondary" id="results-home-btn">
              Return to Suite Hub
            </button>
          </div>
        </div>

        <div class="rounds-audit-list glass-card">
          <h2>Round-by-Round Speed, Stored Answers &amp; 3-Pass Kev Audit</h2>
          <div class="audit-items">
            ${rounds
              .map((r) => {
                const passes = r.verdict?.passes || [];
                return `
                  <details class="audit-row ${r.isValid ? 'valid' : 'invalid'}">
                    <summary>
                      <span class="audit-num">R${r.roundNumber}</span>
                      <span class="audit-term">${escapeHtml(r.term)}</span>
                      <span class="audit-speed">${
                        r.timedOut ? 'Timeout' : r.gaveUp ? 'Gave Up' : formatSeconds(r.elapsedMs)
                      }</span>
                      <span class="audit-tier" style="color:${r.tier.color}">
                        ${escapeHtml(r.tier.name)} (+${formatMeters(r.depthGained)})
                      </span>
                    </summary>
                    <div class="audit-body">
                      <p><strong>Topic:</strong> ${escapeHtml(r.subjectName)}${
                        r.unit ? ` › ${escapeHtml(r.unit)}` : ''
                      } › ${escapeHtml(r.topic || 'General')}</p>
                      <p><strong>Stored Term(s):</strong> ${escapeHtml(r.term)}</p>
                      <p><strong>Stored Definition:</strong> ${escapeHtml(r.definition)}</p>
                      <p><strong>Your Answer:</strong> ${
                        r.userAnswer ? escapeHtml(r.userAnswer) : '<em>(None)</em>'
                      }</p>
                      ${
                        r.explanation
                          ? `<p class="audit-expl"><strong>// Explanation:</strong> ${escapeHtml(
                              r.explanation
                            )}</p>`
                          : ''
                      }
                      ${
                        passes.length > 0
                          ? `<div class="audit-passes">
                              <span>3-Pass Avg: <strong>${formatPercent(
                                r.verdict.averageProbability
                              )}</strong></span>
                              ${passes
                                .map(
                                  (p) =>
                                    `<span>${escapeHtml(p.passLabel)}: <strong>${formatPercent(
                                      p.validProbability
                                    )}</strong></span>`
                                )
                                .join('')}
                            </div>`
                          : ''
                      }
                    </div>
                  </details>
                `;
              })
              .join('')}
          </div>
        </div>
      </section>
    `;

    this.container.querySelector('#results-replay-btn')?.addEventListener('click', () =>
      this.callbacks.onPlayAgain?.()
    );
    this.container.querySelector('#results-home-btn')?.addEventListener('click', () =>
      this.callbacks.onReturnHome?.()
    );
  }

  buildBathymetricSvg(rounds, maxMeters) {
    const w = 680;
    const h = 175;
    const padX = 48;
    const padY = 22;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;
    const maxY = Math.max(1000, maxMeters);

    const points = [{ x: padX, y: padY, depth: 0, color: '#38f2ff', label: '0m' }];
    rounds.forEach((r, idx) => {
      const x = padX + ((idx + 1) / Math.max(1, rounds.length)) * plotW;
      const y = padY + (r.cumulativeDepth / maxY) * plotH;
      points.push({
        x,
        y,
        depth: r.cumulativeDepth,
        color: r.tier.color,
        label: `R${r.roundNumber}`,
      });
    });

    const polyPoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPoints = `${padX},${padY} ${polyPoints} ${points[points.length - 1].x.toFixed(1)},${padY}`;

    return `
      <svg viewBox="0 0 ${w} ${h}" class="bathymetric-svg" role="img" aria-label="Dive Depth Chart">
        <defs>
          <linearGradient id="diveAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38f2ff" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#c084fc" stop-opacity="0.32" />
          </linearGradient>
        </defs>
        <line x1="${padX}" y1="${padY}" x2="${w - padX}" y2="${padY}" stroke="rgba(148,163,184,0.25)" stroke-dasharray="3 3" />
        <line x1="${padX}" y1="${padY + plotH * 0.5}" x2="${w - padX}" y2="${padY + plotH * 0.5}" stroke="rgba(148,163,184,0.16)" stroke-dasharray="3 3" />
        <line x1="${padX}" y1="${padY + plotH}" x2="${w - padX}" y2="${padY + plotH}" stroke="rgba(255,224,102,0.28)" stroke-dasharray="4 4" />
        <text x="6" y="${padY + 4}" fill="#94a3b8" font-size="10">0m</text>
        <text x="6" y="${padY + plotH * 0.5 + 4}" fill="#94a3b8" font-size="10">${Math.round(maxY / 2)}m</text>
        <text x="6" y="${padY + plotH + 4}" fill="#ffe066" font-size="10">${maxY}m</text>

        <polygon points="${areaPoints}" fill="url(#diveAreaGrad)" />
        <polyline points="${polyPoints}" fill="none" stroke="#38f2ff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
        ${points
          .slice(1)
          .map(
            (p) => `
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${p.color}" stroke="#041224" stroke-width="1.8" />
            <text x="${p.x.toFixed(1)}" y="${Math.min(h - 4, p.y + 16).toFixed(1)}" text-anchor="middle" fill="#cbd5e1" font-size="10">${p.label}</text>
          `
          )
          .join('')}
      </svg>
    `;
  }
}
