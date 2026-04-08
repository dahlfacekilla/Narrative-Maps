/**
 * Legend — collapsible popover anchored to the top bar (PRD §5.11).
 * Opens downward from a "Legend" button. Self-contained open/close state.
 */

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

export function Legend({ affiliations, theme }) {
  // Fall back to hardcoded dark values if theme not yet provided
  const t = theme ?? {
    bgPanel: '#111', borderSoft: '#2a2a2a', borderMid: '#222',
    textMuted: '#888', textDim: '#666', textGhost: '#444',
    bgSubtle: '#1e2a3a', accent: '#6aaaf5', accentBorder: '#4a90d944',
    textVeryDim: '#555',
  }
  const [open, setOpen] = useState(false)
  const [buttonRect, setButtonRect] = useState(null)
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)

  function handleToggle() {
    if (!open && buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect())
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  const popover = open && buttonRect && createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: buttonRect.bottom + 6,
        right: window.innerWidth - buttonRect.right,
        zIndex: 1000,
        background: t.bgPanel,
        border: `1px solid ${t.borderSoft}`,
        borderRadius: 4,
        padding: '12px 14px',
        color: t.textMuted,
        fontSize: 9,
        width: 520,
        display: 'flex',
        gap: 20,
      }}
    >
      {/* Affiliations */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 7.5, color: t.textGhost, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
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

      <div style={{ width: 1, background: t.borderMid, flexShrink: 0 }} />

      {/* Relationship types */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 7.5, color: t.textGhost, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          Relationship Types
        </div>
        {Object.entries(RELATIONSHIP_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <LineSwatch color={color} />
            <span style={{ color: t.textDim, fontSize: 8.5, textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
      </div>

      <div style={{ width: 1, background: t.borderMid, flexShrink: 0 }} />

      {/* Confidence */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 7.5, color: t.textGhost, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          Confidence
        </div>
        {Object.entries(CONFIDENCE_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <LineSwatch color={CONFIDENCE_COLOR[key]} dashArray={CONFIDENCE_DASH[key]} />
            <span style={{ color: t.textDim, fontSize: 8.5 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        style={{
          padding: '3px 10px',
          fontSize: 8.5,
          letterSpacing: '0.06em',
          cursor: 'pointer',
          background: open ? t.bgSubtle : 'transparent',
          color: open ? t.accent : t.textVeryDim,
          border: `1px solid ${open ? t.accentBorder : t.borderSoft}`,
          borderRadius: 2,
        }}
      >
        Legend {open ? '▲' : '▼'}
      </button>
      {popover}
    </div>
  )
}
