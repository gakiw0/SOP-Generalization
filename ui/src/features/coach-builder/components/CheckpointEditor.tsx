import { useState } from 'react'
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
  const [newConditionType, setNewConditionType] = useState<ConditionType>('threshold')

  if (!step) {
    return (
      <section className="cb-panel">
        <h2>Checkpoint editor</h2>
        <p>Select a step to start editing checkpoints.</p>
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
          <h2>Checkpoint editor</h2>
          <button type="button" onClick={onAddCheckpoint}>
            Add checkpoint
          </button>
        </div>
        <p>No checkpoints yet.</p>
      </section>
    )
  }

  return (
    <section className="cb-panel">
      <div className="cb-panel-header">
        <h2>Checkpoint editor</h2>
        <button type="button" onClick={onAddCheckpoint}>
          Add checkpoint
        </button>
      </div>

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
          Checkpoint ID
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
          Label
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
          Category
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

        <label>
          Severity
          <select
            value={selectedCheckpoint.severity}
            onChange={(event) =>
              onUpdateCheckpoint(selectedCheckpoint.id, {
                severity: event.target.value as 'info' | 'warn' | 'fail',
              })
            }
          >
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="fail">fail</option>
          </select>
        </label>

        <label className="cb-full-width">
          Description
          <textarea
            rows={2}
            value={selectedCheckpoint.description}
            onChange={(event) =>
              onUpdateCheckpoint(selectedCheckpoint.id, {
                description: event.target.value,
              })
            }
          />
        </label>

        <label>
          Signal type
          <select
            value={selectedCheckpoint.signalType}
            onChange={(event) =>
              onUpdateCheckpoint(selectedCheckpoint.id, {
                signalType: event.target.value as 'frame_range_ref' | 'direct' | 'event_window',
              })
            }
          >
            <option value="frame_range_ref">frame_range_ref</option>
            <option value="direct">direct</option>
            <option value="event_window">event_window</option>
          </select>
        </label>

        {selectedCheckpoint.signalType === 'frame_range_ref' && (
          <label>
            Reference step
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
              Direct start frame
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
              Direct end frame
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
              Event
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
              Window pre ms
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
              Window post ms
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
              Default phase (optional)
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
      </div>

      <div className="cb-inline-actions">
        <label className="cb-checkbox-label">
          <input
            type="checkbox"
            checked={expertEnabled}
            onChange={(event) => onToggleExpert(event.target.checked)}
          />
          Enable expert condition types
        </label>

        <button type="button" className="cb-danger" onClick={() => onRemoveCheckpoint(selectedCheckpoint.id)}>
          Remove checkpoint
        </button>
      </div>

      <div className="cb-panel cb-sub-panel">
        <div className="cb-panel-header">
          <h3>Conditions</h3>
          <div className="cb-add-condition-row">
            <select
              value={newConditionType}
              onChange={(event) => setNewConditionType(event.target.value as ConditionType)}
            >
              {allowedTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onAddCondition(selectedCheckpoint.id, newConditionType)}
            >
              Add condition
            </button>
          </div>
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
                  <h4>
                    Condition ({condition.type})
                  </h4>
                  <button
                    type="button"
                    className="cb-danger"
                    onClick={() => onRemoveCondition(selectedCheckpoint.id, condition.id)}
                  >
                    Remove
                  </button>
                </div>
                <p>Enable expert mode to edit this condition type.</p>
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
