import { useMemo, useReducer } from 'react'
import { createInitialState } from './draftTypes'
import { coachDraftReducer } from './reducer'
import { CheckpointEditor } from './components/CheckpointEditor'
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

      <CheckpointEditor
        step={selectedStep}
        stepIds={state.draft.steps.map((step) => step.id)}
        selectedCheckpointId={state.selectedCheckpointId}
        onSelectCheckpoint={(checkpointId) =>
          dispatch({ type: 'checkpoint/select', checkpointId })
        }
        onAddCheckpoint={() => {
          if (!selectedStep) return
          dispatch({ type: 'checkpoint/add', stepId: selectedStep.id })
        }}
        onRemoveCheckpoint={(checkpointId) => {
          if (!selectedStep) return
          dispatch({ type: 'checkpoint/remove', stepId: selectedStep.id, checkpointId })
        }}
        onUpdateCheckpoint={(checkpointId, patch) => {
          if (!selectedStep) return
          dispatch({
            type: 'checkpoint/update',
            stepId: selectedStep.id,
            checkpointId,
            patch,
          })
        }}
        onAddCondition={(checkpointId) => {
          if (!selectedStep) return
          dispatch({ type: 'condition/add', stepId: selectedStep.id, checkpointId })
        }}
        onUpdateCondition={(checkpointId, conditionId, patch) => {
          if (!selectedStep) return
          dispatch({
            type: 'condition/update',
            stepId: selectedStep.id,
            checkpointId,
            conditionId,
            patch,
          })
        }}
        onRemoveCondition={(checkpointId, conditionId) => {
          if (!selectedStep) return
          dispatch({
            type: 'condition/remove',
            stepId: selectedStep.id,
            checkpointId,
            conditionId,
          })
        }}
      />
    </main>
  )
}
