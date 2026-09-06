import { describe, expect, it, vi } from 'vitest';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logBackupEvent } from './backup-audit';
import { logger } from './logger';

describe('logBackupEvent', () => {
  it('calls createActivityLog with the system category', async () => {
    const createActivityLog = vi.fn(async () => ({ id: 'a1' }));
    await logBackupEvent({ createActivityLog } as never, {
      action: 'backup_exported',
      description: 'exported N records',
      details: { path: '/tmp/x' },
    });
    expect(createActivityLog).toHaveBeenCalledWith({
      action: 'backup_exported',
      category: 'system',
      description: 'exported N records',
      details: { path: '/tmp/x' },
    });
  });

  it('swallows errors so the underlying backup op is never blocked', async () => {
    const createActivityLog = vi.fn(async () => {
      throw new Error('activity log write failed');
    });
    // Should NOT throw
    await expect(
      logBackupEvent({ createActivityLog } as never, {
        action: 'backup_exported',
        description: 'x',
      })
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to write backup audit entry',
      expect.objectContaining({ action: 'backup_exported' })
    );
  });

  it('does not throw when createActivityLog is missing entirely', async () => {
    await expect(
      logBackupEvent({} as never, {
        action: 'backup_auto_enabled',
        description: 'enabled',
      })
    ).resolves.toBeUndefined();
  });
});
