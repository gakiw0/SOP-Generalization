import { useTranslation } from 'react-i18next'
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
  checkpointLabels: string[]
): string => {
  const phaseMatch = path.match(/^phases\[(\d+)\](?:\.(.+))?$/)
  if (phaseMatch) {
    const index = Number(phaseMatch[1])
    const field = phaseMatch[2] ? ` > ${phaseMatch[2]}` : ''
    return `Step: ${stepLabels[index] ?? `#${index + 1}`}${field}`
  }

  const ruleMatch = path.match(/^rules\[(\d+)\](?:\.(.+))?$/)
  if (ruleMatch) {
    const index = Number(ruleMatch[1])
    const field = ruleMatch[2] ? ` > ${ruleMatch[2]}` : ''
    return `Checkpoint: ${checkpointLabels[index] ?? `#${index + 1}`}${field}`
  }

  const metadataMatch = path.match(/^metadata(?:\.(.+))?$/)
  if (metadataMatch) {
    const field = metadataMatch[1] ?? 'general'
    return `Setup: ${field}`
  }

  if (path.startsWith('metric_profile')) {
    return `Setup: comparison template`
  }

  if (path === 'schema_version' || path === 'rule_set_id' || path === 'sport' || path === 'sport_version') {
    return `Setup: ${path}`
  }

  return 'Review: general'
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
                <strong>{describeErrorLocation(error.path, stepLabels, checkpointLabels)}</strong>: {t(`validation.code.${error.code}`, error.params)}
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
