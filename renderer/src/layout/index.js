/**
 * Top-level layout computation.
 *
 * Accepts the raw investigation data and returns a complete layout object
 * consumed by the renderer. All functions are pure; no DOM or React dependency.
 */

import {
  computeScale,
  autoDetectScaleMode,
  computeAxisTicks,
  SCALE_MODES,
} from './timeAxis.js'

import {
  computeEventZones,
  computeTotalCanvasWidth,
  computeChapterBounds,
} from './eventZones.js'

import {
  buildEntityRows,
  getTotalCanvasHeight,
  buildGroupBandsMap,
} from './swimlanes.js'

import {
  assignEntitySlots,
  getEventParticipants,
} from './entitySlots.js'

export { SCALE_MODES }

/**
 * @typedef {Object} InvestigationData
 * @property {Array<object>} entities
 * @property {Array<object>} events
 * @property {Array<object>} relationships
 * @property {Array<object>} affiliations
 * @property {Array<object>} chapters
 * @property {object}        [overrides]
 */

/**
 * @typedef {Object} LayoutResult
 * @property {Array<object>}            rows           – EntityRow[]
 * @property {Map<string,object>}       groupBands     – affiliationId → band metadata
 * @property {Map<string,object>}       eventZones     – eventId → EventZone
 * @property {Map<string,object>}       chapterBounds  – chapterId → bounds
 * @property {Map<string,Map>}          entitySlots    – eventId → Map<entityId, slot>
 * @property {Map<string,Set>}          eventParticipants – eventId → Set<entityId>
 * @property {object}                   scale
 * @property {Array<object>}            axisTicks
 * @property {number}                   canvasWidth
 * @property {number}                   canvasHeight
 * @property {string}                   scaleMode
 */

/**
 * Compute the complete layout for an investigation.
 *
 * @param {InvestigationData} data
 * @param {{ scaleMode?: string, pxPerMonth?: number, basePxPerMonth?: number }} [options]
 * @returns {LayoutResult}
 */
export function computeLayout(data, options = {}) {
  const { entities, events, relationships, affiliations, chapters } = data

  // 1. Determine scale mode (auto-detect unless overridden)
  const scaleMode = options.scaleMode ?? autoDetectScaleMode(events)
  const scale = computeScale(events, scaleMode, options)

  // 2. Compute entity rows (swimlanes)
  const rows = buildEntityRows(entities, affiliations)
  const groupBands = buildGroupBandsMap(rows)

  // 3. Compute event zone positions
  const eventZones = computeEventZones(events, relationships, scale, chapters)
  const chapterBounds = computeChapterBounds(eventZones, chapters)

  // 4. Assign entity slots per event
  const entitySlots = new Map()
  const eventParticipants = new Map()
  for (const event of events) {
    const slots = assignEntitySlots(event.id, relationships, eventZones.get(event.id)?.width ?? 80)
    entitySlots.set(event.id, slots)
    eventParticipants.set(event.id, getEventParticipants(event.id, relationships))
  }

  // 5. Compute canvas dimensions
  const canvasWidth = computeTotalCanvasWidth(eventZones)
  const canvasHeight = getTotalCanvasHeight(rows)

  // 6. Axis ticks
  const axisTicks = computeAxisTicks(scale)

  return {
    rows,
    groupBands,
    eventZones,
    chapterBounds,
    entitySlots,
    eventParticipants,
    scale,
    axisTicks,
    canvasWidth,
    canvasHeight,
    scaleMode,
  }
}

/**
 * Re-compute the layout with a different scale mode, preserving other options.
 * Convenience wrapper used by the toolbar's scale toggle.
 */
export function recomputeWithScaleMode(data, scaleMode, options = {}) {
  return computeLayout(data, { ...options, scaleMode })
}
