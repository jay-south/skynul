import { useMemo } from 'react'
import {
  ReactFlow,
  type Node,
  type Edge,
  Position,
  Background,
  BackgroundVariant
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

export function SkillGraph({ skills }: { skills: Skill[] }): React.JSX.Element {
  const { nodes, edges } = useMemo(() => {
    const agentNode: Node = {
      id: 'agent',
      position: { x: 250, y: 200 },
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
      draggable: false
    }

    const angleStep = (2 * Math.PI) / Math.max(skills.length, 1)
    const radius = 160

    const skillNodes: Node[] = skills.map((s, i) => {
      const angle = angleStep * i - Math.PI / 2
      return {
        id: s.id,
        position: {
          x: 250 + Math.cos(angle) * radius,
          y: 200 + Math.sin(angle) * radius
        },
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
        draggable: false
      }
    })

    const skillEdges: Edge[] = skills.map((s) => ({
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
    }))

    return { nodes: [agentNode, ...skillNodes], edges: skillEdges }
  }, [skills])

  return (
    <div style={{ width: '100%', height: 320, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--nb-border)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--nb-border)" />
      </ReactFlow>
    </div>
  )
}
