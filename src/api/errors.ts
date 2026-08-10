/**
 * Provider-neutral error type for the vision layer. Lives in its own module so
 * both provider transports (`anthropic.ts`, `gemini.ts`) and the facade
 * (`vision.ts`) can share it without a circular import.
 */

export type VisionErrorKind =
  | 'no_key'
  | 'unauthorized'
  | 'billing'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'timeout'
  | 'malformed'
  | 'cancelled';

/** Every failure the UI has to say something distinct about. */
export class VisionError extends Error {
  readonly kind: VisionErrorKind;
  provider?: import('@/api/keyStore').Provider;
  readonly retryAfterMs?: number;

  constructor(kind: VisionErrorKind, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'VisionError';
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Normalises the standard Retry-After response header to milliseconds. */
export function retryAfterMs(headers: Pick<Headers, 'get'>): number | undefined {
  const value = headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}
