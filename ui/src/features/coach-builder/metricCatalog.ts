import rawMetricCatalog from '../../generated/coreMetricCatalog.json'

export type MetricCatalogEntry = {
  id: string
  label: string
  description?: string
  unit?: string
  value_kind?: 'scalar' | 'series' | string
}

type MetricCatalog = {
  version: number
  metric_space: string
  metrics: MetricCatalogEntry[]
}

const parseMetricCatalog = (value: unknown): MetricCatalog => {
  const input = (value ?? {}) as Record<string, unknown>
  const metricsInput = Array.isArray(input.metrics) ? input.metrics : []
  return {
    version: Number(input.version ?? 1),
    metric_space: String(input.metric_space ?? 'core_v1'),
    metrics: metricsInput.map((metric) => {
      const item = (metric ?? {}) as Record<string, unknown>
      return {
        id: String(item.id ?? ''),
        label: String(item.label ?? ''),
        description:
          item.description == null || String(item.description).trim().length === 0
            ? undefined
            : String(item.description),
        unit:
          item.unit == null || String(item.unit).trim().length === 0
            ? undefined
            : String(item.unit),
        value_kind:
          item.value_kind == null || String(item.value_kind).trim().length === 0
            ? undefined
            : String(item.value_kind),
      }
    }),
  }
}

export const metricCatalog = parseMetricCatalog(rawMetricCatalog)

const metricEntryById = new Map(metricCatalog.metrics.map((metric) => [metric.id, metric]))

export const getMetricCatalogEntry = (metricId: string): MetricCatalogEntry | null =>
  metricEntryById.get(metricId) ?? null

