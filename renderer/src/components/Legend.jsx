/**
 * Legend — collapsible popover anchored to the top bar (PRD §5.11).
 * Opens downward from a "Legend" button. Self-contained open/close state.
 */

import { useState } from 'react'
import { RELATIONSHIP_COLORS, CONFIDENCE_DASH, CONFIDENCE_COLOR } from '../constants.js'

const CONFIDENCE_LABELS = {
  verified: 'Verified',
  reported: 'Reported',
  alleged:  'Alleged',
  inferred: 'Inferred',
}

// Inline SVG swatch for a relationship type line
function LineSwatch({ color, dashArray }) {
  return (
    <svg width={28} height={12} style={{ flexShrink: 0, overflow: 'visible' }}>
      <line
        x1={2} y1={6} x2={26} y2={6}
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={dashArray ?? undefined}
        opacity={0.85}
      />
    </svg>
  )
}

export function Legend({ affiliations }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '3px 10px',
          fontSize: 8.5,
          fontFamily: 'monospace',
          letterSpacing: '0.06em',
          cursor: 'pointer',
          background: open ? '#1e2a3a' : 'transparent',
          color: open ? '#6aaaf5' : '#555',
          border: `1px solid ${open ? '#4a90d944' : '#2a2a2a'}`,
          borderRadius: 2,
        }}
      >
        Legend {open ? '▲' : '▼'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 300,
            background: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: 4,
            padding: '12px 14px',
            fontFamily: 'monospace',
            color: '#888',
            fontSize: 9,
            width: 520,
            display: 'flex',
            gap: 20,
          }}
        >
          {/* Affiliations */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 7.5, color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
              Affiliations
            </div>
            {(affiliations ?? []).map(aff => (
              <div key={aff.id} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <div
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: aff.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: aff.color, fontSize: 8.5 }}>{aff.label}</span>
              </div>
            ))}
          </div>

          <div style={{ width: 1, background: '#222', flexShrink: 0 }} />

          {/* Relationship types */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 7.5, color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
              Relationship Types
            </div>
            {Object.entries(RELATIONSHIP_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <LineSwatch color={color} />
                <span style={{ color: '#666', fontSize: 8.5, textTransform: 'capitalize' }}>{type}</span>
              </div>
            ))}
          </div>

          <div style={{ width: 1, background: '#222', flexShrink: 0 }} />

          {/* Confidence */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 7.5, color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
              Confidence
            </div>
            {Object.entries(CONFIDENCE_LABELS).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <LineSwatch color={CONFIDENCE_COLOR[key]} dashArray={CONFIDENCE_DASH[key]} />
                <span style={{ color: '#666', fontSize: 8.5 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
