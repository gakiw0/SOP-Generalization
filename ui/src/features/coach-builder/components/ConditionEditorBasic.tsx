import type { BasicConditionType, ConditionDraft } from '../draftTypes'

type ConditionEditorBasicProps = {
  condition: ConditionDraft
  allConditionIds: string[]
  onUpdate: (patch: Partial<ConditionDraft>) => void
  onRemove: () => void
}

const BASIC_TYPES: BasicConditionType[] = ['threshold', 'range', 'boolean', 'composite']

export function ConditionEditorBasic({
  condition,
  allConditionIds,
  onUpdate,
  onRemove,
}: ConditionEditorBasicProps) {
  const availableRefIds = allConditionIds.filter((id) => id !== condition.id)

  return (
    <article className="cb-condition-card">
      <div className="cb-condition-header">
        <h4>Condition</h4>
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
              const nextType = event.target.value as BasicConditionType
              onUpdate({
                type: nextType,
                op:
                  nextType === 'range'
                    ? 'between'
                    : nextType === 'boolean'
                      ? 'is_true'
                      : nextType === 'composite'
                        ? ''
                        : 'gte',
              })
            }}
          >
            {BASIC_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        {(condition.type === 'threshold' || condition.type === 'range' || condition.type === 'boolean') && (
          <label>
            Metric
            <input
              type="text"
              value={condition.metric}
              onChange={(event) => onUpdate({ metric: event.target.value })}
              placeholder="head_move_diff_ratio"
            />
          </label>
        )}

        {condition.type === 'threshold' && (
          <label>
            Operator
            <select value={condition.op} onChange={(event) => onUpdate({ op: event.target.value })}>
              <option value="gte">gte</option>
              <option value="gt">gt</option>
              <option value="lte">lte</option>
              <option value="lt">lt</option>
              <option value="eq">eq</option>
              <option value="neq">neq</option>
            </select>
          </label>
        )}

        {condition.type === 'boolean' && (
          <label>
            Operator
            <select value={condition.op} onChange={(event) => onUpdate({ op: event.target.value })}>
              <option value="is_true">is_true</option>
              <option value="is_false">is_false</option>
            </select>
          </label>
        )}

        {(condition.type === 'threshold' || condition.type === 'range') && (
          <label>
            Value
            <input
              type="text"
              value={condition.valueText}
              onChange={(event) => onUpdate({ valueText: event.target.value })}
              placeholder={condition.type === 'range' ? '0, 1' : '0.3'}
            />
          </label>
        )}

        {(condition.type === 'threshold' || condition.type === 'range') && (
          <label>
            Tolerance
            <input
              type="number"
              value={condition.tolerance}
              onChange={(event) => onUpdate({ tolerance: event.target.value })}
              placeholder="0"
            />
          </label>
        )}

        {(condition.type === 'threshold' || condition.type === 'range') && (
          <label className="cb-checkbox-label">
            <input
              type="checkbox"
              checked={condition.absVal}
              onChange={(event) => onUpdate({ absVal: event.target.checked })}
            />
            Use absolute value
          </label>
        )}

        {condition.type === 'composite' && (
          <>
            <label>
              Logic
              <select value={condition.logic} onChange={(event) => onUpdate({ logic: event.target.value as 'all' | 'any' | 'none' })}>
                <option value="all">all</option>
                <option value="any">any</option>
                <option value="none">none</option>
              </select>
            </label>

            <label className="cb-full-width">
              Condition refs (CSV)
              <input
                type="text"
                value={condition.conditionRefs.join(', ')}
                onChange={(event) =>
                  onUpdate({
                    conditionRefs: event.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter((item) => item.length > 0),
                  })
                }
                placeholder="cond_1, cond_2"
                list={`condition_refs_${condition.id}`}
              />
              <datalist id={`condition_refs_${condition.id}`}>
                {availableRefIds.map((refId) => (
                  <option key={refId} value={refId} />
                ))}
              </datalist>
            </label>
          </>
        )}
      </div>
    </article>
  )
}
