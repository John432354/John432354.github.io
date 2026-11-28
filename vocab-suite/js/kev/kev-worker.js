/**
 * Dedicated Kev Classifier Web Worker (`type: "module"`)
 *
 * Keeps model download, tokenization, and all 3 ONNX forward passes off the
 * main browser thread so the 60fps ocean canvas never drops a frame.
 */

import { KevBrowserEngine } from './transformers-loader.js?v=2.1';
import { verifyAnswerThreePasses } from './pass-aggregator.js';

const engine = new KevBrowserEngine();

self.addEventListener('message', async (event) => {
  const { id, type, payload } = event.data || {};
  if (!type) return;

  try {
    if (type === 'INSPECT_CACHE') {
      const info = await engine.inspectCache(payload || {});
      self.postMessage({ id, ok: true, result: info });
      return;
    }

    if (type === 'LOAD_MODEL') {
      const runtime = await engine.load(payload || {}, (progressInfo) => {
        self.postMessage({ type: 'LOAD_PROGRESS', payload: progressInfo });
      });
      self.postMessage({ id, ok: true, result: runtime });
      return;
    }

    if (type === 'JUDGE_ANSWER') {
      if (!engine.isReady()) {
        await engine.load(payload?.modelOptions || {}, (progressInfo) => {
          self.postMessage({ type: 'LOAD_PROGRESS', payload: progressInfo });
        });
      }

      const verdict = await verifyAnswerThreePasses(engine, payload, {
        threshold: payload.threshold ?? 0.52,
        temperature: payload.temperature ?? 1.0,
        onPassResult: (passRecord) => {
          self.postMessage({
            type: 'PASS_PROGRESS',
            requestId: id,
            payload: passRecord,
          });
        },
      });

      self.postMessage({ id, ok: true, result: verdict });
      return;
    }
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
