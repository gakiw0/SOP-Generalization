import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  conditionTypeIsBasic,
  type CheckpointDraft,
  type ConditionDraft,
  type ConditionType,
  type StepDraft,
} from '../draftTypes'
import { ConditionEditorBasic } from './ConditionEditorBasic'
import { ConditionEditorExpert } from './ConditionEditorExpert'

type CheckpointEditorProps = {
  step: StepDraft | null
  stepIds: string[]
  selectedCheckpointId: string | null
  expertEnabled: boolean
  onToggleExpert: (enabled: boolean) => void
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

const BASIC_TYPES: ConditionType[] = ['threshold', 'range', 'boolean', 'composite']
const EXPERT_TYPES: ConditionType[] = ['event_exists', 'trend', 'angle', 'distance']

export function CheckpointEditor({
  step,
  stepIds,
  selectedCheckpointId,
  expertEnabled,
  onToggleExpert,
  onSelectCheckpoint,
  onAddCheckpoint,
  onRemoveCheckpoint,
  onUpdateCheckpoint,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
}: CheckpointEditorProps) {
  const { t } = useTranslation()
  const [newConditionType, setNewConditionType] = useState<ConditionType>('threshold')
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

  const allowedTypes = expertEnabled ? [...BASIC_TYPES, ...EXPERT_TYPES] : [...BASIC_TYPES]

  if (!selectedCheckpoint) {
    return (
      <section className="cb-panel">
        <div className="cb-panel-header">
          <h2>{t('checkpoint.editorTitle')}</h2>
          <button type="button" onClick={onAddCheckpoint}>
            {t('checkpoint.addButton')}
          </button>
        </div>
        <p>{t('checkpoint.emptyNoCheckpoints')}</p>
      </section>
    )
  }

  return (
    <section className="cb-panel">
      <div className="cb-panel-header">
        <h2>{t('checkpoint.editorTitle')}</h2>
        <button type="button" onClick={onAddCheckpoint}>
          {t('checkpoint.addButton')}
        </button>
      </div>
      <p>{t('checkpoint.editorHelp')}</p>

      <div className="cb-checkpoint-tabs">
        {step.checkpoints.map((checkpoint) => (
          <button
            key={checkpoint.id}
            type="button"
            className={checkpoint.id === selectedCheckpoint.id ? 'is-selected' : ''}
            onClick={() => onSelectCheckpoint(checkpoint.id)}
          >
            {checkpoint.label || checkpoint.id}
          </button>
        ))}
      </div>

      <div className="cb-field-grid">
        <label>
          {t('checkpoint.fields.label')}
          <input
            type="text"
            value={selectedCheckpoint.label}
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
            <option value="frame_range_ref">{t('signalType.frame_range_ref')}</option>
            <option value="direct">{t('signalType.direct')}</option>
            <option value="event_window">{t('signalType.event_window')}</option>
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
                  {stepId}
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
              <input
                type="text"
                value={selectedCheckpoint.signalDefaultPhase}
                onChange={(event) =>
                  onUpdateCheckpoint(selectedCheckpoint.id, {
                    signalDefaultPhase: event.target.value,
                  })
                }
              />
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
            <label>
              {t('checkpoint.fields.category')}
              <input
                type="text"
                value={selectedCheckpoint.category}
                onChange={(event) =>
                  onUpdateCheckpoint(selectedCheckpoint.id, {
                    category: event.target.value,
                  })
                }
              />
            </label>
          </>
        )}
      </div>

      <div className="cb-body-guide">
        <h3>{t('checkpoint.bodyGuide.title')}</h3>
        <p>{t('checkpoint.bodyGuide.help')}</p>
        <div className="cb-body-guide-grid">
          <span>{t('checkpoint.bodyGuide.head')}</span>
          <span>{t('checkpoint.bodyGuide.shoulder')}</span>
          <span>{t('checkpoint.bodyGuide.elbow')}</span>
          <span>{t('checkpoint.bodyGuide.wrist')}</span>
          <span>{t('checkpoint.bodyGuide.hip')}</span>
          <span>{t('checkpoint.bodyGuide.knee')}</span>
          <span>{t('checkpoint.bodyGuide.ankle')}</span>
        </div>
      </div>

      <div className="cb-inline-actions">
        <label className="cb-checkbox-label">
          <input
            type="checkbox"
            checked={expertEnabled}
            onChange={(event) => onToggleExpert(event.target.checked)}
          />
          {t('checkpoint.enableExpert')}
        </label>
        <button
          type="button"
          onClick={() => setShowTechnicalFields((value) => !value)}
        >
          {showTechnicalFields ? t('checkpoint.hideTechnical') : t('checkpoint.showTechnical')}
        </button>

        <button type="button" className="cb-danger" onClick={() => onRemoveCheckpoint(selectedCheckpoint.id)}>
          {t('checkpoint.removeButton')}
        </button>
      </div>

      <div className="cb-panel cb-sub-panel">
        <div className="cb-panel-header">
          <h3>{t('checkpoint.conditionsTitle')}</h3>
          <div className="cb-add-condition-row">
            <select
              value={newConditionType}
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
              onClick={() => onAddCondition(selectedCheckpoint.id, newConditionType)}
            >
              {t('condition.addButton')}
            </button>
          </div>
        </div>
        <p>{t('checkpoint.conditionsHelp')}</p>
        <div className="cb-chip-row">
          {BASIC_TYPES.map((type) => (
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
                onUpdate={(patch) => onUpdateCondition(selectedCheckpoint.id, condition.id, patch)}
                onRemove={() => onRemoveCondition(selectedCheckpoint.id, condition.id)}
              />
            )
          }

          if (!expertEnabled) {
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
              onUpdate={(patch) => onUpdateCondition(selectedCheckpoint.id, condition.id, patch)}
              onRemove={() => onRemoveCondition(selectedCheckpoint.id, condition.id)}
            />
          )
        })}
      </div>
    </section>
  )
}
