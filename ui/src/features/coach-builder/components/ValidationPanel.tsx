import type { ValidationError } from '../schemaTypes'

type ValidationPanelProps = {
  errors: ValidationError[]
  summary: string
  onValidate: () => void
  onNavigateError: (path: string) => void
}

export function ValidationPanel({
  errors,
  summary,
  onValidate,
  onNavigateError,
}: ValidationPanelProps) {
  return (
    <section className="cb-panel">
      <div className="cb-panel-header">
        <h2>Validation</h2>
        <button type="button" onClick={onValidate}>
          Validate
        </button>
      </div>

      <p className={errors.length > 0 ? 'cb-error-text' : 'cb-ok-text'}>{summary}</p>

      {errors.length > 0 && (
        <ul className="cb-validation-list">
          {errors.map((error, index) => (
            <li key={`${error.path}_${index}`}>
              <button type="button" onClick={() => onNavigateError(error.path)}>
                <code>{error.path}</code>: {error.message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
