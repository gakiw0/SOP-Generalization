import { fromRuleSetSchemaV1 } from './mappers'
import type { CoachDraft } from './draftTypes'
import type { RuleSet, ValidationError } from './schemaTypes'
import { validateRuleSet } from './validation'

const readFileText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null

const parseRuleSetJson = (raw: string): RuleSet => {
  const parsed: unknown = JSON.parse(raw)
  if (!isObject(parsed)) {
    throw new Error('JSON root must be an object.')
  }

  return parsed as RuleSet
}

export const importDraftFromFile = async (
  file: File
): Promise<{ draft: CoachDraft | null; errors: ValidationError[]; message: string }> => {
  const text = await readFileText(file)
  const ruleSet = parseRuleSetJson(text)
  const errors = validateRuleSet(ruleSet)

  if (errors.length > 0) {
    return {
      draft: null,
      errors,
      message: `Import failed. ${errors.length} validation issue(s) found.`,
    }
  }

  const draft = fromRuleSetSchemaV1(ruleSet)
  return {
    draft,
    errors: [],
    message: 'Import successful. Draft loaded from schema v1 JSON.',
  }
}
