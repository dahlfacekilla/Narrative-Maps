/**
 * App — root component for Narrative Structures renderer v2.
 *
 * Layout (column flex):
 *   ┌──────────────────────────────────────────────┐  TopBar (44px)
 *   ├──────────┬───────────────────────────────────┤
 *   │ Swimlane │ TimelineCanvas (scrollable SVG)   │  scrollArea (flex:1)
 *   │ Panel    │                                   │
 *   ├──────────┴───────────────────────────────────┤
 *   │ DetailPanel (slide-up, 0 or 220px)           │
 *   └──────────────────────────────────────────────┘
 *
 * Interactions:
 *   - Ctrl+scroll → zoom toward cursor (Steps 3)
 *   - F key → toggle Focus Mode (Step 5)
 *   - Arrow keys → navigate events in Focus Mode (Step 5)
 *   - Esc → exit Focus Mode (Step 5)
 *   - Chapter tabs → scroll to chapter (Step 6)
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useInvestigation } from './hooks/useInvestigation.js'
import { computeLayout, SCALE_MODES } from './layout/index.js'
import { SwimlanePanel } from './components/SwimlanePanel.jsx'
import { TimelineCanvas } from './components/TimelineCanvas.jsx'
import { DetailPanel } from './components/DetailPanel.jsx'
import { Legend } from './components/Legend.jsx'
import { LEFT_PANEL_WIDTH, CANVAS_X_PADDING } from './constants.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const TOP_BAR_HEIGHT = 44
const ZOOM_MIN = 0.2
const ZOOM_MAX = 4.0
const ZOOM_FACTOR = 0.1  // fraction of current zoom per wheel tick

const SCALE_LABELS = {
  [SCALE_MODES.COMPRESSED]:   'Comp.',
  [SCALE_MODES.PROPORTIONAL]: 'Prop.',
  [SCALE_MODES.UNIFORM]:      'Uniform',
}

const SCALE_ORDER = [SCALE_MODES.COMPRESSED, SCALE_MODES.PROPORTIONAL, SCALE_MODES.UNIFORM]

// ─── TopBar ───────────────────────────────────────────────────────────────────

function TopBar({
  investigationLabel,
  scaleMode,
  onScaleModeChange,
  zoom,
  onFit,
  focusMode,
  onToggleFocus,
  onFocusPrev,
  onFocusNext,
  chapters,
  chapterBounds,
  activeChapterId,
  onScrollToChapter,
  affiliations,
}) {
  return (
    <div
      style={{
        height: TOP_BAR_HEIGHT,
        flexShrink: 0,
        background: '#111',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        fontFamily: 'monospace',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Title */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', letterSpacing: '0.1em', color: '#ccc' }}>
          {investigationLabel?.toUpperCase() ?? 'NARRATIVE STRUCTURES'}
        </div>
      </div>

      <Divider />

      {/* Scale mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span style={{ fontSize: 7.5, color: '#444', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Scale
        </span>
        {SCALE_ORDER.map(mode => (
          <ToolbarButton
            key={mode}
            label={SCALE_LABELS[mode]}
            active={mode === scaleMode}
            onClick={() => onScaleModeChange(mode)}
          />
        ))}
      </div>

      <Divider />

      {/* Focus mode controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <ToolbarButton label="Focus [F]" active={focusMode} onClick={onToggleFocus} />
        {focusMode && (
          <>
            <ToolbarButton label="←" onClick={onFocusPrev} />
            <ToolbarButton label="→" onClick={onFocusNext} />
          </>
        )}
      </div>

      <Divider />

      {/* Zoom controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <ToolbarButton label="Fit" onClick={onFit} />
        <span style={{ fontSize: 8, color: '#444', minWidth: 28, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <Divider />

      {/* Chapter tabs */}
      {chapters.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', flex: 1 }}>
          {[...chapters].sort((a, b) => a.order - b.order).map(ch => {
            const bounds = chapterBounds.get(ch.id)
            const isActive = ch.id === activeChapterId
            return (
              <button
                key={ch.id}
                onClick={() => onScrollToChapter(ch.id)}
                disabled={!bounds}
                style={{
                  padding: '2px 8px',
                  fontSize: 8,
                  fontFamily: 'monospace',
                  letterSpacing: '0.04em',
                  cursor: bounds ? 'pointer' : 'default',
                  background: isActive ? `${ch.color}22` : 'transparent',
                  color: isActive ? ch.color : '#555',
                  border: `1px solid ${isActive ? `${ch.color}55` : '#222'}`,
                  borderRadius: 2,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {ch.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Legend pushed to far right */}
      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <Legend affiliations={affiliations} />
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 24, background: '#222', flexShrink: 0 }} />
}

function ToolbarButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 8px',
        fontSize: 8.5,
        fontFamily: 'monospace',
        letterSpacing: '0.06em',
        cursor: 'pointer',
        background: active ? '#1e2a3a' : 'transparent',
        color: active ? '#6aaaf5' : '#555',
        border: `1px solid ${active ? '#4a90d944' : '#2a2a2a'}`,
        borderRadius: 2,
      }}
    >
      {label}
    </button>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { data } = useInvestigation()

  // ── Scale mode ───────────────────────────────────────────────────────────────
  const [scaleMode, setScaleMode] = useState(null)  // null = auto-detect

  const layout = useMemo(
    () => computeLayout(data, scaleMode ? { scaleMode } : {}),
    [data, scaleMode]
  )

  // ── Selection state ──────────────────────────────────────────────────────────
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [selectedEntityId, setSelectedEntityId] = useState(null)

  const handleSelectEvent = useCallback((eventId) => {
    setSelectedEventId(eventId)
    setSelectedEntityId(null)
  }, [])

  const handleSelectEntity = useCallback((entityId) => {
    setSelectedEntityId(prev => prev === entityId ? null : entityId)
  }, [])

  const handleDismiss = useCallback(() => {
    setSelectedEventId(null)
    setSelectedEntityId(null)
  }, [])

  // ── Zoom ─────────────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  const scrollRef = useRef(null)

  // Ctrl+scroll → zoom toward cursor (passive:false required for preventDefault)
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    function handleWheel(e) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()

      const currentZoom = zoomRef.current
      const direction = e.deltaY > 0 ? -1 : 1
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, currentZoom * (1 + direction * ZOOM_FACTOR)))

      // Zoom toward cursor: keep the content point under the mouse at the same screen position
      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const ratio = newZoom / currentZoom

      const newScrollLeft = (mouseX + container.scrollLeft - LEFT_PANEL_WIDTH) * ratio + LEFT_PANEL_WIDTH - mouseX
      const newScrollTop  = (mouseY + container.scrollTop) * ratio - mouseY

      setZoom(newZoom)
      requestAnimationFrame(() => {
        container.scrollLeft = Math.max(0, newScrollLeft)
        container.scrollTop  = Math.max(0, newScrollTop)
      })
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  const handleFit = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const svgWidth = layout.canvasWidth + CANVAS_X_PADDING
    const availWidth = container.clientWidth - LEFT_PANEL_WIDTH
    const newZoom = Math.min(1, availWidth / svgWidth)
    setZoom(newZoom)
    requestAnimationFrame(() => {
      container.scrollLeft = 0
      container.scrollTop = 0
    })
  }, [layout.canvasWidth])

  // ── Focus mode ───────────────────────────────────────────────────────────────
  const [focusMode, setFocusMode] = useState(false)
  const [focusedEventId, setFocusedEventId] = useState(null)

  // Sorted event IDs (in chronological order, matching eventZones insertion order)
  const sortedEventIds = useMemo(() => [...layout.eventZones.keys()], [layout.eventZones])

  // Toggle focus mode, initialising focusedEventId on entry
  const toggleFocusMode = useCallback(() => {
    setFocusMode(prev => {
      if (!prev) {
        // Entering focus mode: set to current or first event
        setFocusedEventId(curr => curr ?? sortedEventIds[0] ?? null)
      }
      return !prev
    })
  }, [sortedEventIds])

  // Auto-scroll to focused event
  useEffect(() => {
    if (!focusMode || !focusedEventId || !scrollRef.current) return
    const zone = layout.eventZones.get(focusedEventId)
    if (!zone) return
    const container = scrollRef.current
    const containerWidth = container.clientWidth - LEFT_PANEL_WIDTH
    const targetScrollLeft = (zone.centerX + CANVAS_X_PADDING) * zoom - containerWidth / 2
    container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' })
  }, [focusedEventId, focusMode, layout.eventZones, zoom])

  const focusPrev = useCallback(() => {
    setFocusedEventId(curr => {
      const idx = sortedEventIds.indexOf(curr)
      return sortedEventIds[Math.max(0, idx - 1)] ?? curr
    })
  }, [sortedEventIds])

  const focusNext = useCallback(() => {
    setFocusedEventId(curr => {
      const idx = sortedEventIds.indexOf(curr)
      return sortedEventIds[Math.min(sortedEventIds.length - 1, idx + 1)] ?? curr
    })
  }, [sortedEventIds])

  // Keyboard handler: F, Escape, Arrow keys
  useEffect(() => {
    function onKey(e) {
      // Don't intercept when typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'f' || e.key === 'F') {
        toggleFocusMode()
        return
      }
      if (e.key === 'Escape') {
        setFocusMode(false)
        return
      }
      if (focusMode) {
        if (e.key === 'ArrowRight') { e.preventDefault(); focusNext() }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); focusPrev() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode, focusNext, focusPrev, toggleFocusMode])

  // ── Chapter navigation ───────────────────────────────────────────────────────
  const [activeChapterId, setActiveChapterId] = useState(null)

  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const canvasX = container.scrollLeft / zoom - CANVAS_X_PADDING

    let found = null
    for (const [id, bounds] of layout.chapterBounds) {
      if (canvasX >= bounds.x - 40 && canvasX <= bounds.x + bounds.width) {
        found = id
        break
      }
    }
    setActiveChapterId(found)
  }, [layout.chapterBounds, zoom])

  const handleScrollToChapter = useCallback((chapterId) => {
    const bounds = layout.chapterBounds.get(chapterId)
    if (!bounds || !scrollRef.current) return
    const targetScrollLeft = (bounds.x + CANVAS_X_PADDING) * zoom
    scrollRef.current.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' })
  }, [layout.chapterBounds, zoom])

  // ── Selection for detail panel ───────────────────────────────────────────────
  const selection = useMemo(() => {
    if (focusMode && focusedEventId) return { type: 'event', eventId: focusedEventId }
    if (selectedEntityId) return { type: 'entity', entityId: selectedEntityId }
    if (selectedEventId) return { type: 'event', eventId: selectedEventId }
    return null
  }, [focusMode, focusedEventId, selectedEntityId, selectedEventId])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0d0d0d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <TopBar
        investigationLabel={data.manifest?.label}
        scaleMode={layout.scaleMode}
        onScaleModeChange={setScaleMode}
        zoom={zoom}
        onFit={handleFit}
        focusMode={focusMode}
        onToggleFocus={toggleFocusMode}
        onFocusPrev={focusPrev}
        onFocusNext={focusNext}
        chapters={data.chapters ?? []}
        chapterBounds={layout.chapterBounds}
        activeChapterId={activeChapterId}
        onScrollToChapter={handleScrollToChapter}
        affiliations={data.affiliations ?? []}
      />

      {/* Scrollable area: swimlane panel (sticky) + timeline SVG */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          background: '#0d0d0d',
        }}
      >
        {/* Sticky left panel — scaled via inner wrapper so scroll area size is correct */}
        <div
          style={{
            width: LEFT_PANEL_WIDTH,
            height: layout.canvasHeight * zoom,
            flexShrink: 0,
            position: 'sticky',
            left: 0,
            zIndex: 20,
            background: '#0d0d0d',
            borderRight: '1px solid #1a1a1a',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              transformOrigin: '0 0',
              transform: `scale(${zoom})`,
              width: LEFT_PANEL_WIDTH,
              height: layout.canvasHeight,
            }}
          >
            <SwimlanePanel
              rows={layout.rows}
              groupBands={layout.groupBands}
              canvasHeight={layout.canvasHeight}
              onEntityClick={handleSelectEntity}
            />
          </div>
        </div>

        {/* Timeline canvas */}
        <div style={{ flexShrink: 0 }}>
          <TimelineCanvas
            layout={layout}
            events={data.events}
            relationships={data.relationships}
            zoom={zoom}
            selectedEventId={selectedEventId}
            selectedEntityId={selectedEntityId}
            onSelectEvent={handleSelectEvent}
            onSelectEntity={handleSelectEntity}
            focusMode={focusMode}
            focusedEventId={focusedEventId}
          />
        </div>
      </div>

      {/* Detail panel (slide-up from bottom) */}
      <DetailPanel
        selection={selection}
        data={data}
        onDismiss={handleDismiss}
        onSelectEvent={handleSelectEvent}
      />
    </div>
  )
}
