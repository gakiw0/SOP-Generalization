import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OPENPOSE25_BONES, OPENPOSE25_POINTS } from '../openpose25'

type JointLandmarkDiagramProps = {
  selectedJointIds?: number[]
  titleKey: string
  helpKey: string
  defaultExpanded?: boolean
  dataTestId?: string
  toggleTestId?: string
}

export function JointLandmarkDiagram({
  selectedJointIds = [],
  titleKey,
  helpKey,
  defaultExpanded = true,
  dataTestId,
  toggleTestId,
}: JointLandmarkDiagramProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(defaultExpanded)

  const pointsById = useMemo(
    () => new Map(OPENPOSE25_POINTS.map((point) => [point.id, point])),
    []
  )

  const selectedIds = useMemo(() => new Set(selectedJointIds), [selectedJointIds])

  return (
    <section className="cb-joint-diagram" data-testid={dataTestId}>
      <div className="cb-joint-diagram-header">
        <div>
          <h3>{t(titleKey)}</h3>
          <p>{t(helpKey)}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          data-testid={toggleTestId}
        >
          {expanded ? t('jointDiagram.hide') : t('jointDiagram.show')}
        </button>
      </div>

      {expanded ? (
        <div className="cb-joint-diagram-layout">
          <svg
            viewBox="0 0 320 360"
            role="img"
            aria-label={t('jointDiagram.svgLabel')}
            className="cb-joint-diagram-svg"
          >
            {OPENPOSE25_BONES.map(([startId, endId]) => {
              const start = pointsById.get(startId)
              const end = pointsById.get(endId)
              if (!start || !end) return null

              return (
                <line
                  key={`${startId}_${endId}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className="cb-joint-bone"
                />
              )
            })}

            {OPENPOSE25_POINTS.map((point) => {
              const selected = selectedIds.has(point.id)
              return (
                <g
                  key={point.id}
                  className={selected ? 'cb-joint-point is-selected' : 'cb-joint-point'}
                  data-point-id={point.id}
                  data-selected={selected ? 'true' : 'false'}
                >
                  <circle cx={point.x} cy={point.y} r={selected ? 7 : 5} />
                  <text x={point.x + 8} y={point.y - 8}>
                    {point.id}
                  </text>
                </g>
              )
            })}
          </svg>

          <ul className="cb-joint-legend">
            {OPENPOSE25_POINTS.map((point) => {
              const selected = selectedIds.has(point.id)
              return (
                <li key={point.id} className={selected ? 'is-selected' : ''}>
                  <span className="cb-joint-legend-id">{point.id}</span>
                  <span>{t(`openpose25.point.${point.id}`)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
