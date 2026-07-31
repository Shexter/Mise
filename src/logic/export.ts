import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

import { LATEST_VERSION } from '@/db/schema';
import { exportEverything } from '@/db/queries';

/**
 * Exports everything as JSON through the system share sheet.
 *
 * The bundle is written to a temporary file in the cache directory and shared by
 * URL on iOS (which handles file shares natively). On Android, where the core
 * `Share` API only takes a string, the JSON is shared as a message — fine for a
 * single-user diary, which stays small. No `expo-sharing` dependency is pulled
 * in; the approved set is kept intact.
 */
export async function exportData(): Promise<boolean> {
  const bundle = await exportEverything(LATEST_VERSION);
  const json = JSON.stringify(bundle, null, 2);

  if (Platform.OS === 'ios') {
    const file = new File(new Directory(Paths.cache), `snap-export-${randomUUID()}.json`);
    file.write(json);
    const result = await Share.share({ url: file.uri, title: 'Snap data export' });
    return result.action !== Share.dismissedAction;
  }

  const result = await Share.share({ message: json, title: 'Snap data export' });
  return result.action !== Share.dismissedAction;
}
