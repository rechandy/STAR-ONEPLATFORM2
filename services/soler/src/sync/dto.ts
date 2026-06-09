import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * A single offline-captured SOLER mutation. The iPad logs trials under a
 * client-created session while offline, then flushes the batch (see
 * docs/architecture/05-offline-sync-protocol.md). Three shapes:
 *   - session/create   -> open a data-collection session
 *   - trial/create     -> append one discrete-trial datapoint
 *   - session/finalize -> close the session; SOLER emits student.metric.v1
 */
export class MutationDto {
  /** client UUID — the idempotency key for the op. */
  @IsString()
  opId!: string;

  @IsIn(['session', 'trial'])
  collection!: string;

  @IsIn(['create', 'finalize'])
  op!: string;

  @IsOptional()
  schemaVersion?: number;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

/** Batched outbox flush: POST /api/sync/mutations. */
export class SyncMutationsDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsISO8601()
  clientTime?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MutationDto)
  mutations!: MutationDto[];
}

export type MutationStatus = 'applied' | 'duplicate' | 'conflict' | 'rejected';

export interface MutationResult {
  opId: string;
  status: MutationStatus;
  serverId?: string;
  error?: { code: string; message: string };
}
