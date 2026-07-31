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

  constructor(kind: VisionErrorKind, message: string) {
    super(message);
    this.name = 'VisionError';
    this.kind = kind;
  }
}
