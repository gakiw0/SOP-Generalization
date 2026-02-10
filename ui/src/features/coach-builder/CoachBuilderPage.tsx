import { useMemo, useReducer } from 'react'
import { createInitialState } from './draftTypes'
import { coachDraftReducer } from './reducer'
import { StepEditor } from './components/StepEditor'
import { StepList } from './components/StepList'
import './styles.css'

export function CoachBuilderPage() {
  const [state, dispatch] = useReducer(coachDraftReducer, undefined, createInitialState)

  const selectedStep = useMemo(
    () => state.draft.steps.find((step) => step.id === state.selectedStepId) ?? null,
    [state.draft.steps, state.selectedStepId]
  )

  return (
    <main className="coach-builder-page">
      <header className="coach-builder-header cb-panel">
        <h1>Coach JSON Builder</h1>
        <p>Build schema v1 JSON with step/checkpoint language.</p>
      </header>

      <section className="cb-panel">
        <h2>Rule set metadata</h2>
        <div className="cb-field-grid">
          <label>
            Rule set ID
            <input
              type="text"
              value={state.draft.metadata.ruleSetId}
              onChange={(event) =>
                dispatch({ type: 'meta/set', field: 'ruleSetId', value: event.target.value })
              }
            />
          </label>

          <label>
            Sport
            <input
              type="text"
              value={state.draft.metadata.sport}
              onChange={(event) =>
                dispatch({ type: 'meta/set', field: 'sport', value: event.target.value })
              }
            />
          </label>

          <label>
            Rule version
            <input
              type="text"
              value={state.draft.metadata.sportVersion}
              onChange={(event) =>
                dispatch({ type: 'meta/set', field: 'sportVersion', value: event.target.value })
              }
            />
          </label>

          <label className="cb-full-width">
            Title
            <input
              type="text"
              value={state.draft.metadata.title}
              onChange={(event) =>
                dispatch({ type: 'meta/set', field: 'title', value: event.target.value })
              }
            />
          </label>
        </div>
      </section>

      <div className="cb-layout">
        <StepList
          steps={state.draft.steps}
          selectedStepId={state.selectedStepId}
          onSelect={(stepId) => dispatch({ type: 'step/select', stepId })}
          onAdd={() => dispatch({ type: 'step/add' })}
          onRemove={(stepId) => dispatch({ type: 'step/remove', stepId })}
        />

        <StepEditor
          step={selectedStep}
          onRename={(nextId) => {
            if (!selectedStep) return
            dispatch({ type: 'step/rename', stepId: selectedStep.id, nextId })
          }}
          onUpdate={(patch) => {
            if (!selectedStep) return
            dispatch({ type: 'step/update', stepId: selectedStep.id, patch })
          }}
        />
      </div>

      <section className="cb-panel">
        <h2>Checkpoint editor</h2>
        <p>Checkpoint editing is added in the next commit.</p>
      </section>
    </main>
  )
}
