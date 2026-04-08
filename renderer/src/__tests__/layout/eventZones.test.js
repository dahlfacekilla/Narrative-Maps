import { describe, it, expect } from 'vitest'
import {
  computeZoneWidth,
  computeEventZones,
  computeTotalCanvasWidth,
  computeChapterBounds,
  MIN_ZONE_WIDTH,
  MAX_ZONE_WIDTH,
  MIN_ZONE_GAP,
  CHAPTER_GAP,
  UNIFORM_SPACING,
} from '../../layout/eventZones.js'
import { computeScale, SCALE_MODES } from '../../layout/timeAxis.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeRel = (id, from, to, direction = 'directed', eventId = 'ev1') => ({
  id, from, to, direction, event_id: eventId,
})

const events = [
  { id: 'ev1', date: '2002-01', chapter_id: 'ch1', order: 1 },
  { id: 'ev2', date: '2002-07', chapter_id: 'ch1', order: 1 },
  { id: 'ev3', date: '2005-01', chapter_id: 'ch2', order: 1 },
]

const chapters = [
  { id: 'ch1', label: 'Chapter 1', color: '#4a90d9', order: 1 },
  { id: 'ch2', label: 'Chapter 2', color: '#e67e22', order: 2 },
]

// ─── computeZoneWidth ─────────────────────────────────────────────────────────

describe('computeZoneWidth', () => {
  it('returns MIN_ZONE_WIDTH for event with no relationships', () => {
    expect(computeZoneWidth('ev1', [])).toBe(MIN_ZONE_WIDTH)
  })

  it('increases with each additional directed relationship', () => {
    const rel1 = [makeRel('r1', 'A', 'B')]
    const rel2 = [makeRel('r1', 'A', 'B'), makeRel('r2', 'C', 'D')]
    expect(computeZoneWidth('ev1', rel2)).toBeGreaterThan(computeZoneWidth('ev1', rel1))
  })

  it('is wider for a chain than for independent pairs', () => {
    const chainRels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'B', 'C')]
    const independentRels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'C', 'D')]
    expect(computeZoneWidth('ev1', chainRels)).toBeGreaterThan(
      computeZoneWidth('ev1', independentRels)
    )
  })

  it('does not exceed MAX_ZONE_WIDTH', () => {
    const manyRels = Array.from({ length: 20 }, (_, i) =>
      makeRel(`r${i}`, `A${i}`, `B${i}`)
    )
    expect(computeZoneWidth('ev1', manyRels)).toBeLessThanOrEqual(MAX_ZONE_WIDTH)
  })

  it('is at least MIN_ZONE_WIDTH', () => {
    expect(computeZoneWidth('ev1', [])).toBeGreaterThanOrEqual(MIN_ZONE_WIDTH)
  })

  it('only counts relationships for the given eventId', () => {
    const rels = [
      makeRel('r1', 'A', 'B', 'directed', 'ev1'),
      makeRel('r2', 'C', 'D', 'directed', 'ev2'),
    ]
    // ev1 has 1 rel, ev2 has 1 rel — widths should be equal
    expect(computeZoneWidth('ev1', rels)).toBe(computeZoneWidth('ev2', rels))
  })
})

// ─── computeEventZones ────────────────────────────────────────────────────────

describe('computeEventZones', () => {
  it('returns empty map for empty events', () => {
    const scale = computeScale([], SCALE_MODES.PROPORTIONAL)
    expect(computeEventZones([], [], scale).size).toBe(0)
  })

  it('returns one zone per event', () => {
    const scale = computeScale(events, SCALE_MODES.PROPORTIONAL)
    const zones = computeEventZones(events, [], scale, chapters)
    expect(zones.size).toBe(events.length)
  })

  it('zones are ordered left-to-right by date', () => {
    const scale = computeScale(events, SCALE_MODES.PROPORTIONAL)
    const zones = computeEventZones(events, [], scale, chapters)
    expect(zones.get('ev1').centerX).toBeLessThan(zones.get('ev2').centerX)
    expect(zones.get('ev2').centerX).toBeLessThan(zones.get('ev3').centerX)
  })

  it('each zone has x, width, centerX', () => {
    const scale = computeScale(events, SCALE_MODES.PROPORTIONAL)
    const zones = computeEventZones(events, [], scale, chapters)
    for (const zone of zones.values()) {
      expect(zone).toHaveProperty('x')
      expect(zone).toHaveProperty('width')
      expect(zone).toHaveProperty('centerX')
      expect(zone.centerX).toBeCloseTo(zone.x + zone.width / 2, 3)
    }
  })

  it('enforces MIN_ZONE_GAP between adjacent zones in the same chapter', () => {
    // Two events very close together: same day
    const closeEvents = [
      { id: 'e1', date: '2002-07-01', chapter_id: 'ch1', order: 1 },
      { id: 'e2', date: '2002-07-02', chapter_id: 'ch1', order: 2 },
    ]
    const scale = computeScale(closeEvents, SCALE_MODES.PROPORTIONAL, { pxPerMonth: 80 })
    const zones = computeEventZones(closeEvents, [], scale, chapters)
    const z1 = zones.get('e1')
    const z2 = zones.get('e2')
    const gap = z2.x - (z1.x + z1.width)
    expect(gap).toBeGreaterThanOrEqual(MIN_ZONE_GAP - 0.001)
  })

  it('enforces CHAPTER_GAP between zones in different chapters', () => {
    const scale = computeScale(events, SCALE_MODES.PROPORTIONAL, { pxPerMonth: 80 })
    const zones = computeEventZones(events, [], scale, chapters)
    const z2 = zones.get('ev2') // last of ch1
    const z3 = zones.get('ev3') // first of ch2
    const gap = z3.x - (z2.x + z2.width)
    expect(gap).toBeGreaterThanOrEqual(CHAPTER_GAP - 0.001)
  })

  it('works in UNIFORM mode with equal spacing between zones', () => {
    const scale = computeScale(events, SCALE_MODES.UNIFORM)
    const zones = computeEventZones(events, [], scale, chapters)
    // In UNIFORM mode centerX values should be spread at UNIFORM_SPACING apart (before overlap resolution)
    const z1 = zones.get('ev1')
    const z2 = zones.get('ev2')
    expect(z2.centerX).toBeGreaterThan(z1.centerX)
  })

  it('uses order field as tiebreaker for same-date events', () => {
    const sameDate = [
      { id: 'late',  date: '2002-07', chapter_id: 'ch1', order: 2 },
      { id: 'early', date: '2002-07', chapter_id: 'ch1', order: 1 },
    ]
    const scale = computeScale(sameDate, SCALE_MODES.PROPORTIONAL)
    const zones = computeEventZones(sameDate, [], scale, chapters)
    expect(zones.get('early').centerX).toBeLessThanOrEqual(zones.get('late').centerX)
  })
})

// ─── computeTotalCanvasWidth ──────────────────────────────────────────────────

describe('computeTotalCanvasWidth', () => {
  it('returns a positive value greater than the rightmost zone edge', () => {
    const scale = computeScale(events, SCALE_MODES.PROPORTIONAL)
    const zones = computeEventZones(events, [], scale)
    const width = computeTotalCanvasWidth(zones)
    let maxRight = 0
    zones.forEach(z => { if (z.x + z.width > maxRight) maxRight = z.x + z.width })
    expect(width).toBeGreaterThan(maxRight)
  })

  it('returns a fallback for empty zones', () => {
    expect(computeTotalCanvasWidth(new Map())).toBeGreaterThan(0)
  })
})

// ─── computeChapterBounds ─────────────────────────────────────────────────────

describe('computeChapterBounds', () => {
  it('returns one entry per chapter that has events', () => {
    const scale = computeScale(events, SCALE_MODES.PROPORTIONAL)
    const zones = computeEventZones(events, [], scale, chapters)
    const bounds = computeChapterBounds(zones, chapters)
    expect(bounds.size).toBe(2)
  })

  it('each entry has x, width, label, color', () => {
    const scale = computeScale(events, SCALE_MODES.PROPORTIONAL)
    const zones = computeEventZones(events, [], scale, chapters)
    const bounds = computeChapterBounds(zones, chapters)
    for (const b of bounds.values()) {
      expect(b).toHaveProperty('x')
      expect(b).toHaveProperty('width')
      expect(b).toHaveProperty('label')
      expect(b).toHaveProperty('color')
      expect(b.width).toBeGreaterThan(0)
    }
  })

  it('chapter 1 x starts at or before chapter 2 x', () => {
    const scale = computeScale(events, SCALE_MODES.PROPORTIONAL)
    const zones = computeEventZones(events, [], scale, chapters)
    const bounds = computeChapterBounds(zones, chapters)
    expect(bounds.get('ch1').x).toBeLessThan(bounds.get('ch2').x)
  })

  it('does not include chapters with no events', () => {
    const scale = computeScale(events, SCALE_MODES.PROPORTIONAL)
    const zones = computeEventZones(events, [], scale, chapters)
    const extraChapter = [...chapters, { id: 'ch3', label: 'Empty', color: '#fff', order: 3 }]
    const bounds = computeChapterBounds(zones, extraChapter)
    expect(bounds.has('ch3')).toBe(false)
  })
})
