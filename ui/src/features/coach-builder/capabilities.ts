import rawCapabilities from '../../generated/pluginCapabilities.json'

export type PluginCapability = {
  supported_condition_types: string[]
  metrics_by_phase: Record<string, string[]>
  all_metrics: string[]
}

export type ProfileCapability = {
  id: string
  plugin: string
  type: 'generic' | 'preset'
  preset_id?: string | null
  metric_space: string
  supported_condition_types: string[]
  metrics_by_phase: Record<string, string[]>
  available_metric_ids: string[]
  metric_catalog_ref?: string
}

export type ProfileOption = {
  id: string
  type: 'generic' | 'preset'
  preset_id?: string
  plugin: string
}

export type PluginCapabilities = {
  version: number
  default_profile_id?: string
  profiles: Record<string, ProfileCapability>
  plugins: Record<string, PluginCapability>
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)) : []

const parseCapability = (value: unknown): PluginCapability => {
  const input = (value ?? {}) as Record<string, unknown>
  const metricsByPhaseInput = (input.metrics_by_phase ?? {}) as Record<string, unknown>
  const metricsByPhase: Record<string, string[]> = {}

  Object.entries(metricsByPhaseInput).forEach(([phaseId, metrics]) => {
    metricsByPhase[phaseId] = asStringArray(metrics)
  })

  return {
    supported_condition_types: asStringArray(input.supported_condition_types),
    metrics_by_phase: metricsByPhase,
    all_metrics: asStringArray(input.all_metrics),
  }
}

const parseCapabilities = (value: unknown): PluginCapabilities => {
  const input = (value ?? {}) as Record<string, unknown>
  const pluginsInput = (input.plugins ?? {}) as Record<string, unknown>
  const profilesInput = (input.profiles ?? {}) as Record<string, unknown>
  const plugins: Record<string, PluginCapability> = {}
  const profiles: Record<string, ProfileCapability> = {}

  Object.entries(pluginsInput).forEach(([pluginName, capability]) => {
    plugins[pluginName] = parseCapability(capability)
  })

  Object.entries(profilesInput).forEach(([profileId, rawProfile]) => {
    const profile = (rawProfile ?? {}) as Record<string, unknown>
    const profileCapability = {
      id: String(profile.id ?? profileId),
      plugin: String(profile.plugin ?? ''),
      type: String(profile.type ?? 'generic') === 'preset' ? 'preset' : 'generic',
      preset_id:
        profile.preset_id == null || String(profile.preset_id).trim().length === 0
          ? undefined
          : String(profile.preset_id),
      metric_space: String(profile.metric_space ?? 'core_v1'),
      supported_condition_types: asStringArray(profile.supported_condition_types),
      metrics_by_phase: Object.fromEntries(
        Object.entries((profile.metrics_by_phase ?? {}) as Record<string, unknown>).map(
          ([phaseId, metrics]) => [phaseId, asStringArray(metrics)]
        )
      ),
      available_metric_ids: asStringArray(profile.available_metric_ids),
      metric_catalog_ref:
        profile.metric_catalog_ref == null ? undefined : String(profile.metric_catalog_ref),
    } satisfies ProfileCapability
    profiles[profileId] = profileCapability
  })

  return {
    version: Number(input.version ?? 1),
    default_profile_id:
      input.default_profile_id == null ? undefined : String(input.default_profile_id),
    profiles,
    plugins,
  }
}

export const pluginCapabilities: PluginCapabilities = parseCapabilities(rawCapabilities)

export const listProfileOptions = (): ProfileOption[] =>
  Object.values(pluginCapabilities.profiles)
    .map((profile) => ({
      id: profile.id,
      type: profile.type,
      preset_id: profile.preset_id ?? undefined,
      plugin: profile.plugin,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))

export const getProfileCapability = (profileId: string): PluginCapability | null => {
  const id = profileId.trim()
  if (id.length > 0) {
    const profile = pluginCapabilities.profiles[id]
    if (profile) {
      return {
        supported_condition_types: profile.supported_condition_types,
        metrics_by_phase: profile.metrics_by_phase,
        all_metrics: profile.available_metric_ids,
      }
    }
  }
  const defaultProfileId = pluginCapabilities.default_profile_id
  if (defaultProfileId && pluginCapabilities.profiles[defaultProfileId]) {
    const profile = pluginCapabilities.profiles[defaultProfileId]
    return {
      supported_condition_types: profile.supported_condition_types,
      metrics_by_phase: profile.metrics_by_phase,
      all_metrics: profile.available_metric_ids,
    }
  }
  return null
}

export const getPluginCapability = (sport: string): PluginCapability | null =>
  pluginCapabilities.plugins[sport] ?? null

export const getSupportedConditionTypes = (sport: string): string[] =>
  getPluginCapability(sport)?.supported_condition_types ?? []

export const getSupportedMetricsByPhase = (sport: string): Record<string, string[]> =>
  getPluginCapability(sport)?.metrics_by_phase ?? {}

export const getSupportedMetrics = (sport: string): string[] =>
  getPluginCapability(sport)?.all_metrics ?? []
