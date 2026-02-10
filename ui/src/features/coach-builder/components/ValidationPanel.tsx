import { useTranslation } from 'react-i18next'
import type { ValidationError } from '../schemaTypes'

type ValidationStatus = 'idle' | 'pass' | 'fail'

type ValidationPanelProps = {
  errors: ValidationError[]
  status: ValidationStatus
  onValidate: () => void
  onNavigateError: (path: string) => void
}

export function ValidationPanel({
  errors,
  status,
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
        <button type="button" onClick={onValidate}>
          {t('common.validate')}
        </button>
      </div>

      <p className={errors.length > 0 ? 'cb-error-text' : 'cb-ok-text'}>{summary}</p>

      {errors.length > 0 && (
        <ul className="cb-validation-list">
          {errors.map((error, index) => (
            <li key={`${error.path}_${error.code}_${index}`}>
              <button type="button" onClick={() => onNavigateError(error.path)}>
                <code>{error.path}</code>: {t(`validation.code.${error.code}`, error.params)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
