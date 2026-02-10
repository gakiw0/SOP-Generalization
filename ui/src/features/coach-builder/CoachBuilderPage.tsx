import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createInitialState,
  normalizeDraftForExport,
  type ConditionType,
} from './draftTypes'
import { getProfileCapability, listProfileOptions } from './capabilities'
import { formatProfileLabel, humanizeIdentifier } from './terminology'
import { downloadRuleSetJson } from './export'
import { importDraftFromFile, type ImportMessageKey } from './import'
import { toRuleSetForExport } from './mappers'
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

type WorkflowStage = 'setup' | 'steps' | 'review'

const WORKFLOW_STAGES: WorkflowStage[] = ['setup', 'steps', 'review']
const KNOWN_CONDITION_TYPES: ConditionType[] = [
  'threshold',
  'range',
  'boolean',
  'event_exists',
  'composite',
  'trend',
  'angle',
  'distance',
]

export function CoachBuilderPage() {
  const { t, i18n } = useTranslation()
  const [state, dispatch] = useReducer(coachDraftReducer, undefined, createInitialState)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  const [hasValidated, setHasValidated] = useState(false)
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('setup')
  const [importedSchemaMajor, setImportedSchemaMajor] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const suppressValidationResetRef = useRef(false)

  const selectedStep = useMemo(
    () => state.draft.steps.find((step) => step.id === state.selectedStepId) ?? null,
    [state.draft.steps, state.selectedStepId]
  )
  const activeCapability = useMemo(
    () => getProfileCapability(state.draft.metadata.metricProfileId.trim()),
    [state.draft.metadata.metricProfileId]
  )
  const profileOptions = useMemo(() => listProfileOptions(), [])
  const profileOptionMap = useMemo(
    () => new Map(profileOptions.map((profile) => [profile.id, profile])),
    [profileOptions]
  )
  const selectableProfileOptions = useMemo(() => {
    const currentId = state.draft.metadata.metricProfileId.trim()
    if (currentId.length === 0 || profileOptionMap.has(currentId)) return profileOptions
    return [
      ...profileOptions,
      {
        id: currentId,
        type: state.draft.metadata.metricProfileType,
        preset_id:
          state.draft.metadata.metricPresetId.trim().length > 0
            ? state.draft.metadata.metricPresetId.trim()
            : undefined,
        plugin: '(custom)',
        displayName: humanizeIdentifier(currentId),
        subtitle: currentId,
      },
    ]
  }, [
    profileOptions,
    profileOptionMap,
    state.draft.metadata.metricProfileId,
    state.draft.metadata.metricProfileType,
    state.draft.metadata.metricPresetId,
  ])
  const selectablePresetIds = useMemo(() => {
    const presetIds = Array.from(
      new Set(
        profileOptions
          .filter((profile) => profile.type === 'preset' && profile.preset_id)
          .map((profile) => profile.preset_id as string)
      )
    ).sort((a, b) => a.localeCompare(b))
    const currentPresetId = state.draft.metadata.metricPresetId.trim()
    if (currentPresetId.length > 0 && !presetIds.includes(currentPresetId)) {
      return [...presetIds, currentPresetId]
    }
    return presetIds
  }, [profileOptions, state.draft.metadata.metricPresetId])
  const selectedProfileOption =
    profileOptionMap.get(state.draft.metadata.metricProfileId.trim()) ?? null
  const selectedProfileTypeLabel = state.draft.metadata.metricProfileType === 'preset'
    ? t('metadata.profileType.preset')
    : t('metadata.profileType.generic')
  const supportedConditionTypes = useMemo(() => {
    if (!activeCapability) return KNOWN_CONDITION_TYPES
    const typeSet = new Set(activeCapability.supported_condition_types)
    return KNOWN_CONDITION_TYPES.filter((type) => typeSet.has(type))
  }, [activeCapability])
  const stepMetricCandidates = useMemo(() => {
    if (!selectedStep || !activeCapability) return []
    return activeCapability.metrics_by_phase[selectedStep.id] ?? activeCapability.all_metrics
  }, [activeCapability, selectedStep])

  const checkpointLocator = useMemo(
    () =>
      state.draft.steps.flatMap((step) =>
        step.checkpoints.map((checkpoint) => ({ stepId: step.id, checkpointId: checkpoint.id }))
      ),
    [state.draft.steps]
  )
  const stepLabels = useMemo(
    () =>
      state.draft.steps.map((step, index) =>
        step.label.trim().length > 0 ? step.label : `Step ${index + 1} (${step.id})`
      ),
    [state.draft.steps]
  )
  const checkpointLabels = useMemo(
    () =>
      state.draft.steps.flatMap((step, stepIndex) =>
        step.checkpoints.map((checkpoint, checkpointIndex) =>
          checkpoint.label.trim().length > 0
            ? checkpoint.label
            : `Step ${stepIndex + 1} checkpoint ${checkpointIndex + 1} (${checkpoint.id})`
        )
      ),
    [state.draft.steps]
  )

  const currentLocale =
    normalizeLocale(i18n.resolvedLanguage ?? i18n.language) ?? 'en'

  const totalCheckpointCount = useMemo(
    () => state.draft.steps.reduce((sum, step) => sum + step.checkpoints.length, 0),
    [state.draft.steps]
  )

  const currentStageIndex = WORKFLOW_STAGES.indexOf(workflowStage)

  const canContinue = useMemo(() => {
    switch (workflowStage) {
      case 'setup':
        return (
          state.draft.metadata.ruleSetId.trim().length > 0 &&
          state.draft.metadata.metricProfileId.trim().length > 0
        )
      case 'steps':
        return selectedStep != null && selectedStep.checkpoints.length > 0
      case 'review':
        return false
      default:
        return false
    }
  }, [
    workflowStage,
    state.draft.metadata.ruleSetId,
    state.draft.metadata.metricProfileId,
    selectedStep,
  ])

  useEffect(() => {
    if (suppressValidationResetRef.current) {
      suppressValidationResetRef.current = false
      return
    }
    setHasValidated(false)
    setValidationStatus('idle')
  }, [state.draft])

  const runValidation = () => {
    const ruleSet = toRuleSetForExport(normalizeDraftForExport(state.draft))
    const errors = validateRuleSet(ruleSet, activeCapability)
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
    const ruleSet = toRuleSetForExport(normalizedDraft)
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
      setImportedSchemaMajor(imported.sourceSchemaMajor ?? null)

      if (imported.draft) {
        const importedRuleSet = toRuleSetForExport(normalizeDraftForExport(imported.draft))
        const importedCapability = getProfileCapability(
          imported.draft.metadata.metricProfileId.trim()
        )
        const capabilityErrors = validateRuleSet(importedRuleSet, importedCapability)
        setValidationErrors(capabilityErrors)
        setValidationStatus(capabilityErrors.length === 0 ? 'pass' : 'fail')
        setStatusMessage(
          capabilityErrors.length === 0
            ? { key: 'import.success' }
            : { key: 'import.validation_failed', params: { count: capabilityErrors.length } }
        )
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

  const handleProfileChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextProfileId = event.target.value
    dispatch({ type: 'meta/set', field: 'metricProfileId', value: nextProfileId })

    const selectedProfile = profileOptionMap.get(nextProfileId)
    if (!selectedProfile) return

    dispatch({
      type: 'meta/set',
      field: 'metricProfileType',
      value: selectedProfile.type,
    })
    dispatch({
      type: 'meta/set',
      field: 'metricPresetId',
      value: selectedProfile.preset_id ?? '',
    })
  }

  const moveStage = (nextStage: WorkflowStage) => {
    setWorkflowStage(nextStage)
    if (nextStage === 'review') {
      runValidation()
    }
  }

  const goToPreviousStage = () => {
    if (currentStageIndex <= 0) return
    const nextStage = WORKFLOW_STAGES[currentStageIndex - 1]
    moveStage(nextStage)
  }

  const goToNextStage = () => {
    if (!canContinue) return
    if (currentStageIndex >= WORKFLOW_STAGES.length - 1) return
    const nextStage = WORKFLOW_STAGES[currentStageIndex + 1]
    moveStage(nextStage)
  }

  const navigateFromPath = (path: string) => {
    const phaseMatch = path.match(/^phases\[(\d+)\]/)
    if (phaseMatch) {
      const index = Number(phaseMatch[1])
      const stepId = state.draft.steps[index]?.id
      if (stepId) {
        dispatch({ type: 'step/select', stepId })
        moveStage('steps')
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
        moveStage('steps')
      }
    }
  }

  return (
    <main className="coach-builder-page" data-testid="cb-page-root">
      <header className="coach-builder-header cb-panel cb-shell-hero">
        <div className="cb-panel-header">
          <div className="cb-hero-copy">
            <h1>{t('page.title')}</h1>
            <p>{t('page.subtitle')}</p>
          </div>
          <div className="cb-export-actions">
            <label className="cb-language-select" htmlFor="locale-select">
              {t('common.language')}
              <select id="locale-select" value={currentLocale} onChange={handleLocaleChange} data-testid="cb-header-locale">
                {SUPPORTED_LOCALES.map((locale) => (
                  <option key={locale} value={locale}>
                    {t(`language.${locale}`)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={handleImportClick} data-testid="cb-header-import">
              {t('common.importJson')}
            </button>
            <button
              type="button"
              onClick={() => {
                setImportedSchemaMajor(null)
                dispatch({ type: 'draft/reset' })
              }}
              data-testid="cb-header-reset"
            >
              {t('common.reset')}
            </button>
          </div>
        </div>
        <div className="cb-hero-status">
          {importedSchemaMajor === 1 ? (
            <p className="cb-status-text">{t('import.v1_badge')}</p>
          ) : null}
          {statusMessage ? (
            <p className="cb-status-text">{t(statusMessage.key, statusMessage.params)}</p>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportFile}
          className="cb-hidden-file-input"
        />
      </header>

      <section className="cb-panel cb-stage-strip cb-shell-stage">
        <div className="cb-stage-track">
          {WORKFLOW_STAGES.map((stage, index) => {
            const isCurrent = stage === workflowStage
            const isDone = index < currentStageIndex
            const isEnabled = index <= currentStageIndex || index === currentStageIndex + 1

            return (
              <button
                key={stage}
                type="button"
                className={`cb-stage-pill${isCurrent ? ' is-current' : ''}${isDone ? ' is-done' : ''}`}
                onClick={() => moveStage(stage)}
                disabled={!isEnabled}
                data-testid={`cb-stage-${stage}`}
              >
                <span className="cb-stage-index">{index + 1}</span>
                <span>{t(`workflow.${stage}.label`)}</span>
              </button>
            )
          })}
        </div>
        <p className="cb-stage-description">{t(`workflow.${workflowStage}.description`)}</p>
      </section>

      {workflowStage === 'setup' && (
        <>
          <section className="cb-panel">
            <h2>{t('metadata.sectionTitle')}</h2>
            <p>{t('metadata.help')}</p>
            <div className="cb-field-grid">
              <label>
                {t('metadata.ruleSetId')}
                <input
                  type="text"
                  value={state.draft.metadata.ruleSetId}
                  data-testid="cb-setup-rule-set-id"
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
                  data-testid="cb-setup-sport"
                  onChange={(event) =>
                    dispatch({ type: 'meta/set', field: 'sport', value: event.target.value })
                  }
                />
              </label>

              <label>
                {t('metadata.metricProfileId')}
                <select
                  value={state.draft.metadata.metricProfileId}
                  data-testid="cb-setup-profile-id"
                  onChange={handleProfileChange}
                >
                  {selectableProfileOptions.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {formatProfileLabel(profile, t).displayName} ({profile.id})
                    </option>
                  ))}
                </select>
                {selectedProfileOption ? (
                  <span className="cb-field-help">
                    {selectedProfileOption.type === 'preset' && selectedProfileOption.preset_id
                      ? `${selectedProfileTypeLabel} · preset ${selectedProfileOption.preset_id}`
                      : selectedProfileTypeLabel}
                  </span>
                ) : null}
              </label>

              <label>
                {t('metadata.metricProfileType')}
                <select
                  value={state.draft.metadata.metricProfileType}
                  data-testid="cb-setup-profile-type"
                  disabled
                >
                  <option value="generic">{t('metadata.profileType.generic')}</option>
                  <option value="preset">{t('metadata.profileType.preset')}</option>
                </select>
              </label>

              {state.draft.metadata.metricProfileType === 'preset' && (
                <label>
                  {t('metadata.metricPresetId')}
                  <select
                    value={state.draft.metadata.metricPresetId}
                    data-testid="cb-setup-preset-id"
                    onChange={(event) =>
                      dispatch({ type: 'meta/set', field: 'metricPresetId', value: event.target.value })
                    }
                  >
                    {selectablePresetIds.map((presetId) => (
                      <option key={presetId} value={presetId}>
                        {t(`presets.${presetId}`, { defaultValue: humanizeIdentifier(presetId) })} ({presetId})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                {t('metadata.ruleVersion')}
                <input
                  type="text"
                  value={state.draft.metadata.sportVersion}
                  data-testid="cb-setup-sport-version"
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
                  data-testid="cb-setup-title"
                  onChange={(event) =>
                    dispatch({ type: 'meta/set', field: 'title', value: event.target.value })
                  }
                />
              </label>
            </div>
          </section>
        </>
      )}

      {workflowStage === 'steps' && (
        <div className="cb-layout">
          <StepList
            steps={state.draft.steps}
            selectedStepId={state.selectedStepId}
            onSelect={(stepId) => dispatch({ type: 'step/select', stepId })}
            onAdd={() => dispatch({ type: 'step/add' })}
            onRemove={(stepId) => dispatch({ type: 'step/remove', stepId })}
          />

          <div className="cb-step-workspace">
            <StepEditor
              step={selectedStep}
              metricCandidates={stepMetricCandidates}
              onRename={(nextId) => {
                if (!selectedStep) return
                dispatch({ type: 'step/rename', stepId: selectedStep.id, nextId })
              }}
              onUpdate={(patch) => {
                if (!selectedStep) return
                dispatch({ type: 'step/update', stepId: selectedStep.id, patch })
              }}
            />

            <section className="cb-panel cb-summary-strip">
              <div className="cb-summary-item">
                <span>{t('workflow.summary.steps')}</span>
                <strong>{state.draft.steps.length}</strong>
              </div>
              <div className="cb-summary-item">
                <span>{t('workflow.summary.checkpoints')}</span>
                <strong>{totalCheckpointCount}</strong>
              </div>
              <div className="cb-summary-item">
                <span>{t('workflow.summary.currentStep')}</span>
                <strong>{selectedStep?.label || selectedStep?.id || '-'}</strong>
              </div>
            </section>

            <CheckpointEditor
              step={selectedStep}
              stepIds={state.draft.steps.map((step) => step.id)}
              supportedConditionTypes={supportedConditionTypes}
              metricCandidates={stepMetricCandidates}
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
          </div>
        </div>
      )}

      {workflowStage === 'review' && (
        <>
          <ValidationPanel
            errors={validationErrors}
            status={validationStatus}
            stepLabels={stepLabels}
            checkpointLabels={checkpointLabels}
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
                  data-testid="cb-review-export"
                >
                  {t('common.exportJson')}
                </button>
              </div>
            </div>
            <p>{t('export.description')}</p>
          </section>
        </>
      )}

      <section className="cb-panel cb-workflow-footer cb-shell-footer">
        <div className="cb-workflow-footer-top">
          <div className="cb-workflow-nav">
            <button
              type="button"
              onClick={goToPreviousStage}
              disabled={currentStageIndex <= 0}
              data-testid="cb-nav-back"
            >
              {t('common.back')}
            </button>
            {workflowStage !== 'review' ? (
              <button type="button" className="cb-primary cb-next-button" onClick={goToNextStage} disabled={!canContinue} data-testid="cb-nav-continue">
                {t('common.continue')}
              </button>
            ) : (
              <button type="button" onClick={runValidation} data-testid="cb-nav-revalidate">
                {t('common.revalidate')}
              </button>
            )}
          </div>
        </div>
        <p className="cb-hint-text cb-footer-hint">{t(`workflow.${workflowStage}.footerHint`)}</p>
      </section>
    </main>
  )
}
