import type { RuleSet } from './schemaTypes'

export const serializeRuleSet = (ruleSet: RuleSet): string => JSON.stringify(ruleSet, null, 2)

export const downloadRuleSetJson = (ruleSet: RuleSet, fileName: string) => {
  const blob = new Blob([serializeRuleSet(ruleSet)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`
  link.rel = 'noopener'

  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}
