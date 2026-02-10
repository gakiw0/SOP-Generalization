import type {
  AngleCondition,
  BooleanCondition,
  CompositeCondition,
  DistanceCondition,
  EventExistsCondition,
  Phase,
  RangeCondition,
  Rule,
  RuleSet,
  ThresholdCondition,
  TrendCondition,
  ValidationCode,
  ValidationError,
} from './schemaTypes'

const ID_RE = /^[A-Za-z0-9_.-]+$/

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isSemver = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isFiniteInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value)

const isNonNegativeIntPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  isFiniteInt(value[0]) &&
  isFiniteInt(value[1]) &&
  value[0] >= 0 &&
  value[1] >= 0

const isNumberPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  isFiniteNumber(value[0]) &&
  isFiniteNumber(value[1])

const pushError = (
  errors: ValidationError[],
  path: string,
  code: ValidationCode,
  params?: Record<string, string | number>
) => {
  errors.push({ path, code, params })
}

const validatePhase = (
  phase: Phase,
  index: number,
  errors: ValidationError[],
  phaseIds: Set<string>
) => {
  const basePath = `phases[${index}]`

  if (!isNonEmptyString(phase.id)) {
    pushError(errors, `${basePath}.id`, 'required')
  } else if (!ID_RE.test(phase.id)) {
    pushError(errors, `${basePath}.id`, 'invalid_id_format')
  } else if (phaseIds.has(phase.id)) {
    pushError(errors, `${basePath}.id`, 'duplicate_phase_id', { id: phase.id })
  } else {
    phaseIds.add(phase.id)
  }

  if (!isNonEmptyString(phase.label)) {
    pushError(errors, `${basePath}.label`, 'required')
  }

  const hasFrameRange = phase.frame_range != null
  const hasEventWindow = phase.event_window != null

  if (hasFrameRange === hasEventWindow) {
    pushError(errors, basePath, 'phase_range_mode_required')
  }

  if (hasFrameRange && !isNonNegativeIntPair(phase.frame_range)) {
    pushError(errors, `${basePath}.frame_range`, 'frame_range_invalid')
  }

  if (hasEventWindow) {
    const eventWindow = phase.event_window
    if (!eventWindow || !isNonEmptyString(eventWindow.event)) {
      pushError(errors, `${basePath}.event_window.event`, 'required')
    }
    if (!isNumberPair(eventWindow?.window_ms)) {
      pushError(errors, `${basePath}.event_window.window_ms`, 'window_ms_invalid')
    }
  }

  if (phase.joints_of_interest != null) {
    if (
      !Array.isArray(phase.joints_of_interest) ||
      phase.joints_of_interest.some((jointId) => !isFiniteInt(jointId) || jointId < 0)
    ) {
      pushError(errors, `${basePath}.joints_of_interest`, 'integer_array_non_negative')
    }
  }
}

const validateSignal = (
  rule: Rule,
  index: number,
  errors: ValidationError[],
  phaseIds: Set<string>
) => {
  const basePath = `rules[${index}].signal`

  if (!rule.signal || !isNonEmptyString(rule.signal.type)) {
    pushError(errors, `${basePath}.type`, 'required')
    return
  }

  if (rule.signal.type === 'frame_range_ref') {
    if (!isNonEmptyString(rule.signal.ref)) {
      pushError(errors, `${basePath}.ref`, 'signal_ref_required')
      return
    }

    if (!rule.signal.ref.startsWith('phase:')) {
      pushError(errors, `${basePath}.ref`, 'signal_ref_format')
      return
    }

    const phaseId = rule.signal.ref.slice('phase:'.length)
    if (!phaseIds.has(phaseId)) {
      pushError(errors, `${basePath}.ref`, 'unknown_phase', { id: phaseId })
    }
    return
  }

  if (rule.signal.type === 'event_window') {
    if (!isNonEmptyString(rule.signal.event)) {
      pushError(errors, `${basePath}.event`, 'signal_event_required')
    }
    if (!isNumberPair(rule.signal.window_ms)) {
      pushError(errors, `${basePath}.window_ms`, 'window_ms_invalid')
    }
    if (rule.signal.default_phase != null && rule.signal.default_phase !== '') {
      if (!phaseIds.has(rule.signal.default_phase)) {
        pushError(errors, `${basePath}.default_phase`, 'unknown_phase', {
          id: rule.signal.default_phase,
        })
      }
    }
    return
  }

  if (rule.signal.type === 'direct') {
    if (!isNonNegativeIntPair(rule.signal.frame_range)) {
      pushError(errors, `${basePath}.frame_range`, 'frame_range_invalid')
    }
    if (
      rule.signal.joints != null &&
      (!Array.isArray(rule.signal.joints) ||
        rule.signal.joints.some((jointId) => !isFiniteInt(jointId) || jointId < 0))
    ) {
      pushError(errors, `${basePath}.joints`, 'integer_array_non_negative')
    }
    return
  }

  pushError(errors, `${basePath}.type`, 'signal_type_invalid', {
    type: String((rule.signal as { type?: unknown }).type ?? ''),
  })
}

const validateThreshold = (
  cond: ThresholdCondition,
  path: string,
  errors: ValidationError[]
) => {
  if (!isNonEmptyString(cond.metric)) pushError(errors, path, 'metric_required')
  if (!['gte', 'gt', 'lte', 'lt', 'eq', 'neq'].includes(cond.op)) pushError(errors, path, 'op_invalid')
  if (!isFiniteNumber(cond.value)) pushError(errors, path, 'value_number_required')
  if (cond.tolerance != null && !isFiniteNumber(cond.tolerance)) {
    pushError(errors, path, 'tolerance_number_required')
  }
}

const validateRange = (cond: RangeCondition, path: string, errors: ValidationError[]) => {
  if (!isNonEmptyString(cond.metric)) pushError(errors, path, 'metric_required')
  if (cond.op !== 'between') pushError(errors, path, 'op_invalid')
  if (!isNumberPair(cond.value)) pushError(errors, path, 'value_pair_required')
  if (cond.tolerance != null && !isFiniteNumber(cond.tolerance)) {
    pushError(errors, path, 'tolerance_number_required')
  }
}

const validateBoolean = (cond: BooleanCondition, path: string, errors: ValidationError[]) => {
  if (!isNonEmptyString(cond.metric)) pushError(errors, path, 'metric_required')
  if (!['is_true', 'is_false'].includes(cond.op)) pushError(errors, path, 'op_invalid')
}

const validateEventExists = (
  cond: EventExistsCondition,
  path: string,
  errors: ValidationError[]
) => {
  if (!isNonEmptyString(cond.event)) pushError(errors, path, 'event_required')
  if (cond.window_ms != null && !isNumberPair(cond.window_ms)) {
    pushError(errors, path, 'window_ms_invalid')
  }
}

const validateTrend = (cond: TrendCondition, path: string, errors: ValidationError[]) => {
  if (!isNonEmptyString(cond.metric)) pushError(errors, path, 'metric_required')
  if (!['increasing', 'decreasing'].includes(cond.op)) pushError(errors, path, 'op_invalid')
  if (cond.window_frames != null && (!isFiniteInt(cond.window_frames) || cond.window_frames < 1)) {
    pushError(errors, path, 'window_frames_invalid')
  }
  if (cond.window_ms != null && !isNumberPair(cond.window_ms)) {
    pushError(errors, path, 'window_ms_invalid')
  }
}

const validateAngle = (cond: AngleCondition, path: string, errors: ValidationError[]) => {
  if (
    !Array.isArray(cond.joints) ||
    cond.joints.length < 2 ||
    cond.joints.length > 3 ||
    cond.joints.some((jointId) => !isFiniteInt(jointId) || jointId < 0)
  ) {
    pushError(errors, path, 'joints_invalid')
  }

  if (!['gte', 'gt', 'lte', 'lt', 'eq', 'neq', 'between'].includes(cond.op)) {
    pushError(errors, path, 'op_invalid')
  }

  if (cond.op === 'between') {
    if (!isNumberPair(cond.value)) pushError(errors, path, 'value_pair_required')
  } else if (!isFiniteNumber(cond.value)) {
    pushError(errors, path, 'value_number_required')
  }
}

const validateDistance = (cond: DistanceCondition, path: string, errors: ValidationError[]) => {
  if (!isNonNegativeIntPair(cond.pair)) pushError(errors, path, 'pair_invalid')

  if (!['gte', 'gt', 'lte', 'lt', 'eq', 'neq', 'between'].includes(cond.op)) {
    pushError(errors, path, 'op_invalid')
  }

  if (cond.op === 'between') {
    if (!isNumberPair(cond.value)) pushError(errors, path, 'value_pair_required')
  } else if (!isFiniteNumber(cond.value)) {
    pushError(errors, path, 'value_number_required')
  }
}

const validateComposite = (
  cond: CompositeCondition,
  path: string,
  errors: ValidationError[],
  condIds: Set<string>
) => {
  if (!['all', 'any', 'none'].includes(cond.logic)) pushError(errors, path, 'logic_invalid')
  if (!Array.isArray(cond.conditions) || cond.conditions.length === 0) {
    pushError(errors, path, 'condition_refs_required')
    return
  }

  cond.conditions.forEach((condId) => {
    if (!condIds.has(condId)) {
      pushError(errors, path, 'unknown_condition_ref', { id: condId })
    }
  })
}

const validateConditions = (rule: Rule, ruleIndex: number, errors: ValidationError[]) => {
  const basePath = `rules[${ruleIndex}].conditions`

  if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
    pushError(errors, basePath, 'condition_required')
    return
  }

  const condIds = new Set<string>()
  const compositeConditions: Array<{ cond: CompositeCondition; path: string }> = []

  rule.conditions.forEach((cond, condIndex) => {
    const path = `${basePath}[${condIndex}]`
    if (!isNonEmptyString(cond.id)) {
      pushError(errors, `${path}.id`, 'required')
      return
    }
    if (!ID_RE.test(cond.id)) {
      pushError(errors, `${path}.id`, 'invalid_id_format')
      return
    }
    if (condIds.has(cond.id)) {
      pushError(errors, `${path}.id`, 'duplicate_condition_id', { id: cond.id })
      return
    }
    condIds.add(cond.id)

    switch (cond.type) {
      case 'threshold':
        validateThreshold(cond, path, errors)
        break
      case 'range':
        validateRange(cond, path, errors)
        break
      case 'boolean':
        validateBoolean(cond, path, errors)
        break
      case 'event_exists':
        validateEventExists(cond, path, errors)
        break
      case 'trend':
        validateTrend(cond, path, errors)
        break
      case 'angle':
        validateAngle(cond, path, errors)
        break
      case 'distance':
        validateDistance(cond, path, errors)
        break
      case 'composite':
        compositeConditions.push({ cond, path })
        break
      default:
        pushError(errors, `${path}.type`, 'condition_type_invalid', {
          type: String((cond as { type?: unknown }).type ?? ''),
        })
    }
  })

  compositeConditions.forEach(({ cond, path }) => {
    validateComposite(cond, path, errors, condIds)
  })
}

const validateScore = (rule: Rule, index: number, errors: ValidationError[]) => {
  const basePath = `rules[${index}].score`
  if (!rule.score) {
    pushError(errors, basePath, 'score_required')
    return
  }

  if (!['weighted', 'all-or-nothing', 'average'].includes(rule.score.mode)) {
    pushError(errors, `${basePath}.mode`, 'score_mode_invalid')
  }

  if (!isFiniteNumber(rule.score.pass_score)) {
    pushError(errors, `${basePath}.pass_score`, 'pass_score_invalid')
  }

  if (!isFiniteNumber(rule.score.max_score) || rule.score.max_score < 0) {
    pushError(errors, `${basePath}.max_score`, 'max_score_invalid')
  }

  if (rule.score.mode === 'weighted') {
    if (!rule.score.weights || Object.keys(rule.score.weights).length === 0) {
      pushError(errors, `${basePath}.weights`, 'weighted_requires_weights')
    }
  }
}

const validateFeedback = (rule: Rule, index: number, errors: ValidationError[]) => {
  if (!rule.feedback) return

  const conditionIds = new Set(rule.conditions.map((cond) => cond.id))
  const basePath = `rules[${index}].feedback`

  rule.feedback.forEach((feedback, feedbackIndex) => {
    const path = `${basePath}[${feedbackIndex}]`
    if (!Array.isArray(feedback.condition_ids) || feedback.condition_ids.length === 0) {
      pushError(errors, `${path}.condition_ids`, 'feedback_condition_ids_required')
    } else {
      feedback.condition_ids.forEach((condId) => {
        if (!conditionIds.has(condId)) {
          pushError(errors, `${path}.condition_ids`, 'feedback_unknown_condition', { id: condId })
        }
      })
    }

    if (!isNonEmptyString(feedback.message)) {
      pushError(errors, `${path}.message`, 'feedback_message_required')
    }

    if (!['info', 'warn', 'fail'].includes(feedback.severity)) {
      pushError(errors, `${path}.severity`, 'severity_invalid')
    }

    if (
      feedback.attach_to_ts != null &&
      feedback.attach_to_ts !== '' &&
      !/^(event:[A-Za-z0-9_.-]+|frame:[0-9]+)$/.test(feedback.attach_to_ts)
    ) {
      pushError(errors, `${path}.attach_to_ts`, 'attach_to_ts_invalid')
    }
  })
}

export const validateRuleSet = (ruleSet: RuleSet): ValidationError[] => {
  const errors: ValidationError[] = []

  if (!isSemver(ruleSet.schema_version)) pushError(errors, 'schema_version', 'invalid_semver')
  if (!isNonEmptyString(ruleSet.rule_set_id)) pushError(errors, 'rule_set_id', 'required')
  if (!isNonEmptyString(ruleSet.sport)) pushError(errors, 'sport', 'required')
  if (!isSemver(ruleSet.sport_version)) pushError(errors, 'sport_version', 'invalid_semver')
  if (!isNonEmptyString(ruleSet.metadata?.title)) pushError(errors, 'metadata.title', 'required')

  if (!Array.isArray(ruleSet.phases) || ruleSet.phases.length === 0) {
    pushError(errors, 'phases', 'phases_required')
  }

  if (!Array.isArray(ruleSet.rules) || ruleSet.rules.length === 0) {
    pushError(errors, 'rules', 'rules_required')
  }

  const phaseIds = new Set<string>()
  ruleSet.phases.forEach((phase, index) => validatePhase(phase, index, errors, phaseIds))

  const ruleIds = new Set<string>()
  ruleSet.rules.forEach((rule, index) => {
    const basePath = `rules[${index}]`

    if (!isNonEmptyString(rule.id)) {
      pushError(errors, `${basePath}.id`, 'required')
    } else if (!ID_RE.test(rule.id)) {
      pushError(errors, `${basePath}.id`, 'invalid_id_format')
    } else if (ruleIds.has(rule.id)) {
      pushError(errors, `${basePath}.id`, 'duplicate_rule_id', { id: rule.id })
    } else {
      ruleIds.add(rule.id)
    }

    if (!isNonEmptyString(rule.label)) pushError(errors, `${basePath}.label`, 'required')

    if (!isNonEmptyString(rule.phase)) {
      pushError(errors, `${basePath}.phase`, 'required')
    } else if (!phaseIds.has(rule.phase)) {
      pushError(errors, `${basePath}.phase`, 'unknown_phase', { id: rule.phase })
    }

    if (!isNonEmptyString(rule.category)) pushError(errors, `${basePath}.category`, 'required')

    if (!['info', 'warn', 'fail'].includes(rule.severity)) {
      pushError(errors, `${basePath}.severity`, 'severity_invalid')
    }

    validateSignal(rule, index, errors, phaseIds)
    validateConditions(rule, index, errors)
    validateScore(rule, index, errors)
    validateFeedback(rule, index, errors)
  })

  return errors
}
