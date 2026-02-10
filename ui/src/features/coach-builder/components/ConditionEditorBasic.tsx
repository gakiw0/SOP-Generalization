import { useTranslation } from 'react-i18next'
import type { BasicConditionType, ConditionDraft } from '../draftTypes'
import { getMetricCatalogEntry } from '../metricCatalog'
import { formatMetricOptionText } from '../terminology'

type ConditionEditorBasicProps = {
  condition: ConditionDraft
  allConditionIds: string[]
  supportedTypes?: BasicConditionType[]
  metricCandidates?: string[]
  onUpdate: (patch: Partial<ConditionDraft>) => void
  onRemove: () => void
}

const BASIC_TYPES: BasicConditionType[] = ['threshold', 'range', 'boolean', 'composite']

export function ConditionEditorBasic({
  condition,
  allConditionIds,
  supportedTypes,
  metricCandidates,
  onUpdate,
  onRemove,
}: ConditionEditorBasicProps) {
  const { t } = useTranslation()
  const availableRefIds = allConditionIds.filter((id) => id !== condition.id)
  const selectableRefIds = Array.from(
    new Set([
      ...availableRefIds,
      ...condition.conditionRefs.filter((id) => id !== condition.id),
    ])
  )
  const basicTypes = supportedTypes && supportedTypes.length > 0 ? supportedTypes : BASIC_TYPES
  const metrics =
    metricCandidates && metricCandidates.length > 0
      ? Array.from(new Set([...metricCandidates, condition.metric].filter((item) => item.length > 0)))
      : condition.metric.length > 0
        ? [condition.metric]
        : []

  return (
    <article className="cb-condition-card">
      <div className="cb-condition-header">
        <h4>{t('condition.basicTitle')}</h4>
        <button type="button" className="cb-danger" onClick={onRemove}>
          {t('common.remove')}
        </button>
      </div>
      <p className="cb-card-help-text">{t('condition.basicHelp')}</p>

      <div className="cb-field-grid">
        <label>
          {t('condition.fields.id')}
          <input
            type="text"
            value={condition.id}
            onChange={(event) => onUpdate({ id: event.target.value })}
          />
        </label>

        <label>
          {t('condition.fields.type')}
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
            {basicTypes.map((type) => (
              <option key={type} value={type}>
                {t(`condition.type.${type}`)}
              </option>
            ))}
          </select>
        </label>

        {(condition.type === 'threshold' || condition.type === 'range' || condition.type === 'boolean') && (
          <label>
            {t('condition.fields.metric')}
            <select
              value={condition.metric}
              data-testid="cb-condition-metric"
              onChange={(event) => onUpdate({ metric: event.target.value })}
            >
              <option value="">{t('condition.placeholders.metric')}</option>
              {metrics.map((metric) => (
                <option key={metric} value={metric}>
                  {formatMetricOptionText(metric, getMetricCatalogEntry(metric))}
                </option>
              ))}
            </select>
          </label>
        )}

        {condition.type === 'threshold' && (
          <label>
            {t('condition.fields.operator')}
            <select value={condition.op} onChange={(event) => onUpdate({ op: event.target.value })}>
              <option value="gte">{t('condition.op.gte')}</option>
              <option value="gt">{t('condition.op.gt')}</option>
              <option value="lte">{t('condition.op.lte')}</option>
              <option value="lt">{t('condition.op.lt')}</option>
              <option value="eq">{t('condition.op.eq')}</option>
              <option value="neq">{t('condition.op.neq')}</option>
            </select>
          </label>
        )}

        {condition.type === 'boolean' && (
          <label>
            {t('condition.fields.operator')}
            <select value={condition.op} onChange={(event) => onUpdate({ op: event.target.value })}>
              <option value="is_true">{t('condition.op.is_true')}</option>
              <option value="is_false">{t('condition.op.is_false')}</option>
            </select>
          </label>
        )}

        {(condition.type === 'threshold' || condition.type === 'range') && (
          <label>
            {t('condition.fields.value')}
            <input
              type="text"
              value={condition.valueText}
              onChange={(event) => onUpdate({ valueText: event.target.value })}
              placeholder={
                condition.type === 'range'
                  ? t('condition.placeholders.rangeValue')
                  : t('condition.placeholders.thresholdValue')
              }
            />
          </label>
        )}

        {(condition.type === 'threshold' || condition.type === 'range') && (
          <label>
            {t('condition.fields.tolerance')}
            <input
              type="number"
              value={condition.tolerance}
              onChange={(event) => onUpdate({ tolerance: event.target.value })}
              placeholder={t('condition.placeholders.tolerance')}
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
            {t('condition.fields.useAbsolute')}
          </label>
        )}

        {condition.type === 'composite' && (
          <>
            <label>
              {t('condition.fields.logic')}
              <select
                value={condition.logic}
                onChange={(event) =>
                  onUpdate({ logic: event.target.value as 'all' | 'any' | 'none' })
                }
              >
                <option value="all">{t('condition.logic.all')}</option>
                <option value="any">{t('condition.logic.any')}</option>
                <option value="none">{t('condition.logic.none')}</option>
              </select>
            </label>

            <label className="cb-full-width">
              {t('condition.fields.conditionRefs')}
              <select
                multiple
                className="cb-multi-select"
                value={condition.conditionRefs}
                data-testid="cb-condition-composite-refs"
                onChange={(event) =>
                  onUpdate({
                    conditionRefs: Array.from(event.target.selectedOptions).map(
                      (option) => option.value
                    ),
                  })
                }
              >
                {selectableRefIds.map((refId) => (
                  <option key={refId} value={refId}>
                    {refId}
                  </option>
                ))}
              </select>
              {condition.conditionRefs.length > 0 ? (
                <div className="cb-chip-row">
                  {condition.conditionRefs.map((refId) => (
                    <span key={refId} className="cb-chip-button cb-chip-static">
                      {refId}
                    </span>
                  ))}
                </div>
              ) : null}
            </label>
          </>
        )}
      </div>
    </article>
  )
}
