import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { ValidationError } from '../schemaTypes'

type ValidationStatus = 'idle' | 'pass' | 'fail'

type ValidationPanelProps = {
  errors: ValidationError[]
  status: ValidationStatus
  stepLabels: string[]
  checkpointLabels: string[]
  onValidate: () => void
  onNavigateError: (path: string) => void
}

const describeErrorLocation = (
  path: string,
  stepLabels: string[],
  checkpointLabels: string[],
  t: TFunction
): string => {
  const mapFieldLabel = (fieldToken: string): string => {
    const token = fieldToken.trim()
    if (token.startsWith('conditions[')) return t('validation.field.conditions')
    if (token.startsWith('score')) return t('validation.field.score')
    if (token.startsWith('signal')) return t('validation.field.timing')
    if (token === 'label') return t('validation.field.label')
    if (token === 'category') return t('validation.field.category')
    if (token === 'id') return t('validation.field.id')
    if (token === 'description') return t('validation.field.description')
    if (token === 'title') return t('validation.field.title')
    if (token === 'metric_profile') return t('validation.field.template')
    if (token.startsWith('metric_profile')) return t('validation.field.template')
    if (token === 'rule_set_id') return t('validation.field.comparisonId')
    if (token === 'sport') return t('validation.field.sport')
    if (token === 'sport_version') return t('validation.field.version')
    return t('validation.field.general')
  }

  const phaseMatch = path.match(/^phases\[(\d+)\](?:\.(.+))?$/)
  if (phaseMatch) {
    const index = Number(phaseMatch[1])
    const fieldToken = phaseMatch[2]?.split('.')[0] ?? ''
    const field = fieldToken.length > 0 ? ` > ${mapFieldLabel(fieldToken)}` : ''
    return `${t('validation.location.step', { name: stepLabels[index] ?? `#${index + 1}` })}${field}`
  }

  const ruleMatch = path.match(/^rules\[(\d+)\](?:\.(.+))?$/)
  if (ruleMatch) {
    const index = Number(ruleMatch[1])
    const fieldToken = ruleMatch[2]?.split('.')[0] ?? ''
    const field = fieldToken.length > 0 ? ` > ${mapFieldLabel(fieldToken)}` : ''
    return `${t('validation.location.checkpoint', { name: checkpointLabels[index] ?? `#${index + 1}` })}${field}`
  }

  const metadataMatch = path.match(/^metadata(?:\.(.+))?$/)
  if (metadataMatch) {
    const fieldToken = metadataMatch[1]?.split('.')[0] ?? 'general'
    return `${t('validation.location.setup')}: ${mapFieldLabel(fieldToken)}`
  }

  if (path.startsWith('metric_profile')) {
    return `${t('validation.location.setup')}: ${t('validation.field.template')}`
  }

  if (path === 'schema_version' || path === 'rule_set_id' || path === 'sport' || path === 'sport_version') {
    return `${t('validation.location.setup')}: ${mapFieldLabel(path)}`
  }

  return `${t('validation.location.review')}: ${t('validation.field.general')}`
}

export function ValidationPanel({
  errors,
  status,
  stepLabels,
  checkpointLabels,
  onValidate,
  onNavigateError,
}: ValidationPanelProps) {
  const { t } = useTranslation()

  const summary =
    status === 'idle'
      ? t('validation.summary.idle')
      : status === 'pass'
        ? t('validation.summary.pass')
        : t('validation.summary.fail', { count: errors.length })

  return (
    <section className="cb-panel">
      <div className="cb-panel-header">
        <h2>{t('validation.title')}</h2>
        <button type="button" onClick={onValidate} data-testid="cb-review-validate">
          {t('common.validate')}
        </button>
      </div>
      <p>{t('validation.help')}</p>

      <p className={errors.length > 0 ? 'cb-error-text' : 'cb-ok-text'}>{summary}</p>

      {errors.length > 0 && (
        <ul className="cb-validation-list">
          {errors.map((error, index) => (
            <li key={`${error.path}_${error.code}_${index}`}>
              <button
                type="button"
                onClick={() => onNavigateError(error.path)}
                data-testid={`cb-validation-error-${index}`}
                data-error-path={error.path}
              >
                <strong>{describeErrorLocation(error.path, stepLabels, checkpointLabels, t)}</strong>: {t(`validation.code.${error.code}`, error.params)}
              </button>
              <details className="cb-validation-technical">
                <summary>{t('validation.technicalDetails')}</summary>
                <code>{error.path}</code>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
