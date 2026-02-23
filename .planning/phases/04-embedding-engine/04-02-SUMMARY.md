---
phase: 04-embedding-engine
plan: 02
type: execute
wave: 2
subsystem: embedding-engine
tags: [cache, lru, concurrency, performance]
dependencies:
  requires: ["04-03"]
  provides: ["LRU cache", "PromiseQueue", "CacheStats"]
  affects: ["EmbeddingEngine"]
tech-stack:
  added: []
  patterns: [LRU eviction, Promise queue, Singleton with cache]
key-files:
  created:
    - src/worker/LRUCache.ts
  modified:
    - src/worker/EmbeddingEngine.ts
    - src/types/api.ts
decisions:
  - "LRU cache uses Map for O(1) operations with insertion order for eviction"
  - "PromiseQueue ensures only one embedding call runs at a time"
  - "Cache key is raw text string for exact match deduplication"
  - "Memory warnings at 10MB (warning) and 50MB (critical) thresholds"
  - "Parameterized dims allows different models with different embedding dimensions"
metrics:
  duration: "45m"
  completed-date: "2026-02-23"
  tasks: 5
  files-created: 1
  files-modified: 2
---

# Phase 04 Plan 02: LRU Cache and Concurrency Queue Summary

## Overview

Implemented LRU (Least Recently Used) cache for embeddings and promise-based concurrency queue to optimize embedding performance and prevent race conditions.

## What Was Built

### 1. LRUCache Class (`src/worker/LRUCache.ts`)

A Map-based LRU cache implementation with:

- **O(1) operations**: Using Map's insertion order for LRU semantics
- **Configurable size**: Default 1000 entries (~1.5MB for 384-dim embeddings)
- **Statistics tracking**: Hits, misses, hit rate, oldest entry age
- **Memory estimation**: Uses parameterized dimensions (not hardcoded 384)
- **Methods**: `get()`, `set()`, `has()`, `delete()`, `clear()`, `getStats()`, `getSize()`

### 2. PromiseQueue Class (`src/worker/LRUCache.ts`)

Sequential execution queue ensuring:

- **Single concurrent operation**: Only one embedding call runs at a time
- **FIFO ordering**: Queue processes items in order received
- **Promise-based**: Returns promises that resolve when operation completes
- **Methods**: `add()`, `size()`

### 3. EmbeddingEngine Integration (`src/worker/EmbeddingEngine.ts`)

Updated the embedding engine to use cache and queue:

- **Cache integration**: Check cache before computation, store results after
- **Queue integration**: All embedding calls go through PromiseQueue
- **Double-check pattern**: Check cache again after acquiring queue lock
- **Batch caching**: `embedBatch()` caches individual results
- **Memory warnings**: Log at 10MB and 50MB thresholds
- **Stats API**: `getCacheStats()` returns CacheStats

### 4. Public API Types (`src/types/api.ts`)

Added configuration options:

- `LokulMemConfig.embeddingCacheSize`: Cache size (default: 1000)
- `LokulMemConfig.enableEmbeddingCache`: Enable/disable cache (default: true)
- `EmbeddingCacheStats`: Public cache statistics interface
- `LokulMemDebug.cacheStats`: Debug cache statistics

## Verification

- [x] `npm run typecheck` passes with zero errors
- [x] `npm run build` succeeds
- [x] LRUCache has all required methods (get, set, has, delete, clear, getStats)
- [x] LRUCache constructor accepts dims parameter
- [x] PromiseQueue ensures sequential execution
- [x] EmbeddingEngine.embed() checks cache before computation
- [x] EmbeddingEngine uses queue to prevent concurrent calls
- [x] Cache stats include hitRate, size, maxSize, estimatedMemoryBytes
- [x] embedBatch internally chunks to 32 items max

## Deviations from Plan

None - plan executed exactly as written.

## Key Design Decisions

1. **Map-based LRU**: Using Map preserves insertion order; first entry is oldest, last is newest
2. **Text-based cache keys**: Raw text content is the cache key for exact match deduplication
3. **Queue-per-engine**: Single PromiseQueue per EmbeddingEngine instance
4. **Parameterized dims**: Constructor accepts dims parameter to support different embedding models
5. **Memory warnings**: Console warnings at 10MB/50MB help developers monitor cache usage

## Performance Characteristics

- **Cache lookup**: O(1) via Map.get()
- **Cache eviction**: O(1) via Map.delete() and Map.set()
- **Queue overhead**: Minimal - just array push/shift
- **Memory per entry**: dims * 4 bytes (Float32Array) + overhead
- **Default memory**: ~1.5MB for 1000 entries at 384 dimensions

## Commits

| Hash | Message |
|------|---------|
| e2f3353 | feat(04-02): create LRUCache class with parameterized dimensions |
| fc11b7c | feat(04-02): integrate LRU cache and PromiseQueue into EmbeddingEngine |
| f86e91f | feat(04-02): add cache configuration to public API types |

## Self-Check: PASSED

- [x] src/worker/LRUCache.ts exists
- [x] src/worker/EmbeddingEngine.ts modified with cache integration
- [x] src/types/api.ts modified with cache configuration
- [x] All commits exist in git history
- [x] TypeScript compiles without errors
- [x] Build succeeds
