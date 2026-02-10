import { useTranslation } from 'react-i18next'
import type { StepDraft } from '../draftTypes'

type StepEditorProps = {
  step: StepDraft | null
  onRename: (nextId: string) => void
  onUpdate: (patch: Partial<Omit<StepDraft, 'checkpoints'>>) => void
}

export function StepEditor({ step, onRename, onUpdate }: StepEditorProps) {
  const { t } = useTranslation()

  if (!step) {
    return (
      <section className="cb-panel">
        <h2>{t('step.editorTitle')}</h2>
        <p>{t('step.emptySelect')}</p>
      </section>
    )
  }

  return (
    <section className="cb-panel">
      <h2>{t('step.editorTitle')}</h2>

      <div className="cb-field-grid">
        <label>
          {t('step.fields.id')}
          <input
            type="text"
            value={step.id}
            onChange={(event) => onRename(event.target.value)}
            placeholder={t('step.placeholders.id')}
          />
        </label>

        <label>
          {t('step.fields.label')}
          <input
            type="text"
            value={step.label}
            onChange={(event) => onUpdate({ label: event.target.value })}
            placeholder={t('step.placeholders.label')}
          />
        </label>

        <label>
          {t('step.fields.category')}
          <input
            type="text"
            value={step.category}
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
            onChange={(event) => onUpdate({ jointsOfInterest: event.target.value })}
            placeholder={t('step.placeholders.jointsOfInterest')}
          />
        </label>
      </div>
    </section>
  )
}
