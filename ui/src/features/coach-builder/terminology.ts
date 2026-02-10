import type { MetricCatalogEntry } from './metricCatalog'

type BasicProfileShape = {
  id: string
  type: 'generic' | 'preset'
  preset_id?: string
}

export const humanizeIdentifier = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

export const formatMetricLabel = (
  metricId: string,
  metricEntry: MetricCatalogEntry | null
): { primary: string; secondary: string } => {
  if (metricEntry && metricEntry.label.trim().length > 0) {
    return {
      primary: metricEntry.label,
      secondary: metricId,
    }
  }
  return {
    primary: humanizeIdentifier(metricId),
    secondary: metricId,
  }
}

export const formatMetricOptionText = (
  metricId: string,
  metricEntry: MetricCatalogEntry | null
): string => {
  const label = formatMetricLabel(metricId, metricEntry)
  return `${label.primary} (${label.secondary})`
}

export const formatProfileLabel = (profile: BasicProfileShape): { displayName: string; subtitle: string } => {
  if (profile.type === 'preset') {
    const presetId = profile.preset_id?.trim() || profile.id
    return {
      displayName: humanizeIdentifier(presetId),
      subtitle: profile.id,
    }
  }

  return {
    displayName: profile.id === 'generic_core' ? 'General Motion Comparison' : humanizeIdentifier(profile.id),
    subtitle: profile.id,
  }
}

export const formatSignalTypeLabel = (
  signalType: 'frame_range_ref' | 'direct' | 'event_window'
): string => {
  if (signalType === 'frame_range_ref') return 'Use this step timing'
  if (signalType === 'direct') return 'Use fixed frame range'
  return 'Use event timing'
}
