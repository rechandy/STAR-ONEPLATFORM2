import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { EventEnvelope } from './envelope';
import { EVENT_TYPES } from './envelope';
import { studentMetricV1Schema } from './student-metric';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

/** Registry of payload validators keyed by event type (the "schema registry"). */
const validators: Record<string, ValidateFunction> = {
  [EVENT_TYPES.STUDENT_METRIC_V1]: ajv.compile(studentMetricV1Schema),
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validate a payload against the registered schema for `type`. */
export function validatePayload(type: string, payload: unknown): ValidationResult {
  const validate = validators[type];
  if (!validate) return { valid: false, errors: [`No schema registered for type: ${type}`] };
  const valid = validate(payload) as boolean;
  return {
    valid,
    errors: valid ? [] : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`.trim()),
  };
}

const ENVELOPE_FIELDS: (keyof EventEnvelope)[] = [
  'id',
  'type',
  'tenantId',
  'aggregateType',
  'aggregateId',
  'occurredAt',
  'schemaVersion',
  'payload',
];

/** Validate the envelope shape and its payload against the type's schema. */
export function validateEnvelope(env: EventEnvelope): ValidationResult {
  const errors: string[] = [];
  for (const f of ENVELOPE_FIELDS) {
    if (env[f] === undefined || env[f] === null) errors.push(`envelope.${String(f)} is required`);
  }
  if (errors.length) return { valid: false, errors };
  const payload = validatePayload(env.type, env.payload);
  return { valid: payload.valid, errors: payload.errors };
}

export function isRegisteredType(type: string): boolean {
  return type in validators;
}
