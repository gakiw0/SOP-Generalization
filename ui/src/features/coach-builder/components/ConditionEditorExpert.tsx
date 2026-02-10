import type { ConditionDraft } from '../draftTypes'

type ExpertConditionType = 'event_exists' | 'trend' | 'angle' | 'distance'

const EXPERT_TYPES: ExpertConditionType[] = ['event_exists', 'trend', 'angle', 'distance']

type ConditionEditorExpertProps = {
  condition: ConditionDraft
  onUpdate: (patch: Partial<ConditionDraft>) => void
  onRemove: () => void
}

export function ConditionEditorExpert({ condition, onUpdate, onRemove }: ConditionEditorExpertProps) {
  return (
    <article className="cb-condition-card cb-condition-expert">
      <div className="cb-condition-header">
        <h4>Condition (Expert)</h4>
        <button type="button" className="cb-danger" onClick={onRemove}>
          Remove
        </button>
      </div>

      <div className="cb-field-grid">
        <label>
          Condition ID
          <input
            type="text"
            value={condition.id}
            onChange={(event) => onUpdate({ id: event.target.value })}
          />
        </label>

        <label>
          Type
          <select
            value={condition.type}
            onChange={(event) => {
              const nextType = event.target.value as ExpertConditionType
              onUpdate({
                type: nextType,
                op: nextType === 'trend' ? 'increasing' : nextType === 'event_exists' ? '' : 'gte',
              })
            }}
          >
            {EXPERT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        {condition.type === 'event_exists' && (
          <>
            <label>
              Event
              <input
                type="text"
                value={condition.event}
                onChange={(event) => onUpdate({ event: event.target.value })}
                placeholder="impact"
              />
            </label>
            <label>
              Window pre ms
              <input
                type="number"
                value={condition.windowPreMs}
                onChange={(event) => onUpdate({ windowPreMs: event.target.value })}
              />
            </label>
            <label>
              Window post ms
              <input
                type="number"
                value={condition.windowPostMs}
                onChange={(event) => onUpdate({ windowPostMs: event.target.value })}
              />
            </label>
          </>
        )}

        {condition.type === 'trend' && (
          <>
            <label>
              Metric
              <input
                type="text"
                value={condition.metric}
                onChange={(event) => onUpdate({ metric: event.target.value })}
              />
            </label>
            <label>
              Operator
              <select value={condition.op} onChange={(event) => onUpdate({ op: event.target.value })}>
                <option value="increasing">increasing</option>
                <option value="decreasing">decreasing</option>
              </select>
            </label>
            <label>
              Window frames
              <input
                type="number"
                value={condition.windowFrames}
                onChange={(event) => onUpdate({ windowFrames: event.target.value })}
              />
            </label>
            <label>
              Window pre ms
              <input
                type="number"
                value={condition.windowPreMs}
                onChange={(event) => onUpdate({ windowPreMs: event.target.value })}
              />
            </label>
            <label>
              Window post ms
              <input
                type="number"
                value={condition.windowPostMs}
                onChange={(event) => onUpdate({ windowPostMs: event.target.value })}
              />
            </label>
          </>
        )}

        {condition.type === 'angle' && (
          <>
            <label>
              Joints (2 or 3, CSV)
              <input
                type="text"
                value={condition.joints}
                onChange={(event) => onUpdate({ joints: event.target.value })}
                placeholder="1, 2, 3"
              />
            </label>
            <label>
              Reference
              <select
                value={condition.reference}
                onChange={(event) => onUpdate({ reference: event.target.value as 'global' | 'local' })}
              >
                <option value="global">global</option>
                <option value="local">local</option>
              </select>
            </label>
            <label>
              Operator
              <select value={condition.op} onChange={(event) => onUpdate({ op: event.target.value })}>
                <option value="gte">gte</option>
                <option value="gt">gt</option>
                <option value="lte">lte</option>
                <option value="lt">lt</option>
                <option value="eq">eq</option>
                <option value="neq">neq</option>
                <option value="between">between</option>
              </select>
            </label>
            <label>
              Value
              <input
                type="text"
                value={condition.valueText}
                onChange={(event) => onUpdate({ valueText: event.target.value })}
                placeholder={condition.op === 'between' ? '10, 40' : '25'}
              />
            </label>
            <label>
              Tolerance
              <input
                type="number"
                value={condition.tolerance}
                onChange={(event) => onUpdate({ tolerance: event.target.value })}
              />
            </label>
          </>
        )}

        {condition.type === 'distance' && (
          <>
            <label>
              Pair (CSV)
              <input
                type="text"
                value={condition.pair}
                onChange={(event) => onUpdate({ pair: event.target.value })}
                placeholder="4, 7"
              />
            </label>
            <label>
              Metric (optional)
              <input
                type="text"
                value={condition.metric}
                onChange={(event) => onUpdate({ metric: event.target.value })}
              />
            </label>
            <label>
              Operator
              <select value={condition.op} onChange={(event) => onUpdate({ op: event.target.value })}>
                <option value="gte">gte</option>
                <option value="gt">gt</option>
                <option value="lte">lte</option>
                <option value="lt">lt</option>
                <option value="eq">eq</option>
                <option value="neq">neq</option>
                <option value="between">between</option>
              </select>
            </label>
            <label>
              Value
              <input
                type="text"
                value={condition.valueText}
                onChange={(event) => onUpdate({ valueText: event.target.value })}
                placeholder={condition.op === 'between' ? '0.2, 0.5' : '0.3'}
              />
            </label>
            <label>
              Tolerance
              <input
                type="number"
                value={condition.tolerance}
                onChange={(event) => onUpdate({ tolerance: event.target.value })}
              />
            </label>
          </>
        )}
      </div>
    </article>
  )
}
