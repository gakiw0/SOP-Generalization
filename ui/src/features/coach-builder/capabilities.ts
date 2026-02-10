import rawCapabilities from '../../generated/pluginCapabilities.json'

export type PluginCapability = {
  supported_condition_types: string[]
  metrics_by_phase: Record<string, string[]>
  all_metrics: string[]
}

export type PluginCapabilities = {
  version: number
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
  const plugins: Record<string, PluginCapability> = {}

  Object.entries(pluginsInput).forEach(([pluginName, capability]) => {
    plugins[pluginName] = parseCapability(capability)
  })

  return {
    version: Number(input.version ?? 1),
    plugins,
  }
}

export const pluginCapabilities: PluginCapabilities = parseCapabilities(rawCapabilities)

export const getPluginCapability = (sport: string): PluginCapability | null =>
  pluginCapabilities.plugins[sport] ?? null

export const getSupportedConditionTypes = (sport: string): string[] =>
  getPluginCapability(sport)?.supported_condition_types ?? []

export const getSupportedMetricsByPhase = (sport: string): Record<string, string[]> =>
  getPluginCapability(sport)?.metrics_by_phase ?? {}

export const getSupportedMetrics = (sport: string): string[] =>
  getPluginCapability(sport)?.all_metrics ?? []
