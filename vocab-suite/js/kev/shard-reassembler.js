/**
 * Multi-Shard Weight Stream Reassembler (`< 20 MB` per file)
 *
 * Allows large ONNX weight files (`model_q4f16.onnx_data`) to be hosted on
 * GitHub Pages or Google Drive API split into small `< 20 MB` shard files
 * (`part-000.bin`, `part-001.bin`, ...), bypassing GitHub's 25 MB / 100 MB
 * single-file upload limits.
 *
 * When a custom shard manifest URL is configured, requests matching a sharded
 * filename transparently stream all parts sequentially as one `Response`.
 */

let installedManifest = null;
let originalFetch = null;

export function configureShardInterceptor(manifest = null) {
  installedManifest = manifest;
  if (!manifest) return;

  if (!originalFetch && typeof globalThis.fetch === 'function') {
    originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      const matchedEntry = matchShardEntry(url, installedManifest);
      if (!matchedEntry) {
        return originalFetch(input, init);
      }
      return streamShardedResponse(matchedEntry, init);
    };
  }
}

function matchShardEntry(url, manifest) {
  if (!manifest || !manifest.files) return null;
  for (const [suffix, entry] of Object.entries(manifest.files)) {
    if (url.endsWith(suffix)) {
      return entry;
    }
  }
  return null;
}

async function streamShardedResponse(entry, init) {
  const parts = entry.parts || [];
  const totalBytes = entry.totalBytes || 0;

  if (init?.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        'Content-Length': String(totalBytes),
        'Content-Type': 'application/octet-stream',
      },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const partUrl of parts) {
          const res = await originalFetch(partUrl, { mode: 'cors' });
          if (!res.ok) {
            throw new Error(`Failed to fetch shard ${partUrl} (HTTP ${res.status})`);
          }
          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Length': String(totalBytes),
      'Content-Type': 'application/octet-stream',
    },
  });
}
