# Phase 2: Worker Infrastructure - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Library initializes with optimal worker strategy (SharedWorker → DedicatedWorker → main thread) and reports progress through all stages. This phase establishes how the library runs — in a worker for performance and multi-tab sync, with graceful degradation when workers aren't available.

</domain>

<decisions>
## Implementation Decisions

### Worker Detection & Fallback

- **Detection method:** Try/catch instantiation — attempt `new SharedWorker(url, { type: 'module' })` and catch failures
- **Fallback chain:** User-configurable with 'auto' as default. When auto: SharedWorker → DedicatedWorker → main thread
- **Safari handling:** Don't UA-detect. Try SharedWorker, catch the specific failure (common in private mode), immediately fall back
- **Worker type exposure:** Yes — expose via API as `workerType: 'shared' | 'dedicated' | 'main'`
- **Initialization timeout:** User-configurable (default: 10 seconds)
- **Fallback behavior:** Try DedicatedWorker immediately if SharedWorker fails
- **Multiple instances:** No — singleton only, library enforces single worker instance
- **Message queue during init:** Queue with timeout — messages queue during initialization and flush once ready, with configurable timeout
- **Cleanup on unload:** User-controlled — provide `terminate()` method on API
- **Worker restart:** Yes — manual `restart()` API available if worker crashes
- **Worker file load failure:** Try main thread fallback if worker.mjs fails to load (404, network error)
- **Status API:** Yes — detailed status object including `workerType`, `canPersist`, health info

### Progress Reporting

- **Progress granularity:** Both overall percentage and per-stage progress
- **Stages reported:** worker, model, storage, maintenance, ready (5 stages)
- **Progress format:** Overall: 30%, stage: "model: 80%"
- **Error states:** Included in progress callbacks
- **Storage persistence result:** Surface via `onStoragePersistDenied` / status flag

### Error Handling & Recovery

- **Worker crash during init:** Fail with error (throw/callback)
- **Worker crash after init:** Fail with error (emit error event)
- **Max retry limit:** Yes — configurable `maxRetries` option
- **Error information:** Full error details — message, code, stack trace, timestamp, recovery suggestion
- **Initialization errors:** Recoverable — try with different worker type
- **Health check:** On-demand ping always available, optional heartbeat behind config flag (default off)
- **Timeout errors:** Error code based — specific codes like TIMEOUT_WORKER_INIT, TIMEOUT_REQUEST
- **Error exposure:** Both available — LokulMemError wrapper with `rawCause` property for original error
- **Degraded state visibility:** Yes — detailed status object with worker type, storage persistence, health info
- **Unexpected messages:** Ignore unknown messages (log but continue)
- **Per-operation timeout:** Configurable per-operation timeout (default 5-10s) with retry once for idempotent operations only

### Storage Persistence Behavior

- **Permission denied:** Initialize with warnings — proceed but surface warning about data loss risk
- **Who prompts:** User calls `persistStorage()` explicitly — library provides API, site decides when
- **Persistence failure:** Warn and continue — emit warning, proceed without persistence
- **Persistence status exposure:** Yes — detailed info: `persisted: boolean`, `reason: string`, `lastAttempt: timestamp`
- **Blocking behavior:** Configurable (default: do not block — proceed, but surface result via callback/status)

</decisions>

<specifics>
## Specific Ideas

- "Don't UA-detect Safari. Attempt new SharedWorker and catch the specific failure."
- "Progress should show both overall (30%) and per-stage (model: 80%) for better UX."
- "On-demand ping always available, optional heartbeat behind config flag (default off)."
- "Per-operation timeout with retry once for idempotent operations only."
- "Storage persistence: configurable, default is don't block, surface result via callback."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-worker-infrastructure*
*Context gathered: 2026-02-23*
