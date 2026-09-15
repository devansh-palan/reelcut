import { ArrowLeftToLine, ArrowRightToLine, ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react'
import { useProject } from '../../store/project'
import PanelHead from './PanelHead'

/** Reorders the selected clip within the timeline. */
export default function MovePanel() {
  const clips = useProject((s) => s.clips)
  const selectedClipId = useProject((s) => s.selectedClipId)
  const moveClip = useProject((s) => s.moveClip)
  const index = clips.findIndex((c) => c.id === selectedClipId)
  if (index < 0) return null
  const last = clips.length - 1

  const toEdge = (direction: -1 | 1) => {
    const steps = direction === -1 ? index : last - index
    for (let i = 0; i < steps; i++) moveClip(selectedClipId!, direction)
  }

  return (
    <div className="panel">
      <PanelHead
        icon={<MoveHorizontal size={16} />}
        title="Move clip"
        right={
          <span className="mono label">
            {index + 1} of {clips.length}
          </span>
        }
      />
      <div className="row" style={{ marginBottom: 8, gap: 6 }}>
        <button className="btn sm" style={{ padding: '0 10px' }} disabled={index === 0} onClick={() => toEdge(-1)} aria-label="Move to first">
          <ArrowLeftToLine size={16} />
        </button>
        <button className="btn sm" style={{ flex: 1, minWidth: 0 }} disabled={index === 0} onClick={() => moveClip(selectedClipId!, -1)}>
          <ChevronLeft size={16} /> Left
        </button>
        <button className="btn sm" style={{ flex: 1, minWidth: 0 }} disabled={index === last} onClick={() => moveClip(selectedClipId!, 1)}>
          Right <ChevronRight size={16} />
        </button>
        <button className="btn sm" style={{ padding: '0 10px' }} disabled={index === last} onClick={() => toEdge(1)} aria-label="Move to last">
          <ArrowRightToLine size={16} />
        </button>
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--muted)' }}>Moves the selected clip one step, or straight to the start or end.</p>
    </div>
  )
}
