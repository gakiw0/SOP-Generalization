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
  phases: unknown[]
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
            <h2>JSON Preview</h2>
            <pre className="code">{jsonPreview}</pre>
          </section>
        </main>
      </div>
    </>
  )
}

export default App
