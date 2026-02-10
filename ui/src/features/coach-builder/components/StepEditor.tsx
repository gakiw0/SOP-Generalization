import type { StepDraft } from '../draftTypes'

type StepEditorProps = {
  step: StepDraft | null
  onRename: (nextId: string) => void
  onUpdate: (patch: Partial<Omit<StepDraft, 'checkpoints'>>) => void
}

export function StepEditor({ step, onRename, onUpdate }: StepEditorProps) {
  if (!step) {
    return (
      <section className="cb-panel">
        <h2>Step editor</h2>
        <p>Select a step to edit.</p>
      </section>
    )
  }

  return (
    <section className="cb-panel">
      <h2>Step editor</h2>

      <div className="cb-field-grid">
        <label>
          Step ID
          <input
            type="text"
            value={step.id}
            onChange={(event) => onRename(event.target.value)}
            placeholder="step1"
          />
        </label>

        <label>
          Step label
          <input
            type="text"
            value={step.label}
            onChange={(event) => onUpdate({ label: event.target.value })}
            placeholder="Get Prepared"
          />
        </label>

        <label>
          Category
          <input
            type="text"
            value={step.category}
            onChange={(event) => onUpdate({ category: event.target.value })}
            placeholder="batting"
          />
        </label>

        <label className="cb-full-width">
          Description
          <textarea
            rows={3}
            value={step.description}
            onChange={(event) => onUpdate({ description: event.target.value })}
          />
        </label>

        <label>
          Range type
          <select
            value={step.rangeType}
            onChange={(event) => onUpdate({ rangeType: event.target.value as 'frame' | 'event' })}
          >
            <option value="frame">Frame range</option>
            <option value="event">Event window</option>
          </select>
        </label>

        {step.rangeType === 'frame' ? (
          <>
            <label>
              Start frame
              <input
                type="number"
                value={step.frameStart}
                onChange={(event) => onUpdate({ frameStart: event.target.value })}
              />
            </label>
            <label>
              End frame
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
              Event name
              <input
                type="text"
                value={step.eventName}
                onChange={(event) => onUpdate({ eventName: event.target.value })}
                placeholder="impact"
              />
            </label>
            <label>
              Pre-window (ms)
              <input
                type="number"
                value={step.eventWindowPreMs}
                onChange={(event) => onUpdate({ eventWindowPreMs: event.target.value })}
              />
            </label>
            <label>
              Post-window (ms)
              <input
                type="number"
                value={step.eventWindowPostMs}
                onChange={(event) => onUpdate({ eventWindowPostMs: event.target.value })}
              />
            </label>
          </>
        )}

        <label className="cb-full-width">
          Joints of interest (CSV)
          <input
            type="text"
            value={step.jointsOfInterest}
            onChange={(event) => onUpdate({ jointsOfInterest: event.target.value })}
            placeholder="1, 8, 12"
          />
        </label>
      </div>
    </section>
  )
}
