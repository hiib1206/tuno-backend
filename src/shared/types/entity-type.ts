/** 엔티티 타입 상수. */
export const ENTITY_TYPES = {
  POST: "POST",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

/** 유효한 EntityType인지 검증한다. */
export function isValidEntityType(value: string): value is EntityType {
  return Object.values(ENTITY_TYPES).includes(value as EntityType);
}
