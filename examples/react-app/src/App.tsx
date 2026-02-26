import { useState } from 'react';
import { useLokulMem } from './hooks/useLokulMem';
import { ChatView } from './components/ChatView';
import { MemoryList } from './components/MemoryList';
import { DebugPanel } from './components/DebugPanel';
import type { LokulMemDebug } from 'lokulmem';

type Tab = 'chat' | 'memories';

function App() {
  const { lokul, isReady, error, fallbackModel } = useLokulMem();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [debug, setDebug] = useState<LokulMemDebug | null>(null);

  if (error) {
    return (
      <div className="app error">
        <h1>Error initializing LokulMem</h1>
        <pre>{error.message}</pre>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="app loading">
        <h1> LokulMem Demo</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1> LokulMem Demo</h1>
        <nav>
          <button
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={activeTab === 'memories' ? 'active' : ''}
            onClick={() => setActiveTab('memories')}
          >
            Memories
          </button>
        </nav>
      </header>

      <main>
        {activeTab === 'chat' && lokul && (
          <div className="split-view">
            <div className="chat-pane">
              <ChatView
                lokul={lokul}
                onDebug={setDebug}
                fallbackModel={fallbackModel}
              />
            </div>
            <div className="debug-pane">
              <DebugPanel debug={debug} />
            </div>
          </div>
        )}

        {activeTab === 'memories' && lokul && (
          <MemoryList lokul={lokul} />
        )}
      </main>
    </div>
  );
}

export default App;
