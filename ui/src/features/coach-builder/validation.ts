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

const validatePhase = (
  phase: Phase,
  index: number,
  errors: ValidationError[],
  phaseIds: Set<string>
) => {
  const basePath = `phases[${index}]`
  const add = (path: string, message: string) => errors.push({ path, message })

  if (!isNonEmptyString(phase.id)) {
    add(`${basePath}.id`, 'Required')
  } else if (!ID_RE.test(phase.id)) {
    add(`${basePath}.id`, 'Invalid id format')
  } else if (phaseIds.has(phase.id)) {
    add(`${basePath}.id`, `Duplicate phase id '${phase.id}'`)
  } else {
    phaseIds.add(phase.id)
  }

  if (!isNonEmptyString(phase.label)) {
    add(`${basePath}.label`, 'Required')
  }

  const hasFrameRange = phase.frame_range != null
  const hasEventWindow = phase.event_window != null

  if (hasFrameRange === hasEventWindow) {
    add(basePath, 'Specify either frame_range or event_window')
  }

  if (hasFrameRange && !isNonNegativeIntPair(phase.frame_range)) {
    add(`${basePath}.frame_range`, 'Must be [start,end] integers >= 0')
  }

  if (hasEventWindow) {
    const eventWindow = phase.event_window
    if (!eventWindow || !isNonEmptyString(eventWindow.event)) {
      add(`${basePath}.event_window.event`, 'Required')
    }
    if (!isNumberPair(eventWindow?.window_ms)) {
      add(`${basePath}.event_window.window_ms`, 'Must be [pre,post] numbers')
    }
  }

  if (phase.joints_of_interest != null) {
    if (
      !Array.isArray(phase.joints_of_interest) ||
      phase.joints_of_interest.some((jointId) => !isFiniteInt(jointId) || jointId < 0)
    ) {
      add(`${basePath}.joints_of_interest`, 'Must be integers >= 0')
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
  const add = (path: string, message: string) => errors.push({ path, message })

  if (!rule.signal || !isNonEmptyString(rule.signal.type)) {
    add(`${basePath}.type`, 'Required')
    return
  }

  if (rule.signal.type === 'frame_range_ref') {
    if (!isNonEmptyString(rule.signal.ref)) {
      add(`${basePath}.ref`, 'Required')
      return
    }

    if (!rule.signal.ref.startsWith('phase:')) {
      add(`${basePath}.ref`, "Must be formatted as 'phase:<id>'")
      return
    }

    const phaseId = rule.signal.ref.slice('phase:'.length)
    if (!phaseIds.has(phaseId)) {
      add(`${basePath}.ref`, `Unknown phase '${phaseId}'`)
    }
    return
  }

  if (rule.signal.type === 'event_window') {
    if (!isNonEmptyString(rule.signal.event)) {
      add(`${basePath}.event`, 'Required')
    }
    if (!isNumberPair(rule.signal.window_ms)) {
      add(`${basePath}.window_ms`, 'Must be [pre,post] numbers')
    }
    if (rule.signal.default_phase != null && rule.signal.default_phase !== '') {
      if (!phaseIds.has(rule.signal.default_phase)) {
        add(`${basePath}.default_phase`, `Unknown phase '${rule.signal.default_phase}'`)
      }
    }
    return
  }

  if (rule.signal.type === 'direct') {
    if (!isNonNegativeIntPair(rule.signal.frame_range)) {
      add(`${basePath}.frame_range`, 'Must be [start,end] integers >= 0')
    }
    if (
      rule.signal.joints != null &&
      (!Array.isArray(rule.signal.joints) ||
        rule.signal.joints.some((jointId) => !isFiniteInt(jointId) || jointId < 0))
    ) {
      add(`${basePath}.joints`, 'Must be integers >= 0')
    }
    return
  }

  add(`${basePath}.type`, 'Unsupported signal type')
}

const validateThreshold = (
  cond: ThresholdCondition,
  path: string,
  errors: ValidationError[]
) => {
  const add = (message: string) => errors.push({ path, message })
  if (!isNonEmptyString(cond.metric)) add('metric is required')
  if (!['gte', 'gt', 'lte', 'lt', 'eq', 'neq'].includes(cond.op)) add('invalid op')
  if (!isFiniteNumber(cond.value)) add('value must be a number')
  if (cond.tolerance != null && !isFiniteNumber(cond.tolerance)) add('tolerance must be a number')
}

const validateRange = (cond: RangeCondition, path: string, errors: ValidationError[]) => {
  const add = (message: string) => errors.push({ path, message })
  if (!isNonEmptyString(cond.metric)) add('metric is required')
  if (cond.op !== 'between') add("op must be 'between'")
  if (!isNumberPair(cond.value)) add('value must be [lower, upper]')
  if (cond.tolerance != null && !isFiniteNumber(cond.tolerance)) add('tolerance must be a number')
}

const validateBoolean = (cond: BooleanCondition, path: string, errors: ValidationError[]) => {
  const add = (message: string) => errors.push({ path, message })
  if (!isNonEmptyString(cond.metric)) add('metric is required')
  if (!['is_true', 'is_false'].includes(cond.op)) add('invalid op')
}

const validateEventExists = (
  cond: EventExistsCondition,
  path: string,
  errors: ValidationError[]
) => {
  const add = (message: string) => errors.push({ path, message })
  if (!isNonEmptyString(cond.event)) add('event is required')
  if (cond.window_ms != null && !isNumberPair(cond.window_ms)) add('window_ms must be [pre, post]')
}

const validateTrend = (cond: TrendCondition, path: string, errors: ValidationError[]) => {
  const add = (message: string) => errors.push({ path, message })
  if (!isNonEmptyString(cond.metric)) add('metric is required')
  if (!['increasing', 'decreasing'].includes(cond.op)) add('invalid op')
  if (cond.window_frames != null && (!isFiniteInt(cond.window_frames) || cond.window_frames < 1)) {
    add('window_frames must be integer >= 1')
  }
  if (cond.window_ms != null && !isNumberPair(cond.window_ms)) add('window_ms must be [pre, post]')
}

const validateAngle = (cond: AngleCondition, path: string, errors: ValidationError[]) => {
  const add = (message: string) => errors.push({ path, message })
  if (
    !Array.isArray(cond.joints) ||
    cond.joints.length < 2 ||
    cond.joints.length > 3 ||
    cond.joints.some((jointId) => !isFiniteInt(jointId) || jointId < 0)
  ) {
    add('joints must be 2 or 3 integers >= 0')
  }

  if (!['gte', 'gt', 'lte', 'lt', 'eq', 'neq', 'between'].includes(cond.op)) {
    add('invalid op')
  }

  if (cond.op === 'between') {
    if (!isNumberPair(cond.value)) add('value must be [lower, upper] when op=between')
  } else if (!isFiniteNumber(cond.value)) {
    add('value must be a number when op is not between')
  }
}

const validateDistance = (cond: DistanceCondition, path: string, errors: ValidationError[]) => {
  const add = (message: string) => errors.push({ path, message })
  if (!isNonNegativeIntPair(cond.pair)) add('pair must be 2 integers >= 0')

  if (!['gte', 'gt', 'lte', 'lt', 'eq', 'neq', 'between'].includes(cond.op)) {
    add('invalid op')
  }

  if (cond.op === 'between') {
    if (!isNumberPair(cond.value)) add('value must be [lower, upper] when op=between')
  } else if (!isFiniteNumber(cond.value)) {
    add('value must be a number when op is not between')
  }
}

const validateComposite = (
  cond: CompositeCondition,
  path: string,
  errors: ValidationError[],
  condIds: Set<string>
) => {
  const add = (message: string) => errors.push({ path, message })
  if (!['all', 'any', 'none'].includes(cond.logic)) add('invalid logic')
  if (!Array.isArray(cond.conditions) || cond.conditions.length === 0) {
    add('conditions must be a non-empty array of ids')
    return
  }

  cond.conditions.forEach((condId) => {
    if (!condIds.has(condId)) {
      add(`Unknown condition id '${condId}'`)
    }
  })
}

const validateConditions = (rule: Rule, ruleIndex: number, errors: ValidationError[]) => {
  const basePath = `rules[${ruleIndex}].conditions`

  if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
    errors.push({ path: basePath, message: 'At least one condition is required' })
    return
  }

  const condIds = new Set<string>()
  const compositeConditions: Array<{ cond: CompositeCondition; path: string }> = []

  rule.conditions.forEach((cond, condIndex) => {
    const path = `${basePath}[${condIndex}]`
    if (!isNonEmptyString(cond.id)) {
      errors.push({ path: `${path}.id`, message: 'Required' })
      return
    }
    if (!ID_RE.test(cond.id)) {
      errors.push({ path: `${path}.id`, message: 'Invalid id format' })
      return
    }
    if (condIds.has(cond.id)) {
      errors.push({ path: `${path}.id`, message: `Duplicate condition id '${cond.id}'` })
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
        errors.push({ path: `${path}.type`, message: 'Unsupported condition type' })
    }
  })

  compositeConditions.forEach(({ cond, path }) => {
    validateComposite(cond, path, errors, condIds)
  })
}

const validateScore = (rule: Rule, index: number, errors: ValidationError[]) => {
  const basePath = `rules[${index}].score`
  if (!rule.score) {
    errors.push({ path: basePath, message: 'Required' })
    return
  }

  if (!['weighted', 'all-or-nothing', 'average'].includes(rule.score.mode)) {
    errors.push({ path: `${basePath}.mode`, message: 'Invalid mode' })
  }

  if (!isFiniteNumber(rule.score.pass_score)) {
    errors.push({ path: `${basePath}.pass_score`, message: 'Must be a number' })
  }

  if (!isFiniteNumber(rule.score.max_score) || rule.score.max_score < 0) {
    errors.push({ path: `${basePath}.max_score`, message: 'Must be a number >= 0' })
  }

  if (rule.score.mode === 'weighted') {
    if (!rule.score.weights || Object.keys(rule.score.weights).length === 0) {
      errors.push({ path: `${basePath}.weights`, message: 'Required when mode=weighted' })
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
      errors.push({ path: `${path}.condition_ids`, message: 'At least one condition id is required' })
    } else {
      feedback.condition_ids.forEach((condId) => {
        if (!conditionIds.has(condId)) {
          errors.push({ path: `${path}.condition_ids`, message: `Unknown condition id '${condId}'` })
        }
      })
    }

    if (!isNonEmptyString(feedback.message)) {
      errors.push({ path: `${path}.message`, message: 'Required' })
    }

    if (!['info', 'warn', 'fail'].includes(feedback.severity)) {
      errors.push({ path: `${path}.severity`, message: 'Invalid severity' })
    }

    if (
      feedback.attach_to_ts != null &&
      feedback.attach_to_ts !== '' &&
      !/^(event:[A-Za-z0-9_.-]+|frame:[0-9]+)$/.test(feedback.attach_to_ts)
    ) {
      errors.push({
        path: `${path}.attach_to_ts`,
        message: "Must match 'event:<name>' or 'frame:<index>'",
      })
    }
  })
}

export const validateRuleSet = (ruleSet: RuleSet): ValidationError[] => {
  const errors: ValidationError[] = []
  const add = (path: string, message: string) => errors.push({ path, message })

  if (!isSemver(ruleSet.schema_version)) add('schema_version', 'Must be semver x.y.z')
  if (!isNonEmptyString(ruleSet.rule_set_id)) add('rule_set_id', 'Required')
  if (!isNonEmptyString(ruleSet.sport)) add('sport', 'Required')
  if (!isSemver(ruleSet.sport_version)) add('sport_version', 'Must be semver x.y.z')
  if (!isNonEmptyString(ruleSet.metadata?.title)) add('metadata.title', 'Required')

  if (!Array.isArray(ruleSet.phases) || ruleSet.phases.length === 0) {
    add('phases', 'Add at least one step/phase')
  }

  if (!Array.isArray(ruleSet.rules) || ruleSet.rules.length === 0) {
    add('rules', 'Add at least one checkpoint/rule')
  }

  const phaseIds = new Set<string>()
  ruleSet.phases.forEach((phase, index) => validatePhase(phase, index, errors, phaseIds))

  const ruleIds = new Set<string>()
  ruleSet.rules.forEach((rule, index) => {
    const basePath = `rules[${index}]`

    if (!isNonEmptyString(rule.id)) {
      add(`${basePath}.id`, 'Required')
    } else if (!ID_RE.test(rule.id)) {
      add(`${basePath}.id`, 'Invalid id format')
    } else if (ruleIds.has(rule.id)) {
      add(`${basePath}.id`, `Duplicate rule id '${rule.id}'`)
    } else {
      ruleIds.add(rule.id)
    }

    if (!isNonEmptyString(rule.label)) add(`${basePath}.label`, 'Required')

    if (!isNonEmptyString(rule.phase)) {
      add(`${basePath}.phase`, 'Required')
    } else if (!phaseIds.has(rule.phase)) {
      add(`${basePath}.phase`, `Unknown phase '${rule.phase}'`)
    }

    if (!isNonEmptyString(rule.category)) add(`${basePath}.category`, 'Required')

    if (!['info', 'warn', 'fail'].includes(rule.severity)) {
      add(`${basePath}.severity`, 'Invalid severity')
    }

    validateSignal(rule, index, errors, phaseIds)
    validateConditions(rule, index, errors)
    validateScore(rule, index, errors)
    validateFeedback(rule, index, errors)
  })

  return errors
}
