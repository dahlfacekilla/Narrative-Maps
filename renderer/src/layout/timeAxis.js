/**
 * Time axis utilities: date parsing, timestamp conversion, and scale computation.
 *
 * Scale modes (PRD §5.4):
 *   compressed   – sqrt scale that compresses large temporal gaps (default)
 *   proportional – linear; 1 month = consistent pixel width
 *   uniform      – equal spacing regardless of date
 */

export const SCALE_MODES = Object.freeze({
  COMPRESSED: 'compressed',
  PROPORTIONAL: 'proportional',
  UNIFORM: 'uniform',
})

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_MONTH = 30.44 * MS_PER_DAY
const MS_PER_YEAR = 365.25 * MS_PER_DAY

/**
 * Parse a date string of the form YYYY, YYYY-MM, or YYYY-MM-DD.
 * Returns { year, month (1-12), day (1-31) } using the start of the period.
 * @param {string} dateStr
 * @returns {{ year: number, month: number, day: number }}
 */
export function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error(`Invalid date string: ${JSON.stringify(dateStr)}`)
  }
  const parts = dateStr.split('-')
  const year = parseInt(parts[0], 10)
  if (isNaN(year)) throw new Error(`Invalid date string: ${dateStr}`)
  const month = parts[1] != null ? parseInt(parts[1], 10) : 1
  const day = parts[2] != null ? parseInt(parts[2], 10) : 1
  return { year, month, day }
}

/**
 * Convert a date string to a UTC timestamp (ms since epoch).
 * Uses the start of the period (e.g. "2002" → Jan 1 2002 UTC).
 * @param {string} dateStr
 * @returns {number}
 */
export function dateToMs(dateStr) {
  const { year, month, day } = parseDate(dateStr)
  return Date.UTC(year, month - 1, day)
}

/**
 * Format a date string for display on the time axis.
 * "2002-07-11" → "Jul 2002", "2002-07" → "Jul 2002", "2002" → "2002"
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDateLabel(dateStr) {
  const parts = dateStr.split('-')
  if (parts.length === 1) return parts[0]
  const year = parts[0]
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const month = monthNames[parseInt(parts[1], 10) - 1] ?? parts[1]
  return `${month} ${year}`
}

/**
 * Detect the best scale mode for a set of events based on their temporal distribution.
 * - If event timestamps span > 5 years OR max gap is > 10× min gap → compressed
 * - If events span ≤ 1 year → proportional
 * - Otherwise → proportional
 * @param {Array<{date: string}>} events
 * @returns {string} SCALE_MODES value
 */
export function autoDetectScaleMode(events) {
  if (!events || events.length < 2) return SCALE_MODES.UNIFORM

  const timestamps = events
    .map(e => dateToMs(e.date))
    .sort((a, b) => a - b)

  const totalMs = timestamps[timestamps.length - 1] - timestamps[0]
  const totalYears = totalMs / MS_PER_YEAR

  if (totalYears > 5) return SCALE_MODES.COMPRESSED

  const gaps = []
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1]
    if (gap > 0) gaps.push(gap)
  }

  if (gaps.length === 0) return SCALE_MODES.UNIFORM

  const maxGap = Math.max(...gaps)
  const minGap = Math.min(...gaps)
  if (minGap > 0 && maxGap / minGap > 10) return SCALE_MODES.COMPRESSED

  return SCALE_MODES.PROPORTIONAL
}

/**
 * Compute a scale object given a set of events and a mode.
 *
 * The returned scale has:
 *   - mode
 *   - minTs, maxTs  (bounding timestamps)
 *   - toX(ts)       (timestamp → canvas X pixel; undefined for UNIFORM)
 *   - totalWidth    (approximate canvas width needed; 0 for UNIFORM)
 *
 * @param {Array<{date: string}>} events
 * @param {string} [mode]
 * @param {{ pxPerMonth?: number, basePxPerMonth?: number }} [options]
 * @returns {object}
 */
export function computeScale(events, mode = SCALE_MODES.COMPRESSED, options = {}) {
  if (!events || events.length === 0) {
    return { mode, minTs: 0, maxTs: 0, toX: () => 0, totalWidth: 0 }
  }

  const timestamps = events.map(e => dateToMs(e.date))
  const minTs = Math.min(...timestamps)
  const maxTs = Math.max(...timestamps)

  if (mode === SCALE_MODES.PROPORTIONAL) {
    const pxPerMonth = options.pxPerMonth ?? 80
    const msPerPx = MS_PER_MONTH / pxPerMonth
    const totalWidth = (maxTs - minTs) / msPerPx
    return {
      mode,
      minTs,
      maxTs,
      msPerPx,
      totalWidth,
      toX: (ts) => (ts - minTs) / msPerPx,
    }
  }

  if (mode === SCALE_MODES.COMPRESSED) {
    // x = sqrt((ts - minTs) / (maxTs - minTs)) * totalWidth
    const basePxPerMonth = options.basePxPerMonth ?? 45
    const totalMonths = (maxTs - minTs) / MS_PER_MONTH
    const totalWidth = Math.max(600, Math.sqrt(totalMonths) * basePxPerMonth * 10)
    const span = maxTs - minTs

    return {
      mode,
      minTs,
      maxTs,
      totalWidth,
      toX: (ts) => {
        if (span === 0) return 0
        return Math.sqrt((ts - minTs) / span) * totalWidth
      },
    }
  }

  // UNIFORM — toX is intentionally null; eventZones assigns positions
  return {
    mode: SCALE_MODES.UNIFORM,
    minTs,
    maxTs,
    totalWidth: 0,
    toX: null,
  }
}

/**
 * Convert a date string to a canvas X pixel using the given scale.
 * Throws for UNIFORM mode (use eventZones instead).
 * @param {string} dateStr
 * @param {object} scale  result of computeScale()
 * @returns {number}
 */
export function dateToX(dateStr, scale) {
  if (scale.mode === SCALE_MODES.UNIFORM) {
    throw new Error('dateToX is not valid for UNIFORM mode — use computeEventZones()')
  }
  return scale.toX(dateToMs(dateStr))
}

/**
 * Generate tick mark positions for the time axis (years or quarters).
 * Returns an array of { dateStr, x, label } objects.
 * @param {object} scale  result of computeScale()
 * @param {{ interval?: 'year' | 'quarter' }} [options]
 * @returns {Array<{dateStr: string, x: number, label: string}>}
 */
export function computeAxisTicks(scale, options = {}) {
  if (scale.mode === SCALE_MODES.UNIFORM || scale.minTs === scale.maxTs) return []

  const totalYears = (scale.maxTs - scale.minTs) / MS_PER_YEAR
  const interval = options.interval ?? (totalYears > 4 ? 'year' : 'quarter')

  const startDate = parseDate(new Date(scale.minTs).toISOString().slice(0, 10))
  const endDate = parseDate(new Date(scale.maxTs).toISOString().slice(0, 10))

  const ticks = []

  if (interval === 'year') {
    for (let y = startDate.year; y <= endDate.year + 1; y++) {
      const ts = Date.UTC(y, 0, 1)
      if (ts < scale.minTs - MS_PER_YEAR * 0.1) continue
      if (ts > scale.maxTs + MS_PER_YEAR * 0.5) break
      ticks.push({ dateStr: `${y}`, x: scale.toX(ts), label: `${y}` })
    }
  } else {
    for (let y = startDate.year; y <= endDate.year + 1; y++) {
      for (let q = 0; q < 4; q++) {
        const month = q * 3
        const ts = Date.UTC(y, month, 1)
        if (ts < scale.minTs - MS_PER_MONTH * 1.5) continue
        if (ts > scale.maxTs + MS_PER_MONTH * 3) break
        const label = q === 0 ? `${y}` : `Q${q + 1} ${y}`
        ticks.push({ dateStr: `${y}-${String(month + 1).padStart(2, '0')}`, x: scale.toX(ts), label })
      }
    }
  }

  return ticks
}
