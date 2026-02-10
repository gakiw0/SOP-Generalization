import { OPENPOSE25_MAX_ID } from './openpose25'

export const parseJointIdsCsv = (value: string): number[] => {
  const uniqueIds = new Set<number>()
  const tokens = value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

  tokens.forEach((token) => {
    const parsed = Number(token)
    if (!Number.isFinite(parsed)) return
    if (!Number.isInteger(parsed)) return
    const jointId = parsed
    if (jointId < 0 || jointId > OPENPOSE25_MAX_ID) return
    uniqueIds.add(jointId)
  })

  return [...uniqueIds].sort((a, b) => a - b)
}

export const formatJointIdsCsv = (jointIds: number[]): string =>
  [...new Set(jointIds)].sort((a, b) => a - b).join(', ')
