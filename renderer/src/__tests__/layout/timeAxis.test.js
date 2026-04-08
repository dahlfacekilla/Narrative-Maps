import { describe, it, expect } from 'vitest'
import {
  parseDate,
  dateToMs,
  formatDateLabel,
  autoDetectScaleMode,
  computeScale,
  dateToX,
  computeAxisTicks,
  SCALE_MODES,
} from '../../layout/timeAxis.js'

// ─── parseDate ────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses a full YYYY-MM-DD string', () => {
    expect(parseDate('2002-07-11')).toEqual({ year: 2002, month: 7, day: 11 })
  })

  it('parses YYYY-MM, defaulting day to 1', () => {
    expect(parseDate('2004-09')).toEqual({ year: 2004, month: 9, day: 1 })
  })

  it('parses YYYY only, defaulting month and day to 1', () => {
    expect(parseDate('1996')).toEqual({ year: 1996, month: 1, day: 1 })
  })

  it('throws on invalid input', () => {
    expect(() => parseDate(null)).toThrow()
    expect(() => parseDate('')).toThrow()
    expect(() => parseDate('not-a-date')).toThrow()
  })
})

// ─── dateToMs ─────────────────────────────────────────────────────────────────

describe('dateToMs', () => {
  it('returns a larger timestamp for a later date', () => {
    expect(dateToMs('2003-01-01')).toBeGreaterThan(dateToMs('2002-01-01'))
  })

  it('two identical date strings produce the same timestamp', () => {
    expect(dateToMs('2002-07-11')).toBe(dateToMs('2002-07-11'))
  })

  it('YYYY resolves to January 1 of that year', () => {
    expect(dateToMs('2002')).toBe(dateToMs('2002-01-01'))
  })
})

// ─── formatDateLabel ──────────────────────────────────────────────────────────

describe('formatDateLabel', () => {
  it('formats YYYY-MM as "Mon YYYY"', () => {
    expect(formatDateLabel('2002-07')).toBe('Jul 2002')
    expect(formatDateLabel('2004-01')).toBe('Jan 2004')
  })

  it('formats YYYY-MM-DD as "Mon YYYY"', () => {
    expect(formatDateLabel('2002-11-18')).toBe('Nov 2002')
  })

  it('returns just the year for YYYY', () => {
    expect(formatDateLabel('1996')).toBe('1996')
  })
})

// ─── autoDetectScaleMode ──────────────────────────────────────────────────────

describe('autoDetectScaleMode', () => {
  it('returns UNIFORM for 0 or 1 events', () => {
    expect(autoDetectScaleMode([])).toBe(SCALE_MODES.UNIFORM)
    expect(autoDetectScaleMode([{ date: '2002' }])).toBe(SCALE_MODES.UNIFORM)
  })

  it('returns COMPRESSED for events spanning more than 5 years', () => {
    const events = [{ date: '1996' }, { date: '2010' }]
    expect(autoDetectScaleMode(events)).toBe(SCALE_MODES.COMPRESSED)
  })

  it('returns COMPRESSED when max gap is > 10× min gap', () => {
    // Dense cluster around 2002, then one event ten years later
    const events = [
      { date: '2002-01' },
      { date: '2002-02' },
      { date: '2002-03' },
      { date: '2012-01' },
    ]
    expect(autoDetectScaleMode(events)).toBe(SCALE_MODES.COMPRESSED)
  })

  it('returns PROPORTIONAL for evenly-spaced events within 5 years', () => {
    const events = [
      { date: '2002-01' },
      { date: '2002-07' },
      { date: '2003-01' },
      { date: '2003-07' },
    ]
    expect(autoDetectScaleMode(events)).toBe(SCALE_MODES.PROPORTIONAL)
  })
})

// ─── computeScale ─────────────────────────────────────────────────────────────

describe('computeScale (PROPORTIONAL)', () => {
  const events = [{ date: '2002-01' }, { date: '2004-01' }]
  const scale = computeScale(events, SCALE_MODES.PROPORTIONAL, { pxPerMonth: 80 })

  it('has correct mode', () => {
    expect(scale.mode).toBe(SCALE_MODES.PROPORTIONAL)
  })

  it('maps minTs to x=0', () => {
    expect(scale.toX(scale.minTs)).toBe(0)
  })

  it('maps a date 12 months later to ~960px (12 × 80)', () => {
    const oneYearMs = 365.25 * 24 * 60 * 60 * 1000
    const x = scale.toX(scale.minTs + oneYearMs)
    expect(x).toBeCloseTo(80 * 12, 0)
  })

  it('totalWidth is positive', () => {
    expect(scale.totalWidth).toBeGreaterThan(0)
  })
})

describe('computeScale (COMPRESSED)', () => {
  const events = [{ date: '1996' }, { date: '2010' }]
  const scale = computeScale(events, SCALE_MODES.COMPRESSED)

  it('has correct mode', () => {
    expect(scale.mode).toBe(SCALE_MODES.COMPRESSED)
  })

  it('maps minTs to x=0', () => {
    expect(scale.toX(scale.minTs)).toBeCloseTo(0, 5)
  })

  it('maps maxTs to totalWidth', () => {
    expect(scale.toX(scale.maxTs)).toBeCloseTo(scale.totalWidth, 1)
  })

  it('is monotonically increasing', () => {
    const ts1 = dateToMs('2000')
    const ts2 = dateToMs('2005')
    const ts3 = dateToMs('2010')
    expect(scale.toX(ts1)).toBeLessThan(scale.toX(ts2))
    expect(scale.toX(ts2)).toBeLessThan(scale.toX(ts3))
  })

  it('compresses large gaps relative to small gaps', () => {
    // The gap from 1996→2000 (4 years) vs 2000→2010 (10 years):
    // In proportional mode the ratio of pixel distances would be 4/10 = 0.4
    // In compressed mode the ratio is sqrt(4)/sqrt(10) ≈ 0.632 (closer together)
    const x1996 = scale.toX(dateToMs('1996'))
    const x2000 = scale.toX(dateToMs('2000'))
    const x2010 = scale.toX(dateToMs('2010'))
    const earlyGapPx = x2000 - x1996
    const lateGapPx = x2010 - x2000
    // In compressed mode, early-gap/late-gap should be higher than proportional (4/10)
    const ratio = earlyGapPx / lateGapPx
    expect(ratio).toBeGreaterThan(0.4)
  })
})

describe('computeScale (UNIFORM)', () => {
  const events = [{ date: '2002' }, { date: '2004' }, { date: '2006' }]
  const scale = computeScale(events, SCALE_MODES.UNIFORM)

  it('has correct mode', () => {
    expect(scale.mode).toBe(SCALE_MODES.UNIFORM)
  })

  it('has null toX (not used for UNIFORM)', () => {
    expect(scale.toX).toBeNull()
  })
})

describe('computeScale (empty events)', () => {
  it('returns a zero scale for empty event array', () => {
    const scale = computeScale([])
    expect(scale.toX(0)).toBe(0)
    expect(scale.totalWidth).toBe(0)
  })
})

// ─── dateToX ──────────────────────────────────────────────────────────────────

describe('dateToX', () => {
  it('works for PROPORTIONAL scale', () => {
    const events = [{ date: '2002-01' }, { date: '2004-01' }]
    const scale = computeScale(events, SCALE_MODES.PROPORTIONAL)
    expect(dateToX('2002-01', scale)).toBeCloseTo(0, 1)
    expect(dateToX('2004-01', scale)).toBeCloseTo(scale.totalWidth, 1)
  })

  it('throws for UNIFORM scale', () => {
    const events = [{ date: '2002' }, { date: '2003' }]
    const scale = computeScale(events, SCALE_MODES.UNIFORM)
    expect(() => dateToX('2002', scale)).toThrow()
  })
})

// ─── computeAxisTicks ─────────────────────────────────────────────────────────

describe('computeAxisTicks', () => {
  const events = [{ date: '2002-01' }, { date: '2004-06' }]
  const scale = computeScale(events, SCALE_MODES.PROPORTIONAL)

  it('returns an array of tick objects with x and label', () => {
    const ticks = computeAxisTicks(scale)
    expect(ticks.length).toBeGreaterThan(0)
    for (const tick of ticks) {
      expect(tick).toHaveProperty('x')
      expect(tick).toHaveProperty('label')
      expect(typeof tick.x).toBe('number')
    }
  })

  it('returns empty array for UNIFORM scale', () => {
    const events2 = [{ date: '2002' }, { date: '2003' }]
    const us = computeScale(events2, SCALE_MODES.UNIFORM)
    expect(computeAxisTicks(us)).toEqual([])
  })

  it('returns fewer ticks for year interval than quarter interval', () => {
    const yearTicks = computeAxisTicks(scale, { interval: 'year' })
    const quarterTicks = computeAxisTicks(scale, { interval: 'quarter' })
    expect(quarterTicks.length).toBeGreaterThan(yearTicks.length)
  })

  it('ticks are in ascending x order', () => {
    const ticks = computeAxisTicks(scale, { interval: 'year' })
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].x).toBeGreaterThan(ticks[i - 1].x)
    }
  })
})
