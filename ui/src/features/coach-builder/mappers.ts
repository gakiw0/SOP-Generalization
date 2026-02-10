import {
  createDraftFromRuleSetMeta,
  type CheckpointDraft,
  type CoachDraft,
  type ConditionDraft,
  type ConditionType,
  type StepDraft,
} from './draftTypes'
import type {
  Condition,
  Feedback,
  Phase,
  Rule,
  RuleSet,
  Signal,
  ValidationError,
} from './schemaTypes'

const parseNumber = (value: string, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseIntList = (value: string): number[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Math.trunc(entry))

const parseNumberPair = (value: string, fallback: [number, number]): [number, number] => {
  const nums = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => Number(entry))

  if (nums.length < 2 || !Number.isFinite(nums[0]) || !Number.isFinite(nums[1])) {
    return fallback
  }

  return [nums[0], nums[1]]
}

const parseIntPair = (value: string, fallback: [number, number]): [number, number] => {
  const pair = parseNumberPair(value, fallback)
  return [Math.trunc(pair[0]), Math.trunc(pair[1])]
}

const serializeNumberArray = (value: number[]): string => value.join(', ')

const serializeValue = (value: number | [number, number]): string =>
  Array.isArray(value) ? value.join(', ') : String(value)

const conditionToDraft = (condition: Condition): ConditionDraft => {
  const common: ConditionDraft = {
    id: condition.id,
    type: condition.type,
    metric: 'metric' in condition ? condition.metric ?? '' : '',
    op: 'op' in condition ? String(condition.op ?? '') : '',
    valueText: 'value' in condition ? serializeValue(condition.value as number | [number, number]) : '',
    absVal: 'abs_val' in condition ? Boolean(condition.abs_val) : false,
    tolerance: 'tolerance' in condition && condition.tolerance != null ? String(condition.tolerance) : '',
    logic: 'logic' in condition ? condition.logic : 'all',
    conditionRefs: 'conditions' in condition ? [...condition.conditions] : [],
    event: 'event' in condition ? condition.event : '',
    windowPreMs: 'window_ms' in condition && condition.window_ms ? String(condition.window_ms[0]) : '',
    windowPostMs: 'window_ms' in condition && condition.window_ms ? String(condition.window_ms[1]) : '',
    windowFrames: 'window_frames' in condition && condition.window_frames != null ? String(condition.window_frames) : '',
    joints: 'joints' in condition ? serializeNumberArray(condition.joints) : '',
    pair: 'pair' in condition ? serializeNumberArray(condition.pair) : '',
    reference: 'reference' in condition && condition.reference ? condition.reference : 'global',
  }

  if (condition.type === 'range') {
    common.op = 'between'
  }

  return common
}

const signalToDraft = (
  signal: Signal,
  stepId: string
): Pick<
  CheckpointDraft,
  | 'signalType'
  | 'signalRefStepId'
  | 'signalFrameStart'
  | 'signalFrameEnd'
  | 'signalEvent'
  | 'signalWindowPreMs'
  | 'signalWindowPostMs'
  | 'signalDefaultPhase'
> => {
  if (signal.type === 'frame_range_ref') {
    return {
      signalType: 'frame_range_ref',
      signalRefStepId: signal.ref.startsWith('phase:') ? signal.ref.slice('phase:'.length) : stepId,
      signalFrameStart: '0',
      signalFrameEnd: '0',
      signalEvent: '',
      signalWindowPreMs: '-150',
      signalWindowPostMs: '150',
      signalDefaultPhase: '',
    }
  }

  if (signal.type === 'direct') {
    return {
      signalType: 'direct',
      signalRefStepId: stepId,
      signalFrameStart: String(signal.frame_range[0]),
      signalFrameEnd: String(signal.frame_range[1]),
      signalEvent: '',
      signalWindowPreMs: '-150',
      signalWindowPostMs: '150',
      signalDefaultPhase: '',
    }
  }

  return {
    signalType: 'event_window',
    signalRefStepId: stepId,
    signalFrameStart: '0',
    signalFrameEnd: '0',
    signalEvent: signal.event,
    signalWindowPreMs: String(signal.window_ms[0]),
    signalWindowPostMs: String(signal.window_ms[1]),
    signalDefaultPhase: signal.default_phase ?? '',
  }
}

const phaseToDraftStep = (phase: Phase): StepDraft => ({
  id: phase.id,
  label: phase.label,
  description: phase.description ?? '',
  category: 'batting',
  rangeType: phase.frame_range ? 'frame' : 'event',
  frameStart: phase.frame_range ? String(phase.frame_range[0]) : '0',
  frameEnd: phase.frame_range ? String(phase.frame_range[1]) : '0',
  eventName: phase.event_window?.event ?? '',
  eventWindowPreMs: phase.event_window ? String(phase.event_window.window_ms[0]) : '-150',
  eventWindowPostMs: phase.event_window ? String(phase.event_window.window_ms[1]) : '150',
  jointsOfInterest: serializeNumberArray(phase.joints_of_interest ?? []),
  checkpoints: [],
})

const parseWeights = (value: string): Record<string, number> | undefined => {
  if (value.trim().length === 0) return undefined

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.includes(':'))
    .map((entry) => {
      const [key, raw] = entry.split(':', 2)
      return [key.trim(), Number(raw)] as const
    })
    .filter(([key, val]) => key.length > 0 && Number.isFinite(val))

  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

const parseCondition = (draft: ConditionDraft): Condition => {
  const type = draft.type
  const conditionId = draft.id

  if (type === 'threshold') {
    return {
      id: conditionId,
      type,
      metric: draft.metric,
      op: ['gte', 'gt', 'lte', 'lt', 'eq', 'neq'].includes(draft.op)
        ? (draft.op as 'gte' | 'gt' | 'lte' | 'lt' | 'eq' | 'neq')
        : 'gte',
      value: parseNumber(draft.valueText, 0),
      tolerance: draft.tolerance.trim().length ? parseNumber(draft.tolerance, 0) : undefined,
      abs_val: draft.absVal,
    }
  }

  if (type === 'range') {
    return {
      id: conditionId,
      type,
      metric: draft.metric,
      op: 'between',
      value: parseNumberPair(draft.valueText, [0, 1]),
      tolerance: draft.tolerance.trim().length ? parseNumber(draft.tolerance, 0) : undefined,
      abs_val: draft.absVal,
    }
  }

  if (type === 'boolean') {
    return {
      id: conditionId,
      type,
      metric: draft.metric,
      op: draft.op === 'is_false' ? 'is_false' : 'is_true',
    }
  }

  if (type === 'composite') {
    return {
      id: conditionId,
      type,
      logic: draft.logic,
      conditions: draft.conditionRefs,
    }
  }

  if (type === 'event_exists') {
    const hasWindow = draft.windowPreMs.trim().length > 0 && draft.windowPostMs.trim().length > 0
    return {
      id: conditionId,
      type,
      event: draft.event,
      window_ms: hasWindow
        ? [parseNumber(draft.windowPreMs, -150), parseNumber(draft.windowPostMs, 150)]
        : undefined,
    }
  }

  if (type === 'trend') {
    const hasWindowMs = draft.windowPreMs.trim().length > 0 && draft.windowPostMs.trim().length > 0
    return {
      id: conditionId,
      type,
      metric: draft.metric,
      op: draft.op === 'decreasing' ? 'decreasing' : 'increasing',
      window_frames: draft.windowFrames.trim().length > 0 ? Math.max(1, Math.trunc(parseNumber(draft.windowFrames, 1))) : undefined,
      window_ms: hasWindowMs
        ? [parseNumber(draft.windowPreMs, -150), parseNumber(draft.windowPostMs, 150)]
        : undefined,
    }
  }

  if (type === 'angle') {
    const between = draft.op === 'between'
    return {
      id: conditionId,
      type,
      joints: parseIntList(draft.joints),
      reference: draft.reference,
      op: between ? 'between' : (['gte', 'gt', 'lte', 'lt', 'eq', 'neq'].includes(draft.op) ? draft.op : 'gte'),
      value: between ? parseNumberPair(draft.valueText, [0, 1]) : parseNumber(draft.valueText, 0),
      tolerance: draft.tolerance.trim().length ? parseNumber(draft.tolerance, 0) : undefined,
    }
  }

  const between = draft.op === 'between'
  return {
    id: conditionId,
    type: 'distance',
    pair: parseIntPair(draft.pair, [0, 1]),
    metric: draft.metric || undefined,
    op: between ? 'between' : (['gte', 'gt', 'lte', 'lt', 'eq', 'neq'].includes(draft.op) ? draft.op : 'gte'),
    value: between ? parseNumberPair(draft.valueText, [0, 1]) : parseNumber(draft.valueText, 0),
    tolerance: draft.tolerance.trim().length ? parseNumber(draft.tolerance, 0) : undefined,
  }
}

const toSignal = (checkpoint: CheckpointDraft, stepId: string): Signal => {
  if (checkpoint.signalType === 'direct') {
    return {
      type: 'direct',
      frame_range: [
        Math.trunc(parseNumber(checkpoint.signalFrameStart, 0)),
        Math.trunc(parseNumber(checkpoint.signalFrameEnd, 0)),
      ],
    }
  }

  if (checkpoint.signalType === 'event_window') {
    return {
      type: 'event_window',
      event: checkpoint.signalEvent,
      window_ms: [
        parseNumber(checkpoint.signalWindowPreMs, -150),
        parseNumber(checkpoint.signalWindowPostMs, 150),
      ],
      default_phase: checkpoint.signalDefaultPhase || undefined,
    }
  }

  return {
    type: 'frame_range_ref',
    ref: `phase:${checkpoint.signalRefStepId || stepId}`,
  }
}

const toFeedback = (checkpoint: CheckpointDraft): Feedback[] => {
  if (checkpoint.feedbackMessage.trim().length === 0) return []

  return [
    {
      condition_ids: checkpoint.conditions.map((condition) => condition.id),
      message: checkpoint.feedbackMessage,
      severity: checkpoint.feedbackSeverity,
      attach_to_ts: checkpoint.feedbackAttachToTs.trim().length ? checkpoint.feedbackAttachToTs.trim() : undefined,
    },
  ]
}

const stepToPhase = (step: StepDraft): Phase => {
  const base: Phase = {
    id: step.id,
    label: step.label,
    description: step.description || undefined,
    joints_of_interest: parseIntList(step.jointsOfInterest),
  }

  if (step.rangeType === 'event') {
    return {
      ...base,
      event_window: {
        event: step.eventName,
        window_ms: [parseNumber(step.eventWindowPreMs, -150), parseNumber(step.eventWindowPostMs, 150)],
      },
    }
  }

  return {
    ...base,
    frame_range: [Math.trunc(parseNumber(step.frameStart, 0)), Math.trunc(parseNumber(step.frameEnd, 0))],
  }
}

const checkpointToRule = (checkpoint: CheckpointDraft, stepId: string): Rule => {
  const score = {
    mode: checkpoint.scoreMode,
    weights: checkpoint.scoreMode === 'weighted' ? parseWeights(checkpoint.weightsText) : undefined,
    pass_score: parseNumber(checkpoint.passScore, 1),
    max_score: parseNumber(checkpoint.maxScore, 1),
  }

  return {
    id: checkpoint.id,
    label: checkpoint.label,
    description: checkpoint.description || undefined,
    phase: stepId,
    category: checkpoint.category,
    severity: checkpoint.severity,
    signal: toSignal(checkpoint, stepId),
    conditions: checkpoint.conditions.map(parseCondition),
    score,
    feedback: toFeedback(checkpoint),
  }
}

export const toRuleSetSchemaV1 = (draft: CoachDraft): RuleSet => {
  const phases = draft.steps.map(stepToPhase)
  const rules = draft.steps.flatMap((step) =>
    step.checkpoints.map((checkpoint) => checkpointToRule(checkpoint, step.id))
  )

  return {
    schema_version: draft.metadata.schemaVersion,
    rule_set_id: draft.metadata.ruleSetId,
    sport: draft.metadata.sport,
    sport_version: draft.metadata.sportVersion,
    metadata: {
      title: draft.metadata.title,
      description: draft.metadata.description || undefined,
    },
    inputs: {
      expected_fps: 30,
      keypoints_format: 'openpose25',
      camera_view: 'side',
      preprocess: ['align_orientation', 'normalize_lengths'],
    },
    globals: {
      confidence_threshold: 0,
      angle_units: 'degrees',
      feature_pipeline: [],
    },
    phases,
    rules,
  }
}

export const fromRuleSetSchemaV1 = (ruleSet: RuleSet): CoachDraft => {
  const stepsById = new Map<string, StepDraft>()

  ruleSet.phases.forEach((phase) => {
    stepsById.set(phase.id, phaseToDraftStep(phase))
  })

  ruleSet.rules.forEach((rule) => {
    const targetStep = stepsById.get(rule.phase)
    if (!targetStep) return

    const signalDraft = signalToDraft(rule.signal, rule.phase)
    const firstFeedback = rule.feedback?.[0]

    const checkpoint: CheckpointDraft = {
      id: rule.id,
      label: rule.label,
      description: rule.description ?? '',
      category: rule.category,
      severity: rule.severity,
      ...signalDraft,
      scoreMode: rule.score.mode,
      passScore: String(rule.score.pass_score),
      maxScore: String(rule.score.max_score),
      weightsText:
        rule.score.weights == null
          ? ''
          : Object.entries(rule.score.weights)
              .map(([key, value]) => `${key}:${value}`)
              .join(', '),
      feedbackMessage: firstFeedback?.message ?? '',
      feedbackSeverity: firstFeedback?.severity ?? 'warn',
      feedbackAttachToTs: firstFeedback?.attach_to_ts ?? '',
      conditions: rule.conditions.map(conditionToDraft),
    }

    targetStep.checkpoints.push(checkpoint)
  })

  const steps = [...stepsById.values()].map((step) => {
    if (step.checkpoints.length > 0) return step

    return {
      ...step,
      checkpoints: [
        {
          id: `${step.id}_checkpoint`,
          label: 'Checkpoint',
          description: '',
          category: step.category,
          severity: 'warn',
          signalType: 'frame_range_ref',
          signalRefStepId: step.id,
          signalFrameStart: '0',
          signalFrameEnd: '0',
          signalEvent: '',
          signalWindowPreMs: '-150',
          signalWindowPostMs: '150',
          signalDefaultPhase: '',
          scoreMode: 'all-or-nothing',
          passScore: '1',
          maxScore: '1',
          weightsText: '',
          feedbackMessage: 'Adjust movement to match coach reference.',
          feedbackSeverity: 'warn',
          feedbackAttachToTs: '',
          conditions: [
            {
              id: `${step.id}_condition`,
              type: 'threshold',
              metric: '',
              op: 'gte',
              valueText: '0',
              absVal: false,
              tolerance: '',
              logic: 'all',
              conditionRefs: [],
              event: '',
              windowPreMs: '',
              windowPostMs: '',
              windowFrames: '',
              joints: '',
              pair: '',
              reference: 'global',
            },
          ],
        },
      ],
    }
  })

  return {
    metadata: createDraftFromRuleSetMeta(ruleSet),
    steps,
  }
}

export const summarizeValidation = (errors: ValidationError[]): string => {
  if (errors.length === 0) return 'Validation passed.'
  return `Validation failed with ${errors.length} issue(s).`
}

export const supportsExpertConditionType = (type: ConditionType): boolean =>
  ['event_exists', 'trend', 'angle', 'distance'].includes(type)
