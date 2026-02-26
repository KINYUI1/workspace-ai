const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID v4 format.
 * Agents sometimes hallucinate IDs like "Task-1" or "alpha-lead";
 * this guard prevents Prisma UUID parse errors.
 */
export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Validate an array of strings are all valid UUIDs.
 */
export function areValidUuids(values: unknown): values is string[] {
  return Array.isArray(values) && values.every(isValidUuid);
}
