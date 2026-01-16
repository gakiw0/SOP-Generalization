import { useMemo, useState } from 'react'
import './App.css'

type Inputs = {
  expected_fps?: number
  keypoints_format?: string
  camera_view?: string
  preprocess?: string[]
}

type Globals = {
  confidence_threshold?: number
  angle_units?: string
  feature_pipeline?: string[]
}

type ValidationError = {
  path: string
  message: string
}

type Phase = {
  id: string
  label: string
  description?: string
  frame_range?: [number, number]
  event_window?: {
    event: string
    window_ms: [number, number]
  }
  joints_of_interest?: number[]
}

type Rule = {
  id: string
  label: string
  description?: string
  phase: string
  category: string
  severity: 'info' | 'warn' | 'fail'
  signal:
    | { type: 'frame_range_ref'; ref: string }
    | { type: 'direct'; frame_range: [number, number] }
    | {
        type: 'event_window'
        event: string
        window_ms: [number, number]
        default_phase?: string
      }
  conditions: Condition[]
  score: Score
  feedback: Feedback[]
}

const PREPROCESS_OPTIONS = ['align_orientation', 'normalize_lengths']

const FEATURE_PIPELINE_OPTIONS = [
  'calculate_frechet_distance',
  'calculate_hausdorff_distance',
  'calculate_kendalls_tau',
  'stance_angle_diff_ratio',
  'cg_z_avg_ratio_or_flag',
  'head_move_diff_ratio',
  'stride_z_class',
  'cg_z_end_ratio_or_flag',
  'shoulder_xz_angle_diff_ratio',
  'cg_z_end_diff_class',
  'shoulder_height_diff_class',
  'cg_z_std_diff_ratio',
  'hip_yaw_angle_diff_ratio_or_clamp',
]

const FEATURE_PIPELINE_DESCRIPTIONS: Record<string, string> = {
  calculate_frechet_distance: 'Trajectory distribution similarity (distance).',
  calculate_hausdorff_distance: 'Maximum deviation between trajectories (distance).',
  calculate_kendalls_tau: 'Temporal trend similarity (rank correlation).',
  stance_angle_diff_ratio: 'Upper-body stance angle difference (ratio).',
  cg_z_avg_ratio_or_flag: 'Average CG Z offset difference (ratio/flag).',
  head_move_diff_ratio: 'Head movement difference (ratio).',
  stride_z_class: 'Stride direction difference (bucketed class).',
  cg_z_end_ratio_or_flag: 'End-frame CG Z offset difference (ratio/flag).',
  shoulder_xz_angle_diff_ratio: 'Shoulder line XZ angle difference (ratio).',
  cg_z_end_diff_class: 'End-frame CG Z difference (bucketed class).',
  shoulder_height_diff_class: 'Shoulder height difference (bucketed class).',
  cg_z_std_diff_ratio: 'CG Z variability difference (stddev ratio).',
  hip_yaw_angle_diff_ratio_or_clamp: 'Hip yaw angle difference (ratio with clamp).',
}

type RuleSet = {
  schema_version: string
  rule_set_id: string
  sport: string
  sport_version: string
  metadata: {
    title: string
    description?: string
    authors?: string[]
    notes?: string[]
    changelog?: unknown[]
  }
  inputs: Inputs
  globals: Globals
  phases: Phase[]
  rules: Rule[]
}

const createEmptyRuleSet = (): RuleSet => ({
  schema_version: '1.0.0',
  rule_set_id: '',
  sport: '',
  sport_version: '',
  metadata: {
    title: '',
  },
  inputs: {
    expected_fps: 30,
    keypoints_format: 'openpose25',
    camera_view: 'side',
    preprocess: [],
  },
  globals: {
    confidence_threshold: 0,
    angle_units: 'degrees',
    feature_pipeline: [],
  },
  phases: [],
  rules: [],
})

const toggleStringListItem = (
  list: string[],
  item: string,
  checked: boolean
): string[] => {
  if (checked) return list.includes(item) ? list : [...list, item]
  return list.filter((entry) => entry !== item)
}

const toCsv = (items: string[]): string => items.join(', ')

const fromCsv = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

const toggleNumberListItem = (
  list: number[],
  item: number,
  checked: boolean
): number[] => {
  if (checked) return list.includes(item) ? list : [...list, item]
  return list.filter((entry) => entry !== item)
}

type Condition = {
  id: string
  type: 'threshold' | 'range' | 'boolean' | 'composite'
  metric?: string
  op?: string
  value?: unknown
  abs_val?: boolean
  tolerance?: number
  logic?: 'all' | 'any' | 'none'
  conditions?: string[]
}

type Score = {
  mode: 'all-or-nothing' | 'average'
  pass_score: number
  max_score: number
}

type Feedback = {
  condition_ids: string[]
  message: string
  severity: 'info' | 'warn' | 'fail'
  attach_to_ts?: string
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isSemver = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9]+\\.[0-9]+\\.[0-9]+$/.test(value)

const isId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_.-]+$/.test(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isFiniteInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)

const validateRuleSet = (ruleSet: RuleSet): ValidationError[] => {
  const errors: ValidationError[] = []
  const add = (path: string, message: string) => errors.push({ path, message })

  if (!isSemver(ruleSet.schema_version)) add('schema_version', 'Must be semver: x.y.z')
  if (!isNonEmptyString(ruleSet.rule_set_id)) add('rule_set_id', 'Required')
  if (!isNonEmptyString(ruleSet.sport)) add('sport', 'Required')
  if (!isSemver(ruleSet.sport_version)) add('sport_version', 'Must be semver: x.y.z')
  if (!isNonEmptyString(ruleSet.metadata.title)) add('metadata.title', 'Required')

  if (ruleSet.phases.length === 0) add('phases', 'Add at least one phase')
  if (ruleSet.rules.length === 0) add('rules', 'Add at least one rule')

  const phaseIds = new Set<string>()
  ruleSet.phases.forEach((phase, i) => {
    const pPath = `phases[${i}]`
    if (!isNonEmptyString(phase.id)) add(`${pPath}.id`, 'Required')
    else if (!isId(phase.id)) add(`${pPath}.id`, 'Invalid id format')
    else if (phaseIds.has(phase.id)) add(`${pPath}.id`, `Duplicate phase id '${phase.id}'`)
    else phaseIds.add(phase.id)

    if (!isNonEmptyString(phase.label)) add(`${pPath}.label`, 'Required')

    const hasFrameRange = phase.frame_range != null
    const hasEventWindow = phase.event_window != null
    if (hasFrameRange && hasEventWindow) {
      add(pPath, 'Specify either frame_range or event_window (not both)')
    } else if (!hasFrameRange && !hasEventWindow) {
      add(pPath, 'Specify either frame_range or event_window')
    }

    if (hasFrameRange) {
      const fr = phase.frame_range
      if (
        !Array.isArray(fr) ||
        fr.length !== 2 ||
        !isFiniteInt(fr[0]) ||
        !isFiniteInt(fr[1]) ||
        fr[0] < 0 ||
        fr[1] < 0
      ) {
        add(`${pPath}.frame_range`, 'Must be [start,end] integers >= 0')
      }
    }

    if (hasEventWindow) {
      const ew = phase.event_window
      if (!ew || !isNonEmptyString(ew.event)) add(`${pPath}.event_window.event`, 'Required')
      const wm = ew?.window_ms
      if (!Array.isArray(wm) || wm.length !== 2 || !isFiniteNumber(wm[0]) || !isFiniteNumber(wm[1])) {
        add(`${pPath}.event_window.window_ms`, 'Must be [pre,post] numbers')
      }
    }

    if (phase.joints_of_interest != null) {
      const joi = phase.joints_of_interest
      if (!Array.isArray(joi) || joi.some((x) => !isFiniteInt(x) || x < 0)) {
        add(`${pPath}.joints_of_interest`, 'Must be an array of integers >= 0')
      }
    }
  })

  const ruleIds = new Set<string>()
  ruleSet.rules.forEach((rule, i) => {
    const rPath = `rules[${i}]`
    if (!isNonEmptyString(rule.id)) add(`${rPath}.id`, 'Required')
    else if (!isId(rule.id)) add(`${rPath}.id`, 'Invalid id format')
    else if (ruleIds.has(rule.id)) add(`${rPath}.id`, `Duplicate rule id '${rule.id}'`)
    else ruleIds.add(rule.id)

    if (!isNonEmptyString(rule.label)) add(`${rPath}.label`, 'Required')
    if (!isNonEmptyString(rule.phase)) add(`${rPath}.phase`, 'Required')
    else if (!phaseIds.has(rule.phase)) add(`${rPath}.phase`, `Unknown phase '${rule.phase}'`)
    if (!isNonEmptyString(rule.category)) add(`${rPath}.category`, 'Required')

    // Signal
    const signalType = rule.signal?.type
    if (!signalType) add(`${rPath}.signal.type`, 'Required')
    if (signalType === 'frame_range_ref') {
      const ref = rule.signal.ref
      if (!isNonEmptyString(ref)) add(`${rPath}.signal.ref`, 'Required')
      else if (!/^phase:[A-Za-z0-9_.-]+$/.test(ref)) add(`${rPath}.signal.ref`, 'Must be phase:<id>')
      else {
        const refId = ref.split('phase:', 2)[1]
        if (!phaseIds.has(refId)) add(`${rPath}.signal.ref`, `Unknown phase '${refId}'`)
      }
    } else if (signalType === 'direct') {
      const fr = rule.signal.frame_range
      if (
        !Array.isArray(fr) ||
        fr.length !== 2 ||
        !isFiniteInt(fr[0]) ||
        !isFiniteInt(fr[1]) ||
        fr[0] < 0 ||
        fr[1] < 0
      ) {
        add(`${rPath}.signal.frame_range`, 'Must be [start,end] integers >= 0')
      }
    } else if (signalType === 'event_window') {
      if (!isNonEmptyString(rule.signal.event)) add(`${rPath}.signal.event`, 'Required')
      const wm = rule.signal.window_ms
      if (!Array.isArray(wm) || wm.length !== 2 || !isFiniteNumber(wm[0]) || !isFiniteNumber(wm[1])) {
        add(`${rPath}.signal.window_ms`, 'Must be [pre,post] numbers')
      }
      const dp = rule.signal.default_phase
      if (dp != null && dp !== '' && !phaseIds.has(dp)) {
        add(`${rPath}.signal.default_phase`, `Unknown phase '${dp}'`)
      }
    }

    // Conditions
    if (rule.conditions.length === 0) add(`${rPath}.conditions`, 'Add at least one condition')
    const condIds = new Set<string>()
    rule.conditions.forEach((cond, j) => {
      const cPath = `${rPath}.conditions[${j}]`
      if (!isNonEmptyString(cond.id)) add(`${cPath}.id`, 'Required')
      else if (!isId(cond.id)) add(`${cPath}.id`, 'Invalid id format')
      else if (condIds.has(cond.id)) add(`${cPath}.id`, `Duplicate condition id '${cond.id}'`)
      else condIds.add(cond.id)

      if (!isNonEmptyString(cond.type)) add(`${cPath}.type`, 'Required')

      if (cond.type === 'threshold') {
        if (!isNonEmptyString(cond.metric)) add(`${cPath}.metric`, 'Required')
        const op = cond.op
        const allowed = new Set(['gte', 'gt', 'lte', 'lt', 'eq', 'neq'])
        if (!isNonEmptyString(op) || !allowed.has(op)) add(`${cPath}.op`, 'Invalid op')
        if (!isFiniteNumber(cond.value)) add(`${cPath}.value`, 'Must be a number')
        if (cond.tolerance != null && !isFiniteNumber(cond.tolerance)) add(`${cPath}.tolerance`, 'Must be a number')
      } else if (cond.type === 'range') {
        if (!isNonEmptyString(cond.metric)) add(`${cPath}.metric`, 'Required')
        if ((cond.op ?? 'between') !== 'between') add(`${cPath}.op`, "Must be 'between'")
        if (
          !Array.isArray(cond.value) ||
          cond.value.length !== 2 ||
          !isFiniteNumber(cond.value[0]) ||
          !isFiniteNumber(cond.value[1])
        ) {
          add(`${cPath}.value`, 'Must be [lower,upper] numbers')
        }
        if (cond.tolerance != null && !isFiniteNumber(cond.tolerance)) add(`${cPath}.tolerance`, 'Must be a number')
      } else if (cond.type === 'boolean') {
        if (!isNonEmptyString(cond.metric)) add(`${cPath}.metric`, 'Required')
        const op = cond.op
        const allowed = new Set(['is_true', 'is_false'])
        if (!isNonEmptyString(op) || !allowed.has(op)) add(`${cPath}.op`, 'Invalid op')
      } else if (cond.type === 'composite') {
        const logic = cond.logic
        if (!logic || !['all', 'any', 'none'].includes(logic)) add(`${cPath}.logic`, 'Invalid logic')
        if (!Array.isArray(cond.conditions) || cond.conditions.length === 0) {
          add(`${cPath}.conditions`, 'Must be a non-empty array of condition ids')
        }
      } else {
        add(`${cPath}.type`, `Unsupported condition type '${String(cond.type)}'`)
      }
    })

    rule.conditions.forEach((cond, j) => {
      if (cond.type !== 'composite') return
      const cPath = `${rPath}.conditions[${j}].conditions`
      const refs = cond.conditions ?? []
      refs.forEach((rid) => {
        if (!condIds.has(rid)) add(cPath, `Unknown condition id reference '${rid}'`)
      })
    })

    // Score
    const mode = rule.score.mode
    if (!isNonEmptyString(mode) || !['all-or-nothing', 'average'].includes(mode)) {
      add(`${rPath}.score.mode`, 'Invalid mode')
    }
    if (!isFiniteNumber(rule.score.pass_score)) add(`${rPath}.score.pass_score`, 'Must be a number')
    if (!isFiniteNumber(rule.score.max_score) || rule.score.max_score < 0) {
      add(`${rPath}.score.max_score`, 'Must be a number >= 0')
    }

    // Feedback
    rule.feedback.forEach((fb, j) => {
      const fPath = `${rPath}.feedback[${j}]`
      if (!Array.isArray(fb.condition_ids) || fb.condition_ids.length === 0) {
        add(`${fPath}.condition_ids`, 'Must be a non-empty array of condition ids')
      } else {
        fb.condition_ids.forEach((cid) => {
          if (!condIds.has(cid)) add(`${fPath}.condition_ids`, `Unknown condition id '${cid}'`)
        })
      }
      if (!isNonEmptyString(fb.message)) add(`${fPath}.message`, 'Required')
      if (!isNonEmptyString(fb.severity) || !['info', 'warn', 'fail'].includes(fb.severity)) {
        add(`${fPath}.severity`, 'Invalid severity')
      }
      if (fb.attach_to_ts != null && fb.attach_to_ts !== '') {
        if (!/^(event:[A-Za-z0-9_.-]+|frame:[0-9]+)$/.test(fb.attach_to_ts)) {
          add(`${fPath}.attach_to_ts`, 'Must match event:<name> or frame:<idx>')
        }
      }
    })
  })

  return errors
}

const formatConditionValue = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const parseLooseJsonValue = (raw: string): unknown => {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    const n = Number(trimmed)
    if (Number.isFinite(n)) return n
    return trimmed
  }
}

type JointOption = {
  id: number
  label: string
}

// OpenPose BODY_25 indices (keypoints_format=openpose25).
const OPENPOSE25_JOINT_OPTIONS: JointOption[] = [
  { id: 0, label: 'Nose' },
  { id: 1, label: 'Neck' },
  { id: 2, label: 'RShoulder' },
  { id: 3, label: 'RElbow' },
  { id: 4, label: 'RWrist' },
  { id: 5, label: 'LShoulder' },
  { id: 6, label: 'LElbow' },
  { id: 7, label: 'LWrist' },
  { id: 8, label: 'MidHip' },
  { id: 9, label: 'RHip' },
  { id: 10, label: 'RKnee' },
  { id: 11, label: 'RAnkle' },
  { id: 12, label: 'LHip' },
  { id: 13, label: 'LKnee' },
  { id: 14, label: 'LAnkle' },
  { id: 15, label: 'REye' },
  { id: 16, label: 'LEye' },
  { id: 17, label: 'REar' },
  { id: 18, label: 'LEar' },
  { id: 19, label: 'LBigToe' },
  { id: 20, label: 'LSmallToe' },
  { id: 21, label: 'LHeel' },
  { id: 22, label: 'RBigToe' },
  { id: 23, label: 'RSmallToe' },
  { id: 24, label: 'RHeel' },
]

const OPENPOSE25_LABEL_BY_ID = Object.fromEntries(
  OPENPOSE25_JOINT_OPTIONS.map((joint) => [joint.id, joint.label])
) as Record<number, string>

// Simple 2D layout for visual selection (not anatomically exact; just a usable picker).
type JointPos = { x: number; y: number }
const OPENPOSE25_POS: Record<number, JointPos> = {
  0: { x: 50, y: 14 }, // Nose
  1: { x: 50, y: 22 }, // Neck
  2: { x: 62, y: 26 }, // RShoulder
  3: { x: 72, y: 36 }, // RElbow
  4: { x: 78, y: 48 }, // RWrist
  5: { x: 38, y: 26 }, // LShoulder
  6: { x: 28, y: 36 }, // LElbow
  7: { x: 22, y: 48 }, // LWrist
  8: { x: 50, y: 44 }, // MidHip
  9: { x: 58, y: 46 }, // RHip
  10: { x: 60, y: 62 }, // RKnee
  11: { x: 62, y: 78 }, // RAnkle
  12: { x: 42, y: 46 }, // LHip
  13: { x: 40, y: 62 }, // LKnee
  14: { x: 38, y: 78 }, // LAnkle
  15: { x: 54, y: 12 }, // REye
  16: { x: 46, y: 12 }, // LEye
  17: { x: 58, y: 14 }, // REar
  18: { x: 42, y: 14 }, // LEar
  19: { x: 35, y: 90 }, // LBigToe
  20: { x: 38, y: 90 }, // LSmallToe
  21: { x: 41, y: 88 }, // LHeel
  22: { x: 65, y: 90 }, // RBigToe
  23: { x: 62, y: 90 }, // RSmallToe
  24: { x: 59, y: 88 }, // RHeel
}

const OPENPOSE25_EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [1, 5],
  [5, 6],
  [6, 7],
  [1, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [8, 12],
  [12, 13],
  [13, 14],
  [0, 15],
  [0, 16],
  [15, 17],
  [16, 18],
  [14, 19],
  [14, 20],
  [14, 21],
  [11, 22],
  [11, 23],
  [11, 24],
]

type SkeletonPickerProps = {
  selected: number[]
  onToggle: (jointId: number, checked: boolean) => void
}

function OpenPose25SkeletonPicker({ selected, onToggle }: SkeletonPickerProps) {
  const selectedSet = new Set(selected)
  const viewBox = '0 0 100 100'
  return (
    <div className="skeleton-picker">
      <svg
        className="skeleton-svg"
        viewBox={viewBox}
        role="group"
        aria-label="OpenPose25 joint picker"
      >
        {OPENPOSE25_EDGES.map(([a, b]) => {
          const pa = OPENPOSE25_POS[a]
          const pb = OPENPOSE25_POS[b]
          if (!pa || !pb) return null
          return (
            <line
              key={`${a}-${b}`}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              className="skeleton-edge"
            />
          )
        })}

        {OPENPOSE25_JOINT_OPTIONS.map((joint) => {
          const pos = OPENPOSE25_POS[joint.id]
          const isSelected = selectedSet.has(joint.id)
          if (!pos) return null
          return (
            <g key={joint.id} className="skeleton-point-group">
              <circle
                cx={pos.x}
                cy={pos.y}
                r={2.3}
                className={isSelected ? 'skeleton-point selected' : 'skeleton-point'}
                onClick={() => onToggle(joint.id, !isSelected)}
              />
              <title>
                {joint.id}: {joint.label}
              </title>
            </g>
          )
        })}
      </svg>
      <div className="skeleton-legend hint">
        Click joints to toggle. Selected joints are highlighted.
      </div>
    </div>
  )
}

const toNumberCsv = (items: number[]): string => items.join(', ')

const fromNumberCsv = (value: string): number[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => Number(item))
    .filter((num) => Number.isFinite(num))
    .map((num) => Math.trunc(num))

function App() {
  const [ruleSetDraft, setRuleSetDraft] = useState<RuleSet>(() =>
    createEmptyRuleSet()
  )
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const jsonPreview = useMemo(
    () => JSON.stringify(ruleSetDraft, null, 2),
    [ruleSetDraft]
  )

  const handleNew = () => {
    setRuleSetDraft(createEmptyRuleSet())
    setValidationErrors([])
  }

  const handleAddPhase = () => {
    setRuleSetDraft((prev) => ({
      ...prev,
      phases: [
        ...prev.phases,
        {
          id: '',
          label: '',
          frame_range: [0, 0],
          joints_of_interest: [],
        },
      ],
    }))
  }

  const handleRemovePhase = (index: number) => {
    setRuleSetDraft((prev) => ({
      ...prev,
      phases: prev.phases.filter((_, i) => i !== index),
    }))
  }

  const handleAddRule = () => {
    setRuleSetDraft((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        (() => {
          const defaultPhase =
            prev.phases.find((p) => p.id.trim().length > 0)?.id ?? ''
          const rule: Rule = {
            id: '',
            label: '',
            phase: defaultPhase,
            category: '',
            severity: 'warn',
            signal: {
              type: 'frame_range_ref',
              ref: defaultPhase ? `phase:${defaultPhase}` : '',
            },
            conditions: [],
            score: {
              mode: 'all-or-nothing',
              pass_score: 1,
              max_score: 1,
            },
            feedback: [],
          }
          return rule
        })(),
      ],
    }))
  }

  const handleRemoveRule = (index: number) => {
    setRuleSetDraft((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }))
  }

  const handleAddCondition = (ruleIndex: number) => {
    setRuleSetDraft((prev) => ({
      ...prev,
      rules: prev.rules.map((r, i) => {
        if (i !== ruleIndex) return r
        const next: Condition = {
          id: '',
          type: 'threshold',
          metric: '',
          op: 'between',
          value: 0,
          abs_val: false,
          tolerance: 0,
        }
        return { ...r, conditions: [...r.conditions, next] }
      }),
    }))
  }

  const handleRemoveCondition = (ruleIndex: number, conditionIndex: number) => {
    setRuleSetDraft((prev) => ({
      ...prev,
      rules: prev.rules.map((r, i) => {
        if (i !== ruleIndex) return r
        return { ...r, conditions: r.conditions.filter((_, j) => j !== conditionIndex) }
      }),
    }))
  }

  const handleAddFeedback = (ruleIndex: number) => {
    setRuleSetDraft((prev) => ({
      ...prev,
      rules: prev.rules.map((r, i) => {
        if (i !== ruleIndex) return r
        const next: Feedback = {
          condition_ids: [],
          message: '',
          severity: 'warn',
        }
        return { ...r, feedback: [...r.feedback, next] }
      }),
    }))
  }

  const handleRemoveFeedback = (ruleIndex: number, feedbackIndex: number) => {
    setRuleSetDraft((prev) => ({
      ...prev,
      rules: prev.rules.map((r, i) => {
        if (i !== ruleIndex) return r
        return { ...r, feedback: r.feedback.filter((_, j) => j !== feedbackIndex) }
      }),
    }))
  }

  const handleValidate = () => {
    const errors = validateRuleSet(ruleSetDraft)
    setValidationErrors(errors)
    if (errors.length === 0) {
      window.alert('Validation succeeded.')
      return
    }
    const preview = errors
      .slice(0, 20)
      .map((e) => `- ${e.path}: ${e.message}`)
      .join('\n')
    const tail = errors.length > 20 ? `\n...and ${errors.length - 20} more` : ''
    window.alert(`Validation failed (${errors.length} errors):\n${preview}${tail}`)
  }

  const handleExport = () => {
    const fileName = `${ruleSetDraft.rule_set_id || 'rule_set'}.json`
    const blob = new Blob([jsonPreview], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="app">
        <header className="header">
          <h1>Rule Set Builder</h1>
          <div className="actions">
            <button type="button" onClick={handleNew}>
              New
            </button>
            <button type="button" onClick={handleValidate}>
              Validate
            </button>
            <button type="button" onClick={handleExport}>
              Export
            </button>
          </div>
        </header>

        <main className="content">
          <section className="panel">
            <h2>Draft</h2>
            <div className="field">
              <label htmlFor="rule_set_id">rule_set_id</label>
              <input
                id="rule_set_id"
                type="text"
                value={ruleSetDraft.rule_set_id}
                onChange={(event) =>
                  setRuleSetDraft((prev) => ({
                    ...prev,
                    rule_set_id: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="sport">sport</label>
              <input
                id="sport"
                type="text"
                value={ruleSetDraft.sport}
                onChange={(event) =>
                  setRuleSetDraft((prev) => ({
                    ...prev,
                    sport: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="sport_version">sport_version</label>
              <input
                id="sport_version"
                type="text"
                value={ruleSetDraft.sport_version}
                onChange={(event) =>
                  setRuleSetDraft((prev) => ({
                    ...prev,
                    sport_version: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="metadata_title">metadata.title</label>
              <input
                id="metadata_title"
                type="text"
                value={ruleSetDraft.metadata.title}
                onChange={(event) =>
                  setRuleSetDraft((prev) => ({
                    ...prev,
                    metadata: {
                      ...prev.metadata,
                      title: event.target.value,
                    },
                  }))
                }
              />
            </div>
            <p className="hint">
              Phases/rules/globals will be added next. Inputs are now editable.
            </p>
          </section>

          <section className="panel">
            <h2>Inputs</h2>
            <div className="field">
              <label htmlFor="expected_fps">expected_fps</label>
              <input
                id="expected_fps"
                type="number"
                value={ruleSetDraft.inputs.expected_fps ?? 0}
                disabled
                onChange={(event) =>
                  setRuleSetDraft((prev) => ({
                    ...prev,
                    inputs: {
                      ...prev.inputs,
                      expected_fps: Number(event.target.value),
                    },
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="keypoints_format">keypoints_format</label>
              <input
                id="keypoints_format"
                type="text"
                value={ruleSetDraft.inputs.keypoints_format ?? ''}
                disabled
                onChange={() => {}}
              />
              <p className="hint">
                Engine currently assumes OpenPose 25 joints (hardcoded joint
                indices).
              </p>
            </div>
            <div className="field">
              <label htmlFor="camera_view">camera_view</label>
              <input
                id="camera_view"
                type="text"
                value={ruleSetDraft.inputs.camera_view ?? ''}
                disabled
                onChange={() => {}}
              />
              <p className="hint">
                Camera view is not implemented in the engine yet; current rules
                are authored assuming side view.
              </p>
            </div>
            <div className="field">
              <label>preprocess</label>
              <div className="checkbox-group">
                {PREPROCESS_OPTIONS.map((option) => (
                  <label key={option} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(ruleSetDraft.inputs.preprocess ?? []).includes(option)}
                      onChange={(event) =>
                        setRuleSetDraft((prev) => {
                          const current = prev.inputs.preprocess ?? []
                          const next = event.target.checked
                            ? [...current, option]
                            : current.filter((item) => item !== option)
                          return {
                            ...prev,
                            inputs: {
                              ...prev.inputs,
                              preprocess: next,
                            },
                          }
                        })
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Validation</h2>
            {validationErrors.length === 0 ? (
              <p className="hint">No validation errors.</p>
            ) : (
              <pre className="code validation-code">
                {validationErrors.map((e) => `${e.path}: ${e.message}`).join('\n')}
              </pre>
            )}
          </section>

          <section className="panel">
            <h2>Globals</h2>
            <div className="field">
              <label htmlFor="confidence_threshold">confidence_threshold</label>
              <input
                id="confidence_threshold"
                type="number"
                value={ruleSetDraft.globals.confidence_threshold ?? 0}
                onChange={(event) =>
                  setRuleSetDraft((prev) => ({
                    ...prev,
                    globals: {
                      ...prev.globals,
                      confidence_threshold: Number(event.target.value),
                    },
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="angle_units">angle_units</label>
              <select
                id="angle_units"
                value={ruleSetDraft.globals.angle_units ?? 'degrees'}
                disabled
                onChange={(event) =>
                  setRuleSetDraft((prev) => ({
                    ...prev,
                    globals: {
                      ...prev.globals,
                      angle_units: event.target.value,
                    },
                  }))
                }
              >
                <option value="degrees">degrees</option>
              </select>
              <p className="hint">
                Engine math helpers return angles in degrees.
              </p>
            </div>
            <div className="field">
              <label>feature_pipeline</label>
              <div className="checkbox-group">
                {FEATURE_PIPELINE_OPTIONS.map((option) => (
                  <label key={option} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(ruleSetDraft.globals.feature_pipeline ?? []).includes(
                        option
                      )}
                      onChange={(event) =>
                        setRuleSetDraft((prev) => ({
                          ...prev,
                          globals: {
                            ...prev.globals,
                            feature_pipeline: toggleStringListItem(
                              prev.globals.feature_pipeline ?? [],
                              option,
                              event.target.checked
                            ),
                          },
                        }))
                      }
                    />
                    <span className="checkbox-text">
                      <span className="checkbox-label">{option}</span>
                      <span className="checkbox-desc">
                        {FEATURE_PIPELINE_DESCRIPTIONS[option] ?? ''}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Phases</h2>
            <div className="actions" style={{ marginBottom: '1rem' }}>
              <button type="button" onClick={handleAddPhase}>
                Add phase
              </button>
            </div>

            {ruleSetDraft.phases.length === 0 ? (
              <p className="hint">No phases yet. Add at least one phase.</p>
            ) : (
              ruleSetDraft.phases.map((phase, index) => {
                const mode: 'frame_range' | 'event_window' =
                  phase.event_window != null ? 'event_window' : 'frame_range'

                return (
                  <div
                    key={index}
                    style={{
                      border: '1px solid #d9dde3',
                      borderRadius: 10,
                      padding: '1rem',
                      marginBottom: '1rem',
                      background: '#f9fafb',
                    }}
                  >
                    <div className="actions" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => handleRemovePhase(index)}>
                        Remove
                      </button>
                    </div>

                    <div className="field">
                      <label htmlFor={`phase_${index}_id`}>id</label>
                      <input
                        id={`phase_${index}_id`}
                        type="text"
                        value={phase.id}
                        onChange={(event) =>
                          setRuleSetDraft((prev) => ({
                            ...prev,
                            phases: prev.phases.map((p, i) =>
                              i === index ? { ...p, id: event.target.value } : p
                            ),
                          }))
                        }
                      />
                    </div>

                    <div className="field">
                      <label htmlFor={`phase_${index}_label`}>label</label>
                      <input
                        id={`phase_${index}_label`}
                        type="text"
                        value={phase.label}
                        onChange={(event) =>
                          setRuleSetDraft((prev) => ({
                            ...prev,
                            phases: prev.phases.map((p, i) =>
                              i === index ? { ...p, label: event.target.value } : p
                            ),
                          }))
                        }
                      />
                    </div>

                    <div className="field">
                      <label>range mode</label>
                      <div className="checkbox-group">
                        <label className="checkbox-item">
                          <input
                            type="radio"
                            name={`phase_${index}_mode`}
                            checked={mode === 'frame_range'}
                            onChange={() =>
                              setRuleSetDraft((prev) => ({
                                ...prev,
                                phases: prev.phases.map((p, i) =>
                                  i === index
                                    ? {
                                        ...p,
                                        frame_range: p.frame_range ?? [0, 0],
                                        event_window: undefined,
                                      }
                                    : p
                                ),
                              }))
                            }
                          />
                          <span>frame_range</span>
                        </label>
                        <label className="checkbox-item">
                          <input
                            type="radio"
                            name={`phase_${index}_mode`}
                            checked={mode === 'event_window'}
                            onChange={() =>
                              setRuleSetDraft((prev) => ({
                                ...prev,
                                phases: prev.phases.map((p, i) =>
                                  i === index
                                    ? {
                                        ...p,
                                        frame_range: undefined,
                                        event_window:
                                          p.event_window ?? ({
                                            event: '',
                                            window_ms: [-200, 100],
                                          } as const),
                                      }
                                    : p
                                ),
                              }))
                            }
                          />
                          <span>event_window</span>
                        </label>
                      </div>
                    </div>

                    {mode === 'frame_range' ? (
                      <div className="field">
                        <label>frame_range</label>
                        <p className="hint" style={{ marginTop: 0 }}>
                          Inclusive frame indices: [start, end].
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <input
                            type="number"
                            value={phase.frame_range?.[0] ?? 0}
                            onChange={(event) => {
                              const start = Number(event.target.value)
                              setRuleSetDraft((prev) => ({
                                ...prev,
                                phases: prev.phases.map((p, i) => {
                                  if (i !== index) return p
                                  const end = p.frame_range?.[1] ?? 0
                                  return { ...p, frame_range: [start, end] }
                                }),
                              }))
                            }}
                          />
                          <input
                            type="number"
                            value={phase.frame_range?.[1] ?? 0}
                            onChange={(event) => {
                              const end = Number(event.target.value)
                              setRuleSetDraft((prev) => ({
                                ...prev,
                                phases: prev.phases.map((p, i) => {
                                  if (i !== index) return p
                                  const start = p.frame_range?.[0] ?? 0
                                  return { ...p, frame_range: [start, end] }
                                }),
                              }))
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="field">
                          <label htmlFor={`phase_${index}_event`}>event</label>
                          <p className="hint" style={{ marginTop: 0 }}>
                            Resolved from runtime context events (e.g. impact, release, contact).
                          </p>
                          <input
                            id={`phase_${index}_event`}
                            type="text"
                            value={phase.event_window?.event ?? ''}
                            onChange={(event) => {
                              const nextEvent = event.target.value
                              setRuleSetDraft((prev) => ({
                                ...prev,
                                phases: prev.phases.map((p, i) =>
                                  i === index
                                    ? {
                                        ...p,
                                        event_window: {
                                          event: nextEvent,
                                          window_ms: p.event_window?.window_ms ?? [-200, 100],
                                        },
                                      }
                                    : p
                                ),
                              }))
                            }}
                          />
                        </div>
                        <div className="field">
                          <label>window_ms</label>
                          <p className="hint" style={{ marginTop: 0 }}>
                            Time window around the event in milliseconds: [pre, post].
                          </p>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <input
                              type="number"
                              value={phase.event_window?.window_ms?.[0] ?? -200}
                              onChange={(event) => {
                                const pre = Number(event.target.value)
                                setRuleSetDraft((prev) => ({
                                  ...prev,
                                  phases: prev.phases.map((p, i) => {
                                    if (i !== index) return p
                                    const ev = p.event_window ?? { event: '', window_ms: [-200, 100] }
                                    return { ...p, event_window: { ...ev, window_ms: [pre, ev.window_ms[1]] } }
                                  }),
                                }))
                              }}
                            />
                            <input
                              type="number"
                              value={phase.event_window?.window_ms?.[1] ?? 100}
                              onChange={(event) => {
                                const post = Number(event.target.value)
                                setRuleSetDraft((prev) => ({
                                  ...prev,
                                  phases: prev.phases.map((p, i) => {
                                    if (i !== index) return p
                                    const ev = p.event_window ?? { event: '', window_ms: [-200, 100] }
                                    return { ...p, event_window: { ...ev, window_ms: [ev.window_ms[0], post] } }
                                  }),
                                }))
                              }}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="field">
                      <label>joints_of_interest</label>
                      <p className="hint" style={{ marginTop: 0 }}>
                        Select BODY_25 joints (OpenPose25). Saved as numeric indices.
                      </p>
                      <OpenPose25SkeletonPicker
                        selected={phase.joints_of_interest ?? []}
                        onToggle={(jointId, checked) => {
                          setRuleSetDraft((prev) => ({
                            ...prev,
                            phases: prev.phases.map((p, i) => {
                              if (i !== index) return p
                              const next = toggleNumberListItem(
                                p.joints_of_interest ?? [],
                                jointId,
                                checked
                              ).sort((a, b) => a - b)
                              return { ...p, joints_of_interest: next }
                            }),
                          }))
                        }}
                      />
                      <div className="checkbox-group">
                        {OPENPOSE25_JOINT_OPTIONS.map((joint) => (
                          <label key={joint.id} className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={(phase.joints_of_interest ?? []).includes(joint.id)}
                              onChange={(event) => {
                                setRuleSetDraft((prev) => ({
                                  ...prev,
                                  phases: prev.phases.map((p, i) => {
                                    if (i !== index) return p
                                    const next = toggleNumberListItem(
                                      p.joints_of_interest ?? [],
                                      joint.id,
                                      event.target.checked
                                    ).sort((a, b) => a - b)
                                    return { ...p, joints_of_interest: next }
                                  }),
                                }))
                              }}
                            />
                            <span className="checkbox-text">
                              <span className="checkbox-label">
                                {joint.id}: {joint.label}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="hint" style={{ marginTop: '0.5rem' }}>
                        Selected:{' '}
                        {toNumberCsv(phase.joints_of_interest ?? []) || '(none)'}{' '}
                        {phase.joints_of_interest && phase.joints_of_interest.length > 0
                          ? `(${phase.joints_of_interest
                              .map((id) => OPENPOSE25_LABEL_BY_ID[id] ?? String(id))
                              .join(', ')})`
                          : ''}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </section>

          <section className="panel">
            <h2>Rules</h2>
            <div className="actions" style={{ marginBottom: '1rem' }}>
              <button type="button" onClick={handleAddRule}>
                Add rule
              </button>
            </div>

            {ruleSetDraft.rules.length === 0 ? (
              <p className="hint">No rules yet.</p>
            ) : (
              ruleSetDraft.rules.map((rule, index) => {
                const phaseOptions = ruleSetDraft.phases
                  .map((p) => p.id.trim())
                  .filter((id) => id.length > 0)
                const hasPhaseOptions = phaseOptions.length > 0

                return (
                  <div
                    key={index}
                    style={{
                      border: '1px solid #d9dde3',
                      borderRadius: 10,
                      padding: '1rem',
                      marginBottom: '1rem',
                      background: '#f9fafb',
                    }}
                  >
                    <div className="actions" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => handleRemoveRule(index)}>
                        Remove
                      </button>
                    </div>

                    <div className="field">
                      <label htmlFor={`rule_${index}_id`}>id</label>
                      <input
                        id={`rule_${index}_id`}
                        type="text"
                        value={rule.id}
                        onChange={(event) =>
                          setRuleSetDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((r, i) =>
                              i === index ? { ...r, id: event.target.value } : r
                            ),
                          }))
                        }
                      />
                    </div>

                    <div className="field">
                      <label htmlFor={`rule_${index}_label`}>label</label>
                      <input
                        id={`rule_${index}_label`}
                        type="text"
                        value={rule.label}
                        onChange={(event) =>
                          setRuleSetDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((r, i) =>
                              i === index ? { ...r, label: event.target.value } : r
                            ),
                          }))
                        }
                      />
                    </div>

                    <div className="field">
                      <label htmlFor={`rule_${index}_phase`}>phase</label>
                      {hasPhaseOptions ? (
                        <select
                          id={`rule_${index}_phase`}
                          value={rule.phase}
                          onChange={(event) =>
                            setRuleSetDraft((prev) => ({
                              ...prev,
                              rules: prev.rules.map((r, i) =>
                                i === index
                                  ? (() => {
                                      const nextPhase = event.target.value
                                      const nextRule: Rule = { ...r, phase: nextPhase }
                                      if (
                                        r.signal.type === 'frame_range_ref' &&
                                        (!r.signal.ref ||
                                          r.signal.ref === `phase:${r.phase}`)
                                      ) {
                                        nextRule.signal = {
                                          type: 'frame_range_ref',
                                          ref: nextPhase ? `phase:${nextPhase}` : '',
                                        }
                                      }
                                      return nextRule
                                    })()
                                  : r
                              ),
                            }))
                          }
                        >
                          <option value="">(select)</option>
                          {phaseOptions.map((id) => (
                            <option key={id} value={id}>
                              {id}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={`rule_${index}_phase`}
                          type="text"
                          value={rule.phase}
                          onChange={(event) =>
                            setRuleSetDraft((prev) => ({
                              ...prev,
                              rules: prev.rules.map((r, i) =>
                                i === index
                                  ? (() => {
                                      const nextPhase = event.target.value
                                      const nextRule: Rule = { ...r, phase: nextPhase }
                                      if (
                                        r.signal.type === 'frame_range_ref' &&
                                        (!r.signal.ref ||
                                          r.signal.ref === `phase:${r.phase}`)
                                      ) {
                                        nextRule.signal = {
                                          type: 'frame_range_ref',
                                          ref: nextPhase ? `phase:${nextPhase}` : '',
                                        }
                                      }
                                      return nextRule
                                    })()
                                  : r
                              ),
                            }))
                          }
                        />
                      )}
                      {!hasPhaseOptions ? (
                        <p className="hint">
                          Add phases (with ids) to pick from a dropdown.
                        </p>
                      ) : null}
                    </div>

                    <div className="field">
                      <label htmlFor={`rule_${index}_signal_type`}>signal</label>
                      <select
                        id={`rule_${index}_signal_type`}
                        value={rule.signal.type}
                        onChange={(event) => {
                          const nextType = event.target.value as Rule['signal']['type']
                          setRuleSetDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((r, i) => {
                              if (i !== index) return r
                              if (nextType === 'frame_range_ref') {
                                return {
                                  ...r,
                                  signal: {
                                    type: 'frame_range_ref',
                                    ref: r.phase ? `phase:${r.phase}` : '',
                                  },
                                }
                              }
                              if (nextType === 'direct') {
                                return {
                                  ...r,
                                  signal: { type: 'direct', frame_range: [0, 0] },
                                }
                              }
                              return {
                                ...r,
                                signal: {
                                  type: 'event_window',
                                  event: '',
                                  window_ms: [-200, 100],
                                  default_phase: r.phase || undefined,
                                },
                              }
                            }),
                          }))
                        }}
                      >
                        <option value="frame_range_ref">frame_range_ref</option>
                        <option value="direct">direct</option>
                        <option value="event_window">event_window</option>
                      </select>
                    </div>

                    {rule.signal.type === 'frame_range_ref' ? (
                      <div className="field">
                        <label htmlFor={`rule_${index}_signal_ref`}>ref</label>
                        <input
                          id={`rule_${index}_signal_ref`}
                          type="text"
                          placeholder="phase:step1"
                          value={rule.signal.ref}
                          onChange={(event) =>
                            setRuleSetDraft((prev) => ({
                              ...prev,
                              rules: prev.rules.map((r, i) =>
                                i === index
                                  ? {
                                      ...r,
                                      signal: { type: 'frame_range_ref', ref: event.target.value },
                                    }
                                  : r
                              ),
                            }))
                          }
                        />
                        <p className="hint">
                          Format: <code>phase:&lt;phaseId&gt;</code>
                        </p>
                      </div>
                    ) : null}

                    {rule.signal.type === 'direct' ? (
                      <div className="field">
                        <label>frame_range</label>
                        <p className="hint" style={{ marginTop: 0 }}>
                          Inclusive frame indices: [start, end].
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <input
                            type="number"
                            value={rule.signal.frame_range[0]}
                            onChange={(event) => {
                              const start = Number(event.target.value)
                              setRuleSetDraft((prev) => ({
                                ...prev,
                                rules: prev.rules.map((r, i) => {
                                  if (i !== index) return r
                                  if (r.signal.type !== 'direct') return r
                                  return { ...r, signal: { ...r.signal, frame_range: [start, r.signal.frame_range[1]] } }
                                }),
                              }))
                            }}
                          />
                          <input
                            type="number"
                            value={rule.signal.frame_range[1]}
                            onChange={(event) => {
                              const end = Number(event.target.value)
                              setRuleSetDraft((prev) => ({
                                ...prev,
                                rules: prev.rules.map((r, i) => {
                                  if (i !== index) return r
                                  if (r.signal.type !== 'direct') return r
                                  return { ...r, signal: { ...r.signal, frame_range: [r.signal.frame_range[0], end] } }
                                }),
                              }))
                            }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {rule.signal.type === 'event_window' ? (
                      <>
                        <div className="field">
                          <label htmlFor={`rule_${index}_signal_event`}>event</label>
                          <input
                            id={`rule_${index}_signal_event`}
                            type="text"
                            placeholder="impact"
                            value={rule.signal.event}
                            onChange={(event) =>
                              setRuleSetDraft((prev) => ({
                                ...prev,
                                rules: prev.rules.map((r, i) =>
                                  i === index && r.signal.type === 'event_window'
                                    ? { ...r, signal: { ...r.signal, event: event.target.value } }
                                    : r
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="field">
                          <label>window_ms</label>
                          <p className="hint" style={{ marginTop: 0 }}>
                            Time window around the event in milliseconds: [pre, post].
                          </p>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <input
                              type="number"
                              value={rule.signal.window_ms[0]}
                              onChange={(event) => {
                                const pre = Number(event.target.value)
                                setRuleSetDraft((prev) => ({
                                  ...prev,
                                  rules: prev.rules.map((r, i) => {
                                    if (i !== index) return r
                                    if (r.signal.type !== 'event_window') return r
                                    return { ...r, signal: { ...r.signal, window_ms: [pre, r.signal.window_ms[1]] } }
                                  }),
                                }))
                              }}
                            />
                            <input
                              type="number"
                              value={rule.signal.window_ms[1]}
                              onChange={(event) => {
                                const post = Number(event.target.value)
                                setRuleSetDraft((prev) => ({
                                  ...prev,
                                  rules: prev.rules.map((r, i) => {
                                    if (i !== index) return r
                                    if (r.signal.type !== 'event_window') return r
                                    return { ...r, signal: { ...r.signal, window_ms: [r.signal.window_ms[0], post] } }
                                  }),
                                }))
                              }}
                            />
                          </div>
                        </div>
                        <div className="field">
                          <label htmlFor={`rule_${index}_signal_default_phase`}>
                            default_phase (optional)
                          </label>
                          {hasPhaseOptions ? (
                            <select
                              id={`rule_${index}_signal_default_phase`}
                              value={rule.signal.default_phase ?? ''}
                              onChange={(event) =>
                                setRuleSetDraft((prev) => ({
                                  ...prev,
                                  rules: prev.rules.map((r, i) =>
                                    i === index && r.signal.type === 'event_window'
                                      ? {
                                          ...r,
                                          signal: {
                                            ...r.signal,
                                            default_phase: event.target.value || undefined,
                                          },
                                        }
                                      : r
                                  ),
                                }))
                              }
                            >
                              <option value="">(none)</option>
                              {phaseOptions.map((id) => (
                                <option key={id} value={id}>
                                  {id}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={`rule_${index}_signal_default_phase`}
                              type="text"
                              value={rule.signal.default_phase ?? ''}
                              onChange={(event) =>
                                setRuleSetDraft((prev) => ({
                                  ...prev,
                                  rules: prev.rules.map((r, i) =>
                                    i === index && r.signal.type === 'event_window'
                                      ? {
                                          ...r,
                                          signal: {
                                            ...r.signal,
                                            default_phase: event.target.value || undefined,
                                          },
                                        }
                                      : r
                                  ),
                                }))
                              }
                            />
                          )}
                        </div>
                      </>
                    ) : null}

                    <div className="field">
                      <label>conditions</label>
                      <div className="actions" style={{ marginBottom: '0.5rem' }}>
                        <button type="button" onClick={() => handleAddCondition(index)}>
                          Add condition
                        </button>
                      </div>

                      {rule.conditions.length === 0 ? (
                        <p className="hint" style={{ marginTop: 0 }}>
                          No conditions yet.
                        </p>
                      ) : (
                        rule.conditions.map((cond, condIndex) => (
                          <div
                            key={condIndex}
                            style={{
                              border: '1px solid #d9dde3',
                              borderRadius: 10,
                              padding: '0.75rem',
                              marginBottom: '0.75rem',
                              background: '#ffffff',
                            }}
                          >
                            <div className="actions" style={{ justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveCondition(index, condIndex)}
                              >
                                Remove
                              </button>
                            </div>

                            <div className="field">
                              <label htmlFor={`rule_${index}_cond_${condIndex}_id`}>id</label>
                              <input
                                id={`rule_${index}_cond_${condIndex}_id`}
                                type="text"
                                value={cond.id}
                                onChange={(event) =>
                                  setRuleSetDraft((prev) => ({
                                    ...prev,
                                    rules: prev.rules.map((r, i) => {
                                      if (i !== index) return r
                                      return {
                                        ...r,
                                        conditions: r.conditions.map((c, j) =>
                                          j === condIndex ? { ...c, id: event.target.value } : c
                                        ),
                                      }
                                    }),
                                  }))
                                }
                              />
                            </div>

                            <div className="field">
                              <label htmlFor={`rule_${index}_cond_${condIndex}_type`}>type</label>
                              <select
                                id={`rule_${index}_cond_${condIndex}_type`}
                                value={cond.type}
                                onChange={(event) => {
                                  const nextType = event.target.value as Condition['type']
                                  setRuleSetDraft((prev) => ({
                                    ...prev,
                                    rules: prev.rules.map((r, i) => {
                                      if (i !== index) return r
                                      return {
                                        ...r,
                                        conditions: r.conditions.map((c, j) => {
                                          if (j !== condIndex) return c
                                          if (nextType === 'threshold') {
                                            return {
                                              id: c.id,
                                              type: 'threshold',
                                              metric: c.metric ?? '',
                                              op: 'gte',
                                              value: 0,
                                              abs_val: c.abs_val ?? false,
                                              tolerance: c.tolerance ?? 0,
                                            }
                                          }
                                          if (nextType === 'range') {
                                            return {
                                              id: c.id,
                                              type: 'range',
                                              metric: c.metric ?? '',
                                              op: 'between',
                                              value: [0, 1],
                                              abs_val: c.abs_val ?? false,
                                              tolerance: c.tolerance ?? 0,
                                            }
                                          }
                                          if (nextType === 'boolean') {
                                            return {
                                              id: c.id,
                                              type: 'boolean',
                                              metric: c.metric ?? '',
                                              op: 'is_true',
                                            }
                                          }
                                          return {
                                            id: c.id,
                                            type: 'composite',
                                            logic: 'all',
                                            conditions: [],
                                          }
                                        }),
                                      }
                                    }),
                                  }))
                                }}
                              >
                                <option value="threshold">threshold</option>
                                <option value="range">range</option>
                                <option value="boolean">boolean</option>
                                <option value="composite">composite</option>
                              </select>
                            </div>

                            {cond.type !== 'composite' ? (
                              <div className="field">
                                <label htmlFor={`rule_${index}_cond_${condIndex}_metric`}>
                                  metric
                                </label>
                                <input
                                  id={`rule_${index}_cond_${condIndex}_metric`}
                                  type="text"
                                  value={cond.metric ?? ''}
                                  onChange={(event) =>
                                    setRuleSetDraft((prev) => ({
                                      ...prev,
                                      rules: prev.rules.map((r, i) => {
                                        if (i !== index) return r
                                        return {
                                          ...r,
                                          conditions: r.conditions.map((c, j) =>
                                            j === condIndex ? { ...c, metric: event.target.value } : c
                                          ),
                                        }
                                      }),
                                    }))
                                  }
                                />
                              </div>
                            ) : null}

                            {cond.type === 'threshold' ? (
                              <>
                                <div className="field">
                                  <label htmlFor={`rule_${index}_cond_${condIndex}_op`}>op</label>
                                  <select
                                    id={`rule_${index}_cond_${condIndex}_op`}
                                    value={cond.op ?? 'gte'}
                                    onChange={(event) =>
                                      setRuleSetDraft((prev) => ({
                                        ...prev,
                                        rules: prev.rules.map((r, i) => {
                                          if (i !== index) return r
                                          return {
                                            ...r,
                                            conditions: r.conditions.map((c, j) =>
                                              j === condIndex ? { ...c, op: event.target.value } : c
                                            ),
                                          }
                                        }),
                                      }))
                                    }
                                  >
                                    <option value="gte">gte</option>
                                    <option value="gt">gt</option>
                                    <option value="lte">lte</option>
                                    <option value="lt">lt</option>
                                    <option value="eq">eq</option>
                                    <option value="neq">neq</option>
                                  </select>
                                </div>
                                <div className="field">
                                  <label htmlFor={`rule_${index}_cond_${condIndex}_value`}>
                                    value
                                  </label>
                                  <input
                                    id={`rule_${index}_cond_${condIndex}_value`}
                                    type="text"
                                    value={formatConditionValue(cond.value)}
                                    onChange={(event) =>
                                      setRuleSetDraft((prev) => ({
                                        ...prev,
                                        rules: prev.rules.map((r, i) => {
                                          if (i !== index) return r
                                          return {
                                            ...r,
                                            conditions: r.conditions.map((c, j) =>
                                              j === condIndex
                                                ? { ...c, value: parseLooseJsonValue(event.target.value) }
                                                : c
                                            ),
                                          }
                                        }),
                                      }))
                                    }
                                  />
                                  <p className="hint">
                                    Accepts a number or JSON (e.g. <code>0.65</code>).
                                  </p>
                                </div>
                                <div className="field">
                                  <label>options</label>
                                  <div className="checkbox-group">
                                    <label className="checkbox-item">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(cond.abs_val)}
                                        onChange={(event) =>
                                          setRuleSetDraft((prev) => ({
                                            ...prev,
                                            rules: prev.rules.map((r, i) => {
                                              if (i !== index) return r
                                              return {
                                                ...r,
                                                conditions: r.conditions.map((c, j) =>
                                                  j === condIndex ? { ...c, abs_val: event.target.checked } : c
                                                ),
                                              }
                                            }),
                                          }))
                                        }
                                      />
                                      <span>abs_val</span>
                                    </label>
                                  </div>
                                </div>
                                <div className="field">
                                  <label htmlFor={`rule_${index}_cond_${condIndex}_tolerance`}>
                                    tolerance
                                  </label>
                                  <input
                                    id={`rule_${index}_cond_${condIndex}_tolerance`}
                                    type="number"
                                    value={Number(cond.tolerance ?? 0)}
                                    onChange={(event) =>
                                      setRuleSetDraft((prev) => ({
                                        ...prev,
                                        rules: prev.rules.map((r, i) => {
                                          if (i !== index) return r
                                          return {
                                            ...r,
                                            conditions: r.conditions.map((c, j) =>
                                              j === condIndex
                                                ? { ...c, tolerance: Number(event.target.value) }
                                                : c
                                            ),
                                          }
                                        }),
                                      }))
                                    }
                                  />
                                </div>
                              </>
                            ) : null}

                            {cond.type === 'range' ? (
                              <>
                                <div className="field">
                                  <label>value (between)</label>
                                  <p className="hint" style={{ marginTop: 0 }}>
                                    Lower and upper bounds.
                                  </p>
                                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input
                                      type="number"
                                      value={Array.isArray(cond.value) ? Number(cond.value[0]) : 0}
                                      onChange={(event) => {
                                        const lower = Number(event.target.value)
                                        const upper = Array.isArray(cond.value) ? Number(cond.value[1]) : 0
                                        setRuleSetDraft((prev) => ({
                                          ...prev,
                                          rules: prev.rules.map((r, i) => {
                                            if (i !== index) return r
                                            return {
                                              ...r,
                                              conditions: r.conditions.map((c, j) =>
                                                j === condIndex ? { ...c, op: 'between', value: [lower, upper] } : c
                                              ),
                                            }
                                          }),
                                        }))
                                      }}
                                    />
                                    <input
                                      type="number"
                                      value={Array.isArray(cond.value) ? Number(cond.value[1]) : 0}
                                      onChange={(event) => {
                                        const upper = Number(event.target.value)
                                        const lower = Array.isArray(cond.value) ? Number(cond.value[0]) : 0
                                        setRuleSetDraft((prev) => ({
                                          ...prev,
                                          rules: prev.rules.map((r, i) => {
                                            if (i !== index) return r
                                            return {
                                              ...r,
                                              conditions: r.conditions.map((c, j) =>
                                                j === condIndex ? { ...c, op: 'between', value: [lower, upper] } : c
                                              ),
                                            }
                                          }),
                                        }))
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="field">
                                  <label>options</label>
                                  <div className="checkbox-group">
                                    <label className="checkbox-item">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(cond.abs_val)}
                                        onChange={(event) =>
                                          setRuleSetDraft((prev) => ({
                                            ...prev,
                                            rules: prev.rules.map((r, i) => {
                                              if (i !== index) return r
                                              return {
                                                ...r,
                                                conditions: r.conditions.map((c, j) =>
                                                  j === condIndex ? { ...c, abs_val: event.target.checked } : c
                                                ),
                                              }
                                            }),
                                          }))
                                        }
                                      />
                                      <span>abs_val</span>
                                    </label>
                                  </div>
                                </div>
                                <div className="field">
                                  <label htmlFor={`rule_${index}_cond_${condIndex}_tolerance`}>
                                    tolerance
                                  </label>
                                  <input
                                    id={`rule_${index}_cond_${condIndex}_tolerance`}
                                    type="number"
                                    value={Number(cond.tolerance ?? 0)}
                                    onChange={(event) =>
                                      setRuleSetDraft((prev) => ({
                                        ...prev,
                                        rules: prev.rules.map((r, i) => {
                                          if (i !== index) return r
                                          return {
                                            ...r,
                                            conditions: r.conditions.map((c, j) =>
                                              j === condIndex
                                                ? { ...c, tolerance: Number(event.target.value) }
                                                : c
                                            ),
                                          }
                                        }),
                                      }))
                                    }
                                  />
                                </div>
                              </>
                            ) : null}

                            {cond.type === 'boolean' ? (
                              <div className="field">
                                <label htmlFor={`rule_${index}_cond_${condIndex}_op`}>op</label>
                                <select
                                  id={`rule_${index}_cond_${condIndex}_op`}
                                  value={cond.op ?? 'is_true'}
                                  onChange={(event) =>
                                    setRuleSetDraft((prev) => ({
                                      ...prev,
                                      rules: prev.rules.map((r, i) => {
                                        if (i !== index) return r
                                        return {
                                          ...r,
                                          conditions: r.conditions.map((c, j) =>
                                            j === condIndex ? { ...c, op: event.target.value } : c
                                          ),
                                        }
                                      }),
                                    }))
                                  }
                                >
                                  <option value="is_true">is_true</option>
                                  <option value="is_false">is_false</option>
                                </select>
                              </div>
                            ) : null}

                            {cond.type === 'composite' ? (
                              <>
                                <div className="field">
                                  <label htmlFor={`rule_${index}_cond_${condIndex}_logic`}>logic</label>
                                  <select
                                    id={`rule_${index}_cond_${condIndex}_logic`}
                                    value={cond.logic ?? 'all'}
                                    onChange={(event) =>
                                      setRuleSetDraft((prev) => ({
                                        ...prev,
                                        rules: prev.rules.map((r, i) => {
                                          if (i !== index) return r
                                          return {
                                            ...r,
                                            conditions: r.conditions.map((c, j) =>
                                              j === condIndex
                                                ? {
                                                    ...c,
                                                    logic: event.target.value as Condition['logic'],
                                                  }
                                                : c
                                            ),
                                          }
                                        }),
                                      }))
                                    }
                                  >
                                    <option value="all">all</option>
                                    <option value="any">any</option>
                                    <option value="none">none</option>
                                  </select>
                                </div>
                                <div className="field">
                                  <label htmlFor={`rule_${index}_cond_${condIndex}_conditions`}>
                                    conditions (CSV of condition ids)
                                  </label>
                                  <input
                                    id={`rule_${index}_cond_${condIndex}_conditions`}
                                    type="text"
                                    value={toCsv(cond.conditions ?? [])}
                                    onChange={(event) =>
                                      setRuleSetDraft((prev) => ({
                                        ...prev,
                                        rules: prev.rules.map((r, i) => {
                                          if (i !== index) return r
                                          return {
                                            ...r,
                                            conditions: r.conditions.map((c, j) =>
                                              j === condIndex
                                                ? {
                                                    ...c,
                                                    conditions: fromCsv(event.target.value),
                                                  }
                                                : c
                                            ),
                                          }
                                        }),
                                      }))
                                    }
                                  />
                                </div>
                              </>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="field">
                      <label>score</label>
                      <div
                        style={{
                          border: '1px solid #d9dde3',
                          borderRadius: 10,
                          padding: '0.75rem',
                          background: '#ffffff',
                        }}
                      >
                        <div className="field">
                          <label htmlFor={`rule_${index}_score_mode`}>mode</label>
                          <select
                            id={`rule_${index}_score_mode`}
                            value={rule.score.mode}
                            onChange={(event) => {
                              const nextMode = event.target.value as Score['mode']
                              setRuleSetDraft((prev) => ({
                                ...prev,
                                rules: prev.rules.map((r, i) =>
                                  i === index ? { ...r, score: { ...r.score, mode: nextMode } } : r
                                ),
                              }))
                            }}
                          >
                            <option value="all-or-nothing">all-or-nothing</option>
                            <option value="average">average</option>
                          </select>
                        </div>

                        <div className="field">
                          <label htmlFor={`rule_${index}_score_pass`}>pass_score</label>
                          <input
                            id={`rule_${index}_score_pass`}
                            type="number"
                            value={rule.score.pass_score}
                            onChange={(event) => {
                              const value = Number(event.target.value)
                              setRuleSetDraft((prev) => ({
                                ...prev,
                                rules: prev.rules.map((r, i) =>
                                  i === index
                                    ? { ...r, score: { ...r.score, pass_score: value } }
                                    : r
                                ),
                              }))
                            }}
                          />
                        </div>

                        <div className="field">
                          <label htmlFor={`rule_${index}_score_max`}>max_score</label>
                          <input
                            id={`rule_${index}_score_max`}
                            type="number"
                            value={rule.score.max_score}
                            onChange={(event) => {
                              const value = Number(event.target.value)
                              setRuleSetDraft((prev) => ({
                                ...prev,
                                rules: prev.rules.map((r, i) =>
                                  i === index ? { ...r, score: { ...r.score, max_score: value } } : r
                                ),
                              }))
                            }}
                          />
                        </div>

                        <p className="hint" style={{ marginTop: 0 }}>
                          Weighted scoring is omitted in the UI for now.
                        </p>
                      </div>
                    </div>

                    <div className="field">
                      <label>feedback</label>
                      <div className="actions" style={{ marginBottom: '0.5rem' }}>
                        <button type="button" onClick={() => handleAddFeedback(index)}>
                          Add feedback
                        </button>
                      </div>

                      {rule.feedback.length === 0 ? (
                        <p className="hint" style={{ marginTop: 0 }}>
                          No feedback yet.
                        </p>
                      ) : (
                        rule.feedback.map((fb, fbIndex) => (
                          <div
                            key={fbIndex}
                            style={{
                              border: '1px solid #d9dde3',
                              borderRadius: 10,
                              padding: '0.75rem',
                              marginBottom: '0.75rem',
                              background: '#ffffff',
                            }}
                          >
                            <div className="actions" style={{ justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveFeedback(index, fbIndex)}
                              >
                                Remove
                              </button>
                            </div>

                            <div className="field">
                              <label htmlFor={`rule_${index}_fb_${fbIndex}_condition_ids`}>
                                condition_ids (CSV)
                              </label>
                              <input
                                id={`rule_${index}_fb_${fbIndex}_condition_ids`}
                                type="text"
                                value={toCsv(fb.condition_ids)}
                                onChange={(event) => {
                                  const next = fromCsv(event.target.value)
                                  setRuleSetDraft((prev) => ({
                                    ...prev,
                                    rules: prev.rules.map((r, i) => {
                                      if (i !== index) return r
                                      return {
                                        ...r,
                                        feedback: r.feedback.map((f, j) =>
                                          j === fbIndex ? { ...f, condition_ids: next } : f
                                        ),
                                      }
                                    }),
                                  }))
                                }}
                              />
                            </div>

                            <div className="field">
                              <label htmlFor={`rule_${index}_fb_${fbIndex}_message`}>message</label>
                              <input
                                id={`rule_${index}_fb_${fbIndex}_message`}
                                type="text"
                                value={fb.message}
                                onChange={(event) =>
                                  setRuleSetDraft((prev) => ({
                                    ...prev,
                                    rules: prev.rules.map((r, i) => {
                                      if (i !== index) return r
                                      return {
                                        ...r,
                                        feedback: r.feedback.map((f, j) =>
                                          j === fbIndex ? { ...f, message: event.target.value } : f
                                        ),
                                      }
                                    }),
                                  }))
                                }
                              />
                            </div>

                            <div className="field">
                              <label htmlFor={`rule_${index}_fb_${fbIndex}_severity`}>severity</label>
                              <select
                                id={`rule_${index}_fb_${fbIndex}_severity`}
                                value={fb.severity}
                                onChange={(event) =>
                                  setRuleSetDraft((prev) => ({
                                    ...prev,
                                    rules: prev.rules.map((r, i) => {
                                      if (i !== index) return r
                                      return {
                                        ...r,
                                        feedback: r.feedback.map((f, j) =>
                                          j === fbIndex
                                            ? {
                                                ...f,
                                                severity: event.target.value as Feedback['severity'],
                                              }
                                            : f
                                        ),
                                      }
                                    }),
                                  }))
                                }
                              >
                                <option value="info">info</option>
                                <option value="warn">warn</option>
                                <option value="fail">fail</option>
                              </select>
                            </div>

                            <div className="field">
                              <label htmlFor={`rule_${index}_fb_${fbIndex}_attach_to_ts`}>
                                attach_to_ts (optional)
                              </label>
                              <input
                                id={`rule_${index}_fb_${fbIndex}_attach_to_ts`}
                                type="text"
                                placeholder="event:impact or frame:0"
                                value={fb.attach_to_ts ?? ''}
                                onChange={(event) =>
                                  setRuleSetDraft((prev) => ({
                                    ...prev,
                                    rules: prev.rules.map((r, i) => {
                                      if (i !== index) return r
                                      return {
                                        ...r,
                                        feedback: r.feedback.map((f, j) =>
                                          j === fbIndex
                                            ? {
                                                ...f,
                                                attach_to_ts: event.target.value || undefined,
                                              }
                                            : f
                                        ),
                                      }
                                    }),
                                  }))
                                }
                              />
                              <p className="hint">
                                Format: <code>event:&lt;name&gt;</code> or <code>frame:&lt;idx&gt;</code>
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="field">
                      <label htmlFor={`rule_${index}_category`}>category</label>
                      <input
                        id={`rule_${index}_category`}
                        type="text"
                        value={rule.category}
                        onChange={(event) =>
                          setRuleSetDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((r, i) =>
                              i === index ? { ...r, category: event.target.value } : r
                            ),
                          }))
                        }
                      />
                    </div>

                    <div className="field">
                      <label htmlFor={`rule_${index}_severity`}>severity</label>
                      <select
                        id={`rule_${index}_severity`}
                        value={rule.severity}
                        onChange={(event) =>
                          setRuleSetDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((r, i) =>
                              i === index
                                ? { ...r, severity: event.target.value as Rule['severity'] }
                                : r
                            ),
                          }))
                        }
                      >
                        <option value="info">info</option>
                        <option value="warn">warn</option>
                        <option value="fail">fail</option>
                      </select>
                    </div>
                  </div>
                )
              })
            )}
          </section>

          <section className="panel">
            <h2>JSON Preview</h2>
            <pre className="code">{jsonPreview}</pre>
          </section>
        </main>
      </div>
    </>
  )
}

export default App
