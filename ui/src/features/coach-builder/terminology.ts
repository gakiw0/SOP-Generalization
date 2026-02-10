import type { MetricCatalogEntry } from './metricCatalog'
import type { TFunction } from 'i18next'

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
  metricEntry: MetricCatalogEntry | null,
  t?: TFunction
): { primary: string; secondary: string } => {
  const translatedLabel = t?.(`metrics.${metricId}`, { defaultValue: '' }) ?? ''
  if (translatedLabel.trim().length > 0) {
    return {
      primary: translatedLabel,
      secondary: metricId,
    }
  }
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
  metricEntry: MetricCatalogEntry | null,
  t?: TFunction
): string => {
  const label = formatMetricLabel(metricId, metricEntry, t)
  return `${label.primary} (${label.secondary})`
}

export const formatProfileLabel = (
  profile: BasicProfileShape,
  t?: TFunction
): { displayName: string; subtitle: string } => {
  const translatedProfile = t?.(`profiles.${profile.id}`, { defaultValue: '' }) ?? ''
  if (translatedProfile.trim().length > 0) {
    return {
      displayName: translatedProfile,
      subtitle: profile.id,
    }
  }

  if (profile.type === 'preset') {
    const presetId = profile.preset_id?.trim() || profile.id
    const translatedPreset = t?.(`presets.${presetId}`, { defaultValue: '' }) ?? ''
    return {
      displayName: translatedPreset.trim().length > 0 ? translatedPreset : humanizeIdentifier(presetId),
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
