import { useState } from 'react';
import type { LokulMem } from 'lokulmem';
import type { ChatMessage } from 'lokulmem';
import type { LokulMemDebug } from 'lokulmem';

interface ChatViewProps {
  lokul: LokulMem;
  onDebug: (debug: LokulMemDebug) => void;
}

export function ChatView({ lokul, onDebug }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
        {isLoading && <div className="message assistant">Thinking...</div>}
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
    </div>
  );
}
