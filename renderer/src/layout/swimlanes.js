/**
 * Swimlane row assignment.
 *
 * Entities are grouped by affiliation and sorted by swimlane_order within each group.
 * Each entity gets exactly one row. Groups are separated by a larger gap than rows.
 *
 * PRD §5.2: Row height 56px min, 72px if entity has a portrait.
 */

export const ROW_HEIGHT_DEFAULT = 56
export const ROW_HEIGHT_PORTRAIT = 72
export const ROW_GAP = 4        // gap between rows within a group
export const GROUP_GAP = 20     // extra gap between affiliation groups
export const HEADER_HEIGHT = 48 // top margin for event date markers / chapter headers

/**
 * @typedef {Object} EntityRow
 * @property {string}  entityId
 * @property {object}  entity
 * @property {string}  affiliationId
 * @property {object}  affiliation
 * @property {number}  rowIndex   – 0-based sequential index
 * @property {number}  y          – top edge of this row on the canvas
 * @property {number}  height     – row height in px
 * @property {number}  centerY    – vertical center of this row
 */

/**
 * Build the ordered list of entity rows from entities + affiliations.
 *
 * @param {Array<object>} entities      – entity records (v2 schema, affiliation_id field)
 * @param {Array<object>} affiliations  – affiliation records sorted by order
 * @returns {EntityRow[]}
 */
export function buildEntityRows(entities, affiliations) {
  const sortedAffiliations = [...affiliations].sort((a, b) => a.order - b.order)

  const rows = []
  let y = HEADER_HEIGHT
  let rowIndex = 0

  for (const affiliation of sortedAffiliations) {
    const groupEntities = entities
      .filter(e => e.affiliation_id === affiliation.id)
      .sort((a, b) => (a.swimlane_order ?? 999) - (b.swimlane_order ?? 999))

    if (groupEntities.length === 0) continue

    for (let i = 0; i < groupEntities.length; i++) {
      const entity = groupEntities[i]
      const height = entity.portrait ? ROW_HEIGHT_PORTRAIT : ROW_HEIGHT_DEFAULT

      rows.push({
        entityId: entity.id,
        entity,
        affiliationId: affiliation.id,
        affiliation,
        rowIndex,
        y,
        height,
        centerY: y + height / 2,
      })

      y += height + ROW_GAP
      rowIndex++
    }

    // After the last row of the group, replace the inter-row gap with a larger group gap
    y -= ROW_GAP
    y += GROUP_GAP
  }

  return rows
}

/**
 * Look up a single entity's row by entity ID.
 * @param {string} entityId
 * @param {EntityRow[]} rows
 * @returns {EntityRow|null}
 */
export function getEntityRow(entityId, rows) {
  return rows.find(r => r.entityId === entityId) ?? null
}

/**
 * Get the Y-bounds of an affiliation group.
 * @param {string} affiliationId
 * @param {EntityRow[]} rows
 * @returns {{ yStart: number, yEnd: number }|null}
 */
export function getGroupBounds(affiliationId, rows) {
  const group = rows.filter(r => r.affiliationId === affiliationId)
  if (group.length === 0) return null
  const yStart = group[0].y
  const last = group[group.length - 1]
  return { yStart, yEnd: last.y + last.height }
}

/**
 * Total canvas height needed to fit all rows.
 * @param {EntityRow[]} rows
 * @returns {number}
 */
export function getTotalCanvasHeight(rows) {
  if (rows.length === 0) return HEADER_HEIGHT
  const last = rows[rows.length - 1]
  return last.y + last.height + GROUP_GAP
}

/**
 * Build a map from affiliationId → { label, color, yStart, yEnd } for swimlane backgrounds.
 * @param {EntityRow[]} rows
 * @returns {Map<string, {label: string, color: string, yStart: number, yEnd: number}>}
 */
export function buildGroupBandsMap(rows) {
  const map = new Map()
  for (const row of rows) {
    const id = row.affiliationId
    if (!map.has(id)) {
      map.set(id, {
        affiliationId: id,
        label: row.affiliation.label,
        color: row.affiliation.color,
        yStart: row.y,
        yEnd: row.y + row.height,
      })
    } else {
      const entry = map.get(id)
      entry.yEnd = row.y + row.height
    }
  }
  return map
}
