import { useTranslation } from 'react-i18next'
import type { ConditionDraft } from '../draftTypes'
import { formatJointIdsCsv, parseJointIdsCsv } from '../jointParsing'
import { getMetricCatalogEntry } from '../metricCatalog'
import { formatMetricOptionText } from '../terminology'
import { JointLandmarkDiagram } from './JointLandmarkDiagram'

type ExpertConditionType = 'event_exists' | 'trend' | 'angle' | 'distance'

const EXPERT_TYPES: ExpertConditionType[] = ['event_exists', 'trend', 'angle', 'distance']

type ConditionEditorExpertProps = {
  condition: ConditionDraft
  supportedTypes?: ExpertConditionType[]
  metricCandidates?: string[]
  onUpdate: (patch: Partial<ConditionDraft>) => void
  onRemove: () => void
}

export function ConditionEditorExpert({
  condition,
  supportedTypes,
  metricCandidates,
  onUpdate,
  onRemove,
}: ConditionEditorExpertProps) {
  const { t } = useTranslation()
  const expertTypes =
    supportedTypes && supportedTypes.length > 0 ? supportedTypes : EXPERT_TYPES
  const metrics =
    metricCandidates && metricCandidates.length > 0
      ? Array.from(new Set([...metricCandidates, condition.metric].filter((item) => item.length > 0)))
      : condition.metric.length > 0
        ? [condition.metric]
        : []
  const selectedJointIds =
    condition.type === 'angle'
      ? parseJointIdsCsv(condition.joints)
      : condition.type === 'distance'
        ? parseJointIdsCsv(condition.pair)
        : []

  const handleAngleJointSelectionChange = (nextJointIds: number[]) => {
    onUpdate({ joints: formatJointIdsCsv(nextJointIds) })
  }

  const handleDistancePairSelectionChange = (nextJointIds: number[]) => {
    onUpdate({ pair: formatJointIdsCsv(nextJointIds) })
  }

  return (
    <article className="cb-condition-card cb-condition-expert">
      <div className="cb-condition-header">
        <div className="cb-condition-heading">
          <h4>{t('condition.expertTitle')}</h4>
          <span className="cb-condition-type-chip">{t(`condition.type.${condition.type}`)}</span>
        </div>
        <button type="button" className="cb-danger" onClick={onRemove}>
          {t('common.remove')}
        </button>
      </div>
      <p className="cb-card-help-text">{t('condition.expertHelp')}</p>

      <div className="cb-field-grid cb-condition-grid">
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
              const nextType = event.target.value as ExpertConditionType
              onUpdate({
                type: nextType,
                op: nextType === 'trend' ? 'increasing' : nextType === 'event_exists' ? '' : 'gte',
              })
            }}
          >
            {expertTypes.map((type) => (
              <option key={type} value={type}>
                {t(`condition.type.${type}`)}
              </option>
            ))}
          </select>
        </label>

        {condition.type === 'event_exists' && (
          <>
            <label>
              {t('condition.fields.event')}
              <input
                type="text"
                value={condition.event}
                onChange={(event) => onUpdate({ event: event.target.value })}
                placeholder={t('condition.placeholders.event')}
              />
            </label>
            <label>
              {t('condition.fields.windowPreMs')}
              <input
                type="number"
                value={condition.windowPreMs}
                onChange={(event) => onUpdate({ windowPreMs: event.target.value })}
              />
            </label>
            <label>
              {t('condition.fields.windowPostMs')}
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
              {t('condition.fields.metric')}
              <select
                value={condition.metric}
                onChange={(event) => onUpdate({ metric: event.target.value })}
              >
                <option value="">{t('condition.placeholders.metric')}</option>
                {metrics.map((metric) => (
                  <option key={metric} value={metric}>
                    {formatMetricOptionText(metric, getMetricCatalogEntry(metric), t)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('condition.fields.operator')}
              <select value={condition.op} onChange={(event) => onUpdate({ op: event.target.value })}>
                <option value="increasing">{t('condition.op.increasing')}</option>
                <option value="decreasing">{t('condition.op.decreasing')}</option>
              </select>
            </label>
            <label>
              {t('condition.fields.windowFrames')}
              <input
                type="number"
                value={condition.windowFrames}
                onChange={(event) => onUpdate({ windowFrames: event.target.value })}
              />
            </label>
            <label>
              {t('condition.fields.windowPreMs')}
              <input
                type="number"
                value={condition.windowPreMs}
                onChange={(event) => onUpdate({ windowPreMs: event.target.value })}
              />
            </label>
            <label>
              {t('condition.fields.windowPostMs')}
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
              {t('condition.fields.joints')}
              <input
                type="text"
                value={condition.joints}
                data-testid="cb-condition-angle-joints"
                onChange={(event) => onUpdate({ joints: event.target.value })}
                placeholder={t('condition.placeholders.joints')}
              />
            </label>
            <label>
              {t('condition.fields.reference')}
              <select
                value={condition.reference}
                onChange={(event) => onUpdate({ reference: event.target.value as 'global' | 'local' })}
              >
                <option value="global">{t('condition.reference.global')}</option>
                <option value="local">{t('condition.reference.local')}</option>
              </select>
            </label>
            <label>
              {t('condition.fields.operator')}
              <select value={condition.op} onChange={(event) => onUpdate({ op: event.target.value })}>
                <option value="gte">{t('condition.op.gte')}</option>
                <option value="gt">{t('condition.op.gt')}</option>
                <option value="lte">{t('condition.op.lte')}</option>
                <option value="lt">{t('condition.op.lt')}</option>
                <option value="eq">{t('condition.op.eq')}</option>
                <option value="neq">{t('condition.op.neq')}</option>
                <option value="between">{t('condition.op.between')}</option>
              </select>
            </label>
            <label>
              {t('condition.fields.value')}
              <input
                type="text"
                value={condition.valueText}
                onChange={(event) => onUpdate({ valueText: event.target.value })}
                placeholder={
                  condition.op === 'between'
                    ? t('condition.placeholders.angleRange')
                    : t('condition.placeholders.angleSingle')
                }
              />
            </label>
            <label>
              {t('condition.fields.tolerance')}
              <input
                type="number"
                value={condition.tolerance}
                onChange={(event) => onUpdate({ tolerance: event.target.value })}
              />
            </label>

            <div className="cb-full-width">
              <JointLandmarkDiagram
                selectedJointIds={selectedJointIds}
                maxSelectable={3}
                onSelectionChange={handleAngleJointSelectionChange}
                titleKey="jointDiagram.conditionTitle"
                helpKey="jointDiagram.conditionHelp"
                dataTestId="cb-joint-diagram-condition"
              />
            </div>
          </>
        )}

        {condition.type === 'distance' && (
          <>
            <label>
              {t('condition.fields.pair')}
              <input
                type="text"
                value={condition.pair}
                data-testid="cb-condition-distance-pair"
                onChange={(event) => onUpdate({ pair: event.target.value })}
                placeholder={t('condition.placeholders.pair')}
              />
            </label>
            <label>
              {t('condition.fields.metricOptional')}
              <select
                value={condition.metric}
                onChange={(event) => onUpdate({ metric: event.target.value })}
              >
                <option value="">{t('condition.placeholders.metric')}</option>
                {metrics.map((metric) => (
                  <option key={metric} value={metric}>
                    {formatMetricOptionText(metric, getMetricCatalogEntry(metric), t)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('condition.fields.operator')}
              <select value={condition.op} onChange={(event) => onUpdate({ op: event.target.value })}>
                <option value="gte">{t('condition.op.gte')}</option>
                <option value="gt">{t('condition.op.gt')}</option>
                <option value="lte">{t('condition.op.lte')}</option>
                <option value="lt">{t('condition.op.lt')}</option>
                <option value="eq">{t('condition.op.eq')}</option>
                <option value="neq">{t('condition.op.neq')}</option>
                <option value="between">{t('condition.op.between')}</option>
              </select>
            </label>
            <label>
              {t('condition.fields.value')}
              <input
                type="text"
                value={condition.valueText}
                onChange={(event) => onUpdate({ valueText: event.target.value })}
                placeholder={
                  condition.op === 'between'
                    ? t('condition.placeholders.distanceRange')
                    : t('condition.placeholders.distanceSingle')
                }
              />
            </label>
            <label>
              {t('condition.fields.tolerance')}
              <input
                type="number"
                value={condition.tolerance}
                onChange={(event) => onUpdate({ tolerance: event.target.value })}
              />
            </label>

            <div className="cb-full-width">
              <JointLandmarkDiagram
                selectedJointIds={selectedJointIds}
                maxSelectable={2}
                onSelectionChange={handleDistancePairSelectionChange}
                titleKey="jointDiagram.conditionTitle"
                helpKey="jointDiagram.conditionHelp"
                dataTestId="cb-joint-diagram-condition"
              />
            </div>
          </>
        )}
      </div>
    </article>
  )
}
