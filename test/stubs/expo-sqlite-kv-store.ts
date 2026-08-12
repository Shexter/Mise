const values = new Map<string, string>();

export default {
  getItemSync(key: string): string | null { return values.get(key) ?? null; },
  setItemSync(key: string, value: string): void { values.set(key, value); },
};

export function clearKvStore(): void { values.clear(); }
