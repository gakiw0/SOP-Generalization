import type { Condition, RuleSet, RuleSetV2 } from './schemaTypes'

export type ConditionType = Condition['type']
export type BasicConditionType = 'threshold' | 'range' | 'boolean' | 'composite'

export type DraftMeta = {
  schemaVersion: string
  ruleSetId: string
  sport: string
  sportVersion: string
  metricProfileId: string
  metricProfileType: 'generic' | 'preset'
  metricPresetId: string
  title: string
  description: string
}

export type ConditionDraft = {
  id: string
  type: ConditionType
  metric: string
  op: string
  valueText: string
  absVal: boolean
  tolerance: string
  logic: 'all' | 'any' | 'none'
  conditionRefs: string[]
  event: string
  windowPreMs: string
  windowPostMs: string
  windowFrames: string
  joints: string
  pair: string
  reference: 'global' | 'local'
}

export type CheckpointDraft = {
  id: string
  label: string
  description: string
  category: string
  severity: 'info' | 'warn' | 'fail'
  signalType: 'frame_range_ref' | 'direct' | 'event_window'
  signalRefStepId: string
  signalFrameStart: string
  signalFrameEnd: string
  signalEvent: string
  signalWindowPreMs: string
  signalWindowPostMs: string
  signalDefaultPhase: string
  scoreMode: 'weighted' | 'all-or-nothing' | 'average'
  passScore: string
  maxScore: string
  weightsText: string
  feedbackMessage: string
  feedbackSeverity: 'info' | 'warn' | 'fail'
  feedbackAttachToTs: string
  conditions: ConditionDraft[]
}

export type StepDraft = {
  id: string
  label: string
  description: string
  category: string
  rangeType: 'frame' | 'event'
  frameStart: string
  frameEnd: string
  eventName: string
  eventWindowPreMs: string
  eventWindowPostMs: string
  jointsOfInterest: string
  checkpoints: CheckpointDraft[]
}

export type CoachDraft = {
  metadata: DraftMeta
  steps: StepDraft[]
}

export type CoachDraftState = {
  draft: CoachDraft
  selectedStepId: string | null
  selectedCheckpointId: string | null
  expertCheckpointIds: string[]
}

const slugify = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '_')
  return normalized.length > 0 ? normalized : 'item'
}

const nextUniqueId = (base: string, usedIds: Set<string>): string => {
  const cleanBase = slugify(base)
  if (!usedIds.has(cleanBase)) return cleanBase

  let index = 2
  while (usedIds.has(`${cleanBase}_${index}`)) {
    index += 1
  }
  return `${cleanBase}_${index}`
}

export const createDefaultCondition = (
  usedIds: Set<string>,
  type: ConditionType = 'threshold'
): ConditionDraft => {
  const id = nextUniqueId('condition', usedIds)
  usedIds.add(id)
  return {
    id,
    type,
    metric: '',
    op: type === 'range' ? 'between' : 'gte',
    valueText: type === 'range' ? '0, 1' : '0',
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
  }
}

export const createDefaultCheckpoint = (
  stepId: string,
  usedRuleIds: Set<string>,
  usedConditionIds: Set<string>
): CheckpointDraft => {
  const id = nextUniqueId('checkpoint', usedRuleIds)
  usedRuleIds.add(id)
  const firstCondition = createDefaultCondition(usedConditionIds)

  return {
    id,
    label: '',
    description: '',
    category: '',
    severity: 'warn',
    signalType: 'frame_range_ref',
    signalRefStepId: stepId,
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
    feedbackMessage: '',
    feedbackSeverity: 'warn',
    feedbackAttachToTs: '',
    conditions: [firstCondition],
  }
}

export const createDefaultStep = (
  usedStepIds: Set<string>,
  usedRuleIds: Set<string>,
  usedConditionIds: Set<string>
): StepDraft => {
  const id = nextUniqueId('step', usedStepIds)
  usedStepIds.add(id)
  const checkpoint = createDefaultCheckpoint(id, usedRuleIds, usedConditionIds)

  return {
    id,
    label: '',
    description: '',
    category: '',
    rangeType: 'frame',
    frameStart: '0',
    frameEnd: '10',
    eventName: '',
    eventWindowPreMs: '-150',
    eventWindowPostMs: '150',
    jointsOfInterest: '',
    checkpoints: [checkpoint],
  }
}

export const createInitialDraft = (): CoachDraft => {
  const usedStepIds = new Set<string>()
  const usedRuleIds = new Set<string>()
  const usedConditionIds = new Set<string>()
  const firstStep = createDefaultStep(usedStepIds, usedRuleIds, usedConditionIds)

  return {
    metadata: {
      schemaVersion: '2.0.0',
      ruleSetId: 'motion_compare_custom',
      sport: '',
      sportVersion: '1.0.0',
      metricProfileId: 'generic_core',
      metricProfileType: 'generic',
      metricPresetId: '',
      title: '',
      description: '',
    },
    steps: [firstStep],
  }
}

export const createInitialState = (): CoachDraftState => {
  const draft = createInitialDraft()
  const firstStep = draft.steps[0]
  const firstCheckpoint = firstStep?.checkpoints[0]

  return {
    draft,
    selectedStepId: firstStep?.id ?? null,
    selectedCheckpointId: firstCheckpoint?.id ?? null,
    expertCheckpointIds: [],
  }
}

export const collectUsedIds = (draft: CoachDraft) => {
  const stepIds = new Set<string>()
  const checkpointIds = new Set<string>()
  const conditionIds = new Set<string>()

  draft.steps.forEach((step) => {
    stepIds.add(step.id)
    step.checkpoints.forEach((checkpoint) => {
      checkpointIds.add(checkpoint.id)
      checkpoint.conditions.forEach((condition) => {
        conditionIds.add(condition.id)
      })
    })
  })

  return { stepIds, checkpointIds, conditionIds }
}

export const conditionTypeIsBasic = (type: ConditionType): type is BasicConditionType =>
  ['threshold', 'range', 'boolean', 'composite'].includes(type)

export const normalizeRuleSetId = (value: string): string => slugify(value)

export const normalizeDraftForExport = (draft: CoachDraft): CoachDraft => ({
  ...draft,
  metadata: {
    ...draft.metadata,
    ruleSetId: normalizeRuleSetId(draft.metadata.ruleSetId),
  },
})

export const createDraftFromRuleSetMeta = (ruleSet: RuleSet): DraftMeta => {
  const isV2 = 'metric_profile' in ruleSet
  const v2Profile = isV2 ? (ruleSet as RuleSetV2).metric_profile : null

  return {
    schemaVersion: ruleSet.schema_version,
    ruleSetId: ruleSet.rule_set_id,
    sport: ruleSet.sport ?? '',
    sportVersion: ruleSet.sport_version ?? '1.0.0',
    metricProfileId: v2Profile?.id ?? 'generic_core',
    metricProfileType: v2Profile?.type ?? 'generic',
    metricPresetId: v2Profile?.preset_id ?? '',
    title: ruleSet.metadata.title,
    description: ruleSet.metadata.description ?? '',
  }
}
