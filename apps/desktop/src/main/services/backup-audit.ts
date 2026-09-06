import type { IDatabase } from './database.interface';
import type { ActivityAction } from '../../shared/types';
import { logger } from './logger';

interface AuditParams {
  action: ActivityAction;
  description: string;
  details?: Record<string, unknown>;
}

/**
 * Best-effort audit-log write for backup lifecycle events. Failures are
 * logged but never bubble — a broken audit-log write must not fail the
 * underlying backup / restore operation.
 */
export async function logBackupEvent(db: IDatabase, params: AuditParams): Promise<void> {
  try {
    await db.createActivityLog({
      action: params.action,
      category: 'system',
      description: params.description,
      details: params.details,
    });
  } catch (err) {
    logger.warn('Failed to write backup audit entry', {
      action: params.action,
      err,
    });
  }
}
