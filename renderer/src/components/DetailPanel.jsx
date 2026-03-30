/**
 * DetailPanel — dismissable bottom panel showing event or entity details.
 * PRD §5.10
 *
 * Props:
 *   selection  – { type: 'event', eventId } | { type: 'entity', entityId } | null
 *   data       – { events, relationships, entities } from useInvestigation
 *   onDismiss  – () => void
 *   onSelectEvent  – (eventId) => void
 *   onSelectEntity – (entityId) => void
 */

import { useMemo } from 'react'
import { formatDateLabel } from '../layout/timeAxis.js'
import { AFFILIATION_COLORS, CONFIDENCE_COLOR, RELATIONSHIP_COLORS } from '../constants.js'

const PANEL_HEIGHT = 220

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ label, color }) {
  return (
    <span
      style={{
        fontSize: 7.5,
        padding: '2px 6px',
        borderRadius: 2,
        border: `1px solid ${color}55`,
        color,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontFamily: 'monospace',
      }}
    >
      {label}
    </span>
  )
}

function SourceLink({ source }) {
  const url = typeof source === 'string' ? source : source?.url
  const title = typeof source === 'string' ? null : source?.title
  const display = title ?? (url ? new URL(url).hostname : 'source')
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#4a90d9', fontSize: 9, textDecoration: 'none' }}
    >
      {display}
    </a>
  )
}

// ─── Event Panel ──────────────────────────────────────────────────────────────

function EventPanel({ event, relationships, entityById }) {
  const eventRels = relationships.filter(r => r.event_id === event.id)

  return (
    <div style={{ display: 'flex', gap: 24, height: '100%' }}>
      {/* Left: event meta */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ddd', lineHeight: 1.3, marginBottom: 4 }}>
          {event.label}
        </div>
        <div style={{ fontSize: 9, color: '#666', marginBottom: 8, letterSpacing: '0.04em' }}>
          {formatDateLabel(event.date)}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <Badge label={event.confidence} color={CONFIDENCE_COLOR[event.confidence] ?? '#888'} />
          {(event.tags ?? []).map(t => (
            <Badge key={t} label={t} color="#444" />
          ))}
        </div>
        {event.description && (
          <div style={{ fontSize: 9.5, color: '#888', lineHeight: 1.55 }}>
            {event.description}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, background: '#1e1e1e', flexShrink: 0 }} />

      {/* Center: relationships */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <div style={{ fontSize: 8, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Relationships
        </div>
        {eventRels.length === 0 && (
          <div style={{ fontSize: 9, color: '#444' }}>No relationships recorded for this event.</div>
        )}
        {eventRels.map(rel => {
          const fromEnt = entityById.get(rel.from)
          const toEnt = entityById.get(rel.to)
          const color = RELATIONSHIP_COLORS[rel.type] ?? '#888'
          return (
            <div key={rel.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <div
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: color,
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 9.5, color: '#bbb', lineHeight: 1.4 }}>
                  <span style={{ color: AFFILIATION_COLORS[fromEnt?.affiliation_id] ?? '#aaa' }}>
                    {fromEnt?.label ?? rel.from}
                  </span>
                  <span style={{ color: '#444', margin: '0 5px' }}>→</span>
                  <span style={{ color, fontStyle: 'italic' }}>{rel.label}</span>
                  <span style={{ color: '#444', margin: '0 5px' }}>→</span>
                  <span style={{ color: AFFILIATION_COLORS[toEnt?.affiliation_id] ?? '#aaa' }}>
                    {toEnt?.label ?? rel.to}
                  </span>
                </div>
                {rel.description && (
                  <div style={{ fontSize: 8.5, color: '#555', marginTop: 2, lineHeight: 1.4 }}>
                    {rel.description}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Right: sources */}
      {(event.sources ?? []).length > 0 && (
        <>
          <div style={{ width: 1, background: '#1e1e1e', flexShrink: 0 }} />
          <div style={{ width: 180, flexShrink: 0 }}>
            <div style={{ fontSize: 8, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Sources
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(event.sources ?? []).map((src, i) => (
                <SourceLink key={i} source={src} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Entity Panel ─────────────────────────────────────────────────────────────

function EntityPanel({ entity, entityEvents, affiliations, onSelectEvent }) {
  const affiliation = affiliations.find(a => a.id === entity.affiliation_id)
  const color = affiliation?.color ?? AFFILIATION_COLORS[entity.affiliation_id] ?? '#888'

  return (
    <div style={{ display: 'flex', gap: 24, height: '100%' }}>
      {/* Left: entity meta */}
      <div style={{ width: 240, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {/* Portrait circle */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: `${color}22`,
              border: `2px solid ${color}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 'bold',
              color,
              fontFamily: 'monospace',
              flexShrink: 0,
            }}
          >
            {entity.label.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ddd', lineHeight: 1.2 }}>
              {entity.label}
            </div>
            {entity.role && (
              <div style={{ fontSize: 8.5, color: color, opacity: 0.8, marginTop: 1 }}>
                {entity.role}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <Badge label={entity.type} color="#555" />
          {entity.confidence && (
            <Badge label={entity.confidence} color={CONFIDENCE_COLOR[entity.confidence] ?? '#888'} />
          )}
          {affiliation && <Badge label={affiliation.label} color={color} />}
        </div>

        {entity.description && (
          <div style={{ fontSize: 9.5, color: '#888', lineHeight: 1.55, marginBottom: 8 }}>
            {entity.description}
          </div>
        )}

        {(entity.first_seen || entity.last_seen) && (
          <div style={{ fontSize: 8.5, color: '#555', marginBottom: 6 }}>
            {entity.first_seen && <span>From {entity.first_seen}</span>}
            {entity.first_seen && entity.last_seen && <span style={{ margin: '0 4px' }}>·</span>}
            {entity.last_seen && <span>To {entity.last_seen}</span>}
          </div>
        )}

        {(entity.sources ?? []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(entity.sources ?? []).map((src, i) => (
              <SourceLink key={i} source={src} />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, background: '#1e1e1e', flexShrink: 0 }} />

      {/* Right: events this entity participates in */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <div style={{ fontSize: 8, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Appears In
        </div>
        {entityEvents.length === 0 && (
          <div style={{ fontSize: 9, color: '#444' }}>No events found for this entity.</div>
        )}
        {entityEvents.map(ev => (
          <button
            key={ev.id}
            onClick={() => onSelectEvent(ev.id)}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              width: '100%',
              background: 'none',
              border: 'none',
              padding: '4px 0',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 8, color: '#555', fontFamily: 'monospace', flexShrink: 0 }}>
              {formatDateLabel(ev.date)}
            </span>
            <span style={{ fontSize: 9.5, color: '#aaa', fontFamily: 'monospace' }}>
              {ev.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── DetailPanel ──────────────────────────────────────────────────────────────

export function DetailPanel({ selection, data, onDismiss, onSelectEvent }) {
  const { events, relationships, entities } = data

  const entityById = useMemo(() => {
    const m = new Map()
    for (const e of entities) m.set(e.id, e)
    return m
  }, [entities])

  const eventById = useMemo(() => {
    const m = new Map()
    for (const e of events) m.set(e.id, e)
    return m
  }, [events])

  // For entity panel: map entityId → sorted events it appears in
  const entityEventIds = useMemo(() => {
    const map = new Map()
    for (const rel of relationships) {
      if (!rel.event_id) continue
      for (const id of [rel.from, rel.to]) {
        if (!map.has(id)) map.set(id, new Set())
        map.get(id).add(rel.event_id)
      }
    }
    return map
  }, [relationships])

  const visible = selection !== null

  const content = useMemo(() => {
    if (!selection) return null
    if (selection.type === 'event') {
      const event = eventById.get(selection.eventId)
      if (!event) return null
      return { mode: 'event', event }
    }
    if (selection.type === 'entity') {
      const entity = entityById.get(selection.entityId)
      if (!entity) return null
      const eventIds = entityEventIds.get(selection.entityId) ?? new Set()
      const entityEvents = [...eventIds]
        .map(id => eventById.get(id))
        .filter(Boolean)
        .sort((a, b) => a.date.localeCompare(b.date))
      return { mode: 'entity', entity, entityEvents }
    }
    return null
  }, [selection, eventById, entityById, entityEventIds])

  return (
    <div
      style={{
        height: visible ? PANEL_HEIGHT : 0,
        overflow: 'hidden',
        transition: 'height 0.18s ease',
        background: '#0f0f0f',
        borderTop: visible ? '1px solid #1e1e1e' : 'none',
        flexShrink: 0,
      }}
    >
      {content && (
        <div
          style={{
            height: PANEL_HEIGHT,
            padding: '14px 20px',
            fontFamily: 'monospace',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            style={{
              position: 'absolute',
              top: 10,
              right: 14,
              background: 'none',
              border: 'none',
              color: '#444',
              cursor: 'pointer',
              fontSize: 13,
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>

          {content.mode === 'event' && (
            <EventPanel
              event={content.event}
              relationships={relationships}
              entityById={entityById}
            />
          )}

          {content.mode === 'entity' && (
            <EntityPanel
              entity={content.entity}
              entityEvents={content.entityEvents}
              affiliations={data.affiliations ?? []}
              onSelectEvent={onSelectEvent}
            />
          )}
        </div>
      )}
    </div>
  )
}
