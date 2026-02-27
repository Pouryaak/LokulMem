import { useState, useEffect } from 'react';
import type { LokulMem, MemoryDTO } from '@lokul/lokulmem';

interface MemoryListProps {
  lokul: LokulMem;
}

export function MemoryList({ lokul }: MemoryListProps) {
  const [memories, setMemories] = useState<MemoryDTO[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMemories();

    // Subscribe to memory changes
    const unsubscribe = lokul.onMemoryAdded(() => {
      loadMemories();
    });

    return unsubscribe;
  }, [lokul]);

  async function loadMemories() {
    const result = await lokul.manage().list();
    setMemories(result.items);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handlePin(id: string) {
    await lokul.manage().pin(id);
    loadMemories();
  }

  async function handleDelete(id: string) {
    await lokul.manage().delete(id);
    loadMemories();
  }

  return (
    <div className="memory-list">
      <h3>Memories ({memories.length})</h3>

      {memories.length === 0 ? (
        <p>No memories yet. Send some messages!</p>
      ) : (
        <ul>
          {memories.map(memory => (
            <li key={memory.id} className={`memory ${memory.pinned ? 'pinned' : ''}`}>
              <div className="memory-summary" onClick={() => toggleExpand(memory.id)}>
                <span className="types">{memory.types.join(', ')}</span>
                <span className="strength">{memory.currentStrength.toFixed(2)}</span>
                {memory.pinned && <span className="pinned-badge">📌</span>}
              </div>

              {expanded.has(memory.id) && (
                <div className="memory-detail">
                  <p>{memory.content}</p>
                  <div className="meta">
                    <small>Created: {new Date(memory.createdAt).toLocaleString()}</small>
                    {memory.entities.length > 0 && (
                      <small>Entities: {memory.entities.join(', ')}</small>
                    )}
                  </div>
                  <div className="actions">
                    <button onClick={() => handlePin(memory.id)}>
                      {memory.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button onClick={() => handleDelete(memory.id)}>Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
