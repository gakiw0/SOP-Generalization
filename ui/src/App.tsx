import { useMemo, useState } from 'react'
import './App.css'

type Inputs = {
  expected_fps?: number
  keypoints_format?: string
  camera_view?: string
  preprocess?: string[]
}

const KEYPOINTS_FORMATS = ['openpose25', 'coco17', 'other']
const CAMERA_VIEWS = ['side', 'front', 'rear', 'other']
const PREPROCESS_OPTIONS = ['align_orientation', 'normalize_lengths']

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
  globals: Record<string, unknown>
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
    keypoints_format: '',
    camera_view: '',
    preprocess: [],
  },
  globals: {},
  phases: [],
  rules: [],
})

const toCsv = (items: string[]): string => items.join(', ')

const fromCsv = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

function App() {
  const [ruleSetDraft, setRuleSetDraft] = useState<RuleSet>(() =>
    createEmptyRuleSet()
  )
  const [keypointsChoice, setKeypointsChoice] = useState('')
  const [cameraChoice, setCameraChoice] = useState('')
  const jsonPreview = useMemo(
    () => JSON.stringify(ruleSetDraft, null, 2),
    [ruleSetDraft]
  )

  const handleNew = () => {
    setRuleSetDraft(createEmptyRuleSet())
    setKeypointsChoice('')
    setCameraChoice('')
  }

  const handleValidate = () => {
    const errors: string[] = []
    if (!ruleSetDraft.rule_set_id.trim()) errors.push('rule_set_id')
    if (!ruleSetDraft.sport.trim()) errors.push('sport')
    if (!ruleSetDraft.sport_version.trim()) errors.push('sport_version')
    if (!ruleSetDraft.metadata.title.trim()) errors.push('metadata.title')

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
              <select
                id="keypoints_format"
                value={keypointsChoice}
                onChange={(event) =>
                  setRuleSetDraft((prev) => {
                    const nextValue = event.target.value
                    setKeypointsChoice(nextValue)
                    return {
                      ...prev,
                      inputs: {
                        ...prev.inputs,
                        keypoints_format: nextValue === 'other' ? '' : nextValue,
                      },
                    }
                  })
                }
              >
                <option value="">Select format</option>
                {KEYPOINTS_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
              {keypointsChoice === 'other' && (
                <input
                  type="text"
                  placeholder="custom keypoints_format"
                  value={ruleSetDraft.inputs.keypoints_format ?? ''}
                  onChange={(event) =>
                    setRuleSetDraft((prev) => ({
                      ...prev,
                      inputs: {
                        ...prev.inputs,
                        keypoints_format: event.target.value,
                      },
                    }))
                  }
                />
              )}
            </div>
            <div className="field">
              <label htmlFor="camera_view">camera_view</label>
              <select
                id="camera_view"
                value={cameraChoice}
                onChange={(event) =>
                  setRuleSetDraft((prev) => {
                    const nextValue = event.target.value
                    setCameraChoice(nextValue)
                    return {
                      ...prev,
                      inputs: {
                        ...prev.inputs,
                        camera_view: nextValue === 'other' ? '' : nextValue,
                      },
                    }
                  })
                }
              >
                <option value="">Select view</option>
                {CAMERA_VIEWS.map((view) => (
                  <option key={view} value={view}>
                    {view}
                  </option>
                ))}
              </select>
              {cameraChoice === 'other' && (
                <input
                  type="text"
                  placeholder="custom camera_view"
                  value={ruleSetDraft.inputs.camera_view ?? ''}
                  onChange={(event) =>
                    setRuleSetDraft((prev) => ({
                      ...prev,
                      inputs: {
                        ...prev.inputs,
                        camera_view: event.target.value,
                      },
                    }))
                  }
                />
              )}
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
            <h2>JSON Preview</h2>
            <pre className="code">{jsonPreview}</pre>
          </section>
        </main>
      </div>
    </>
  )
}

export default App
