/**
 * TimelineCanvas — the scrollable SVG canvas rendering the event-driven timeline.
 *
 * Renders (in z-order):
 *  1. Swimlane background bands
 *  2. Chapter header bars
 *  3. Axis ticks
 *  4. Event markers (date + label above the rows)
 *  5. Span relationships (event_id: null, drawn as thin horizontal lines)
 *  6. Relationship arcs (bezier curves within event zones)
 *  7. Entity icons (circles with initials at event-row intersections)
 */

import { useMemo } from 'react'
import {
  CANVAS_X_PADDING,
  CHAPTER_HEADER_HEIGHT,
  RELATIONSHIP_COLORS,
  CONFIDENCE_DASH,
  ENTITY_ICON_SIZE,
  ENTITY_ICON_RING,
  ARC_STROKE_WIDTH,
  Z_SWIMLANE_BG,
  Z_CHAPTER_BAR,
  Z_AXIS_TICK,
  Z_EVENT_MARKER,
  Z_ARC_EDGE,
  Z_ENTITY_ICON,
} from '../constants.js'
import { formatDateLabel } from '../layout/timeAxis.js'
import { HEADER_HEIGHT } from '../layout/swimlanes.js'

// ─── Arc path builder ─────────────────────────────────────────────────────────

/**
 * Build an SVG path string for a relationship connector.
 *
 * Directed relationships get a rightward-bowing C-curve (PRD §5.5.1).
 * Undirected get a straight line (PRD §5.5.2).
 *
 * @param {number} x1 - from-entity center X
 * @param {number} y1 - from-entity center Y
 * @param {number} x2 - to-entity center X
 * @param {number} y2 - to-entity center Y
 * @param {boolean} isDirected
 * @returns {string}
 */
function arcPath(x1, y1, x2, y2, isDirected) {
  const dy = y2 - y1
  const dx = x2 - x1

  // Same row or undirected: straight line
  if (!isDirected || (Math.abs(dy) < 8 && Math.abs(dx) < 8)) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  if (Math.abs(dy) < 8) {
    // Nearly horizontal directed (same swimlane row)
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  // Rightward-bowing cubic Bézier.
  // Both control points are pushed to the right of the midpoint.
  // The bow scales with vertical distance (PRD §5.5.5).
  const bow = Math.min(40, Math.abs(dy) * 0.18) + 14
  const midX = (x1 + x2) / 2

  const cx1 = midX + bow
  const cy1 = y1
  const cx2 = midX + bow
  const cy2 = y2

  return `M ${x1} ${y1} C ${cx1} ${cy1} ${cx2} ${cy2} ${x2} ${y2}`
}

// ─── Initials helper ──────────────────────────────────────────────────────────

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
      {/* Fallback for unknown types */}
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
  selectedEventId,
  onSelectEvent,
}) {
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

  // Build entity row lookup (entityId → row)
  const rowByEntityId = useMemo(() => {
    const map = new Map()
    for (const row of rows) map.set(row.entityId, row)
    return map
  }, [rows])

  // SVG total width: canvas content + left padding
  const svgWidth = canvasWidth + CANVAS_X_PADDING

  // Separate span relationships (no event_id) from event-scoped relationships
  const { eventRels, spanRels } = useMemo(() => {
    const ev = []
    const sp = []
    for (const r of relationships) {
      if (r.event_id) ev.push(r)
      else if (r.span) sp.push(r)
    }
    return { eventRels: ev, spanRels: sp }
  }, [relationships])

  return (
    <svg
      width={svgWidth}
      height={canvasHeight}
      style={{ display: 'block', cursor: 'default', userSelect: 'none' }}
    >
      <ArrowMarkers />

      {/* ── All positioned content offset by CANVAS_X_PADDING ── */}
      <g transform={`translate(${CANVAS_X_PADDING}, 0)`}>

        {/* 1. Swimlane background bands */}
        <g style={{ zIndex: Z_SWIMLANE_BG }}>
          {[...groupBands.values()].map(band => (
            <rect
              key={band.affiliationId}
              x={0}
              y={band.yStart}
              width={canvasWidth}
              height={band.yEnd - band.yStart}
              fill={`${band.color}12`}
            />
          ))}
          {/* Subtle horizontal separator between affiliation groups */}
          {[...groupBands.values()].map(band => (
            <line
              key={`sep-${band.affiliationId}`}
              x1={0}
              y1={band.yStart}
              x2={canvasWidth}
              y2={band.yStart}
              stroke={`${band.color}28`}
              strokeWidth={1}
            />
          ))}
        </g>

        {/* 2. Chapter header bars */}
        <g style={{ zIndex: Z_CHAPTER_BAR }}>
          {[...chapterBounds.values()].map(ch => (
            <g key={ch.chapterId}>
              <rect
                x={ch.x}
                y={0}
                width={ch.width}
                height={CHAPTER_HEADER_HEIGHT}
                fill={`${ch.color}28`}
              />
              {/* Left accent border */}
              <rect
                x={ch.x}
                y={0}
                width={3}
                height={CHAPTER_HEADER_HEIGHT}
                fill={ch.color}
              />
              {/* Chapter label */}
              <text
                x={ch.x + 10}
                y={CHAPTER_HEADER_HEIGHT - 10}
                fill={ch.color}
                fontSize={10}
                fontFamily="monospace"
                fontWeight="bold"
                letterSpacing="0.06em"
                opacity={0.85}
              >
                {ch.label.toUpperCase()}
              </text>
            </g>
          ))}
        </g>

        {/* 3. Axis ticks (faint vertical guides) */}
        <g style={{ zIndex: Z_AXIS_TICK }}>
          {axisTicks.map(tick => (
            <g key={tick.label}>
              <line
                x1={tick.x}
                y1={CHAPTER_HEADER_HEIGHT}
                x2={tick.x}
                y2={canvasHeight}
                stroke="#ffffff"
                strokeWidth={1}
                opacity={0.04}
              />
              <text
                x={tick.x}
                y={canvasHeight - 6}
                fill="#2e2e2e"
                fontSize={8.5}
                fontFamily="monospace"
                textAnchor="middle"
                letterSpacing="0.06em"
              >
                {tick.label}
              </text>
            </g>
          ))}
        </g>

        {/* 4. Event markers */}
        <g style={{ zIndex: Z_EVENT_MARKER }}>
          {events.map(event => {
            const zone = eventZones.get(event.id)
            if (!zone) return null
            const isSelected = event.id === selectedEventId
            const markerColor = isSelected ? '#fff' : '#555'
            const labelColor = isSelected ? '#ccc' : '#3a3a3a'

            return (
              <g
                key={`marker-${event.id}`}
                onClick={() => onSelectEvent(isSelected ? null : event.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Highlight background for selected event */}
                {isSelected && (
                  <rect
                    x={zone.x - 4}
                    y={0}
                    width={zone.width + 8}
                    height={HEADER_HEIGHT}
                    fill="#ffffff08"
                    rx={2}
                  />
                )}
                {/* Date label */}
                <text
                  x={zone.centerX}
                  y={CHAPTER_HEADER_HEIGHT + 13}
                  fill={markerColor}
                  fontSize={8}
                  fontFamily="monospace"
                  textAnchor="middle"
                  letterSpacing="0.06em"
                  opacity={0.7}
                >
                  {formatDateLabel(event.date)}
                </text>
                {/* Event name */}
                <text
                  x={zone.centerX}
                  y={CHAPTER_HEADER_HEIGHT + 25}
                  fill={labelColor}
                  fontSize={7.5}
                  fontFamily="monospace"
                  textAnchor="middle"
                  letterSpacing="0.03em"
                >
                  {truncate(event.label, 22)}
                </text>
                {/* Tick mark dropping to row area */}
                <line
                  x1={zone.centerX}
                  y1={CHAPTER_HEADER_HEIGHT + 30}
                  x2={zone.centerX}
                  y2={HEADER_HEIGHT - 2}
                  stroke={markerColor}
                  strokeWidth={1}
                  opacity={0.3}
                />
              </g>
            )
          })}
        </g>

        {/* 5. Span relationships — implemented in Task #4 */}
        {spanRels.length > 0 && null}

        {/* 6. Relationship arcs */}
        <g style={{ zIndex: Z_ARC_EDGE }}>
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
            const markerId = RELATIONSHIP_COLORS[rel.type]
              ? `arrow-${rel.type}`
              : 'arrow-default'

            // Dim arcs not in the selected event (when an event is selected)
            const dimmed = selectedEventId && rel.event_id !== selectedEventId

            return (
              <path
                key={rel.id}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={ARC_STROKE_WIDTH}
                strokeDasharray={dashArray}
                opacity={dimmed ? 0.12 : 0.75}
                markerEnd={isDirected ? `url(#${markerId})` : undefined}
              />
            )
          })}
        </g>

        {/* 7. Entity icons */}
        <g style={{ zIndex: Z_ENTITY_ICON }}>
          {events.map(event => {
            const zone = eventZones.get(event.id)
            if (!zone) return null
            const slots = entitySlots.get(event.id)
            const participants = eventParticipants.get(event.id) ?? new Set()

            // Dim icons not in the selected event
            const dimmed = selectedEventId && event.id !== selectedEventId

            return [...participants].map(entityId => {
              const row = rowByEntityId.get(entityId)
              if (!row) return null

              const slot = slots?.get(entityId) ?? { xOffset: 0 }
              const cx = zone.centerX + slot.xOffset
              const cy = row.centerY
              const r = ENTITY_ICON_SIZE / 2
              const color = row.affiliation.color
              const label = initials(row.entity.label)

              return (
                <g
                  key={`icon-${event.id}-${entityId}`}
                  opacity={dimmed ? 0.15 : 1}
                >
                  {/* Icon background */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="#0d0d0d"
                    stroke={color}
                    strokeWidth={ENTITY_ICON_RING}
                  />
                  {/* Initials */}
                  <text
                    x={cx}
                    y={cy + 3.5}
                    textAnchor="middle"
                    fill={color}
                    fontSize={8}
                    fontFamily="monospace"
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
