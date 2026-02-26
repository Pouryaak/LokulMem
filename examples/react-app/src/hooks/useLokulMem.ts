import { createLokulMem } from 'lokulmem';
import type { LokulMem, LokulMemConfig } from 'lokulmem';
import { useEffect, useRef, useState } from 'react';

interface UseLokulMemResult {
  lokul: LokulMem | null;
  isReady: boolean;
  error: Error | null;
  fallbackModel: string;
}

export function useLokulMem(): UseLokulMemResult {
  const [lokul, setLokul] = useState<LokulMem | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const progressKeyRef = useRef<string>('');

  useEffect(() => {
    let mounted = true;

    const env = (
      import.meta as ImportMeta & {
        env?: Record<string, string | undefined>;
      }
    ).env;
    const fallbackModel =
      env?.VITE_WEBLLM_FALLBACK_MODEL ?? 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

    const config: LokulMemConfig = {
      dbName: 'lokulmem-demo',
      fallbackLLM: {
        enabled: true,
        provider: 'webllm',
        model: fallbackModel,
        temperature: 0,
        timeoutMs: 12000,
      },
      onProgress: (stage, progress) => {
        const key = `${stage}:${progress}`;
        if (progressKeyRef.current === key) {
          return;
        }
        progressKeyRef.current = key;
        console.log(`[${stage}] ${progress}%`);
      },
    };

    console.log('[useLokulMem] WebLLM fallback model:', fallbackModel);

    createLokulMem(config)
      .then((instance) => {
        if (mounted) {
          setLokul(instance);
          setIsReady(true);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const env = (
    import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    }
  ).env;
  const fallbackModel =
    env?.VITE_WEBLLM_FALLBACK_MODEL ?? 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

  return { lokul, isReady, error, fallbackModel };
}
