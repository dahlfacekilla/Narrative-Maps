/**
 * Entity slot assignment within an event zone.
 *
 * For each event, determines the horizontal offset of each participating entity's icon
 * relative to the event's center X. Directed relationships create left-to-right stagger;
 * undirected relationships center both entities.
 *
 * Topologies handled (PRD §5.5.4):
 *   simple       – one directed A→B pair
 *   fan-out      – one source, multiple targets
 *   fan-in       – multiple sources, one target
 *   chain        – A→B→C (entity is both source and target)
 *   reciprocal   – A→B and B→A simultaneously
 *   independent  – multiple pairs sharing no entities
 *   mixed        – combination resolved via topological sort
 */

/**
 * @typedef {Object} EntitySlot
 * @property {number} xOffset  – px offset from zone centerX (negative = left, positive = right)
 * @property {'left'|'center'|'right'} side
 */

/**
 * Classify the relationship topology for a given event.
 * @param {Array<object>} relationships  – all relationships in the investigation
 * @param {string} eventId
 * @returns {'none'|'simple'|'fan-out'|'fan-in'|'chain'|'reciprocal'|'independent'|'mixed'}
 */
export function classifyTopology(relationships, eventId) {
  const rels = relationships.filter(r => r.event_id === eventId && r.direction === 'directed')
  if (rels.length === 0) return 'none'
  if (rels.length === 1) return 'simple'

  const outDegree = new Map()
  const inDegree = new Map()

  for (const r of rels) {
    outDegree.set(r.from, (outDegree.get(r.from) ?? 0) + 1)
    inDegree.set(r.to, (inDegree.get(r.to) ?? 0) + 1)
  }

  // Reciprocal: A→B and B→A
  for (const r of rels) {
    if (rels.some(r2 => r2.from === r.to && r2.to === r.from)) {
      return 'reciprocal'
    }
  }

  const entities = new Set([...outDegree.keys(), ...inDegree.keys()])

  // Chain: any entity has both incoming and outgoing
  for (const id of entities) {
    if ((outDegree.get(id) ?? 0) > 0 && (inDegree.get(id) ?? 0) > 0) {
      return 'chain'
    }
  }

  // Fan-out: one entity points to multiple targets
  for (const [, count] of outDegree) {
    if (count > 1) return 'fan-out'
  }

  // Fan-in: one entity receives from multiple sources
  for (const [, count] of inDegree) {
    if (count > 1) return 'fan-in'
  }

  // Independent: multiple separate pairs
  return 'independent'
}

/**
 * Assign horizontal slots to entities participating in a given event.
 *
 * The algorithm:
 *  1. Build directed-relationship degree maps for the event.
 *  2. Assign roles: pure source → left slot, pure sink → right slot, intermediate → center slot.
 *  3. For entities only in undirected relationships → center.
 *  4. stagger is clamped to ≤ 30px or 20% of zoneWidth.
 *
 * @param {string} eventId
 * @param {Array<object>} relationships  – all relationships
 * @param {number} zoneWidth             – pixel width of the event zone
 * @returns {Map<string, EntitySlot>}
 */
export function assignEntitySlots(eventId, relationships, zoneWidth) {
  const eventRels = relationships.filter(r => r.event_id === eventId)
  const slots = new Map()

  if (eventRels.length === 0) return slots

  const stagger = Math.min(30, zoneWidth * 0.2)
  const directed = eventRels.filter(r => r.direction === 'directed')
  const undirected = eventRels.filter(r => r.direction !== 'directed')

  if (directed.length === 0) {
    // All undirected — center everything
    for (const r of undirected) {
      if (!slots.has(r.from)) slots.set(r.from, { xOffset: 0, side: 'center' })
      if (!slots.has(r.to)) slots.set(r.to, { xOffset: 0, side: 'center' })
    }
    return slots
  }

  const outDegree = new Map()
  const inDegree = new Map()

  for (const r of directed) {
    outDegree.set(r.from, (outDegree.get(r.from) ?? 0) + 1)
    inDegree.set(r.to, (inDegree.get(r.to) ?? 0) + 1)
  }

  const allDirectedEntities = new Set([...outDegree.keys(), ...inDegree.keys()])

  for (const id of allDirectedEntities) {
    const out = outDegree.get(id) ?? 0
    const ins = inDegree.get(id) ?? 0

    if (out > 0 && ins === 0) {
      // Pure source → left
      slots.set(id, { xOffset: -stagger, side: 'left' })
    } else if (ins > 0 && out === 0) {
      // Pure sink → right
      slots.set(id, { xOffset: +stagger, side: 'right' })
    } else {
      // Intermediate (chain node) → center
      slots.set(id, { xOffset: 0, side: 'center' })
    }
  }

  // Undirected entities not already assigned
  for (const r of undirected) {
    if (!slots.has(r.from)) slots.set(r.from, { xOffset: 0, side: 'center' })
    if (!slots.has(r.to)) slots.set(r.to, { xOffset: 0, side: 'center' })
  }

  return slots
}

/**
 * Collect all unique entity IDs participating in a given event
 * (from both directed and undirected relationships).
 * @param {string} eventId
 * @param {Array<object>} relationships
 * @returns {Set<string>}
 */
export function getEventParticipants(eventId, relationships) {
  const participants = new Set()
  for (const r of relationships) {
    if (r.event_id === eventId) {
      participants.add(r.from)
      participants.add(r.to)
    }
  }
  return participants
}

/**
 * Compute the chain depth (longest directed path) through an event's relationships.
 * Used by eventZones to determine zone width.
 * @param {Array<object>} relationships  – event-scoped relationships (already filtered)
 * @returns {number}
 */
export function computeChainDepth(relationships) {
  const directed = relationships.filter(r => r.direction === 'directed')
  if (directed.length === 0) return 0

  const outgoing = new Map()
  const allNodes = new Set()

  for (const r of directed) {
    if (!outgoing.has(r.from)) outgoing.set(r.from, [])
    outgoing.get(r.from).push(r.to)
    allNodes.add(r.from)
    allNodes.add(r.to)
  }

  let maxDepth = 0

  function dfs(node, depth, visited) {
    if (visited.has(node)) return // prevent infinite loops on cycles
    visited.add(node)
    if (depth > maxDepth) maxDepth = depth
    for (const next of (outgoing.get(node) ?? [])) {
      dfs(next, depth + 1, new Set(visited))
    }
  }

  for (const node of allNodes) {
    dfs(node, 0, new Set())
  }

  return maxDepth
}
