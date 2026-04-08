/**
 * TimelineCanvas — the scrollable SVG canvas rendering the event-driven timeline.
 *
 * Renders (in z-order):
 *  1. Swimlane background bands
 *  2. Chapter header bars
 *  3. Axis ticks
 *  4. Event markers (date + label above the rows)
 *  5. Span relationships (event_id: null — stubbed for later)
 *  6. Relationship arcs (bezier curves within event zones)
 *  7. Entity icons (circles with initials at event-row intersections)
 *
 * Zoom is applied via SVG attribute scaling + internal <g transform="scale">.
 * Focus mode dims non-focused events; event/entity selection dims non-selected events.
 */

import { useMemo } from 'react'
import { useTheme } from '../ThemeContext.jsx'
import {
  CANVAS_X_PADDING,
  CHAPTER_HEADER_HEIGHT,
  RELATIONSHIP_COLORS,
  CONFIDENCE_DASH,
  ENTITY_ICON_SIZE,
  ENTITY_ICON_RING,
  ARC_STROKE_WIDTH,
  OPACITY_DIMMED,
} from '../constants.js'
import { formatDateLabel } from '../layout/timeAxis.js'
import { HEADER_HEIGHT } from '../layout/swimlanes.js'

// ─── Arc path builder ─────────────────────────────────────────────────────────

/**
 * Build an SVG path string for a relationship connector.
 * Directed: rightward-bowing C-curve (PRD §5.5.1).
 * Undirected: straight line (PRD §5.5.2).
 */
function arcPath(x1, y1, x2, y2, isDirected) {
  const dy = y2 - y1

  if (!isDirected || Math.abs(dy) < 8) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  // Rightward-bowing cubic Bézier (PRD §5.5.1, §5.5.5)
  const bow = Math.min(40, Math.abs(dy) * 0.18) + 14
  const midX = (x1 + x2) / 2

  return `M ${x1} ${y1} C ${midX + bow} ${y1} ${midX + bow} ${y2} ${x2} ${y2}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(label) {
  return label
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function truncate(str, maxLen) {
  if (!str) return ''
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str
}

// ─── SVG Defs: arrowhead markers ──────────────────────────────────────────────

function ArrowMarkers() {
  return (
    <defs>
      {Object.entries(RELATIONSHIP_COLORS).map(([type, color]) => (
        <marker
          key={type}
          id={`arrow-${type}`}
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 8 3.5, 0 7" fill={color} opacity="0.85" />
        </marker>
      ))}
      <marker id="arrow-default" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
        <polygon points="0 0, 8 3.5, 0 7" fill="#888" opacity="0.7" />
      </marker>
    </defs>
  )
}

// ─── TimelineCanvas ───────────────────────────────────────────────────────────

export function TimelineCanvas({
  layout,
  events,
  relationships,
  zoom,
  selectedEventId,
  selectedEntityId,
  onSelectEvent,
  onSelectEntity,
  focusMode,
  focusedEventId,
  fontFamily,
}) {
  const { theme } = useTheme()
  const {
    rows,
    groupBands,
    eventZones,
    chapterBounds,
    entitySlots,
    eventParticipants,
    canvasWidth,
    canvasHeight,
    axisTicks,
  } = layout

  const rowByEntityId = useMemo(() => {
    const map = new Map()
    for (const row of rows) map.set(row.entityId, row)
    return map
  }, [rows])

  const { eventRels, spanRels } = useMemo(() => {
    const ev = []
    const sp = []
    for (const r of relationships) {
      if (r.event_id) ev.push(r)
      else if (r.span) sp.push(r)
    }
    return { eventRels: ev, spanRels: sp }
  }, [relationships])

  // Participants in the focused event (for focus mode dimming)
  const focusedParticipants = useMemo(() => {
    if (!focusMode || !focusedEventId) return null
    return eventParticipants.get(focusedEventId) ?? new Set()
  }, [focusMode, focusedEventId, eventParticipants])

  // Determine opacity for a given eventId
  const eventOpacity = (eventId) => {
    if (focusMode && focusedEventId) {
      return eventId === focusedEventId ? 1 : OPACITY_DIMMED
    }
    if (!focusMode && selectedEventId) {
      return eventId === selectedEventId ? 1 : OPACITY_DIMMED
    }
    return 1
  }

  const svgWidth = canvasWidth + CANVAS_X_PADDING

  return (
    <svg
      width={svgWidth * zoom}
      height={canvasHeight * zoom}
      style={{ display: 'block' }}
    >
      <ArrowMarkers />

      {/* Scale all content by zoom */}
      <g transform={`scale(${zoom})`}>

        {/* Offset all positioned content by CANVAS_X_PADDING */}
        <g transform={`translate(${CANVAS_X_PADDING}, 0)`}>

          {/* 1. Swimlane background bands */}
          {[...groupBands.values()].map(band => (
            <g key={band.affiliationId}>
              <rect
                x={0}
                y={band.yStart}
                width={canvasWidth}
                height={band.yEnd - band.yStart}
                fill={`${band.color}12`}
              />
              <line
                x1={0} y1={band.yStart}
                x2={canvasWidth} y2={band.yStart}
                stroke={`${band.color}28`}
                strokeWidth={1}
              />
            </g>
          ))}

          {/* 2. Chapter header bars */}
          {[...chapterBounds.values()].map(ch => (
            <g key={ch.chapterId}>
              <rect
                x={ch.x} y={0}
                width={ch.width} height={CHAPTER_HEADER_HEIGHT}
                fill={`${ch.color}28`}
              />
              <rect x={ch.x} y={0} width={3} height={CHAPTER_HEADER_HEIGHT} fill={ch.color} />
              <text
                x={ch.x + 10} y={CHAPTER_HEADER_HEIGHT - 10}
                fill={ch.color} fontSize={10} fontFamily={fontFamily ?? 'Barlow, sans-serif'}
                fontWeight="bold" letterSpacing="0.06em" opacity={0.85}
              >
                {ch.label.toUpperCase()}
              </text>
            </g>
          ))}

          {/* 3. Axis ticks */}
          {axisTicks.map(tick => (
            <g key={tick.label}>
              <line
                x1={tick.x} y1={CHAPTER_HEADER_HEIGHT}
                x2={tick.x} y2={canvasHeight}
                stroke="#ffffff" strokeWidth={1} opacity={0.04}
              />
              <text
                x={tick.x} y={canvasHeight - 6}
                fill="#2e2e2e" fontSize={8.5} fontFamily={fontFamily ?? 'Barlow, sans-serif'}
                textAnchor="middle" letterSpacing="0.06em"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* 4. Event markers */}
          {events.map(event => {
            const zone = eventZones.get(event.id)
            if (!zone) return null

            const isFocused = focusMode && event.id === focusedEventId
            const isSelected = !focusMode && event.id === selectedEventId
            const highlight = isFocused || isSelected
            const markerColor = highlight ? '#fff' : '#555'
            const labelColor = highlight ? '#ccc' : '#3a3a3a'

            return (
              <g
                key={`marker-${event.id}`}
                onClick={() => onSelectEvent(highlight ? null : event.id)}
                style={{ cursor: 'pointer' }}
              >
                {highlight && (
                  <rect
                    x={zone.x - 4} y={0}
                    width={zone.width + 8} height={HEADER_HEIGHT}
                    fill="#ffffff08" rx={2}
                  />
                )}
                <text
                  x={zone.centerX} y={CHAPTER_HEADER_HEIGHT + 13}
                  fill={markerColor} fontSize={8} fontFamily={fontFamily ?? 'Barlow, sans-serif'}
                  textAnchor="middle" letterSpacing="0.06em" opacity={0.7}
                >
                  {formatDateLabel(event.date)}
                </text>
                <text
                  x={zone.centerX} y={CHAPTER_HEADER_HEIGHT + 25}
                  fill={labelColor} fontSize={7.5} fontFamily={fontFamily ?? 'Barlow, sans-serif'}
                  textAnchor="middle" letterSpacing="0.03em"
                >
                  {truncate(event.label, 22)}
                </text>
                <line
                  x1={zone.centerX} y1={CHAPTER_HEADER_HEIGHT + 30}
                  x2={zone.centerX} y2={HEADER_HEIGHT - 2}
                  stroke={markerColor} strokeWidth={1} opacity={0.3}
                />
              </g>
            )
          })}

          {/* 5. Span relationships — implemented in Task #5+ */}
          {spanRels.length > 0 && null}

          {/* 6. Relationship arcs */}
          {eventRels.map(rel => {
            const zone = eventZones.get(rel.event_id)
            if (!zone) return null

            const slots = entitySlots.get(rel.event_id)
            const fromRow = rowByEntityId.get(rel.from)
            const toRow = rowByEntityId.get(rel.to)
            if (!fromRow || !toRow) return null

            const fromSlot = slots?.get(rel.from) ?? { xOffset: 0 }
            const toSlot = slots?.get(rel.to) ?? { xOffset: 0 }

            const x1 = zone.centerX + fromSlot.xOffset
            const y1 = fromRow.centerY
            const x2 = zone.centerX + toSlot.xOffset
            const y2 = toRow.centerY

            const color = RELATIONSHIP_COLORS[rel.type] ?? '#888'
            const dashArray = CONFIDENCE_DASH[rel.confidence] ?? null
            const isDirected = rel.direction === 'directed'
            const d = arcPath(x1, y1, x2, y2, isDirected)
            const markerId = RELATIONSHIP_COLORS[rel.type] ? `arrow-${rel.type}` : 'arrow-default'
            const opacity = eventOpacity(rel.event_id) * 0.75

            return (
              <path
                key={rel.id}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={ARC_STROKE_WIDTH}
                strokeDasharray={dashArray}
                opacity={opacity}
                markerEnd={isDirected ? `url(#${markerId})` : undefined}
              />
            )
          })}

          {/* 7. Entity icons */}
          {events.map(event => {
            const zone = eventZones.get(event.id)
            if (!zone) return null
            const slots = entitySlots.get(event.id)
            const participants = eventParticipants.get(event.id) ?? new Set()
            const evOpacity = eventOpacity(event.id)

            return [...participants].map(entityId => {
              const row = rowByEntityId.get(entityId)
              if (!row) return null

              const slot = slots?.get(entityId) ?? { xOffset: 0 }
              const cx = zone.centerX + slot.xOffset
              const cy = row.centerY
              const r = ENTITY_ICON_SIZE / 2
              const color = row.affiliation.color
              const label = initials(row.entity.label)

              // Extra dim for non-participants in focus mode
              let iconOpacity = evOpacity
              if (focusMode && focusedParticipants && !focusedParticipants.has(entityId)) {
                iconOpacity = Math.min(iconOpacity, 0.10)
              }
              // Dim entity if a different entity is selected
              if (!focusMode && selectedEntityId && entityId !== selectedEntityId) {
                iconOpacity = Math.min(iconOpacity, 0.35)
              }

              const isSelected = !focusMode && entityId === selectedEntityId

              return (
                <g
                  key={`icon-${event.id}-${entityId}`}
                  opacity={iconOpacity}
                  onClick={() => onSelectEntity?.(entityId)}
                  style={{ cursor: onSelectEntity ? 'pointer' : 'default' }}
                >
                  <circle
                    cx={cx} cy={cy} r={r}
                    fill={theme.bgApp}
                    stroke={color}
                    strokeWidth={isSelected ? ENTITY_ICON_RING * 2 : ENTITY_ICON_RING}
                  />
                  <text
                    x={cx} y={cy + 3.5}
                    textAnchor="middle"
                    fill={color}
                    fontSize={8}
                    fontFamily={fontFamily ?? 'Barlow, sans-serif'}
                    fontWeight="bold"
                    letterSpacing="0.04em"
                  >
                    {label}
                  </text>
                </g>
              )
            })
          })}

        </g>
      </g>
    </svg>
  )
}
