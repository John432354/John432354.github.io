/**
 * Kev ONNX Runtime / Transformers.js Browser Engine
 *
 * Dynamically imports `@huggingface/transformers` from CDN ESM, downloads and
 * caches `onnx-community/kev-0.6b-ONNX` (smallest browser Kev, ~330 MB q4f16),
 * and executes serialized prefill-only pointer-head forward passes.
 */

import { DEFAULT_KEV_MODEL_ID, TRANSFORMERS_CDN_URL } from './models-config.js';
import { resolveKevRuntime } from './device-detect.js';
import { escapeKevUserText } from './text-escape.js';
import { resolveDelimiterIds, packKevSequence } from './sequence-encoder.js';
import { decodePointerBranch } from './pointer-readout.js';
import { configureShardInterceptor } from './shard-reassembler.js';

let tfModulePromise = null;

async function getTransformersModule() {
  if (!tfModulePromise) {
    tfModulePromise = import(TRANSFORMERS_CDN_URL);
  }
  return tfModulePromise;
}

export class KevBrowserEngine {
  constructor() {
    this.model = null;
    this.tokenizer = null;
    this.config = null;
    this.delimiters = null;
    this.runtime = null;
    this.Tensor = null;
    this.queue = Promise.resolve();
    this.loadingPromise = null;
  }

  isReady() {
    return Boolean(this.model && this.tokenizer && this.delimiters);
  }

  async inspectCache(options = {}) {
    try {
      const { AutoConfig, ModelRegistry } = await getTransformersModule();
      const modelId =
        options.modelId && options.modelId !== 'local-shards'
          ? options.modelId
          : DEFAULT_KEV_MODEL_ID;
      const runtime = await resolveKevRuntime(options.device || 'auto', options.dtype || 'auto');
      const config = await AutoConfig.from_pretrained(modelId);
      const isCached = await ModelRegistry.is_cached(modelId, {
        config,
        dtype: runtime.dtype,
        device: runtime.device,
      });
      return { modelId, ...runtime, isCached };
    } catch {
      const runtime = await resolveKevRuntime(options.device || 'auto', options.dtype || 'auto');
      return { modelId: DEFAULT_KEV_MODEL_ID, ...runtime, isCached: false };
    }
  }

  async load(options = {}, onProgress = null) {
    if (this.isReady() && !options.forceReload) {
      return this.runtime;
    }
    if (this.loadingPromise && !options.forceReload) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      if (options.shardManifest) {
        configureShardInterceptor(options.shardManifest);
      }

      const { AutoConfig, AutoTokenizer, PreTrainedModel, Tensor, env } =
        await getTransformersModule();
      this.Tensor = Tensor;

      if (env) {
        env.allowLocalModels = Boolean(options.allowLocalModels);
        env.useBrowserCache = true;
      }

      const repoId =
        options.customModelRepo ||
        (options.modelId && options.modelId !== 'local-shards'
          ? options.modelId
          : DEFAULT_KEV_MODEL_ID);

      let runtime = await resolveKevRuntime(options.device || 'auto', options.dtype || 'auto');

      if (typeof onProgress === 'function') {
        onProgress({ stage: 'config', progress: 0.02, message: `Resolving ${repoId} config…` });
      }

      const config = await AutoConfig.from_pretrained(repoId);
      const tokenizer = await AutoTokenizer.from_pretrained(repoId);

      const encodeRaw = (str) => {
        const { input_ids } = tokenizer(str, { add_special_tokens: false });
        return Array.from(input_ids.data, Number);
      };

      const delimiters = resolveDelimiterIds(config.kev || {}, encodeRaw);

      const fileBytes = new Map();
      const handleProgress = (evt) => {
        if (typeof onProgress !== 'function' || !evt) return;
        if (evt.status === 'progress_total' && typeof evt.progress === 'number') {
          onProgress({
            stage: 'weights',
            progress: Math.min(0.99, Math.max(0.03, evt.progress / 100)),
            loaded: evt.loaded || 0,
            total: evt.total || 0,
            message: `Loading Kev-0.6B (${runtime.device.toUpperCase()} · ${runtime.dtype})`,
          });
          return;
        }
        if (evt.status === 'progress' && evt.file) {
          fileBytes.set(evt.file, { loaded: evt.loaded || 0, total: evt.total || 0 });
          let sumLoaded = 0;
          let sumTotal = 0;
          for (const item of fileBytes.values()) {
            sumLoaded += item.loaded;
            sumTotal += item.total;
          }
          if (sumTotal > 0) {
            onProgress({
              stage: 'weights',
              progress: Math.min(0.99, Math.max(0.03, sumLoaded / sumTotal)),
              loaded: sumLoaded,
              total: sumTotal,
              message: `Downloading ${evt.file.split('/').pop()}…`,
            });
          }
        }
      };

      let model;
      try {
        model = await PreTrainedModel.from_pretrained(repoId, {
          config,
          dtype: runtime.dtype,
          device: runtime.device,
          progress_callback: handleProgress,
        });
      } catch (primaryErr) {
        if (runtime.device === 'webgpu') {
          // Graceful fallback from WebGPU to WASM q4 if adapter rejects buffer size or f16
          runtime = { device: 'wasm', dtype: 'q4' };
          if (typeof onProgress === 'function') {
            onProgress({
              stage: 'fallback',
              progress: 0.05,
              message: 'WebGPU unavailable — falling back to WASM SIMD (q4)…',
            });
          }
          model = await PreTrainedModel.from_pretrained(repoId, {
            config,
            dtype: runtime.dtype,
            device: runtime.device,
            progress_callback: handleProgress,
          });
        } else {
          throw primaryErr;
        }
      }

      this.config = config;
      this.tokenizer = tokenizer;
      this.model = model;
      this.delimiters = delimiters;
      this.runtime = {
        modelId: repoId,
        device: runtime.device,
        dtype: runtime.dtype,
        maxStateTokens: config.kev?.max_state_tokens || 8192,
        maxBranchTokens: config.kev?.max_branch_tokens || 8192,
      };

      if (typeof onProgress === 'function') {
        onProgress({
          stage: 'ready',
          progress: 1,
          message: `Kev-0.6B ready (${runtime.device.toUpperCase()} · ${runtime.dtype})`,
        });
      }

      return this.runtime;
    })();

    try {
      return await this.loadingPromise;
    } catch (err) {
      this.loadingPromise = null;
      throw err;
    }
  }

  encodeUserText(text) {
    const safe = escapeKevUserText(text);
    const { input_ids } = this.tokenizer(safe, { add_special_tokens: false });
    return Array.from(input_ids.data, Number);
  }

  runSingleQuestion({ state, instructions, options, temperature = 1.0 }) {
    const task = async () => {
      if (!this.isReady()) {
        await this.load();
      }

      const stateTokenIds = this.encodeUserText(state);
      const instructionIds = this.encodeUserText(instructions);
      const optionTokenIds = options.map((opt) => this.encodeUserText(opt));

      const packed = packKevSequence({
        stateTokenIds,
        questionBranches: [{ instructionIds, optionTokenIds }],
        delimiters: this.delimiters,
        maxStateTokens: Math.min(1024, this.runtime.maxStateTokens),
        maxBranchTokens: Math.min(4096, this.runtime.maxBranchTokens),
      });

      const seqLen = packed.inputIds.length;
      const input_ids = new this.Tensor(
        'int64',
        BigInt64Array.from(packed.inputIds, BigInt),
        [1, seqLen]
      );
      const attention_mask = new this.Tensor(
        'int64',
        new BigInt64Array(seqLen).fill(1n),
        [1, seqLen]
      );

      const { logits } = await this.model({ input_ids, attention_mask });
      const floatLogits = Array.from(logits.to('float32').data);

      return decodePointerBranch({
        logitsArray: floatLogits,
        endPositions: packed.optionEndGroups[0],
        optionLabels: options,
        temperature,
      });
    };

    const next = this.queue.then(task, task);
    this.queue = next.catch(() => {});
    return next;
  }
}
