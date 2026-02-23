---
phase: 02-worker-infrastructure
plan: 02
subsystem: worker-communication
tags: [protocol, message-port, worker-client, progress-reporting]
dependencies:
  requires: [01-03]
  provides: [02-03, 02-04]
  affects: [src/core/Protocol.ts, src/core/MessagePort.ts, src/worker/index.ts]
tech-stack:
  added: []
  patterns:
    - PortLike abstraction for worker type independence
    - Request/response correlation with UUID
    - Progress reporting with stage/overall tracking
key-files:
  created:
    - src/core/Protocol.ts
  modified:
    - src/worker/index.ts
decisions:
  - MessageType as const object instead of const enum for build tool compatibility
  - PortLike interface abstracts MessagePort/Worker differences
  - DedicatedWorker uses wrapper function instead of casting self to MessagePort
  - Progress calculation uses equal 20% weights per stage
metrics:
  duration: 15m
  completed-date: 2026-02-23
---

# Phase 2 Plan 2: Message Protocol and Communication Layer Summary

**Objective:** Create the message protocol and communication layer that enables progress reporting through 5 stages (worker, model, storage, maintenance, ready) with request/response correlation.

## What Was Built

### 1. Protocol Types (src/core/Protocol.ts)

Message protocol types for structured worker communication:

- **RequestMessage**: UUID-based correlation with type/payload
- **ResponseMessage**: Matches request ID, includes optional error details
- **ProgressMessage**: Stage-based progress with both stage and overall percentages
- **WorkerMessage**: Union type for all message variants
- **MessageType**: Const object (not enum) for build tool compatibility
- **InitPayload**: Initialization data including dbName and persistence status

### 2. WorkerClient (src/core/MessagePort.ts)

Request/response handling with timeout support:

- **WorkerClient class**: Wraps PortLike for consistent messaging
- **request()**: Promise-based requests with UUID correlation and configurable timeout
- **onMessage()**: Handler for non-response messages (progress updates)
- **terminate()**: Cleanup with pending request rejection
- **createMainThreadPort()**: In-memory channel for main thread fallback

### 3. Worker Entry Point (src/worker/index.ts)

Progress reporting through all 5 initialization stages:

- **setupPort()**: Message routing for INIT and PING messages
- **handleInit()**: Async initialization with progress reporting
- **reportProgress()**: Calculates and sends progress messages
- **createWorkerPortLike()**: PortLike wrapper for DedicatedWorker
- **Entry points**: SharedWorker (onconnect) and DedicatedWorker detection

## Verification

All success criteria met:

- [x] src/core/Protocol.ts exists with all message types using `as const`
- [x] src/core/MessagePort.ts exists with WorkerClient class using PortLike
- [x] src/worker/index.ts rewritten with progress reporting
- [x] Request/response correlation uses UUID-based IDs
- [x] Progress reporting calculates overall progress correctly
- [x] Worker handles both SharedWorker and DedicatedWorker entry points
- [x] DedicatedWorker uses PortLike wrapper (not casting self to MessagePort)
- [x] InitPayload includes dbName field

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 6afd5f9 | feat(02-02): create message protocol types | src/core/Protocol.ts |
| c01fbea | feat(02-02): update worker entry point with progress reporting | src/worker/index.ts |

**Note:** WorkerClient (src/core/MessagePort.ts) was implemented in plan 02-01 due to task dependencies. The implementation follows the specification in this plan.

## Deviations from Plan

None - plan executed exactly as written. WorkerClient was implemented in 02-01 as a prerequisite.

## Key Implementation Details

### Progress Calculation

```typescript
const stageWeights = { worker: 0.2, model: 0.2, storage: 0.2, maintenance: 0.2, ready: 0.2 };
const overallProgress = (completedStages + currentStageContribution) * 100;
```

### DedicatedWorker Detection

```typescript
if (!('onconnect' in self)) {
  // DedicatedWorker context - wrap self as PortLike
  const portLike = createWorkerPortLike(self as DedicatedWorkerGlobalScope);
  setupPort(portLike);
}
```

### Request/Response Correlation

```typescript
const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
// Store pending request, post message with ID
// On response: match ID, resolve/reject promise, cleanup timeout
```

## Next Steps

- Plan 02-03: Worker initialization and fallback chain
- Plan 02-04: Worker lifecycle management

## Self-Check: PASSED

- [x] src/core/Protocol.ts exists and exports all required types
- [x] src/core/MessagePort.ts exists with WorkerClient class
- [x] src/worker/index.ts exists with progress reporting
- [x] Commits 6afd5f9 and c01fbea exist in git history
