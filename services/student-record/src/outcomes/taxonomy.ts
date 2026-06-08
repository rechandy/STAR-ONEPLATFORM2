import { MetricType } from '@prisma/client';

/** The four outcome families this service records and serves. */
export type OutcomeCategory = 'progress' | 'milestone' | 'assessment' | 'behavior';

/** Recordable metric types (teacher-logged student outcomes) -> their category. */
export const CATEGORY_BY_TYPE: Partial<Record<MetricType, OutcomeCategory>> = {
  [MetricType.TRIAL_SCORE]: 'progress',
  [MetricType.ACCURACY_SNAPSHOT]: 'progress',
  [MetricType.PROMPT_LEVEL_CHANGE]: 'progress',
  [MetricType.OBJECTIVE_MASTERED]: 'milestone',
  [MetricType.MILESTONE_ACHIEVED]: 'milestone',
  [MetricType.ASSESSMENT_SCORED]: 'assessment',
  [MetricType.BEHAVIOR_INCIDENT]: 'behavior',
  [MetricType.BEHAVIOR_OBSERVATION]: 'behavior',
};

export const RECORDABLE_TYPES = Object.keys(CATEGORY_BY_TYPE) as MetricType[];

export const TYPES_BY_CATEGORY: Record<OutcomeCategory, MetricType[]> = {
  progress: [],
  milestone: [],
  assessment: [],
  behavior: [],
};
for (const [type, cat] of Object.entries(CATEGORY_BY_TYPE)) {
  TYPES_BY_CATEGORY[cat as OutcomeCategory].push(type as MetricType);
}

export function categoryOf(type: MetricType): OutcomeCategory | undefined {
  return CATEGORY_BY_TYPE[type];
}

export function isRecordable(type: string): type is MetricType {
  return (RECORDABLE_TYPES as string[]).includes(type);
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * Validate the `value` payload for a recordable outcome. Returns an error
 * message, or null if valid. Keeps each family's data shape meaningful without
 * being overbearing.
 */
export function validateOutcomeValue(type: MetricType, value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'value must be an object';
  const v = value as Record<string, unknown>;
  switch (type) {
    case MetricType.TRIAL_SCORE:
      if (!num(v.trials) || !num(v.correct)) return 'TRIAL_SCORE requires numeric trials & correct';
      if (v.correct > v.trials) return 'correct cannot exceed trials';
      return null;
    case MetricType.ACCURACY_SNAPSHOT:
      if (!num(v.accuracy) || v.accuracy < 0 || v.accuracy > 1) return 'ACCURACY_SNAPSHOT requires accuracy in [0,1]';
      return null;
    case MetricType.PROMPT_LEVEL_CHANGE:
      if (!num(v.promptLevel)) return 'PROMPT_LEVEL_CHANGE requires numeric promptLevel';
      return null;
    case MetricType.MILESTONE_ACHIEVED:
      if (!str(v.title)) return 'MILESTONE_ACHIEVED requires a title';
      return null;
    case MetricType.OBJECTIVE_MASTERED:
      return null; // goalId on the mutation links the mastered objective
    case MetricType.ASSESSMENT_SCORED:
      if (!str(v.instrument)) return 'ASSESSMENT_SCORED requires an instrument';
      if (!num(v.score)) return 'ASSESSMENT_SCORED requires a numeric score';
      return null;
    case MetricType.BEHAVIOR_INCIDENT:
      if (!str(v.behavior)) return 'BEHAVIOR_INCIDENT requires a behavior description';
      if (v.intensity !== undefined && !str(v.intensity)) return 'intensity must be a string (low|medium|high)';
      return null;
    case MetricType.BEHAVIOR_OBSERVATION:
      if (!str(v.note) && !str(v.behavior)) return 'BEHAVIOR_OBSERVATION requires a note or behavior';
      return null;
    default:
      return `Unsupported outcome type: ${type}`;
  }
}
