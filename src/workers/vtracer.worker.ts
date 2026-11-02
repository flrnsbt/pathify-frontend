/// <reference lib="webworker" />
import { initVTracer, convertImage, countSvgNodes } from '@/lib/vtracer';
import { WorkerInputPayload, WorkerResponse } from '@/lib/vtracer/types';

declare const self: DedicatedWorkerGlobalScope;

let isInitialized = false;

self.onmessage = async (e: MessageEvent<WorkerInputPayload>) => {
  const { id, pixels, width, height, options, wasmUrl } = e.data;
  const startTime = performance.now();

  try {
    if (!isInitialized) {
      await initVTracer(wasmUrl || '/wasm/vtracer.wasm');
      isInitialized = true;
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
