import { fromRuleSetSchemaV1 } from './mappers'
import type { CoachDraft } from './draftTypes'
import type { RuleSet, ValidationError } from './schemaTypes'
import { validateRuleSet } from './validation'

export type ImportMessageKey =
  | 'import.success'
  | 'import.validation_failed'
  | 'import.invalid_json'
  | 'import.invalid_json_root'
  | 'import.unexpected_error'

export type ImportResult = {
  draft: CoachDraft | null
  errors: ValidationError[]
  messageKey: ImportMessageKey
  messageParams?: Record<string, string | number>
}

const readFileText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null

const parseRuleSetJson = (raw: string): { ruleSet: RuleSet | null; error: ValidationError | null } => {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed)) {
      return {
        ruleSet: null,
        error: { path: 'import', code: 'import_invalid_json_root' },
      }
    }

    return { ruleSet: parsed as RuleSet, error: null }
  } catch {
    return {
      ruleSet: null,
      error: { path: 'import', code: 'import_invalid_json' },
    }
  }
}

export const importDraftFromFile = async (file: File): Promise<ImportResult> => {
  try {
    const text = await readFileText(file)
    const parsed = parseRuleSetJson(text)

    if (parsed.error) {
      return {
        draft: null,
        errors: [parsed.error],
        messageKey: parsed.error.code === 'import_invalid_json_root' ? 'import.invalid_json_root' : 'import.invalid_json',
      }
    }

    const ruleSet = parsed.ruleSet as RuleSet
    const errors = validateRuleSet(ruleSet)

    if (errors.length > 0) {
      return {
        draft: null,
        errors,
        messageKey: 'import.validation_failed',
        messageParams: { count: errors.length },
      }
    }

    const draft = fromRuleSetSchemaV1(ruleSet)
    return {
      draft,
      errors: [],
      messageKey: 'import.success',
    }
  } catch {
    return {
      draft: null,
      errors: [{ path: 'import', code: 'import_unexpected_error' }],
      messageKey: 'import.unexpected_error',
    }
  }
}
