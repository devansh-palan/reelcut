import { Copy, Crop, Gauge, MoveHorizontal, Scissors, SlidersHorizontal, Sparkles, Trash2, Type } from 'lucide-react'
import { useProject } from '../store/project'
import { engine } from '../engine/engine'
import { useToast } from '../store/toast'
import type { Tool } from '../types'

const ICON = 19

/** Tools that open a panel. */
const PANEL_TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: 'trim', label: 'Trim', icon: <SlidersHorizontal size={ICON} /> },
  { id: 'speed', label: 'Speed', icon: <Gauge size={ICON} /> },
  { id: 'crop', label: 'Crop', icon: <Crop size={ICON} /> },
  { id: 'filter', label: 'Look', icon: <Sparkles size={ICON} /> },
  { id: 'text', label: 'Text', icon: <Type size={ICON} /> },
]

/**
 * Single-row dock: every action is always visible (no horizontal scrolling).
 * Nine items share the width evenly, so labels stay short.
 */
export default function ToolDock() {
  const tool = useProject((s) => s.tool)
  const setTool = useProject((s) => s.setTool)
  const selectedClipId = useProject((s) => s.selectedClipId)
  const show = useToast((s) => s.show)
  const hasClip = !!selectedClipId

  const split = () => {
    if (!selectedClipId) return
    const before = useProject.getState().clips.length
    useProject.getState().splitClip(selectedClipId, engine.getTime())
    if (useProject.getState().clips.length === before) show('Move the playhead inside the selected clip to split it', 'error')
  }

  return (
    <div className="dock">
      {PANEL_TOOLS.map((t) => (
        <button
          key={t.id}
          className={`tool ${tool === t.id ? 'on' : ''}`}
          disabled={!hasClip && t.id !== 'text'}
          onClick={() => setTool(tool === t.id ? 'none' : t.id)}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
      <button className="tool" disabled={!hasClip} onClick={split}>
        <Scissors size={ICON} />
        Split
      </button>
      <button className="tool" disabled={!hasClip} onClick={() => useProject.getState().duplicateClip(selectedClipId!)}>
        <Copy size={ICON} />
        Copy
      </button>
      <button className={`tool ${tool === 'move' ? 'on' : ''}`} disabled={!hasClip} onClick={() => setTool(tool === 'move' ? 'none' : 'move')}>
        <MoveHorizontal size={ICON} />
        Move
      </button>
      <button className="tool danger" disabled={!hasClip} onClick={() => useProject.getState().removeClip(selectedClipId!)}>
        <Trash2 size={ICON} />
        Delete
      </button>
    </div>
  )
}
