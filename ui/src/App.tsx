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
  rules: unknown[]
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

const toggleNumberListItem = (
  list: number[],
  item: number,
  checked: boolean
): number[] => {
  if (checked) return list.includes(item) ? list : [...list, item]
  return list.filter((entry) => entry !== item)
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
  const jsonPreview = useMemo(
    () => JSON.stringify(ruleSetDraft, null, 2),
    [ruleSetDraft]
  )

  const handleNew = () => {
    setRuleSetDraft(createEmptyRuleSet())
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

  const handleValidate = () => {
    const errors: string[] = []
    if (!ruleSetDraft.rule_set_id.trim()) errors.push('rule_set_id')
    if (!ruleSetDraft.sport.trim()) errors.push('sport')
    if (!ruleSetDraft.sport_version.trim()) errors.push('sport_version')
    if (!ruleSetDraft.metadata.title.trim()) errors.push('metadata.title')
    if ((ruleSetDraft.inputs.keypoints_format ?? '') !== 'openpose25') {
      errors.push('inputs.keypoints_format (must be openpose25 for current engine)')
    }
    if ((ruleSetDraft.inputs.camera_view ?? '') !== 'side') {
      errors.push('inputs.camera_view (must be side for current engine)')
    }
    if ((ruleSetDraft.globals.angle_units ?? '') !== 'degrees') {
      errors.push('globals.angle_units (must be degrees for current engine)')
    }

    if (errors.length === 0) {
      window.alert('Basic check passed. Full validation will be added later.')
      return
    }
    window.alert(`Missing required fields: ${errors.join(', ')}`)
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
                    key={`${index}-${phase.id}`}
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
                        Selected: {toNumberCsv(phase.joints_of_interest ?? []) || '(none)'}
                      </p>
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
