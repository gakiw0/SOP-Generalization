export type Inputs = {
  expected_fps?: number
  min_resolution?: [number, number]
  keypoints_format?: string
  camera_view?: string
  preprocess?: string[]
}

export type Globals = {
  time_tolerance_ms?: number
  confidence_threshold?: number
  angle_units?: 'degrees' | 'radians'
  feature_pipeline?: string[]
}

export type FrameRange = [number, number]
export type WindowMs = [number, number]

export type Phase = {
  id: string
  label: string
  description?: string
  frame_range?: FrameRange
  event_window?: {
    event: string
    window_ms: WindowMs
  }
  joints_of_interest?: number[]
}

export type SignalFrameRangeRef = {
  type: 'frame_range_ref'
  ref: string
}

export type SignalEventWindow = {
  type: 'event_window'
  event: string
  window_ms: WindowMs
  default_phase?: string
}

export type SignalDirect = {
  type: 'direct'
  frame_range: FrameRange
  joints?: number[]
}

export type Signal = SignalFrameRangeRef | SignalEventWindow | SignalDirect

export type ThresholdCondition = {
  id: string
  type: 'threshold'
  metric: string
  op: 'gte' | 'gt' | 'lte' | 'lt' | 'eq' | 'neq'
  value: number
  tolerance?: number
  abs_val?: boolean
}

export type RangeCondition = {
  id: string
  type: 'range'
  metric: string
  op: 'between'
  value: [number, number]
  tolerance?: number
  abs_val?: boolean
}

export type BooleanCondition = {
  id: string
  type: 'boolean'
  metric: string
  op: 'is_true' | 'is_false'
}

export type EventExistsCondition = {
  id: string
  type: 'event_exists'
  event: string
  window_ms?: WindowMs
}

export type CompositeCondition = {
  id: string
  type: 'composite'
  logic: 'all' | 'any' | 'none'
  conditions: string[]
}

export type TrendCondition = {
  id: string
  type: 'trend'
  metric: string
  op: 'increasing' | 'decreasing'
  window_frames?: number
  window_ms?: WindowMs
}

export type AngleCondition = {
  id: string
  type: 'angle'
  joints: number[]
  reference?: 'global' | 'local'
  op: 'gte' | 'gt' | 'lte' | 'lt' | 'eq' | 'neq' | 'between'
  value: number | [number, number]
  tolerance?: number
}

export type DistanceCondition = {
  id: string
  type: 'distance'
  pair: [number, number]
  metric?: string
  op: 'gte' | 'gt' | 'lte' | 'lt' | 'eq' | 'neq' | 'between'
  value: number | [number, number]
  tolerance?: number
}

export type Condition =
  | ThresholdCondition
  | RangeCondition
  | BooleanCondition
  | EventExistsCondition
  | CompositeCondition
  | TrendCondition
  | AngleCondition
  | DistanceCondition

export type Score = {
  mode: 'weighted' | 'all-or-nothing' | 'average'
  weights?: Record<string, number>
  pass_score: number
  max_score: number
}

export type Feedback = {
  condition_ids: string[]
  message: string
  severity: 'info' | 'warn' | 'fail'
  attach_to_ts?: string
}

export type Rule = {
  id: string
  label: string
  description?: string
  phase: string
  category: string
  severity: 'info' | 'warn' | 'fail'
  applies_when?: {
    phase?: string
    prereq_rules_passed?: string[]
  }
  signal: Signal
  conditions: Condition[]
  score: Score
  feedback?: Feedback[]
}

export type RuleSetBase = {
  schema_version: string
  rule_set_id: string
  metadata: {
    title: string
    description?: string
    created_at?: string
    authors?: string[]
    notes?: string[]
    changelog?: Array<{
      version: string
      date: string
      changes: string[]
      parity_checks?: string[]
    }>
  }
  inputs: Inputs
  globals: Globals
  phases: Phase[]
  rules: Rule[]
}

export type MetricProfile = {
  id: string
  type: 'generic' | 'preset'
  metric_space: 'core_v1'
  preset_id?: string
}

export type RuleSetV1 = RuleSetBase & {
  sport: string
  sport_version: string
}

export type RuleSetV2 = RuleSetBase & {
  metric_profile: MetricProfile
  sport?: string
  sport_version?: string
}

export type RuleSet = RuleSetV1 | RuleSetV2

export type ValidationCode =
  | 'required'
  | 'invalid_semver'
  | 'invalid_id_format'
  | 'duplicate_phase_id'
  | 'duplicate_rule_id'
  | 'unknown_phase'
  | 'phase_range_mode_required'
  | 'frame_range_invalid'
  | 'window_ms_invalid'
  | 'integer_array_non_negative'
  | 'signal_ref_required'
  | 'signal_ref_format'
  | 'signal_type_invalid'
  | 'signal_event_required'
  | 'condition_required'
  | 'duplicate_condition_id'
  | 'condition_type_invalid'
  | 'unsupported_condition_type'
  | 'metric_required'
  | 'unsupported_metric'
  | 'op_invalid'
  | 'value_number_required'
  | 'value_pair_required'
  | 'tolerance_number_required'
  | 'event_required'
  | 'window_frames_invalid'
  | 'joints_invalid'
  | 'pair_invalid'
  | 'logic_invalid'
  | 'condition_refs_required'
  | 'unknown_condition_ref'
  | 'score_required'
  | 'score_mode_invalid'
  | 'pass_score_invalid'
  | 'max_score_invalid'
  | 'weighted_requires_weights'
  | 'feedback_condition_ids_required'
  | 'feedback_unknown_condition'
  | 'feedback_message_required'
  | 'severity_invalid'
  | 'attach_to_ts_invalid'
  | 'phases_required'
  | 'rules_required'
  | 'import_invalid_json'
  | 'import_invalid_json_root'
  | 'import_unexpected_error'

export type ValidationError = {
  path: string
  code: ValidationCode
  params?: Record<string, string | number>
}
