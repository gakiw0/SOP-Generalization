import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type BasicConditionType,
  conditionTypeIsBasic,
  type CheckpointDraft,
  type ConditionDraft,
  type ConditionType,
  type StepDraft,
} from '../draftTypes'
import { parseJointIdsCsv } from '../jointParsing'
import { formatSignalTypeLabel } from '../terminology'
import { ConditionEditorBasic } from './ConditionEditorBasic'
import { ConditionEditorExpert } from './ConditionEditorExpert'
import { JointLandmarkDiagram } from './JointLandmarkDiagram'

type CheckpointEditorProps = {
  step: StepDraft | null
  stepIds: string[]
  supportedConditionTypes?: ConditionType[]
  metricCandidates?: string[]
  selectedCheckpointId: string | null
  onSelectCheckpoint: (checkpointId: string) => void
  onAddCheckpoint: () => void
  onRemoveCheckpoint: (checkpointId: string) => void
  onUpdateCheckpoint: (checkpointId: string, patch: Partial<Omit<CheckpointDraft, 'conditions'>>) => void
  onAddCondition: (checkpointId: string, conditionType?: ConditionType) => void
  onUpdateCondition: (
    checkpointId: string,
    conditionId: string,
    patch: Partial<ConditionDraft>
  ) => void
  onRemoveCondition: (checkpointId: string, conditionId: string) => void
}

type ExpertConditionType = 'event_exists' | 'trend' | 'angle' | 'distance'

const BASIC_TYPES: BasicConditionType[] = ['threshold', 'range', 'boolean', 'composite']
const EXPERT_TYPES: ExpertConditionType[] = ['event_exists', 'trend', 'angle', 'distance']

export function CheckpointEditor({
  step,
  stepIds,
  supportedConditionTypes,
  metricCandidates,
  selectedCheckpointId,
  onSelectCheckpoint,
  onAddCheckpoint,
  onRemoveCheckpoint,
  onUpdateCheckpoint,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
}: CheckpointEditorProps) {
  const { t } = useTranslation()
  const effectiveSupportedTypes =
    supportedConditionTypes && supportedConditionTypes.length > 0
      ? supportedConditionTypes
      : [...BASIC_TYPES, ...EXPERT_TYPES]
  const supportedTypeSet = new Set(effectiveSupportedTypes)
  const allowedBasicTypes: BasicConditionType[] = BASIC_TYPES.filter((type) =>
    supportedTypeSet.has(type)
  )
  const allowedExpertTypes: ExpertConditionType[] = EXPERT_TYPES.filter((type) =>
    supportedTypeSet.has(type)
  )
  const allowedTypes = [...allowedBasicTypes, ...allowedExpertTypes]
  const [newConditionType, setNewConditionType] = useState<ConditionType>(
    allowedTypes[0] ?? 'threshold'
  )
  const selectedNewConditionType = allowedTypes.includes(newConditionType)
    ? newConditionType
    : (allowedTypes[0] ?? 'threshold')
  const [showTechnicalFields, setShowTechnicalFields] = useState(false)

  if (!step) {
    return (
      <section className="cb-panel">
        <h2>{t('checkpoint.editorTitle')}</h2>
        <p>{t('checkpoint.emptySelectStep')}</p>
      </section>
    )
  }

  const selectedCheckpoint =
    step.checkpoints.find((checkpoint) => checkpoint.id === selectedCheckpointId) ?? step.checkpoints[0] ?? null
  const stepLabelMap = new Map(stepIds.map((stepId, index) => [stepId, `Step ${index + 1} (${stepId})`]))

  const highlightedJointIds: number[] = []
  if (selectedCheckpoint) {
    const jointSet = new Set<number>()
    selectedCheckpoint.conditions.forEach((condition) => {
      const nextIds =
        condition.type === 'angle'
          ? parseJointIdsCsv(condition.joints)
          : condition.type === 'distance'
            ? parseJointIdsCsv(condition.pair)
            : []
      nextIds.forEach((jointId) => jointSet.add(jointId))
    })
    highlightedJointIds.push(...jointSet)
  }

  if (!selectedCheckpoint) {
    return (
      <section className="cb-panel">
        <div className="cb-panel-header">
          <h2>{t('checkpoint.editorTitle')}</h2>
          <button type="button" onClick={onAddCheckpoint} data-testid="cb-checkpoints-add">
            {t('checkpoint.addButton')}
          </button>
        </div>
        <p>{t('checkpoint.emptyNoCheckpoints')}</p>
      </section>
    )
  }

  return (
    <section className="cb-panel cb-editor-shell">
      <div className="cb-panel-header">
        <h2>{t('checkpoint.editorTitle')}</h2>
        <button type="button" onClick={onAddCheckpoint} data-testid="cb-checkpoints-add">
          {t('checkpoint.addButton')}
        </button>
      </div>
      <p>{t('checkpoint.editorHelp')}</p>

      <div className="cb-checkpoint-tabs">
        {step.checkpoints.map((checkpoint, index) => (
          <button
            key={checkpoint.id}
            type="button"
            className={checkpoint.id === selectedCheckpoint.id ? 'is-selected' : ''}
            onClick={() => onSelectCheckpoint(checkpoint.id)}
            data-testid={`cb-checkpoints-tab-${index}`}
          >
            {checkpoint.label || `Checkpoint ${index + 1}`}
          </button>
        ))}
      </div>

      <div className="cb-editor-sections">
        <section className="cb-editor-block">
          <h3>{t('checkpoint.fields.label')}</h3>
          <div className="cb-field-grid">
            <label>
              {t('checkpoint.fields.label')}
              <input
                type="text"
                value={selectedCheckpoint.label}
                data-testid="cb-checkpoints-label"
                onChange={(event) =>
                  onUpdateCheckpoint(selectedCheckpoint.id, {
                    label: event.target.value,
                  })
                }
              />
            </label>

            <label>
              {t('checkpoint.fields.severity')}
              <select
                value={selectedCheckpoint.severity}
                onChange={(event) =>
                  onUpdateCheckpoint(selectedCheckpoint.id, {
                    severity: event.target.value as 'info' | 'warn' | 'fail',
                  })
                }
              >
                <option value="info">{t('severity.info')}</option>
                <option value="warn">{t('severity.warn')}</option>
                <option value="fail">{t('severity.fail')}</option>
              </select>
            </label>

            <label>
              {t('checkpoint.fields.category')}
              <input
                type="text"
                value={selectedCheckpoint.category}
                data-testid="cb-checkpoints-category"
                onChange={(event) =>
                  onUpdateCheckpoint(selectedCheckpoint.id, {
                    category: event.target.value,
                  })
                }
              />
            </label>

            <label className="cb-full-width">
              {t('checkpoint.fields.description')}
              <textarea
                rows={2}
                value={selectedCheckpoint.description}
                onChange={(event) =>
                  onUpdateCheckpoint(selectedCheckpoint.id, {
                    description: event.target.value,
                  })
                }
                placeholder={t('checkpoint.placeholders.description')}
              />
            </label>
          </div>
        </section>

        <section className="cb-editor-block">
          <div className="cb-editor-block-header">
            <h3>{t('checkpoint.fields.signalType')}</h3>
            <button
              type="button"
              onClick={() => setShowTechnicalFields((value) => !value)}
              data-testid="cb-checkpoints-toggle-technical"
            >
              {showTechnicalFields ? t('checkpoint.hideTechnical') : t('checkpoint.showTechnical')}
            </button>
          </div>
          <div className="cb-field-grid">
            <label>
              {t('checkpoint.fields.signalType')}
              <select
                value={selectedCheckpoint.signalType}
                onChange={(event) =>
                  onUpdateCheckpoint(selectedCheckpoint.id, {
                    signalType: event.target.value as 'frame_range_ref' | 'direct' | 'event_window',
                  })
                }
              >
                <option value="frame_range_ref">
                  {t('signalType.frame_range_ref')} ({formatSignalTypeLabel('frame_range_ref')})
                </option>
                <option value="direct">
                  {t('signalType.direct')} ({formatSignalTypeLabel('direct')})
                </option>
                <option value="event_window">
                  {t('signalType.event_window')} ({formatSignalTypeLabel('event_window')})
                </option>
              </select>
              <span className="cb-field-help">{t('checkpoint.fields.signalTypeHelp')}</span>
            </label>

            {selectedCheckpoint.signalType === 'frame_range_ref' && (
              <label>
                {t('checkpoint.fields.referenceStep')}
                <select
                  value={selectedCheckpoint.signalRefStepId}
                  onChange={(event) =>
                    onUpdateCheckpoint(selectedCheckpoint.id, {
                      signalRefStepId: event.target.value,
                    })
                  }
                >
                  {stepIds.map((stepId) => (
                    <option key={stepId} value={stepId}>
                      {stepLabelMap.get(stepId) ?? stepId}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedCheckpoint.signalType === 'direct' && (
              <>
                <label>
                  {t('checkpoint.fields.directStartFrame')}
                  <input
                    type="number"
                    value={selectedCheckpoint.signalFrameStart}
                    onChange={(event) =>
                      onUpdateCheckpoint(selectedCheckpoint.id, {
                        signalFrameStart: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {t('checkpoint.fields.directEndFrame')}
                  <input
                    type="number"
                    value={selectedCheckpoint.signalFrameEnd}
                    onChange={(event) =>
                      onUpdateCheckpoint(selectedCheckpoint.id, {
                        signalFrameEnd: event.target.value,
                      })
                    }
                  />
                </label>
              </>
            )}

            {selectedCheckpoint.signalType === 'event_window' && (
              <>
                <label>
                  {t('checkpoint.fields.event')}
                  <input
                    type="text"
                    value={selectedCheckpoint.signalEvent}
                    onChange={(event) =>
                      onUpdateCheckpoint(selectedCheckpoint.id, {
                        signalEvent: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {t('checkpoint.fields.windowPreMs')}
                  <input
                    type="number"
                    value={selectedCheckpoint.signalWindowPreMs}
                    onChange={(event) =>
                      onUpdateCheckpoint(selectedCheckpoint.id, {
                        signalWindowPreMs: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {t('checkpoint.fields.windowPostMs')}
                  <input
                    type="number"
                    value={selectedCheckpoint.signalWindowPostMs}
                    onChange={(event) =>
                      onUpdateCheckpoint(selectedCheckpoint.id, {
                        signalWindowPostMs: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {t('checkpoint.fields.defaultPhase')}
                  <select
                    value={selectedCheckpoint.signalDefaultPhase}
                    onChange={(event) =>
                      onUpdateCheckpoint(selectedCheckpoint.id, {
                        signalDefaultPhase: event.target.value,
                      })
                    }
                  >
                    <option value="">{t('common.none')}</option>
                    {stepIds.map((stepId) => (
                      <option key={stepId} value={stepId}>
                        {stepLabelMap.get(stepId) ?? stepId}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {showTechnicalFields && (
              <>
                <label>
                  {t('checkpoint.fields.id')}
                  <input
                    type="text"
                    value={selectedCheckpoint.id}
                    onChange={(event) =>
                      onUpdateCheckpoint(selectedCheckpoint.id, {
                        id: event.target.value,
                      })
                    }
                  />
                </label>
              </>
            )}
          </div>
        </section>
      </div>

      <JointLandmarkDiagram
        selectedJointIds={highlightedJointIds}
        titleKey="jointDiagram.checkpointTitle"
        helpKey="jointDiagram.checkpointHelp"
        dataTestId="cb-joint-diagram-checkpoint"
      />

      <div className="cb-inline-actions">
        <button type="button" className="cb-danger" onClick={() => onRemoveCheckpoint(selectedCheckpoint.id)}>
          {t('checkpoint.removeButton')}
        </button>
      </div>

      <div className="cb-panel cb-sub-panel">
        <div className="cb-panel-header">
          <h3>{t('checkpoint.conditionsTitle')}</h3>
          <div className="cb-add-condition-row">
            <select
              value={selectedNewConditionType}
              data-testid="cb-checkpoints-new-condition-type"
              onChange={(event) => setNewConditionType(event.target.value as ConditionType)}
            >
              {allowedTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`condition.type.${type}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={allowedTypes.length === 0}
              onClick={() => onAddCondition(selectedCheckpoint.id, selectedNewConditionType)}
            >
              {t('condition.addButton')}
            </button>
          </div>
        </div>
        <p>{t('checkpoint.conditionsHelp')}</p>
        <div className="cb-chip-row">
          {allowedBasicTypes.map((type) => (
            <button key={type} type="button" className="cb-chip-button" onClick={() => setNewConditionType(type)}>
              {t(`condition.type.${type}`)}
            </button>
          ))}
        </div>

        {selectedCheckpoint.conditions.map((condition) => {
          if (conditionTypeIsBasic(condition.type)) {
            return (
              <ConditionEditorBasic
                key={condition.id}
                condition={condition}
                allConditionIds={selectedCheckpoint.conditions.map((item) => item.id)}
                supportedTypes={allowedBasicTypes}
                metricCandidates={metricCandidates}
                onUpdate={(patch) => onUpdateCondition(selectedCheckpoint.id, condition.id, patch)}
                onRemove={() => onRemoveCondition(selectedCheckpoint.id, condition.id)}
              />
            )
          }

          const expertTypeSupported = allowedExpertTypes.includes(condition.type)
          if (!expertTypeSupported) {
            return (
              <article key={condition.id} className="cb-condition-card cb-condition-locked">
                <div className="cb-condition-header">
                  <h4>{t('checkpoint.lockedTitle', { type: t(`condition.type.${condition.type}`) })}</h4>
                  <button
                    type="button"
                    className="cb-danger"
                    onClick={() => onRemoveCondition(selectedCheckpoint.id, condition.id)}
                  >
                    {t('common.remove')}
                  </button>
                </div>
                <p>{t('checkpoint.lockedMessage')}</p>
              </article>
            )
          }

          return (
            <ConditionEditorExpert
              key={condition.id}
              condition={condition}
              supportedTypes={allowedExpertTypes}
              metricCandidates={metricCandidates}
              onUpdate={(patch) => onUpdateCondition(selectedCheckpoint.id, condition.id, patch)}
              onRemove={() => onRemoveCondition(selectedCheckpoint.id, condition.id)}
            />
          )
        })}
      </div>
    </section>
  )
}
