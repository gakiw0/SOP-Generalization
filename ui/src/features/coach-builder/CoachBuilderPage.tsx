import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createInitialState, normalizeDraftForExport } from './draftTypes'
import { downloadRuleSetJson } from './export'
import { importDraftFromFile, type ImportMessageKey } from './import'
import { toRuleSetSchemaV1 } from './mappers'
import { coachDraftReducer } from './reducer'
import type { ValidationError } from './schemaTypes'
import { validateRuleSet } from './validation'
import {
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  normalizeLocale,
  type LocaleCode,
} from '../../i18n'
import { CheckpointEditor } from './components/CheckpointEditor'
import { StepEditor } from './components/StepEditor'
import { StepList } from './components/StepList'
import { ValidationPanel } from './components/ValidationPanel'
import './styles.css'

type ValidationStatus = 'idle' | 'pass' | 'fail'

type StatusMessage = {
  key: ImportMessageKey
  params?: Record<string, string | number>
}

export function CoachBuilderPage() {
  const { t, i18n } = useTranslation()
  const [state, dispatch] = useReducer(coachDraftReducer, undefined, createInitialState)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
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

  const currentLocale =
    normalizeLocale(i18n.resolvedLanguage ?? i18n.language) ?? 'en'

  useEffect(() => {
    if (suppressValidationResetRef.current) {
      suppressValidationResetRef.current = false
      return
    }
    setHasValidated(false)
    setValidationStatus('idle')
  }, [state.draft])

  const runValidation = () => {
    const ruleSet = toRuleSetSchemaV1(normalizeDraftForExport(state.draft))
    const errors = validateRuleSet(ruleSet)
    setValidationErrors(errors)
    setValidationStatus(errors.length === 0 ? 'pass' : 'fail')
    setHasValidated(true)
    setStatusMessage(null)
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
      setValidationStatus(imported.errors.length === 0 ? 'pass' : 'fail')
      setStatusMessage({ key: imported.messageKey, params: imported.messageParams })
      setHasValidated(true)

      if (imported.draft) {
        suppressValidationResetRef.current = true
        dispatch({ type: 'draft/replace', draft: imported.draft })
      }
    } finally {
      event.target.value = ''
    }
  }

  const handleLocaleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as LocaleCode
    await i18n.changeLanguage(next)
    window.sessionStorage.setItem(LOCALE_STORAGE_KEY, next)
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
          <h1>{t('page.title')}</h1>
          <div className="cb-export-actions">
            <label className="cb-language-select" htmlFor="locale-select">
              {t('common.language')}
              <select id="locale-select" value={currentLocale} onChange={handleLocaleChange}>
                {SUPPORTED_LOCALES.map((locale) => (
                  <option key={locale} value={locale}>
                    {t(`language.${locale}`)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={handleImportClick}>
              {t('common.importJson')}
            </button>
            <button type="button" onClick={() => dispatch({ type: 'draft/reset' })}>
              {t('common.reset')}
            </button>
          </div>
        </div>
        <p>{t('page.subtitle')}</p>
        {statusMessage ? <p className="cb-status-text">{t(statusMessage.key, statusMessage.params)}</p> : null}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportFile}
          className="cb-hidden-file-input"
        />
      </header>

      <section className="cb-panel">
        <h2>{t('metadata.sectionTitle')}</h2>
        <div className="cb-field-grid">
          <label>
            {t('metadata.ruleSetId')}
            <input
              type="text"
              value={state.draft.metadata.ruleSetId}
              onChange={(event) =>
                dispatch({ type: 'meta/set', field: 'ruleSetId', value: event.target.value })
              }
            />
          </label>

          <label>
            {t('metadata.sport')}
            <input
              type="text"
              value={state.draft.metadata.sport}
              onChange={(event) =>
                dispatch({ type: 'meta/set', field: 'sport', value: event.target.value })
              }
            />
          </label>

          <label>
            {t('metadata.ruleVersion')}
            <input
              type="text"
              value={state.draft.metadata.sportVersion}
              onChange={(event) =>
                dispatch({ type: 'meta/set', field: 'sportVersion', value: event.target.value })
              }
            />
          </label>

          <label className="cb-full-width">
            {t('metadata.title')}
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
        status={validationStatus}
        onValidate={runValidation}
        onNavigateError={navigateFromPath}
      />

      <section className="cb-panel">
        <div className="cb-panel-header">
          <h2>{t('export.sectionTitle')}</h2>
          <div className="cb-export-actions">
            <button
              type="button"
              className="cb-primary"
              disabled={!hasValidated || validationErrors.length > 0}
              onClick={handleExport}
            >
              {t('common.exportJson')}
            </button>
          </div>
        </div>
        <p>{t('export.description')}</p>
      </section>
    </main>
  )
}
