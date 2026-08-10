import { beforeEach, describe, expect, test } from 'vitest';

import {
  insertPendingCapture,
  listPendingCaptures,
  MAX_PENDING_CAPTURES,
  PendingCaptureLimitError,
  recordPendingCaptureAttempt,
  removePendingCapture,
} from '@/db/queries';
import { openTestDatabase } from './stubs/db';

describe('pending captures', () => {
  beforeEach(() => {
    openTestDatabase();
  });

  test('persists retry state and removes the image reference on discard', async () => {
    const capture = await insertPendingCapture('file://capture.jpg', 'receipt');
    await recordPendingCaptureAttempt(capture.id, 'network', false);

    expect(await listPendingCaptures()).toMatchObject([{
      id: capture.id,
      imageUri: 'file://capture.jpg',
      detectedKind: 'receipt',
      status: 'pending',
      retryCount: 1,
      lastErrorKind: 'network',
    }]);
    expect(await removePendingCapture(capture.id)).toBe('file://capture.jpg');
    expect(await listPendingCaptures()).toEqual([]);
  });

  test('refuses captures once the durable queue reaches its explicit limit', async () => {
    for (let index = 0; index < MAX_PENDING_CAPTURES; index += 1) {
      await insertPendingCapture(`file://capture-${index}.jpg`);
    }

    await expect(insertPendingCapture('file://one-too-many.jpg'))
      .rejects.toBeInstanceOf(PendingCaptureLimitError);
  });
});
