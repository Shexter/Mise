const values = new Map<string, string>();

export default {
  getItemSync(key: string): string | null { return values.get(key) ?? null; },
  setItemSync(key: string, value: string): void { values.set(key, value); },
  async getItem(key: string): Promise<string | null> { return values.get(key) ?? null; },
  async setItem(key: string, value: string): Promise<void> { values.set(key, value); },
  removeItemSync(key: string): boolean { return values.delete(key); },
  async removeItem(key: string): Promise<void> { values.delete(key); },
};

export function clearKvStore(): void { values.clear(); }
