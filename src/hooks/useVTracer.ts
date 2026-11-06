'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  VTracerOptions,
  WorkerInputPayload,
  WorkerResponse,
  DEFAULT_VTRACER_OPTIONS,
} from '../lib/vtracer/types';
import { initVTracer, convertImage, countSvgNodes, ENGINE_WASM_URLS } from '../lib/vtracer';
import { useI18n } from '../lib/i18n';

export type VTracerStatus = 'idle' | 'initializing' | 'vectorizing' | 'completed' | 'error';

export interface VTracerState {
  isProcessing: boolean;
  status: VTracerStatus;
  statusText: string;
  progress: number;
  svg: string | null;
  nodeCount: number;
  executionTimeMs: number;
  error: string | null;
}

export function useVTracer() {
  const { t } = useI18n();
  const [state, setState] = useState<VTracerState>({
    isProcessing: false,
    status: 'idle',
    statusText: t('status.ready'),
    progress: 0,
    svg: null,
    nodeCount: 0,
    executionTimeMs: 0,
    error: null,
  });

  const workerRef = useRef<Worker | null>(null);
  const activeTaskId = useRef<string | null>(null);
  const pendingResolvers = useRef<Map<string, { resolve: (svg: string) => void; reject: (err: Error) => void }>>(new Map());

  // Initialize worker
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../workers/vtracer.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const response = e.data;
        const resolver = pendingResolvers.current.get(response.id);

        if (response.id !== activeTaskId.current && !resolver) {
          return;
        }

        if (response.success) {
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            status: 'completed',
            statusText: t('status.vectorized', { ms: response.executionTimeMs, count: response.nodeCount }),
            progress: 100,
            svg: response.svg,
            nodeCount: response.nodeCount,
            executionTimeMs: response.executionTimeMs,
            error: null,
          }));
          resolver?.resolve(response.svg);
        } else {
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            status: 'error',
            statusText: t('status.failed'),
            progress: 0,
            error: response.error,
          }));
          resolver?.reject(new Error(response.error));
        }

        pendingResolvers.current.delete(response.id);
      };

      worker.onerror = (err) => {
        console.warn('VTracer worker error, falling back to main-thread execution if needed:', err);
      };

      workerRef.current = worker;
    } catch (err) {
      console.warn('Could not instantiate Web Worker, will fallback to main thread:', err);
    }

    const resolvers = pendingResolvers.current;
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      resolvers.clear();
    };
  }, [t]);

  const reset = useCallback(() => {
    activeTaskId.current = null;
    setState({
      isProcessing: false,
      status: 'idle',
      statusText: t('status.ready'),
      progress: 0,
      svg: null,
      nodeCount: 0,
      executionTimeMs: 0,
      error: null,
    });
  }, [t]);

  const runMainThreadFallback = useCallback(
    async (
      taskId: string,
      pixels: Uint8ClampedArray | Uint8Array,
      width: number,
      height: number,
      options: VTracerOptions
    ): Promise<string> => {
      const startTime = performance.now();
      try {
        setState((prev) => ({
          ...prev,
          statusText: t('status.initializingWasm'),
          progress: 45,
        }));
        const engine = options.engineVersion || 'vtracer-2.0.10';
        const wasmPath = ENGINE_WASM_URLS[engine] || ENGINE_WASM_URLS['vtracer-2.0.10'];
        await initVTracer(wasmPath, engine);

        setState((prev) => ({
          ...prev,
          statusText: t('status.tracingPaths'),
          progress: 75,
        }));

        await new Promise((r) => setTimeout(r, 10));

        const svg = convertImage(pixels, width, height, options);
        const executionTimeMs = Math.round(performance.now() - startTime);
        const nodeCount = countSvgNodes(svg);

        if (activeTaskId.current === taskId) {
          setState({
            isProcessing: false,
            status: 'completed',
            statusText: t('status.vectorized', { ms: executionTimeMs, count: nodeCount }),
            progress: 100,
            svg,
            nodeCount,
            executionTimeMs,
            error: null,
          });
        }

        return svg;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (activeTaskId.current === taskId) {
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            status: 'error',
            statusText: t('status.failed'),
            progress: 0,
            error: errorMessage,
          }));
        }
        throw err;
      }
    },
    [t]
  );

  const vectorize = useCallback(
    async (
      imageSource: ImageData | { data: Uint8ClampedArray | Uint8Array; width: number; height: number },
      options: Partial<VTracerOptions> = {}
    ): Promise<string> => {
      const taskId = `vtracer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      activeTaskId.current = taskId;

      const mergedOptions: VTracerOptions = {
        ...DEFAULT_VTRACER_OPTIONS,
        ...options,
      };

      setState((prev) => ({
        ...prev,
        isProcessing: true,
        status: 'vectorizing',
        statusText: t('status.vectorizingImage'),
        progress: 30,
        error: null,
      }));

      const width = imageSource.width;
      const height = imageSource.height;
      const pixels = imageSource.data;

      // Primary path: Web Worker
      if (workerRef.current) {
        return new Promise<string>((resolve, reject) => {
          pendingResolvers.current.set(taskId, { resolve, reject });

          try {
            const payload: WorkerInputPayload = {
              id: taskId,
              pixels,
              width,
              height,
              options: mergedOptions,
            };

            workerRef.current?.postMessage(payload);
          } catch (workerErr) {
            console.warn('Posting message to worker failed, attempting main thread fallback:', workerErr);
            pendingResolvers.current.delete(taskId);
            runMainThreadFallback(taskId, pixels, width, height, mergedOptions)
              .then(resolve)
              .catch(reject);
          }
        });
      }

      // Fallback path: In-thread WASM execution
      return runMainThreadFallback(taskId, pixels, width, height, mergedOptions);
    },
    [runMainThreadFallback, t]
  );

  /** Loads a previously generated SVG into state without re-vectorizing (e.g. history restore). */
  const loadResult = useCallback((svgStr: string, nodes?: number, execMs?: number) => {
    setState((prev) => ({
      ...prev,
      isProcessing: false,
      status: 'completed',
      statusText: t('status.loadedFromHistory'),
      progress: 100,
      svg: svgStr,
      nodeCount: nodes ?? (svgStr.match(/<path/g) || []).length,
      executionTimeMs: execMs ?? 0,
      error: null,
    }));
  }, [t]);

  return {
    ...state,
    vectorize,
    reset,
    loadResult,
  };
}
