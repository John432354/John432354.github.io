/**
 * Top Suite Navigation & Telemetry HUD Bar
 */

import { getZoneForDepth } from '../config/ocean-zones.js';
import { escapeHtml, formatMeters } from './dom-helpers.js';

export class HudView {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.currentDepth = 0;
    this.activeRoute = 'lobby';
    this.kevStatus = { state: 'idle', progress: 0, message: 'Kev-0.6B standby' };
    this.soundEnabled = true;
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="hud-bar">
        <div class="hud-left-group">
          <button class="hud-brand" id="hud-home-btn" type="button" title="Return to Suite Hub">
            <span class="hud-brand-mark">🦐</span>
            <span class="hud-brand-text">
              <strong>VOCAB SUITE</strong>
              <small>KRILLION · WORDLE</small>
            </span>
          </button>

          <nav class="hud-nav-links" aria-label="Suite Navigation">
            <button class="hud-nav-btn active" id="nav-hub-btn" type="button">Suite Hub</button>
            <button class="hud-nav-btn" id="nav-spec-btn" type="button">📖 Creator Spec</button>
          </nav>
        </div>

        <div class="hud-depth-cluster" id="hud-depth-cluster" aria-live="polite">
          <div class="hud-depth-readout">
            <span class="hud-label">DEPTH</span>
            <strong class="hud-depth-value" id="hud-depth-val">0 m</strong>
          </div>
          <span class="hud-zone-pill" id="hud-zone-pill">Sunlight Zone</span>
        </div>

        <div class="hud-actions">
          <button class="hud-kev-pill" id="hud-kev-btn" type="button" title="Open Kev-0.6B Classifier Console">
            <span class="kev-dot" id="hud-kev-dot"></span>
            <span class="kev-pill-label" id="hud-kev-text">Kev-0.6B Standby</span>
          </button>

          <button class="hud-btn" id="hud-zip-btn" type="button" title="Upload Subject .zip or Manage Subjects">
            <span>📦</span>
            <span class="hide-xs">Upload .zip / Lab</span>
          </button>

          <button class="hud-btn icon-only" id="hud-sound-btn" type="button" title="Toggle Audio">
            <span id="hud-sound-icon">🔊</span>
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#hud-home-btn')?.addEventListener('click', () => {
      this.callbacks.onNavigateHome?.();
    });
    this.container.querySelector('#nav-hub-btn')?.addEventListener('click', () => {
      this.callbacks.onNavigateHome?.();
    });
    this.container.querySelector('#nav-spec-btn')?.addEventListener('click', () => {
      this.callbacks.onNavigateSpec?.();
    });
    this.container.querySelector('#hud-kev-btn')?.addEventListener('click', () => {
      this.callbacks.onOpenAiModal?.();
    });
    this.container.querySelector('#hud-zip-btn')?.addEventListener('click', () => {
      this.callbacks.onOpenSubjectModal?.('import');
    });
    this.container.querySelector('#hud-sound-btn')?.addEventListener('click', () => {
      this.callbacks.onToggleSound?.();
    });
  }

  setActiveRoute(route) {
    this.activeRoute = route;
    const hubBtn = this.container.querySelector('#nav-hub-btn');
    const specBtn = this.container.querySelector('#nav-spec-btn');
    hubBtn?.classList.toggle('active', route !== 'spec');
    specBtn?.classList.toggle('active', route === 'spec');
  }

  updateDepth(meters) {
    this.currentDepth = Math.max(0, Number(meters) || 0);
    const zone = getZoneForDepth(this.currentDepth);
    const valEl = this.container.querySelector('#hud-depth-val');
    const zoneEl = this.container.querySelector('#hud-zone-pill');
    if (valEl) valEl.textContent = formatMeters(this.currentDepth);
    if (zoneEl) {
      zoneEl.textContent = zone.name;
      zoneEl.style.borderColor = `${zone.accent}66`;
      zoneEl.style.color = zone.accent;
    }
  }

  updateKevStatus(status) {
    this.kevStatus = status;
    const dot = this.container.querySelector('#hud-kev-dot');
    const txt = this.container.querySelector('#hud-kev-text');
    if (!dot || !txt) return;

    dot.className = `kev-dot state-${escapeHtml(status.state || 'idle')}`;
    if (status.state === 'loading') {
      const pct = Math.round((status.progress || 0) * 100);
      txt.textContent = `Kev-0.6B · ${pct}%`;
    } else if (status.state === 'ready') {
      const dev = String(status.device || 'wasm').toUpperCase();
      txt.textContent = `Kev-0.6B · ${dev}`;
    } else if (status.state === 'error') {
      txt.textContent = 'Kev-0.6B · Setup';
    } else {
      txt.textContent = status.isCached ? 'Kev-0.6B · Cached' : 'Kev-0.6B · AI';
    }
  }

  updateSound(enabled) {
    this.soundEnabled = Boolean(enabled);
    const icon = this.container.querySelector('#hud-sound-icon');
    if (icon) icon.textContent = this.soundEnabled ? '🔊' : '🔇';
  }
}
