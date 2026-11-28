/**
 * Browser WebGPU & Shader-F16 Capability Detection
 *
 * Selects `webgpu` + `q4f16` when supported, gracefully falling back to
 * `webgpu` + `q4` or `wasm` + `q4` on devices without f16 shaders or WebGPU.
 */

let cachedF16Promise = null;

export function hasWebGPU() {
  return typeof navigator !== 'undefined' && typeof navigator.gpu !== 'undefined';
}

export function supportsShaderF16() {
  if (!cachedF16Promise) {
    cachedF16Promise = (async () => {
      if (!hasWebGPU()) return false;
      try {
        const adapter = await navigator.gpu.requestAdapter();
        return Boolean(adapter && adapter.features && adapter.features.has('shader-f16'));
      } catch {
        return false;
      }
    })();
  }
  return cachedF16Promise;
}

export async function resolveKevRuntime(preferredDevice = 'auto', preferredDtype = 'auto') {
  let device = preferredDevice;
  if (device === 'auto') {
    device = hasWebGPU() ? 'webgpu' : 'wasm';
  }

  let dtype = preferredDtype;
  if (dtype === 'auto') {
    if (device === 'webgpu' && (await supportsShaderF16())) {
      dtype = 'q4f16';
    } else {
      dtype = 'q4';
    }
  }

  return { device, dtype };
}
