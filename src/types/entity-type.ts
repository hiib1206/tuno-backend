// src/types/entity-type.ts
export const ENTITY_TYPES = {
  POST: "POST",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

// 유틸 함수로 검증
export function isValidEntityType(value: string): value is EntityType {
  return Object.values(ENTITY_TYPES).includes(value as EntityType);
}
