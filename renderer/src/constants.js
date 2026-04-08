/**
 * Visual constants shared across renderer components.
 * Keep layout values in sync with layout/swimlanes.js (HEADER_HEIGHT, ROW_HEIGHT_*, etc.)
 */

// ─── Canvas ───────────────────────────────────────────────────────────────────

export const LEFT_PANEL_WIDTH = 200   // px — fixed swimlane label column
export const CANVAS_X_PADDING = 80   // px — left padding before the first event zone

// ─── Affiliation colors ───────────────────────────────────────────────────────
// Canonical color map — affiliations.json drives runtime colors;
// this provides a fallback and is used in the Legend.

export const AFFILIATION_COLORS = {
  'city-administration': '#4a90d9',
  'pension-board':       '#e67e22',
  'political':           '#9b59b6',
  'whistleblower':       '#27ae60',
  'enforcement':         '#e74c3c',
  'external':            '#888888',
}

// ─── Relationship type colors ─────────────────────────────────────────────────

export const RELATIONSHIP_COLORS = {
  financial:   '#f5a623',
  legal:       '#e74c3c',
  political:   '#9b59b6',
  employment:  '#3498db',
  adversarial: '#ff5a5a',
  board:       '#1abc9c',
  contractual: '#f39c12',
  influence:   '#8e44ad',
  personal:    '#7f8c8d',
}

// ─── Confidence styles ────────────────────────────────────────────────────────

export const CONFIDENCE_DASH = {
  verified:   null,              // solid
  reported:   '12,4',
  alleged:    '6,4',
  inferred:   '3,4',
}

export const CONFIDENCE_COLOR = {
  verified: '#27ae60',
  reported: '#f5a623',
  alleged:  '#e67e22',
  inferred: '#888888',
}

// ─── Relationship arcs ────────────────────────────────────────────────────────

export const ARC_STROKE_WIDTH = 4         // px
export const SPAN_STROKE_WIDTH = 1.5      // px for span relationships
export const ARC_OPACITY_DEFAULT = 0.85
export const ARC_OPACITY_DIMMED = 0.15

// ─── Entity icons ─────────────────────────────────────────────────────────────

export const ENTITY_ICON_SIZE = 28        // px — timeline canvas icon diameter
export const ENTITY_ICON_RING = 2.5       // px — ring border width
export const LEFT_PANEL_ICON_SIZE = 36    // px — left panel portrait diameter

// ─── Focus / dimming ─────────────────────────────────────────────────────────

export const OPACITY_FOCUSED    = 1.0
export const OPACITY_DIMMED     = 0.20
export const OPACITY_INACTIVE   = 0.35   // entity rows with no events in current chapter

// ─── Chapter header ───────────────────────────────────────────────────────────

export const CHAPTER_HEADER_HEIGHT = 32  // px
export const CHAPTER_HEADER_OPACITY = 0.18

// ─── Z-index layers ───────────────────────────────────────────────────────────

export const Z_SWIMLANE_BG   = 0
export const Z_SPAN_EDGE     = 1
export const Z_CHAPTER_BAR   = 2
export const Z_AXIS_TICK     = 3
export const Z_EVENT_MARKER  = 4
export const Z_ARC_EDGE      = 5
export const Z_ENTITY_ICON   = 10
