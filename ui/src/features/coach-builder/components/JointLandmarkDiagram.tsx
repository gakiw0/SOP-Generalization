import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OPENPOSE25_BONES, OPENPOSE25_POINTS } from '../openpose25'

type JointLandmarkDiagramProps = {
  selectedJointIds?: number[]
  titleKey: string
  helpKey: string
  defaultExpanded?: boolean
  maxSelectable?: number
  onSelectionChange?: (nextJointIds: number[]) => void
  dataTestId?: string
  toggleTestId?: string
}

export function JointLandmarkDiagram({
  selectedJointIds = [],
  titleKey,
  helpKey,
  defaultExpanded = true,
  maxSelectable,
  onSelectionChange,
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
  const interactive = typeof onSelectionChange === 'function'
  const selectionCount = selectedJointIds.length

  const handleToggleJoint = (jointId: number) => {
    if (!onSelectionChange) return
    const nextIds = [...selectedJointIds]
    const currentIndex = nextIds.indexOf(jointId)

    if (currentIndex >= 0) {
      nextIds.splice(currentIndex, 1)
      onSelectionChange(nextIds.sort((a, b) => a - b))
      return
    }

    if (maxSelectable != null && nextIds.length >= maxSelectable) return
    nextIds.push(jointId)
    onSelectionChange(nextIds.sort((a, b) => a - b))
  }

  const handleKeyToggle = (event: React.KeyboardEvent<SVGGElement | HTMLLIElement>, jointId: number) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handleToggleJoint(jointId)
  }

  return (
    <section className="cb-joint-diagram" data-testid={dataTestId}>
      <div className="cb-joint-diagram-header">
        <div>
          <h3>{t(titleKey)}</h3>
          <p>{t(helpKey)}</p>
          {interactive ? (
            <p className="cb-joint-diagram-note">
              {maxSelectable != null
                ? t('jointDiagram.interactiveMaxHint', { count: maxSelectable })
                : t('jointDiagram.interactiveHint')}
            </p>
          ) : null}
        </div>
        <div className="cb-joint-diagram-actions">
          {interactive ? (
            <span className="cb-joint-diagram-status">
              {selectionCount}
              {maxSelectable != null ? ` / ${maxSelectable}` : ''}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            data-testid={toggleTestId}
          >
            {expanded ? t('jointDiagram.hide') : t('jointDiagram.show')}
          </button>
        </div>
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
                  className={`${selected ? 'cb-joint-point is-selected' : 'cb-joint-point'}${interactive ? ' is-clickable' : ''}`}
                  data-point-id={point.id}
                  data-selected={selected ? 'true' : 'false'}
                  role={interactive ? 'button' : undefined}
                  aria-pressed={interactive ? selected : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={() => handleToggleJoint(point.id)}
                  onKeyDown={(event) => handleKeyToggle(event, point.id)}
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
                <li
                  key={point.id}
                  className={`${selected ? 'is-selected' : ''}${interactive ? ' is-clickable' : ''}`}
                  data-point-id={point.id}
                  data-selected={selected ? 'true' : 'false'}
                  role={interactive ? 'button' : undefined}
                  aria-pressed={interactive ? selected : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={() => handleToggleJoint(point.id)}
                  onKeyDown={(event) => handleKeyToggle(event, point.id)}
                >
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
