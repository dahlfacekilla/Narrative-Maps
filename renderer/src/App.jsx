/**
 * App — root component for the Narrative Structures renderer v2.
 *
 * Architecture:
 *   - Left: SwimlanePanel (sticky, stays fixed during horizontal scroll)
 *   - Right: TimelineCanvas (SVG, scrollable in both axes)
 *
 * The outer div scrolls both axes; the left panel uses position:sticky left:0
 * so it stays visible during horizontal scroll while scrolling vertically
 * in sync with the canvas.
 */

import { useState, useMemo } from 'react'
import { useInvestigation } from './hooks/useInvestigation.js'
import { computeLayout, SCALE_MODES } from './layout/index.js'
import { SwimlanePanel } from './components/SwimlanePanel.jsx'
import { TimelineCanvas } from './components/TimelineCanvas.jsx'
import { LEFT_PANEL_WIDTH, CANVAS_X_PADDING } from './constants.js'

// ─── Toolbar ──────────────────────────────────────────────────────────────────

const SCALE_LABELS = {
  [SCALE_MODES.COMPRESSED]:   'Compressed',
  [SCALE_MODES.PROPORTIONAL]: 'Proportional',
  [SCALE_MODES.UNIFORM]:      'Uniform',
}

const SCALE_ORDER = [SCALE_MODES.COMPRESSED, SCALE_MODES.PROPORTIONAL, SCALE_MODES.UNIFORM]

function Toolbar({ scaleMode, onScaleModeChange, investigationLabel }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: LEFT_PANEL_WIDTH + 16,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(13,13,13,0.92)',
        border: '1px solid #1e1e1e',
        borderRadius: 4,
        padding: '8px 14px',
        fontFamily: 'monospace',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Investigation title */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: '0.12em', color: '#ccc' }}>
          {investigationLabel?.toUpperCase() ?? 'NARRATIVE STRUCTURES'}
        </div>
        <div style={{ fontSize: 8, color: '#444', letterSpacing: '0.08em', marginTop: 1 }}>
          Narrative Structures
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#222' }} />

      {/* Scale mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 8, color: '#444', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Scale
        </span>
        {SCALE_ORDER.map(mode => (
          <button
            key={mode}
            onClick={() => onScaleModeChange(mode)}
            style={{
              padding: '3px 8px',
              fontSize: 8.5,
              fontFamily: 'monospace',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              background: mode === scaleMode ? '#1e2a3a' : 'transparent',
              color: mode === scaleMode ? '#6aaaf5' : '#555',
              border: `1px solid ${mode === scaleMode ? '#4a90d944' : '#2a2a2a'}`,
              borderRadius: 2,
            }}
          >
            {SCALE_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { data } = useInvestigation()
  const [scaleMode, setScaleMode] = useState(null) // null = auto-detect
  const [selectedEventId, setSelectedEventId] = useState(null)

  const layout = useMemo(
    () => computeLayout(data, scaleMode ? { scaleMode } : {}),
    [data, scaleMode]
  )

  const resolvedScaleMode = layout.scaleMode

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0d0d0d',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Toolbar
        scaleMode={resolvedScaleMode}
        onScaleModeChange={setScaleMode}
        investigationLabel={data.manifest?.label}
      />

      {/* Scrollable container — both axes */}
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'auto',
          display: 'flex',
        }}
      >
        {/* Sticky left panel — stays at left:0 during horizontal scroll */}
        <div
          style={{
            width: LEFT_PANEL_WIDTH,
            flexShrink: 0,
            position: 'sticky',
            left: 0,
            zIndex: 20,
            background: '#0d0d0d',
            borderRight: '1px solid #1a1a1a',
          }}
        >
          <SwimlanePanel
            rows={layout.rows}
            groupBands={layout.groupBands}
            canvasHeight={layout.canvasHeight}
          />
        </div>

        {/* Timeline SVG canvas */}
        <div style={{ flexShrink: 0 }}>
          <TimelineCanvas
            layout={layout}
            events={data.events}
            relationships={data.relationships}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />
        </div>
      </div>
    </div>
  )
}
