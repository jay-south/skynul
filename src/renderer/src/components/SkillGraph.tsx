import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeChange,
  Position,
  Background,
  BackgroundVariant,
  applyNodeChanges
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Skill } from '../../../shared/skill'

const CATEGORY_COLORS: Record<string, string> = {
  trading: '#f59e0b',
  developer: '#3b82f6',
  communication: '#8b5cf6',
  daily: '#10b981',
  custom: '#6b7280'
}

const POSITIONS_KEY = 'skynul.skillGraph.positions'

type SavedPositions = Record<string, { x: number; y: number }>

function loadPositions(): SavedPositions {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePositions(positions: SavedPositions): void {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions))
}

function defaultPosition(index: number, count: number): { x: number; y: number } {
  const angleStep = (2 * Math.PI) / Math.max(count, 1)
  const radius = Math.min(160, 80 + count * 20)
  const startAngle = count === 1 ? 0 : -Math.PI / 2
  const angle = angleStep * index + startAngle
  return {
    x: 250 + Math.cos(angle) * radius,
    y: 200 + Math.sin(angle) * radius
  }
}

function buildNodes(skills: Skill[], saved: SavedPositions): Node[] {
  const agentNode: Node = {
    id: 'agent',
    position: saved['agent'] ?? { x: 250, y: 200 },
    data: { label: 'Agent' },
    style: {
      background: 'var(--nb-accent-2)',
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      fontWeight: 700,
      fontSize: 14,
      padding: '12px 24px',
      width: 'auto'
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    draggable: true
  }

  const skillNodes: Node[] = skills.map((s, i) => ({
    id: s.id,
    position: saved[s.id] ?? defaultPosition(i, skills.length),
    data: { label: s.name },
    style: {
      background: s.enabled
        ? CATEGORY_COLORS[s.tag] ?? CATEGORY_COLORS.custom
        : 'var(--nb-panel-2)',
      color: s.enabled ? '#fff' : 'var(--nb-muted)',
      border: s.enabled ? 'none' : '1px solid var(--nb-border)',
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 600,
      padding: '8px 16px',
      opacity: s.enabled ? 1 : 0.5,
      width: 'auto'
    },
    draggable: true
  }))

  return [agentNode, ...skillNodes]
}

export function SkillGraph({ skills }: { skills: Skill[] }): React.JSX.Element {
  const [nodes, setNodes] = useState<Node[]>(() => buildNodes(skills, loadPositions()))

  // Rebuild nodes when skills change (add/remove/toggle), preserving saved positions
  useEffect(() => {
    const saved = loadPositions()
    setNodes((prev) => {
      // Merge current dragged positions into saved
      const merged = { ...saved }
      for (const n of prev) {
        merged[n.id] = n.position
      }
      return buildNodes(skills, merged)
    })
  }, [skills])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => {
      const next = applyNodeChanges(changes, prev)
      // Persist positions on drag end
      const hasDragStop = changes.some((c) => c.type === 'position' && !('dragging' in c && c.dragging))
      if (hasDragStop) {
        const positions: SavedPositions = {}
        for (const n of next) {
          positions[n.id] = n.position
        }
        savePositions(positions)
      }
      return next
    })
  }, [])

  const edges: Edge[] = useMemo(() =>
    skills.map((s) => ({
      id: `e-${s.id}`,
      source: 'agent',
      target: s.id,
      animated: s.enabled,
      style: {
        stroke: s.enabled
          ? CATEGORY_COLORS[s.tag] ?? CATEGORY_COLORS.custom
          : 'var(--nb-border)',
        strokeWidth: s.enabled ? 2 : 1,
        opacity: s.enabled ? 0.8 : 0.3
      }
    })),
    [skills]
  )

  return (
    <div style={{ width: '100%', height: 360, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--nb-border)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--nb-border)" />
      </ReactFlow>
    </div>
  )
}
