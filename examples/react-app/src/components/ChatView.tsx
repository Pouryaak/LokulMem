import { useState } from 'react';
import type { LokulMem } from 'lokulmem';
import type { ChatMessage } from 'lokulmem';
import type { LokulMemDebug } from 'lokulmem';

interface ChatViewProps {
  lokul: LokulMem;
  onDebug: (debug: LokulMemDebug) => void;
  fallbackModel: string;
}

interface LearnDiagnosticView {
  fallbackInvoked?: boolean;
  fallbackFactCount?: number;
  fallbackProvider?: 'pattern' | 'webllm' | 'noop';
  fallbackModel?: string;
  fallbackError?: string;
  extractionMode?: 'deterministic' | 'fallback';
}

interface FallbackStatus {
  totalInvocations: number;
  webllmSuccesses: number;
  webllmFailures: number;
  patternFallbackUses: number;
  lastProvider: string;
  lastError: string;
  lastFactCount: number;
  lastExtractionMode: string;
}

const DEFAULT_FALLBACK_STATUS: FallbackStatus = {
  totalInvocations: 0,
  webllmSuccesses: 0,
  webllmFailures: 0,
  patternFallbackUses: 0,
  lastProvider: 'none',
  lastError: 'none',
  lastFactCount: 0,
  lastExtractionMode: 'none',
};

export function ChatView({ lokul, onDebug, fallbackModel }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fallbackStatus, setFallbackStatus] = useState<FallbackStatus>(
    DEFAULT_FALLBACK_STATUS,
  );

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    try {
      // Augment with memories
      const augmentResult = await lokul.augment(userMessage, messages, { debug: true });

      if (augmentResult.debug) {
        onDebug(augmentResult.debug);
      }

      // Simulate LLM response (in real app, send to LLM)
      const assistantResponse = `I received your message: "${userMessage}". ${augmentResult.metadata.injectedCount} memories were injected.`;

      // Learn from conversation
      const learnResult = await lokul.learn(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: assistantResponse },
        { verbose: true },
      );
      console.log('[ChatView] Learn result:', JSON.stringify(learnResult, null, 2));

      const diagnostics = (
        ((learnResult as unknown as { diagnostics?: LearnDiagnosticView[] })
          .diagnostics as LearnDiagnosticView[] | undefined) ?? []
      );
      const fallbackDiagnostics = diagnostics.filter(
        (diagnostic) => diagnostic.fallbackInvoked,
      );
      if (fallbackDiagnostics.length > 0) {
        const lastFallback =
          fallbackDiagnostics[fallbackDiagnostics.length - 1] ?? null;
        const webllmSuccesses = fallbackDiagnostics.filter(
          (diagnostic) =>
            diagnostic.fallbackProvider === 'webllm' &&
            !diagnostic.fallbackError,
        ).length;
        const webllmFailures = fallbackDiagnostics.filter(
          (diagnostic) => {
            if (diagnostic.fallbackProvider === 'webllm') {
              return Boolean(diagnostic.fallbackError);
            }
            if (diagnostic.fallbackProvider === 'pattern') {
              return Boolean(diagnostic.fallbackError?.startsWith('upstream:'));
            }
            return false;
          },
        ).length;
        const patternFallbackUses = fallbackDiagnostics.filter(
          (diagnostic) => diagnostic.fallbackProvider === 'pattern',
        ).length;

        setFallbackStatus((prev) => ({
          totalInvocations: prev.totalInvocations + 1,
          webllmSuccesses: prev.webllmSuccesses + webllmSuccesses,
          webllmFailures: prev.webllmFailures + webllmFailures,
          patternFallbackUses: prev.patternFallbackUses + patternFallbackUses,
          lastProvider: lastFallback?.fallbackProvider ?? prev.lastProvider,
          lastError: lastFallback?.fallbackError ?? 'none',
          lastFactCount: lastFallback?.fallbackFactCount ?? 0,
          lastExtractionMode: lastFallback?.extractionMode ?? 'unknown',
        }));
      }

      // Verify memory was stored by listing
      const listResult = await lokul.manage().list();
      console.log('[ChatView] Total memories in DB:', listResult.total);

      // Update messages
      setMessages(prev => [
        ...prev,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: assistantResponse }
      ]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-view">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">Processing message...</div>
        )}
      </div>

      <div className="input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message... (Shift+Enter for newline)"
          rows={3}
        />
        <button onClick={handleSend} disabled={isLoading || !input.trim()}>
          Send
        </button>
      </div>

      <div className="fallback-status">
        <h4>Fallback LLM Status</h4>
        <p>
          Model: <code>{fallbackModel}</code>
        </p>
        <p>
          WebLLM success: <strong>{fallbackStatus.webllmSuccesses}</strong> | failures:{' '}
          <strong>{fallbackStatus.webllmFailures}</strong>
        </p>
        <p>
          Pattern fallback uses: <strong>{fallbackStatus.patternFallbackUses}</strong>
        </p>
        <p>
          Last provider: <strong>{fallbackStatus.lastProvider}</strong> | Last mode:{' '}
          <strong>{fallbackStatus.lastExtractionMode}</strong> | Last facts:{' '}
          <strong>{fallbackStatus.lastFactCount}</strong>
        </p>
        <p>
          Last error: <code>{fallbackStatus.lastError}</code>
        </p>
      </div>
    </div>
  );
}
