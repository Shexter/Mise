import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Tests run under Node, not under Expo — they cover the pure logic in
 * `src/logic` and the SQL in `src/db`, neither of which needs a device.
 *
 * Two aliases make that possible:
 * - `expo-crypto` and `@/db` resolve to Node stubs in `test/stubs/`, so the
 *   real `src/db/queries.ts` runs its real SQL against `node:sqlite` instead
 *   of the on-device `expo-sqlite`.
 * - `@/` resolves to `src/`, mirroring the tsconfig path.
 *
 * Nothing in here is reachable from the Expo bundle: Metro only follows
 * imports from the app entry, and no app module imports a test file.
 */
export default defineConfig({
  plugins: [
    {
      name: 'png-loader',
      load(id) {
        if (/\.(png|jpg|webp)$/.test(id)) {
          return 'export default 1; module.exports = 1;';
        }
      },
    },
  ],
  resolve: {
    alias: [
      { find: 'expo-crypto', replacement: join(root, 'test/stubs/expo-crypto.ts') },
      { find: 'expo-secure-store', replacement: join(root, 'test/stubs/expo-secure-store.ts') },
      { find: 'expo-location', replacement: join(root, 'test/stubs/expo-location.ts') },
      { find: 'expo-constants', replacement: join(root, 'test/stubs/expo-constants.ts') },
      { find: 'expo-file-system', replacement: join(root, 'test/stubs/expo-file-system.ts') },
      { find: 'expo-image-manipulator', replacement: join(root, 'test/stubs/expo-image-manipulator.ts') },
      { find: 'expo-sqlite/kv-store', replacement: join(root, 'test/stubs/expo-sqlite-kv-store.ts') },
      { find: /^@\/db$/, replacement: join(root, 'test/stubs/db.ts') },
      { find: /^@\//, replacement: `${root}/src/` },
    ],
  },
  test: {
    setupFiles: [join(root, 'test/setup.ts')],
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
  },
});
