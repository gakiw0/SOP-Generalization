import { useMemo, useState } from 'react'
import './App.css'

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
  inputs: Record<string, unknown>
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
  inputs: {},
  globals: {},
  phases: [],
  rules: [],
})

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
              More fields (phases/rules/inputs/globals) will be added in Step 3.
            </p>
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
