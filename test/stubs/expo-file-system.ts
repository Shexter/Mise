/**
 * Minimal stand-in for `expo-file-system`, wired in via `vitest.config.ts`.
 * Only shaped enough to satisfy module evaluation for code paths the test
 * suite imports but does not exercise (`src/media/photos.ts`).
 */

export class Directory {
  uri: string;
  constructor(..._segments: unknown[]) {
    this.uri = 'file:///test/';
  }
  get exists(): boolean {
    return true;
  }
  create(): void {}
  delete(): void {}
}

export class File {
  uri: string;
  constructor(..._segments: unknown[]) {
    this.uri = 'file:///test/file';
  }
  get exists(): boolean {
    return false;
  }
  delete(): void {}
  write(_content: string): void {}
  async move(_destination: File): Promise<void> {}
  async base64(): Promise<string> {
    return 'stub-base64';
  }
}

export const Paths = {
  document: 'file:///test/document/',
  cache: 'file:///test/cache/',
};
