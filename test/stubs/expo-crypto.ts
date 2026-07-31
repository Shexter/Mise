import { randomUUID as nodeRandomUUID } from 'node:crypto';

/** Node stand-in for `expo-crypto`, wired in via `vitest.config.ts`. */
export function randomUUID(): string {
  return nodeRandomUUID();
}
