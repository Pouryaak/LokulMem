import type { LokulMemDebug } from '@lokul/lokulmem';

interface DebugPanelProps {
  debug: LokulMemDebug | null;
}

export function DebugPanel({ debug }: DebugPanelProps) {
  return (
    <div className="debug-panel">
      <h3>Debug Output</h3>

      {!debug ? (
        <p className="placeholder">Send a message with debug enabled to see output...</p>
      ) : (
        <pre className="debug-json">{JSON.stringify(debug, null, 2)}</pre>
      )}
    </div>
  );
}
