import { useMemo, useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Panel,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './index.css'

import entitiesRaw from '../../investigations/san-diego-pension-crisis/entities.json'
import relationshipsRaw from '../../investigations/san-diego-pension-crisis/relationships.json'

// ─── Constants ────────────────────────────────────────────────────────────────

const YEAR_WIDTH = 260       // px per year along x-axis
const LANE_HEIGHT = 68       // px per timeline_y unit
const X_ORIGIN_YEAR = 1999   // year at x=0 (so 2000 → 260px, 2002 → 780px, etc.)
const X_OFFSET = 180         // left margin (for swimlane labels)
const Y_OFFSET = 40          // top margin

const AFFILIATION_COLORS = {
  'city-administration': { bg: 'rgba(20,50,88,0.4)',  border: '#4a90d9', label: '#6aaaf5', dot: '#4a90d9' },
  'pension-board':       { bg: 'rgba(70,38,0,0.4)',   border: '#e67e22', label: '#f0a050', dot: '#e67e22' },
  'political':           { bg: 'rgba(52,20,80,0.4)',  border: '#9b59b6', label: '#c080e0', dot: '#9b59b6' },
  'whistleblower':       { bg: 'rgba(18,60,30,0.4)',  border: '#27ae60', label: '#50d080', dot: '#27ae60' },
  'enforcement':         { bg: 'rgba(72,20,20,0.4)',  border: '#e74c3c', label: '#f08080', dot: '#e74c3c' },
  'external':            { bg: 'rgba(36,36,36,0.4)',  border: '#888',    label: '#aaa',    dot: '#888'    },
}

const CONNECTION_STYLE = {
  verified:  { strokeWidth: 1.5, strokeDasharray: undefined, opacity: 0.75 },
  reported:  { strokeWidth: 1.2, strokeDasharray: '7,4',     opacity: 0.65 },
  alleged:   { strokeWidth: 1.0, strokeDasharray: '3,5',     opacity: 0.45 },
  inferred:  { strokeWidth: 0.8, strokeDasharray: '2,7',     opacity: 0.35 },
}

const CONNECTION_COLOR = {
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

// Affiliation swimlane bands (yMin/yMax in timeline_y units)
const SWIMLANES = [
  { id: 'lane-city-administration', label: 'City Administration', affiliation: 'city-administration', yMin: 0.4,  yMax: 3.6  },
  { id: 'lane-pension-board',       label: 'Pension Board',       affiliation: 'pension-board',       yMin: 3.6,  yMax: 7.3  },
  { id: 'lane-political',           label: 'Political',           affiliation: 'political',           yMin: 7.3,  yMax: 9.5  },
  { id: 'lane-whistleblower',       label: 'Whistleblowers',      affiliation: 'whistleblower',       yMin: 9.5,  yMax: 11.0 },
  { id: 'lane-enforcement',         label: 'Enforcement',         affiliation: 'enforcement',         yMin: 11.0, yMax: 13.5 },
  { id: 'lane-external',            label: 'External / Finance',  affiliation: 'external',            yMin: 13.5, yMax: 15.5 },
]

// ─── Coordinate helpers ────────────────────────────────────────────────────────

function toPixels(timeline_x, timeline_y) {
  return {
    x: (timeline_x - X_ORIGIN_YEAR) * YEAR_WIDTH + X_OFFSET,
    y: timeline_y * LANE_HEIGHT + Y_OFFSET,
  }
}

// ─── Custom Node: Entity ──────────────────────────────────────────────────────

function EntityNode({ data, selected }) {
  const colors = AFFILIATION_COLORS[data.affiliation] || AFFILIATION_COLORS['external']
  const isEvent = data.type === 'event'
  const isOrg   = data.type === 'organization'

  const dotStyle = {
    width:  isEvent ? 9 : isOrg ? 13 : 9,
    height: isEvent ? 9 : isOrg ? 7  : 9,
    borderRadius: isOrg ? '2px' : '50%',
    transform: isEvent ? 'rotate(45deg)' : 'none',
    backgroundColor: colors.dot,
    boxShadow: selected
      ? `0 0 10px 3px ${colors.dot}`
      : `0 0 5px ${colors.dot}88`,
    flexShrink: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
      <Handle type="target" position={Position.Left}  style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <div style={dotStyle} />
      <div style={{
        marginTop: 5,
        fontSize: 9.5,
        color: selected ? '#fff' : colors.label,
        whiteSpace: 'nowrap',
        maxWidth: 130,
        textAlign: 'center',
        lineHeight: 1.25,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        letterSpacing: '0.03em',
        textTransform: isEvent ? 'uppercase' : 'none',
        fontWeight: selected ? 'bold' : 'normal',
      }}>
        {data.label}
      </div>
    </div>
  )
}

// ─── Custom Node: Swimlane background ─────────────────────────────────────────

function SwimlaneNode({ data }) {
  const colors = AFFILIATION_COLORS[data.affiliation] || {}
  return (
    <div style={{
      width: data.width,
      height: data.height,
      background: colors.bg,
      borderLeft: `2px solid ${colors.border}22`,
      borderBottom: `1px solid ${colors.border}18`,
      display: 'flex',
      alignItems: 'flex-start',
      paddingTop: 8,
      paddingLeft: 10,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      <span style={{
        fontSize: 9,
        color: colors.border,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        opacity: 0.55,
      }}>
        {data.label}
      </span>
    </div>
  )
}

const nodeTypes = {
  entity:   EntityNode,
  swimlane: SwimlaneNode,
}

// ─── Detail panel for selected node ──────────────────────────────────────────

function DetailPanel({ node, onClose }) {
  if (!node) return null
  const d = node.data
  const colors = AFFILIATION_COLORS[d.affiliation] || AFFILIATION_COLORS['external']

  return (
    <div style={{
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 320,
      background: '#141414',
      border: `1px solid ${colors.border}66`,
      borderRadius: 4,
      padding: '14px 16px',
      zIndex: 1000,
      fontFamily: 'monospace',
      color: '#ccc',
      boxShadow: `0 0 20px ${colors.border}22`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: colors.label, marginBottom: 2 }}>{d.label}</div>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {d.type} · {d.affiliation}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: 0,
        }}>✕</button>
      </div>
      {d.description && (
        <div style={{ fontSize: 10.5, color: '#999', lineHeight: 1.6, marginBottom: 10 }}>
          {d.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {d.confidence && (
          <span style={{
            fontSize: 8.5, padding: '2px 6px', borderRadius: 2,
            border: `1px solid ${colors.border}55`, color: colors.label,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>{d.confidence}</span>
        )}
        {(d.tags || []).map(t => (
          <span key={t} style={{
            fontSize: 8.5, padding: '2px 6px', borderRadius: 2,
            border: '1px solid #333', color: '#666',
          }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      background: '#111',
      border: '1px solid #2a2a2a',
      borderRadius: 4,
      padding: open ? '12px 14px' : '8px 14px',
      fontFamily: 'monospace',
      color: '#888',
      fontSize: 9.5,
      cursor: 'pointer',
      minWidth: 160,
    }} onClick={() => setOpen(o => !o)}>
      <div style={{ letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: open ? 10 : 0, color: '#555' }}>
        Legend {open ? '▲' : '▼'}
      </div>
      {open && (
        <>
          <div style={{ marginBottom: 8 }}>
            {Object.entries(AFFILIATION_COLORS).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.dot }} />
                <span style={{ color: v.label, fontSize: 9 }}>{k}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #222', paddingTop: 8, marginTop: 4 }}>
            <div style={{ color: '#555', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 8.5 }}>connections</div>
            {[
              { label: 'financial', color: CONNECTION_COLOR.financial },
              { label: 'legal',     color: CONNECTION_COLOR.legal },
              { label: 'political', color: CONNECTION_COLOR.political },
              { label: 'employment', color: CONNECTION_COLOR.employment },
              { label: 'adversarial', color: CONNECTION_COLOR.adversarial },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 14, height: 1.5, background: color, opacity: 0.7 }} />
                <span style={{ color: '#666', fontSize: 9 }}>{label}</span>
              </div>
            ))}
            <div style={{ marginTop: 6, color: '#444', fontSize: 9 }}>
              — solid = verified<br />
              – – dashed = reported<br />
              ·· dotted = alleged
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Year axis ruler ──────────────────────────────────────────────────────────

function YearAxis() {
  const years = []
  for (let y = 1996; y <= 2011; y++) years.push(y)
  return (
    <div style={{
      position: 'absolute',
      top: Y_OFFSET - 28,
      left: 0,
      right: 0,
      pointerEvents: 'none',
      zIndex: 0,
    }}>
      {years.map(y => (
        <div key={y} style={{
          position: 'absolute',
          left: (y - X_ORIGIN_YEAR) * YEAR_WIDTH + X_OFFSET - 16,
          fontSize: 9,
          color: '#2a2a2a',
          letterSpacing: '0.08em',
          userSelect: 'none',
        }}>
          {y}
        </div>
      ))}
    </div>
  )
}

// ─── Build graph data ─────────────────────────────────────────────────────────

function buildGraph() {
  // Calculate canvas dimensions
  const xs = entitiesRaw.filter(e => e.timeline_x).map(e => e.timeline_x)
  const maxYear = Math.max(...xs)
  const totalWidth = (maxYear - X_ORIGIN_YEAR + 2) * YEAR_WIDTH + X_OFFSET + 200

  // Swimlane background nodes (rendered behind everything)
  const swimlaneNodes = SWIMLANES.map(lane => ({
    id: lane.id,
    type: 'swimlane',
    position: {
      x: 0,
      y: lane.yMin * LANE_HEIGHT + Y_OFFSET,
    },
    data: {
      label: lane.label,
      affiliation: lane.affiliation,
      width: totalWidth,
      height: (lane.yMax - lane.yMin) * LANE_HEIGHT,
    },
    selectable: false,
    draggable: false,
    connectable: false,
    focusable: false,
    zIndex: -1,
  }))

  // Entity nodes
  const entityNodes = entitiesRaw
    .filter(e => e.timeline_x && e.timeline_y)
    .map(entity => {
      const pos = toPixels(entity.timeline_x, entity.timeline_y)
      return {
        id: entity.id,
        type: 'entity',
        position: pos,
        data: {
          label: entity.label,
          type: entity.type,
          affiliation: entity.affiliation,
          description: entity.description,
          confidence: entity.confidence,
          tags: entity.tags || [],
          role: entity.role,
        },
        draggable: true,
        zIndex: 10,
      }
    })

  // Edges from relationships
  const edges = relationshipsRaw.map(rel => {
    const edgeStyle = CONNECTION_STYLE[rel.confidence] || CONNECTION_STYLE.reported
    const color = CONNECTION_COLOR[rel.type] || '#555'
    return {
      id: rel.id,
      source: rel.from,
      target: rel.to,
      type: 'default',
      animated: false,
      label: undefined, // skip labels for cleanliness; show on hover later
      style: {
        stroke: color,
        strokeWidth: edgeStyle.strokeWidth,
        strokeDasharray: edgeStyle.strokeDasharray,
        opacity: edgeStyle.opacity,
      },
      markerEnd: rel.direction === 'directed'
        ? { type: MarkerType.ArrowClosed, color, width: 8, height: 8 }
        : undefined,
      data: {
        label: rel.label,
        type: rel.type,
        confidence: rel.confidence,
        description: rel.description,
      },
    }
  })

  return { nodes: [...swimlaneNodes, ...entityNodes], edges }
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildGraph(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState(null)

  const onNodeClick = useCallback((_, node) => {
    if (node.type === 'swimlane') return
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0d0d0d', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.05}
        maxZoom={4}
        defaultEdgeOptions={{ type: 'default' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a1a1a" gap={YEAR_WIDTH} size={1} />
        <Controls
          showInteractive={false}
          style={{ bottom: 24, left: 24, top: 'auto' }}
        />
        <MiniMap
          style={{ background: '#0d0d0d', border: '1px solid #1e1e1e' }}
          maskColor="rgba(0,0,0,0.7)"
          nodeColor={(n) => {
            if (n.type === 'swimlane') return 'transparent'
            return AFFILIATION_COLORS[n.data?.affiliation]?.dot || '#555'
          }}
          nodeStrokeWidth={0}
        />

        {/* Title */}
        <Panel position="top-left">
          <div style={{
            background: 'rgba(13,13,13,0.92)',
            border: '1px solid #1e1e1e',
            borderRadius: 3,
            padding: '12px 16px',
            fontFamily: 'monospace',
          }}>
            <div style={{ fontSize: 13, letterSpacing: '0.14em', color: '#ddd', fontWeight: 'bold' }}>
              SAN DIEGO PENSION CRISIS
            </div>
            <div style={{ fontSize: 9, color: '#444', marginTop: 3, letterSpacing: '0.08em' }}>
              1996 – 2010 · Narrative Structures
            </div>
          </div>
        </Panel>

        {/* Legend */}
        <Panel position="top-right">
          <Legend />
        </Panel>
      </ReactFlow>

      {/* Detail panel outside ReactFlow to avoid z-index issues */}
      {selectedNode && (
        <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  )
}
