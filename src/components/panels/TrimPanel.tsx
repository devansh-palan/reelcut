import { useRef } from 'react'
import { Scissors } from 'lucide-react'
import { selectSelectedClip, useProject } from '../../store/project'
import { engine } from '../../engine/engine'
import { MIN_CLIP_LENGTH, clamp, clipLength, clipOffset, formatTime } from '../../lib/timeline'
import PanelHead from './PanelHead'
import { IMAGE_MAX_DURATION } from '../../lib/media'

/**
 * Two-handle trim over a filmstrip of the whole source. Dragging a handle
 * scrubs the preview to that edge so the user sees exactly where the cut lands.
 */
export default function TrimPanel() {
  const clip = useProject(selectSelectedClip)
  const asset = useProject((s) => (clip ? s.assets[clip.assetId] : undefined))
  const updateClip = useProject((s) => s.updateClip)
  const stripRef = useRef<HTMLDivElement>(null)
  const drag = useRef<'l' | 'r' | null>(null)

  if (!clip || !asset) return null

  const dur = asset.duration
  const startPct = (clip.start / dur) * 100
  const endPct = (clip.end / dur) * 100

  const fracFromEvent = (e: React.PointerEvent) => {
    const rect = stripRef.current!.getBoundingClientRect()
    return clamp((e.clientX - rect.left) / rect.width, 0, 1)
  }

  const onDown = (side: 'l' | 'r') => (e: React.PointerEvent) => {
    e.preventDefault()
    useProject.getState().snapshot()
    engine.pause()
    drag.current = side
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const t = fracFromEvent(e) * dur
    const clips = useProject.getState().clips
    const offset = clipOffset(clips, clip.id)
    if (drag.current === 'l') {
      const start = clamp(t, 0, clip.end - MIN_CLIP_LENGTH)
      updateClip(clip.id, { start })
      engine.seek(offset)
    } else {
      const end = clamp(t, clip.start + MIN_CLIP_LENGTH, dur)
      updateClip(clip.id, { end })
      engine.seek(offset + (end - clip.start) / (clip.speed || 1) - 0.04)
    }
  }

  const onUp = () => {
    drag.current = null
  }

  if (asset.kind === 'image') {
    const len = clipLength(clip)
    return (
      <div className="panel">
        <PanelHead icon={<Scissors size={16} />} title="Duration" />
        <div className="slider-row">
          <span>Show for</span>
          <input
            type="range"
            min={0.5}
            max={IMAGE_MAX_DURATION}
            step={0.1}
            value={len}
            onPointerDown={() => useProject.getState().snapshot()}
            onChange={(e) => updateClip(clip.id, { start: 0, end: Number(e.target.value) })}
          />
          <span className="val mono">{len.toFixed(1)}s</span>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <PanelHead icon={<Scissors size={16} />} title="Trim" right={<span className="mono label">{formatTime(clipLength(clip))} kept</span>} />
      <div className="trim-strip" ref={stripRef} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="thumbs">
          {asset.thumbnails.map((src, i) => (
            <img key={i} src={src} alt="" draggable={false} />
          ))}
        </div>
        <div className="shade" style={{ left: 0, width: `${startPct}%` }} />
        <div className="shade" style={{ left: `${endPct}%`, right: 0 }} />
        <div className="window" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
        <div className="handle l" style={{ left: `${startPct}%` }} onPointerDown={onDown('l')} />
        <div className="handle r" style={{ left: `${endPct}%` }} onPointerDown={onDown('r')} />
      </div>
      <div className="trim-times">
        <span>
          in <b>{formatTime(clip.start)}</b>
        </span>
        <span>
          source {formatTime(dur)}
        </span>
        <span>
          out <b>{formatTime(clip.end)}</b>
        </span>
      </div>
    </div>
  )
}
