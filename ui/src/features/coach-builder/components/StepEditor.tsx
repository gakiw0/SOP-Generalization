import { useTranslation } from 'react-i18next'
import type { StepDraft } from '../draftTypes'
import { parseJointIdsCsv } from '../jointParsing'
import { JointLandmarkDiagram } from './JointLandmarkDiagram'

type StepEditorProps = {
  step: StepDraft | null
  onRename: (nextId: string) => void
  onUpdate: (patch: Partial<Omit<StepDraft, 'checkpoints'>>) => void
}

export function StepEditor({ step, onRename, onUpdate }: StepEditorProps) {
  const { t } = useTranslation()
  const jointPresets = [
    { key: 'head', value: '0' },
    { key: 'arms', value: '5, 6, 7, 8, 9, 10' },
    { key: 'torso', value: '5, 6, 11, 12' },
    { key: 'lowerBody', value: '11, 12, 13, 14, 15, 16' },
  ]

  if (!step) {
    return (
      <section className="cb-panel">
        <h2>{t('step.editorTitle')}</h2>
        <p>{t('step.emptySelect')}</p>
      </section>
    )
  }

  const selectedJointIds = parseJointIdsCsv(step.jointsOfInterest)

  return (
    <section className="cb-panel">
      <h2>{t('step.editorTitle')}</h2>
      <p>{t('step.editorHelp')}</p>

      <div className="cb-field-grid">
        <label>
          {t('step.fields.id')}
          <input
            type="text"
            value={step.id}
            data-testid="cb-steps-id"
            onChange={(event) => onRename(event.target.value)}
            placeholder={t('step.placeholders.id')}
          />
        </label>

        <label>
          {t('step.fields.label')}
          <input
            type="text"
            value={step.label}
            data-testid="cb-steps-label"
            onChange={(event) => onUpdate({ label: event.target.value })}
            placeholder={t('step.placeholders.label')}
          />
        </label>

        <label>
          {t('step.fields.category')}
          <input
            type="text"
            value={step.category}
            data-testid="cb-steps-category"
            onChange={(event) => onUpdate({ category: event.target.value })}
            placeholder={t('step.placeholders.category')}
          />
        </label>

        <label className="cb-full-width">
          {t('step.fields.description')}
          <textarea
            rows={3}
            value={step.description}
            onChange={(event) => onUpdate({ description: event.target.value })}
            placeholder={t('step.placeholders.description')}
          />
        </label>

        <label>
          {t('step.fields.rangeType')}
          <select
            value={step.rangeType}
            onChange={(event) => onUpdate({ rangeType: event.target.value as 'frame' | 'event' })}
          >
            <option value="frame">{t('step.rangeType.frame')}</option>
            <option value="event">{t('step.rangeType.event')}</option>
          </select>
          <span className="cb-field-help">{t('step.rangeTypeHelp')}</span>
        </label>

        {step.rangeType === 'frame' ? (
          <>
            <label>
              {t('step.fields.startFrame')}
              <input
                type="number"
                value={step.frameStart}
                onChange={(event) => onUpdate({ frameStart: event.target.value })}
              />
            </label>
            <label>
              {t('step.fields.endFrame')}
              <input
                type="number"
                value={step.frameEnd}
                onChange={(event) => onUpdate({ frameEnd: event.target.value })}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              {t('step.fields.eventName')}
              <input
                type="text"
                value={step.eventName}
                onChange={(event) => onUpdate({ eventName: event.target.value })}
                placeholder={t('step.placeholders.eventName')}
              />
            </label>
            <label>
              {t('step.fields.preWindowMs')}
              <input
                type="number"
                value={step.eventWindowPreMs}
                onChange={(event) => onUpdate({ eventWindowPreMs: event.target.value })}
              />
            </label>
            <label>
              {t('step.fields.postWindowMs')}
              <input
                type="number"
                value={step.eventWindowPostMs}
                onChange={(event) => onUpdate({ eventWindowPostMs: event.target.value })}
              />
            </label>
          </>
        )}

        <label className="cb-full-width">
          {t('step.fields.jointsOfInterest')}
          <input
            type="text"
            value={step.jointsOfInterest}
            data-testid="cb-steps-joints-of-interest"
            onChange={(event) => onUpdate({ jointsOfInterest: event.target.value })}
            placeholder={t('step.placeholders.jointsOfInterest')}
          />
          <span className="cb-field-help">{t('step.fields.jointsHelp')}</span>
          <div className="cb-chip-row">
            {jointPresets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className="cb-chip-button"
                onClick={() => onUpdate({ jointsOfInterest: preset.value })}
              >
                {t(`step.presets.${preset.key}`)}
              </button>
            ))}
          </div>
        </label>
      </div>

      <JointLandmarkDiagram
        selectedJointIds={selectedJointIds}
        titleKey="jointDiagram.stepTitle"
        helpKey="jointDiagram.stepHelp"
        dataTestId="cb-joint-diagram-step"
        toggleTestId="cb-joint-diagram-toggle"
      />
    </section>
  )
}
