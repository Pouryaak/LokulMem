import { createLokulMem } from 'lokulmem';
import type { LokulMem } from 'lokulmem';
import { useEffect, useState } from 'react';

interface UseLokulMemResult {
  lokul: LokulMem | null;
  isReady: boolean;
  error: Error | null;
}

export function useLokulMem(): UseLokulMemResult {
  const [lokul, setLokul] = useState<LokulMem | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    createLokulMem({
      dbName: 'lokulmem-demo',
      onProgress: (stage, progress) => {
        console.log(`[${stage}] ${progress}%`);
      },
    })
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

  return { lokul, isReady, error };
}
