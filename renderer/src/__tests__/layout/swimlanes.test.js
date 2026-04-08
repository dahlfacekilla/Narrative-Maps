import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildEntityRows,
  getEntityRow,
  getGroupBounds,
  getTotalCanvasHeight,
  buildGroupBandsMap,
  ROW_HEIGHT_DEFAULT,
  ROW_HEIGHT_PORTRAIT,
  ROW_GAP,
  GROUP_GAP,
  HEADER_HEIGHT,
} from '../../layout/swimlanes.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const affiliations = [
  { id: 'city-admin', label: 'City Administration', color: '#4a90d9', order: 1 },
  { id: 'enforcement', label: 'Enforcement',         color: '#e74c3c', order: 2 },
]

const entities = [
  { id: 'mayor',        affiliation_id: 'city-admin',  swimlane_order: 1 },
  { id: 'city-manager', affiliation_id: 'city-admin',  swimlane_order: 2 },
  { id: 'sec',          affiliation_id: 'enforcement', swimlane_order: 1 },
  { id: 'da',           affiliation_id: 'enforcement', swimlane_order: 2 },
]

// ─── buildEntityRows ──────────────────────────────────────────────────────────

describe('buildEntityRows', () => {
  let rows

  beforeEach(() => {
    rows = buildEntityRows(entities, affiliations)
  })

  it('returns one row per entity', () => {
    expect(rows).toHaveLength(entities.length)
  })

  it('first row starts at HEADER_HEIGHT', () => {
    expect(rows[0].y).toBe(HEADER_HEIGHT)
  })

  it('assigns sequential rowIndex values', () => {
    rows.forEach((row, i) => expect(row.rowIndex).toBe(i))
  })

  it('sorts by affiliation order, then swimlane_order', () => {
    expect(rows[0].entityId).toBe('mayor')
    expect(rows[1].entityId).toBe('city-manager')
    expect(rows[2].entityId).toBe('sec')
    expect(rows[3].entityId).toBe('da')
  })

  it('rows within the same group have correct y spacing', () => {
    const [r0, r1] = rows
    expect(r1.y).toBe(r0.y + ROW_HEIGHT_DEFAULT + ROW_GAP)
  })

  it('group gap is applied between the last row of group 1 and the first row of group 2', () => {
    const lastCityAdmin = rows[1]
    const firstEnforcement = rows[2]
    expect(firstEnforcement.y).toBe(lastCityAdmin.y + ROW_HEIGHT_DEFAULT + GROUP_GAP)
  })

  it('uses ROW_HEIGHT_PORTRAIT for entities with a portrait field', () => {
    const withPortrait = [...entities, { id: 'photo-person', affiliation_id: 'city-admin', swimlane_order: 3, portrait: 'assets/photo.jpg' }]
    const r = buildEntityRows(withPortrait, affiliations)
    const photoRow = r.find(row => row.entityId === 'photo-person')
    expect(photoRow.height).toBe(ROW_HEIGHT_PORTRAIT)
  })

  it('each row has correct centerY', () => {
    for (const row of rows) {
      expect(row.centerY).toBe(row.y + row.height / 2)
    }
  })

  it('skips affiliations with no entities', () => {
    const emptyAffil = [...affiliations, { id: 'empty', label: 'Empty', color: '#fff', order: 3 }]
    const r = buildEntityRows(entities, emptyAffil)
    expect(r).toHaveLength(entities.length)
  })

  it('auto-sorts entities without swimlane_order to the end of their group', () => {
    const unsorted = [
      { id: 'z-entity', affiliation_id: 'city-admin' },
      { id: 'a-entity', affiliation_id: 'city-admin', swimlane_order: 1 },
    ]
    const r = buildEntityRows(unsorted, affiliations)
    expect(r[0].entityId).toBe('a-entity')
    expect(r[1].entityId).toBe('z-entity')
  })
})

// ─── getEntityRow ─────────────────────────────────────────────────────────────

describe('getEntityRow', () => {
  const rows = buildEntityRows(entities, affiliations)

  it('returns the correct row for a known entity', () => {
    const row = getEntityRow('sec', rows)
    expect(row).not.toBeNull()
    expect(row.entityId).toBe('sec')
  })

  it('returns null for an unknown entity', () => {
    expect(getEntityRow('unknown-id', rows)).toBeNull()
  })
})

// ─── getGroupBounds ───────────────────────────────────────────────────────────

describe('getGroupBounds', () => {
  const rows = buildEntityRows(entities, affiliations)

  it('returns yStart and yEnd for a known affiliation group', () => {
    const bounds = getGroupBounds('city-admin', rows)
    expect(bounds).not.toBeNull()
    expect(bounds.yStart).toBe(HEADER_HEIGHT)
    expect(bounds.yEnd).toBeGreaterThan(bounds.yStart)
  })

  it('yEnd equals the bottom of the last row in the group', () => {
    const rows2 = buildEntityRows(entities, affiliations)
    const lastCityAdminRow = rows2.filter(r => r.affiliationId === 'city-admin').pop()
    const bounds = getGroupBounds('city-admin', rows2)
    expect(bounds.yEnd).toBe(lastCityAdminRow.y + lastCityAdminRow.height)
  })

  it('returns null for an unknown affiliation', () => {
    expect(getGroupBounds('nonexistent', rows)).toBeNull()
  })
})

// ─── getTotalCanvasHeight ─────────────────────────────────────────────────────

describe('getTotalCanvasHeight', () => {
  it('returns HEADER_HEIGHT for empty rows', () => {
    expect(getTotalCanvasHeight([])).toBe(HEADER_HEIGHT)
  })

  it('is greater than the y + height of the last row', () => {
    const rows = buildEntityRows(entities, affiliations)
    const last = rows[rows.length - 1]
    expect(getTotalCanvasHeight(rows)).toBeGreaterThan(last.y + last.height)
  })

  it('grows with more entities', () => {
    const small = buildEntityRows([entities[0]], affiliations)
    const large = buildEntityRows(entities, affiliations)
    expect(getTotalCanvasHeight(large)).toBeGreaterThan(getTotalCanvasHeight(small))
  })
})

// ─── buildGroupBandsMap ───────────────────────────────────────────────────────

describe('buildGroupBandsMap', () => {
  const rows = buildEntityRows(entities, affiliations)
  const map = buildGroupBandsMap(rows)

  it('returns one entry per affiliation group present', () => {
    expect(map.size).toBe(2)
  })

  it('each entry has label, color, yStart, yEnd', () => {
    const entry = map.get('city-admin')
    expect(entry).toHaveProperty('label')
    expect(entry).toHaveProperty('color')
    expect(entry).toHaveProperty('yStart')
    expect(entry).toHaveProperty('yEnd')
  })

  it('yStart of group 1 matches the first row of that group', () => {
    const cityAdminRows = rows.filter(r => r.affiliationId === 'city-admin')
    expect(map.get('city-admin').yStart).toBe(cityAdminRows[0].y)
  })

  it('yEnd of group 1 matches the bottom of the last row in that group', () => {
    const cityAdminRows = rows.filter(r => r.affiliationId === 'city-admin')
    const last = cityAdminRows[cityAdminRows.length - 1]
    expect(map.get('city-admin').yEnd).toBe(last.y + last.height)
  })
})
