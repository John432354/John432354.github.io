/**
 * Kev Decision Model Registry & Special Delimiter Specification
 *
 * Defaults to `onnx-community/kev-0.6b-ONNX` — the smallest browser-ready
 * quantized Kev decision model (~330 MB q4f16 on WebGPU / ~365 MB q4 on WASM).
 *
 * IMPORTANT: Always use `dist/transformers.min.js` (the standalone self-contained
 * browser bundle that embeds `onnxruntime-web` & WebGPU/WASM), NEVER
 * `dist/transformers.web.min.js` (which leaves `onnxruntime-web/webgpu` external).
 */

export const DEFAULT_KEV_MODEL_ID = 'onnx-community/kev-0.6b-ONNX';

export const KEV_MODELS = [
  {
    id: 'onnx-community/kev-0.6b-ONNX',
    alias: 'kev-0.6b',
    label: 'Kev-0.6B (Smallest · Recommended)',
    backbone: 'Qwen3-0.6B-Base + Rank-16 LoRA + Pointer Head',
    downloadMbWebGPU: 330,
    downloadMbWasm: 365,
    webgpuDtype: 'q4f16',
    fallbackDtype: 'q4',
  },
  {
    id: 'local-shards',
    alias: 'kev-0.6b-sharded',
    label: 'Kev-0.6B (Self-Hosted <20MB Shards / Google Drive)',
    backbone: 'Qwen3-0.6B-Base (Chunked Stream)',
    downloadMbWebGPU: 330,
    downloadMbWasm: 365,
    webgpuDtype: 'q4f16',
    fallbackDtype: 'q4',
  },
];

export const KEV_FALLBACK_DELIMITERS = {
  state: '<|fim_prefix|>',
  question: '<|fim_middle|>',
  optionStart: '<|box_start|>',
  optionEnd: '<|box_end|>',
  decide: '<|fim_suffix|>',
};

export const KEV_FALLBACK_DELIMITER_IDS = {
  state: 151659,
  question: 151660,
  optionStart: 151648,
  optionEnd: 151649,
  decide: 151661,
};

export const TRANSFORMERS_CDN_URL =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';

export const TRANSFORMERS_FALLBACK_CDN_URL =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
