/// <reference lib="webworker" />
import { initVTracer, convertImage, countSvgNodes, ENGINE_WASM_URLS } from '@/lib/vtracer';
import { WorkerInputPayload, WorkerResponse, EngineVersionOption } from '@/lib/vtracer/types';

declare const self: DedicatedWorkerGlobalScope;

const initializedEngines = new Set<string>();

self.onmessage = async (e: MessageEvent<WorkerInputPayload>) => {
  const { id, pixels, width, height, options, wasmUrl } = e.data;
  const startTime = performance.now();
  const engine: EngineVersionOption = options.engineVersion || 'vtracer-2.0.10';

  try {
    if (!initializedEngines.has(engine)) {
      const defaultUrl = ENGINE_WASM_URLS[engine] || ENGINE_WASM_URLS['vtracer-2.0.10'];
      await initVTracer(wasmUrl || defaultUrl, engine);
      initializedEngines.add(engine);
    }

    const svg = convertImage(pixels, width, height, options);
    const executionTimeMs = Math.round(performance.now() - startTime);
    const nodeCount = countSvgNodes(svg);

    const response: WorkerResponse = {
      id,
      success: true,
      svg,
      executionTimeMs,
      nodeCount,
    };

    self.postMessage(response);
  } catch (error: unknown) {
    const executionTimeMs = Math.round(performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const response: WorkerResponse = {
      id,
      success: false,
      error: errorMessage,
      executionTimeMs,
    };
    self.postMessage(response);
  }
};

export {};
