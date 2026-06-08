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

/** A single offline-captured mutation (see docs/architecture/05-offline-sync-protocol.md §2.1). */
export class MutationDto {
  /** client UUID — the idempotency key (== MetricEvent.idempotencyKey). */
  @IsString()
  opId!: string;

  @IsIn(['metricEvent'])
  collection!: string;

  @IsIn(['create'])
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
