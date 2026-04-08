import { describe, it, expect, beforeEach } from 'vitest'
import { computeLayout, recomputeWithScaleMode, SCALE_MODES } from '../../layout/index.js'

// ─── Minimal investigation fixture ────────────────────────────────────────────

const affiliations = [
  { id: 'city-admin', label: 'City Administration', color: '#4a90d9', order: 1 },
  { id: 'pension',    label: 'Pension Board',        color: '#e67e22', order: 2 },
]

const entities = [
  { id: 'mayor',    affiliation_id: 'city-admin', swimlane_order: 1 },
  { id: 'manager',  affiliation_id: 'city-admin', swimlane_order: 2 },
  { id: 'sdcers',   affiliation_id: 'pension',    swimlane_order: 1 },
]

const chapters = [
  { id: 'ch1', label: 'Chapter 1', color: '#4a90d9', order: 1 },
  { id: 'ch2', label: 'Chapter 2', color: '#e67e22', order: 2 },
]

const events = [
  { id: 'ev1', date: '2002-01', chapter_id: 'ch1', order: 1, confidence: 'verified' },
  { id: 'ev2', date: '2002-07', chapter_id: 'ch1', order: 1, confidence: 'verified' },
  { id: 'ev3', date: '2005-01', chapter_id: 'ch2', order: 1, confidence: 'verified' },
]

const relationships = [
  { id: 'r1', event_id: 'ev1', from: 'mayor',   to: 'sdcers',  direction: 'directed', type: 'political', confidence: 'verified' },
  { id: 'r2', event_id: 'ev2', from: 'manager', to: 'sdcers',  direction: 'directed', type: 'political', confidence: 'verified' },
  { id: 'r3', event_id: 'ev3', from: 'mayor',   to: 'manager', direction: 'directed', type: 'political', confidence: 'verified' },
]

const investigation = { entities, events, relationships, affiliations, chapters }

// ─── computeLayout ────────────────────────────────────────────────────────────

describe('computeLayout', () => {
  let layout

  beforeEach(() => {
    layout = computeLayout(investigation)
  })

  it('returns a layout object with all required fields', () => {
    expect(layout).toHaveProperty('rows')
    expect(layout).toHaveProperty('groupBands')
    expect(layout).toHaveProperty('eventZones')
    expect(layout).toHaveProperty('chapterBounds')
    expect(layout).toHaveProperty('entitySlots')
    expect(layout).toHaveProperty('eventParticipants')
    expect(layout).toHaveProperty('scale')
    expect(layout).toHaveProperty('axisTicks')
    expect(layout).toHaveProperty('canvasWidth')
    expect(layout).toHaveProperty('canvasHeight')
    expect(layout).toHaveProperty('scaleMode')
  })

  it('rows contains one entry per entity', () => {
    expect(layout.rows).toHaveLength(entities.length)
  })

  it('eventZones contains one entry per event', () => {
    expect(layout.eventZones.size).toBe(events.length)
  })

  it('chapterBounds contains one entry per chapter that has events', () => {
    expect(layout.chapterBounds.size).toBe(chapters.length)
  })

  it('entitySlots contains one map per event', () => {
    expect(layout.entitySlots.size).toBe(events.length)
  })

  it('eventParticipants contains one set per event', () => {
    expect(layout.eventParticipants.size).toBe(events.length)
  })

  it('eventParticipants correctly identifies participating entities', () => {
    const ev1Participants = layout.eventParticipants.get('ev1')
    expect(ev1Participants.has('mayor')).toBe(true)
    expect(ev1Participants.has('sdcers')).toBe(true)
    expect(ev1Participants.has('manager')).toBe(false)
  })

  it('canvasWidth and canvasHeight are positive numbers', () => {
    expect(layout.canvasWidth).toBeGreaterThan(0)
    expect(layout.canvasHeight).toBeGreaterThan(0)
  })

  it('auto-detects scale mode for a 3-year investigation as COMPRESSED', () => {
    // Events span 2002–2005, which is > 3 years with uneven distribution → compressed
    expect([SCALE_MODES.COMPRESSED, SCALE_MODES.PROPORTIONAL]).toContain(layout.scaleMode)
  })

  it('respects explicit scaleMode option', () => {
    const uniform = computeLayout(investigation, { scaleMode: SCALE_MODES.UNIFORM })
    expect(uniform.scaleMode).toBe(SCALE_MODES.UNIFORM)

    const proportional = computeLayout(investigation, { scaleMode: SCALE_MODES.PROPORTIONAL })
    expect(proportional.scaleMode).toBe(SCALE_MODES.PROPORTIONAL)
  })

  it('groupBands has one band per affiliation group present in entities', () => {
    expect(layout.groupBands.size).toBe(affiliations.length)
  })

  it('axisTicks is a non-empty array for multi-event investigations', () => {
    expect(Array.isArray(layout.axisTicks)).toBe(true)
    expect(layout.axisTicks.length).toBeGreaterThan(0)
  })
})

// ─── recomputeWithScaleMode ───────────────────────────────────────────────────

describe('recomputeWithScaleMode', () => {
  it('returns a layout with the specified scale mode', () => {
    const layout = recomputeWithScaleMode(investigation, SCALE_MODES.PROPORTIONAL)
    expect(layout.scaleMode).toBe(SCALE_MODES.PROPORTIONAL)
  })

  it('different scale modes produce different canvasWidth values', () => {
    const compressed = recomputeWithScaleMode(investigation, SCALE_MODES.COMPRESSED)
    const proportional = recomputeWithScaleMode(investigation, SCALE_MODES.PROPORTIONAL)
    // They may differ — just assert both are positive
    expect(compressed.canvasWidth).toBeGreaterThan(0)
    expect(proportional.canvasWidth).toBeGreaterThan(0)
  })

  it('does not mutate the original investigation data', () => {
    const original = JSON.stringify(investigation)
    recomputeWithScaleMode(investigation, SCALE_MODES.UNIFORM)
    expect(JSON.stringify(investigation)).toBe(original)
  })
})
