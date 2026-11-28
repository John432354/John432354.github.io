/**
 * Main-Thread Kev Classifier Client
 *
 * Communicates with `kev-worker.js` via structured RPC messages and emits
 * real-time download progress and per-pass (1/3, 2/3, 3/3) sonar events.
 * Automatically falls back to inline execution if Workers are blocked.
 */

export class KevJudgeClient {
  constructor() {
    this.worker = null;
    this.inlineEngine = null;
    this.inlineVerify = null;
    this.reqCounter = 0;
    this.pending = new Map();
    this.statusListeners = new Set();
    this.status = {
      state: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
      progress: 0,
      loaded: 0,
      total: 0,
      device: 'auto',
      dtype: 'auto',
      isCached: false,
      message: 'Kev-0.6B standby',
      error: null,
    };
  }

  onStatusChange(listener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  updateStatus(patch) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.statusListeners) {
      try {
        fn(this.status);
      } catch {
        // ignore listener errors
      }
    }
  }

  ensureWorker() {
    if (this.worker || this.inlineEngine) return;
    try {
      const workerUrl = new URL('./kev-worker.js', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });
      this.worker.addEventListener('message', (e) => this.handleWorkerMessage(e.data));
      this.worker.addEventListener('error', (err) => {
        this.updateStatus({
          state: 'error',
          error: err?.message || 'Worker runtime error',
          message: 'Kev worker error',
        });
      });
    } catch {
      // Fallback for environments where module Workers cannot be spawned
      this.worker = null;
    }
  }

  handleWorkerMessage(msg) {
    if (!msg) return;

    if (msg.type === 'LOAD_PROGRESS') {
      const p = msg.payload || {};
      this.updateStatus({
        state: p.stage === 'ready' ? 'ready' : 'loading',
        progress: p.progress ?? this.status.progress,
        loaded: p.loaded ?? this.status.loaded,
        total: p.total ?? this.status.total,
        message: p.message || this.status.message,
        error: null,
      });
      return;
    }

    if (msg.type === 'PASS_PROGRESS') {
      const entry = this.pending.get(msg.requestId);
      if (entry && typeof entry.onPass === 'function') {
        entry.onPass(msg.payload);
      }
      return;
    }

    if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
      const entry = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.ok) {
        entry.resolve(msg.result);
      } else {
        entry.reject(new Error(msg.error || 'Kev inference error'));
      }
    }
  }

  callWorker(type, payload = {}, onPass = null) {
    this.ensureWorker();
    if (!this.worker) {
      return this.callInlineFallback(type, payload, onPass);
    }

    const id = ++this.reqCounter;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onPass });
      this.worker.postMessage({ id, type, payload });
    });
  }

  async callInlineFallback(type, payload, onPass) {
    if (!this.inlineEngine) {
      const [{ KevBrowserEngine }, { verifyAnswerThreePasses }] = await Promise.all([
        import('./transformers-loader.js'),
        import('./pass-aggregator.js'),
      ]);
      this.inlineEngine = new KevBrowserEngine();
      this.inlineVerify = verifyAnswerThreePasses;
    }

    if (type === 'INSPECT_CACHE') {
      return this.inlineEngine.inspectCache(payload);
    }
    if (type === 'LOAD_MODEL') {
      return this.inlineEngine.load(payload, (p) =>
        this.handleWorkerMessage({ type: 'LOAD_PROGRESS', payload: p })
      );
    }
    if (type === 'JUDGE_ANSWER') {
      return this.inlineVerify(this.inlineEngine, payload, {
        threshold: payload.threshold ?? 0.52,
        temperature: payload.temperature ?? 1.0,
        onPassResult: onPass,
      });
    }
    throw new Error(`Unknown command: ${type}`);
  }

  async checkCache(options = {}) {
    try {
      const info = await this.callWorker('INSPECT_CACHE', options);
      this.updateStatus({
        device: info.device,
        dtype: info.dtype,
        isCached: Boolean(info.isCached),
        message: info.isCached
          ? `Kev-0.6B cached (${info.device.toUpperCase()} · ${info.dtype})`
          : `Kev-0.6B ready to stream (${info.device.toUpperCase()} · ${info.dtype})`,
      });
      return info;
    } catch {
      return null;
    }
  }

  async preloadModel(options = {}) {
    if (this.status.state === 'loading') return null;
    this.updateStatus({
      state: 'loading',
      progress: 0.01,
      error: null,
      message: 'Initializing Kev-0.6B WebGPU/WASM runtime…',
    });

    try {
      const runtime = await this.callWorker('LOAD_MODEL', options);
      this.updateStatus({
        state: 'ready',
        progress: 1,
        device: runtime.device,
        dtype: runtime.dtype,
        isCached: true,
        error: null,
        message: `Kev-0.6B active · ${runtime.device.toUpperCase()} (${runtime.dtype})`,
      });
      return runtime;
    } catch (err) {
      this.updateStatus({
        state: 'error',
        error: err.message,
        message: `Kev load error: ${err.message}`,
      });
      throw err;
    }
  }

  async judgeAnswer(payload, onPassProgress = null) {
    const result = await this.callWorker('JUDGE_ANSWER', payload, onPassProgress);
    if (this.status.state !== 'ready') {
      this.updateStatus({
        state: 'ready',
        progress: 1,
        device: result.device,
        dtype: result.dtype,
        isCached: true,
        message: `Kev-0.6B active · ${String(result.device).toUpperCase()} (${result.dtype})`,
      });
    }
    return result;
  }
}
