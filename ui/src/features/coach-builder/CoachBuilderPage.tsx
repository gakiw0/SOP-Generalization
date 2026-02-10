import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createInitialState, normalizeDraftForExport } from './draftTypes'
import { downloadRuleSetJson } from './export'
import { importDraftFromFile } from './import'
import { summarizeValidation, toRuleSetSchemaV1 } from './mappers'
import { coachDraftReducer } from './reducer'
import { validateRuleSet } from './validation'
import { CheckpointEditor } from './components/CheckpointEditor'
import { StepEditor } from './components/StepEditor'
import { StepList } from './components/StepList'
import { ValidationPanel } from './components/ValidationPanel'
import './styles.css'

export function CoachBuilderPage() {
  const [state, dispatch] = useReducer(coachDraftReducer, undefined, createInitialState)
  const [validationSummary, setValidationSummary] = useState('Not validated yet.')
  const [validationErrors, setValidationErrors] = useState<
    Array<{ path: string; message: string }>
  >([])
  const [hasValidated, setHasValidated] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const suppressValidationResetRef = useRef(false)

  const selectedStep = useMemo(
    () => state.draft.steps.find((step) => step.id === state.selectedStepId) ?? null,
    [state.draft.steps, state.selectedStepId]
  )

  const checkpointLocator = useMemo(
    () =>
      state.draft.steps.flatMap((step) =>
        step.checkpoints.map((checkpoint) => ({ stepId: step.id, checkpointId: checkpoint.id }))
      ),
    [state.draft.steps]
  )

  useEffect(() => {
    if (suppressValidationResetRef.current) {
      suppressValidationResetRef.current = false
      return
    }
    setHasValidated(false)
  }, [state.draft])

  const runValidation = () => {
    const ruleSet = toRuleSetSchemaV1(normalizeDraftForExport(state.draft))
    const errors = validateRuleSet(ruleSet)
    setValidationErrors(errors)
    setValidationSummary(summarizeValidation(errors))
    setHasValidated(true)
    return errors
  }

  const handleExport = () => {
    const errors = runValidation()
    if (errors.length > 0) return

    const normalizedDraft = normalizeDraftForExport(state.draft)
    const ruleSet = toRuleSetSchemaV1(normalizedDraft)
    const fileName = normalizedDraft.metadata.ruleSetId || 'rule_set'
    downloadRuleSetJson(ruleSet, fileName)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const imported = await importDraftFromFile(file)
      setValidationErrors(imported.errors)
      setValidationSummary(imported.message)
      setHasValidated(true)

      if (imported.draft) {
        suppressValidationResetRef.current = true
        dispatch({ type: 'draft/replace', draft: imported.draft })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import JSON file.'
      setValidationErrors([{ path: 'import', message }])
      setValidationSummary(`Import failed. ${message}`)
      setHasValidated(false)
    } finally {
      event.target.value = ''
    }
  }

  const navigateFromPath = (path: string) => {
    const phaseMatch = path.match(/^phases\[(\d+)\]/)
    if (phaseMatch) {
      const index = Number(phaseMatch[1])
      const stepId = state.draft.steps[index]?.id
      if (stepId) {
        dispatch({ type: 'step/select', stepId })
      }
      return
    }

    const ruleMatch = path.match(/^rules\[(\d+)\]/)
    if (ruleMatch) {
      const index = Number(ruleMatch[1])
      const target = checkpointLocator[index]
      if (target) {
        dispatch({ type: 'step/select', stepId: target.stepId })
        dispatch({ type: 'checkpoint/select', checkpointId: target.checkpointId })
      }
    }
  }

  return (
    <main className="coach-builder-page">
      <header className="coach-builder-header cb-panel">
        <div className="cb-panel-header">
          <h1>Coach JSON Builder</h1>
          <div className="cb-export-actions">
            <button type="button" onClick={handleImportClick}>
              Import JSON
            </button>
            <button type="button" onClick={() => dispatch({ type: 'draft/reset' })}>
              Reset
            </button>
          </div>
        </div>
        <p>Build schema v1 JSON with step/checkpoint language.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportFile}
          className="cb-hidden-file-input"
        />
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
        expertEnabled={
          state.selectedCheckpointId != null &&
          state.expertCheckpointIds.includes(state.selectedCheckpointId)
        }
        onToggleExpert={(enabled) => {
          if (!state.selectedCheckpointId) return
          dispatch({
            type: 'checkpoint/toggleExpert',
            checkpointId: state.selectedCheckpointId,
            enabled,
          })
        }}
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
        onAddCondition={(checkpointId, conditionType) => {
          if (!selectedStep) return
          dispatch({
            type: 'condition/add',
            stepId: selectedStep.id,
            checkpointId,
            conditionType,
          })
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

      <ValidationPanel
        errors={validationErrors}
        summary={validationSummary}
        onValidate={runValidation}
        onNavigateError={navigateFromPath}
      />

      <section className="cb-panel">
        <div className="cb-panel-header">
          <h2>Export</h2>
          <div className="cb-export-actions">
            <button
              type="button"
              className="cb-primary"
              disabled={!hasValidated || validationErrors.length > 0}
              onClick={handleExport}
            >
              Export JSON
            </button>
          </div>
        </div>
        <p>
          Run validation first. Export is enabled only when validation passes with zero errors.
        </p>
      </section>
    </main>
  )
}
