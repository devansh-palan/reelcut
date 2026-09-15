import { Gauge } from 'lucide-react'
import { selectSelectedClip, useProject } from '../../store/project'
import { SPEED_MAX, SPEED_MIN, clipLength, formatTime } from '../../lib/timeline'
import PanelHead from './PanelHead'

const PRESETS = [0.5, 0.75, 1, 1.5, 2, 3]

export default function SpeedPanel() {
  const clip = useProject(selectSelectedClip)
  const asset = useProject((s) => (clip ? s.assets[clip.assetId] : undefined))
  const updateClip = useProject((s) => s.updateClip)
  const snapshot = useProject((s) => s.snapshot)
  if (!clip || !asset) return null

  const setSpeed = (speed: number, withHistory = true) => {
    if (withHistory) snapshot()
    updateClip(clip.id, { speed: Math.round(speed * 100) / 100 })
  }

  if (asset.kind === 'image') {
    return (
      <div className="panel">
        <PanelHead icon={<Gauge size={16} />} title="Speed" />
        <p style={{ margin: '4px 0 10px', color: 'var(--muted)', fontSize: 13 }}>
          Speed applies to video clips. Use Trim to change how long this photo stays on screen.
        </p>
      </div>
    )
  }

  return (
    <div className="panel">
      <PanelHead
        icon={<Gauge size={16} />}
        title="Speed"
        right={
          <span className="mono label">
            {clip.speed}× · {formatTime(clipLength(clip))}
          </span>
        }
      />
      <div className="row" style={{ gap: 6, marginBottom: 6 }}>
        {PRESETS.map((p) => (
          <button key={p} className={`chip ${clip.speed === p ? 'on' : ''}`} style={{ flex: 1, justifyContent: 'center', padding: 0 }} onClick={() => setSpeed(p)}>
            {p}×
          </button>
        ))}
      </div>
      <div className="slider-row">
        <span>Fine tune</span>
        <input
          type="range"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={0.05}
          value={clip.speed}
          onPointerDown={() => snapshot()}
          onChange={(e) => setSpeed(Number(e.target.value), false)}
        />
        <span className="val mono">{clip.speed.toFixed(2)}×</span>
      </div>
    </div>
  )
}
