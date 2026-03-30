/**
 * SwimlanePanel — fixed left panel showing entity rows grouped by affiliation.
 *
 * Heights are derived from the layout engine (rows[].y, rows[].height) so the
 * panel rows align pixel-perfectly with the SVG swimlane bands in TimelineCanvas.
 */

import { LEFT_PANEL_WIDTH, LEFT_PANEL_ICON_SIZE } from '../constants.js'

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

// ─── EntityEntry ─────────────────────────────────────────────────────────────

function EntityEntry({ row }) {
  const { entity, affiliation, y, height } = row
  const color = affiliation.color

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: 0,
        width: LEFT_PANEL_WIDTH,
        height,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px 0 12px',
        boxSizing: 'border-box',
      }}
    >
      {/* Portrait circle / initials */}
      <div
        style={{
          width: LEFT_PANEL_ICON_SIZE,
          height: LEFT_PANEL_ICON_SIZE,
          borderRadius: '50%',
          flexShrink: 0,
          background: `${color}22`,
          border: `2px solid ${color}66`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          fontWeight: 'bold',
          color,
          fontFamily: 'monospace',
          letterSpacing: '0.04em',
          userSelect: 'none',
        }}
      >
        {initials(entity.label)}
      </div>

      {/* Name + role */}
      <div style={{ overflow: 'hidden', lineHeight: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#ccc',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '0.02em',
          }}
        >
          {entity.label}
        </div>
        {entity.role && (
          <div
            style={{
              marginTop: 2,
              fontSize: 8,
              color: '#555',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '0.02em',
            }}
          >
            {entity.role}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SwimlanePanel ────────────────────────────────────────────────────────────

export function SwimlanePanel({ rows, groupBands, canvasHeight }) {
  return (
    <div
      style={{
        width: LEFT_PANEL_WIDTH,
        height: canvasHeight,
        position: 'relative',
        background: '#0d0d0d',
        flexShrink: 0,
        fontFamily: 'monospace',
        overflow: 'hidden',
      }}
    >
      {/* Affiliation group background bands */}
      {[...groupBands.values()].map(band => (
        <div
          key={band.affiliationId}
          style={{
            position: 'absolute',
            top: band.yStart,
            left: 0,
            right: 0,
            height: band.yEnd - band.yStart,
            background: `${band.color}0e`,
            borderLeft: `2px solid ${band.color}44`,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 4,
              left: 10,
              fontSize: 7.5,
              color: band.color,
              opacity: 0.55,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              userSelect: 'none',
            }}
          >
            {band.label}
          </span>
        </div>
      ))}

      {/* Entity rows */}
      {rows.map(row => (
        <EntityEntry key={row.entityId} row={row} />
      ))}
    </div>
  )
}
