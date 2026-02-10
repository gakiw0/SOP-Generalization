import type { StepDraft } from '../draftTypes'

type StepListProps = {
  steps: StepDraft[]
  selectedStepId: string | null
  onSelect: (stepId: string) => void
  onAdd: () => void
  onRemove: (stepId: string) => void
}

export function StepList({ steps, selectedStepId, onSelect, onAdd, onRemove }: StepListProps) {
  return (
    <section className="cb-panel">
      <div className="cb-panel-header">
        <h2>Steps</h2>
        <button type="button" onClick={onAdd}>
          Add step
        </button>
      </div>

      <ul className="cb-step-list">
        {steps.map((step) => {
          const selected = step.id === selectedStepId
          return (
            <li key={step.id} className={selected ? 'is-selected' : undefined}>
              <button type="button" onClick={() => onSelect(step.id)} className="cb-step-card">
                <span className="cb-step-title">{step.label || step.id}</span>
                <span className="cb-step-meta">{step.category || 'uncategorized'}</span>
              </button>
              <button
                type="button"
                className="cb-danger"
                onClick={() => onRemove(step.id)}
                disabled={steps.length <= 1}
              >
                Remove
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
