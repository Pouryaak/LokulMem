/**
 * DTO conversion utilities
 * Handles conversion between internal types (with embeddings) and public DTOs
 */

import type { MemoryDTO, MemoryType } from '../types/memory.js';
import type { MemoryInternal } from './types.js';

/**
 * Convert internal memory to public DTO (removes embedding)
 * @param internal - Internal memory with embedding
 * @returns Public DTO without embedding
 */
export function toMemoryDTO(internal: MemoryInternal): MemoryDTO {
  const { embedding: _embedding, ...dto } = internal;
  return dto;
}

/**
 * Convert array of internal memories to public DTOs
 * @param internals - Array of internal memories
 * @returns Array of public DTOs
 */
export function toMemoryDTOs(internals: MemoryInternal[]): MemoryDTO[] {
  return internals.map(toMemoryDTO);
}

/**
 * Convert public DTO to internal memory (adds embedding)
 * @param dto - Public memory DTO
 * @param embedding - Vector embedding to attach
 * @returns Internal memory with embedding
 */
export function fromMemoryDTO(
  dto: MemoryDTO,
  embedding: Float32Array,
): MemoryInternal {
  return {
    ...dto,
    embedding,
  };
}

/**
 * Create a new internal memory from components
 * Useful when creating memories from extracted data
 * @param content - Memory content
 * @param types - Memory types
 * @param embedding - Vector embedding
 * @param overrides - Optional field overrides
 * @returns Complete internal memory
 */
export function createMemoryInternal(
  content: string,
  types: MemoryType[],
  embedding: Float32Array,
  overrides?: Partial<Omit<MemoryInternal, 'content' | 'types' | 'embedding'>>,
): MemoryInternal {
  const now = Date.now();

  return {
    id: overrides?.id ?? crypto.randomUUID(),
    content,
    types,
    status: overrides?.status ?? 'active',
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    validFrom: overrides?.validFrom ?? now,
    validTo: overrides?.validTo ?? null,
    baseStrength: overrides?.baseStrength ?? 1.0,
    currentStrength: overrides?.currentStrength ?? 1.0,
    pinned: overrides?.pinned ?? false,
    mentionCount: overrides?.mentionCount ?? 0,
    lastAccessedAt: overrides?.lastAccessedAt ?? now,
    clusterId: overrides?.clusterId ?? null,
    entities: overrides?.entities ?? [],
    sourceConversationIds: overrides?.sourceConversationIds ?? [],
    supersededBy: overrides?.supersededBy ?? null,
    supersededAt: overrides?.supersededAt ?? null,
    fadedAt: overrides?.fadedAt ?? null,
    metadata: overrides?.metadata ?? {},
    embedding,
  };
}
