/**
 * Event zone positioning.
 *
 * Each event occupies a "zone" — a horizontal region on the timeline centered on the
 * event's date. This module computes zone widths and resolves overlaps so that zones
 * never collide. (PRD §3.2.1, §5.4)
 */

import { dateToMs, dateToX, SCALE_MODES } from './timeAxis.js'
import { computeChainDepth } from './entitySlots.js'

/** Minimum pixel gap between adjacent zone edges (PRD §5.4 rule 3) */
export const MIN_ZONE_GAP = 24

/** Additional pixel gap between the last zone of one chapter and the first of the next */
export const CHAPTER_GAP = 48

/** Minimum zone width regardless of content */
export const MIN_ZONE_WIDTH = 80

/** Maximum zone width cap */
export const MAX_ZONE_WIDTH = 250

/** Spacing between event zone centers in UNIFORM mode */
export const UNIFORM_SPACING = 220

/**
 * Compute the pixel width of an event zone based on its relationships.
 * Formula (PRD §5.5.4): max(80, 60 + directed_rels × 20 + chain_depth × 30), capped at 250.
 *
 * @param {string} eventId
 * @param {Array<object>} allRelationships
 * @returns {number}
 */
export function computeZoneWidth(eventId, allRelationships) {
  const eventRels = allRelationships.filter(r => r.event_id === eventId)
  const directedRels = eventRels.filter(r => r.direction === 'directed')
  const chainDepth = computeChainDepth(eventRels)

  const width = 60 + directedRels.length * 20 + chainDepth * 30
  return Math.min(MAX_ZONE_WIDTH, Math.max(MIN_ZONE_WIDTH, width))
}

/**
 * @typedef {Object} EventZone
 * @property {string}  eventId
 * @property {string}  [chapterId]
 * @property {number}  x        – left edge of the zone (canvas px)
 * @property {number}  width    – zone width in px
 * @property {number}  centerX  – horizontal center of the zone (canvas px)
 */

/**
 * Compute the positioned event zones for all events.
 *
 * Steps:
 *  1. Sort events by date (then order field as tiebreaker).
 *  2. Compute ideal centerX from the time scale.
 *  3. Compute zone widths.
 *  4. Left-to-right pass to enforce min gap (and chapter gap between chapters).
 *
 * @param {Array<object>} events         – event records
 * @param {Array<object>} relationships  – all relationship records
 * @param {object}        scale          – result of computeScale()
 * @param {object}        [chapters]     – array of chapter records (used for ordering)
 * @returns {Map<string, EventZone>}
 */
export function computeEventZones(events, relationships, scale, chapters = []) {
  if (!events || events.length === 0) return new Map()

  // Build chapter order lookup for gap enforcement
  const chapterOrder = new Map()
  chapters.forEach(c => chapterOrder.set(c.id, c.order ?? 0))

  // Sort events by date, then by order field
  const sorted = [...events].sort((a, b) => {
    const tsDiff = dateToMs(a.date) - dateToMs(b.date)
    if (tsDiff !== 0) return tsDiff
    return (a.order ?? 0) - (b.order ?? 0)
  })

  // Build intermediate zone list with ideal positions
  const zones = sorted.map(event => {
    const width = computeZoneWidth(event.id, relationships)

    let idealCenterX
    if (scale.mode === SCALE_MODES.UNIFORM) {
      // Will be overridden in the spacing pass below
      idealCenterX = 0
    } else {
      idealCenterX = dateToX(event.date, scale)
    }

    return {
      eventId: event.id,
      chapterId: event.chapter_id ?? null,
      width,
      idealCenterX,
      centerX: idealCenterX,
    }
  })

  // UNIFORM mode: assign equal spacing
  if (scale.mode === SCALE_MODES.UNIFORM) {
    zones.forEach((zone, i) => {
      zone.idealCenterX = i * UNIFORM_SPACING + UNIFORM_SPACING / 2
      zone.centerX = zone.idealCenterX
    })
  }

  // Left-to-right overlap resolution pass
  for (let i = 1; i < zones.length; i++) {
    const prev = zones[i - 1]
    const curr = zones[i]

    // Determine required gap: extra if changing chapters
    const prevChapterOrd = chapterOrder.get(prev.chapterId) ?? 0
    const currChapterOrd = chapterOrder.get(curr.chapterId) ?? 0
    const gap = prevChapterOrd !== currChapterOrd ? CHAPTER_GAP : MIN_ZONE_GAP

    const prevRightEdge = prev.centerX + prev.width / 2
    const currLeftEdge = curr.centerX - curr.width / 2

    if (currLeftEdge < prevRightEdge + gap) {
      curr.centerX = prevRightEdge + gap + curr.width / 2
    }
  }

  const result = new Map()
  for (const zone of zones) {
    result.set(zone.eventId, {
      eventId: zone.eventId,
      chapterId: zone.chapterId,
      x: zone.centerX - zone.width / 2,
      width: zone.width,
      centerX: zone.centerX,
    })
  }

  return result
}

/**
 * Total canvas width needed to fit all event zones plus right padding.
 * @param {Map<string, EventZone>} eventZones
 * @param {number} [padding=120]
 * @returns {number}
 */
export function computeTotalCanvasWidth(eventZones, padding = 120) {
  if (eventZones.size === 0) return 600
  let maxRight = 0
  for (const zone of eventZones.values()) {
    const right = zone.x + zone.width
    if (right > maxRight) maxRight = right
  }
  return maxRight + padding
}

/**
 * Compute per-chapter bounding boxes from a positioned event zones map.
 * Returns Map<chapterId, { x, width, label, color }> using chapter metadata.
 *
 * @param {Map<string, EventZone>} eventZones
 * @param {Array<object>} chapters
 * @returns {Map<string, {x: number, width: number, label: string, color: string}>}
 */
export function computeChapterBounds(eventZones, chapters) {
  const bounds = new Map()

  for (const zone of eventZones.values()) {
    if (!zone.chapterId) continue
    const existing = bounds.get(zone.chapterId)
    const left = zone.x
    const right = zone.x + zone.width

    if (!existing) {
      bounds.set(zone.chapterId, { xMin: left, xMax: right })
    } else {
      if (left < existing.xMin) existing.xMin = left
      if (right > existing.xMax) existing.xMax = right
    }
  }

  const result = new Map()
  for (const chapter of chapters) {
    const b = bounds.get(chapter.id)
    if (!b) continue
    result.set(chapter.id, {
      chapterId: chapter.id,
      label: chapter.label,
      color: chapter.color ?? '#888',
      x: b.xMin,
      width: b.xMax - b.xMin,
    })
  }

  return result
}
