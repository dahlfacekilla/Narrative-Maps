import { describe, it, expect } from 'vitest'
import {
  classifyTopology,
  assignEntitySlots,
  getEventParticipants,
  computeChainDepth,
} from '../../layout/entitySlots.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeRel = (id, from, to, direction = 'directed', eventId = 'ev1') => ({
  id,
  from,
  to,
  direction,
  event_id: eventId,
})

// ─── classifyTopology ─────────────────────────────────────────────────────────

describe('classifyTopology', () => {
  it('returns "none" when no directed relationships for the event', () => {
    const rels = [makeRel('r1', 'A', 'B', 'undirected')]
    expect(classifyTopology(rels, 'ev1')).toBe('none')
  })

  it('returns "none" for an event with no relationships at all', () => {
    expect(classifyTopology([], 'ev1')).toBe('none')
  })

  it('returns "simple" for a single directed A→B', () => {
    const rels = [makeRel('r1', 'A', 'B')]
    expect(classifyTopology(rels, 'ev1')).toBe('simple')
  })

  it('returns "reciprocal" for A→B and B→A', () => {
    const rels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'B', 'A')]
    expect(classifyTopology(rels, 'ev1')).toBe('reciprocal')
  })

  it('returns "chain" for A→B and B→C', () => {
    const rels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'B', 'C')]
    expect(classifyTopology(rels, 'ev1')).toBe('chain')
  })

  it('returns "fan-out" for A→B and A→C', () => {
    const rels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'A', 'C')]
    expect(classifyTopology(rels, 'ev1')).toBe('fan-out')
  })

  it('returns "fan-in" for A→C and B→C', () => {
    const rels = [makeRel('r1', 'A', 'C'), makeRel('r2', 'B', 'C')]
    expect(classifyTopology(rels, 'ev1')).toBe('fan-in')
  })

  it('returns "independent" for A→B and C→D', () => {
    const rels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'C', 'D')]
    expect(classifyTopology(rels, 'ev1')).toBe('independent')
  })

  it('ignores relationships for other events', () => {
    const rels = [
      makeRel('r1', 'A', 'B', 'directed', 'ev1'),
      makeRel('r2', 'B', 'A', 'directed', 'ev2'), // different event
    ]
    expect(classifyTopology(rels, 'ev1')).toBe('simple')
  })
})

// ─── assignEntitySlots ────────────────────────────────────────────────────────

describe('assignEntitySlots', () => {
  it('returns empty map when no relationships for event', () => {
    expect(assignEntitySlots('ev1', [], 100).size).toBe(0)
  })

  it('assigns left to source and right to sink in a simple directed pair', () => {
    const rels = [makeRel('r1', 'A', 'B')]
    const slots = assignEntitySlots('ev1', rels, 100)
    expect(slots.get('A').side).toBe('left')
    expect(slots.get('B').side).toBe('right')
    expect(slots.get('A').xOffset).toBeLessThan(0)
    expect(slots.get('B').xOffset).toBeGreaterThan(0)
  })

  it('assigns center to an intermediate node in a chain', () => {
    const rels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'B', 'C')]
    const slots = assignEntitySlots('ev1', rels, 150)
    expect(slots.get('A').side).toBe('left')
    expect(slots.get('B').side).toBe('center')
    expect(slots.get('C').side).toBe('right')
  })

  it('assigns center to all entities in an undirected-only event', () => {
    const rels = [makeRel('r1', 'A', 'B', 'undirected')]
    const slots = assignEntitySlots('ev1', rels, 100)
    expect(slots.get('A').xOffset).toBe(0)
    expect(slots.get('B').xOffset).toBe(0)
  })

  it('clamps stagger to ≤ 30px', () => {
    const rels = [makeRel('r1', 'A', 'B')]
    const slots = assignEntitySlots('ev1', rels, 1000) // very wide zone
    expect(Math.abs(slots.get('A').xOffset)).toBeLessThanOrEqual(30)
    expect(Math.abs(slots.get('B').xOffset)).toBeLessThanOrEqual(30)
  })

  it('uses 20% of zoneWidth when that is smaller than 30px', () => {
    const rels = [makeRel('r1', 'A', 'B')]
    const zoneWidth = 60
    const slots = assignEntitySlots('ev1', rels, zoneWidth)
    const expectedStagger = zoneWidth * 0.2
    expect(Math.abs(slots.get('A').xOffset)).toBeCloseTo(expectedStagger, 5)
  })

  it('fan-out: source left, all targets right', () => {
    const rels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'A', 'C')]
    const slots = assignEntitySlots('ev1', rels, 200)
    expect(slots.get('A').side).toBe('left')
    expect(slots.get('B').side).toBe('right')
    expect(slots.get('C').side).toBe('right')
  })

  it('fan-in: all sources left, shared target right', () => {
    const rels = [makeRel('r1', 'A', 'C'), makeRel('r2', 'B', 'C')]
    const slots = assignEntitySlots('ev1', rels, 200)
    expect(slots.get('A').side).toBe('left')
    expect(slots.get('B').side).toBe('left')
    expect(slots.get('C').side).toBe('right')
  })
})

// ─── getEventParticipants ─────────────────────────────────────────────────────

describe('getEventParticipants', () => {
  it('returns all entity IDs mentioned in event relationships', () => {
    const rels = [
      makeRel('r1', 'A', 'B'),
      makeRel('r2', 'C', 'D'),
    ]
    const participants = getEventParticipants('ev1', rels)
    expect(participants.size).toBe(4)
    expect(participants.has('A')).toBe(true)
    expect(participants.has('D')).toBe(true)
  })

  it('deduplicates entity IDs that appear in multiple relationships', () => {
    const rels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'A', 'C')]
    const participants = getEventParticipants('ev1', rels)
    expect(participants.size).toBe(3) // A, B, C
  })

  it('returns empty set for event with no relationships', () => {
    expect(getEventParticipants('ev1', []).size).toBe(0)
  })

  it('ignores relationships for other events', () => {
    const rels = [
      makeRel('r1', 'A', 'B', 'directed', 'ev1'),
      makeRel('r2', 'C', 'D', 'directed', 'ev2'),
    ]
    const participants = getEventParticipants('ev1', rels)
    expect(participants.size).toBe(2)
    expect(participants.has('C')).toBe(false)
  })
})

// ─── computeChainDepth ────────────────────────────────────────────────────────

describe('computeChainDepth', () => {
  it('returns 0 for no relationships', () => {
    expect(computeChainDepth([])).toBe(0)
  })

  it('returns 0 for undirected-only relationships', () => {
    expect(computeChainDepth([makeRel('r1', 'A', 'B', 'undirected')])).toBe(0)
  })

  it('returns 1 for a single directed pair', () => {
    expect(computeChainDepth([makeRel('r1', 'A', 'B')])).toBe(1)
  })

  it('returns 2 for a two-step chain A→B→C', () => {
    const rels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'B', 'C')]
    expect(computeChainDepth(rels)).toBe(2)
  })

  it('returns 3 for a three-step chain A→B→C→D', () => {
    const rels = [
      makeRel('r1', 'A', 'B'),
      makeRel('r2', 'B', 'C'),
      makeRel('r3', 'C', 'D'),
    ]
    expect(computeChainDepth(rels)).toBe(3)
  })

  it('handles fan-out: returns 1 when A→B and A→C (no chain)', () => {
    const rels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'A', 'C')]
    expect(computeChainDepth(rels)).toBe(1)
  })

  it('does not infinite-loop on cyclic relationships', () => {
    const rels = [makeRel('r1', 'A', 'B'), makeRel('r2', 'B', 'A')]
    expect(() => computeChainDepth(rels)).not.toThrow()
  })
})
