import { Check, Sparkles } from 'lucide-react'
import { selectSelectedClip, useProject } from '../../store/project'
import { DEFAULT_ADJUST, FILTERS } from '../../lib/filters'
import { useToast } from '../../store/toast'
import PanelHead from './PanelHead'
import type { Adjust } from '../../types'

const SLIDERS: { key: keyof Adjust; label: string; min: number; max: number }[] = [
  { key: 'brightness', label: 'Brightness', min: 0.5, max: 1.5 },
  { key: 'contrast', label: 'Contrast', min: 0.5, max: 1.5 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2 },
]

export default function FilterPanel() {
  const clip = useProject(selectSelectedClip)
  const asset = useProject((s) => (clip ? s.assets[clip.assetId] : undefined))
  const updateClip = useProject((s) => s.updateClip)
  const snapshot = useProject((s) => s.snapshot)
  const show = useToast((s) => s.show)
  if (!clip || !asset) return null

  const thumb = asset.thumbnails[Math.floor(asset.thumbnails.length / 2)]

  const applyAll = () => {
    const s = useProject.getState()
    s.snapshot()
    for (const c of s.clips) if (c.id !== clip.id) s.updateClip(c.id, { filter: clip.filter, adjust: { ...clip.adjust } })
    show('Look applied to every clip')
  }

  return (
    <div className="panel">
      <PanelHead
        icon={<Sparkles size={16} />}
        title="Look"
        right={
          <button className="btn sm" onClick={applyAll}>
            Apply to all
          </button>
        }
      />
      <div className="filter-list">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`filter-item ${clip.filter === f.id ? 'on' : ''}`}
            onClick={() => {
              snapshot()
              updateClip(clip.id, { filter: f.id })
            }}
          >
            <span className="sw" style={{ background: f.swatch }}>
              {thumb && <img src={thumb} alt="" style={{ filter: f.css || 'none' }} />}
              {clip.filter === f.id && (
                <span className="check">
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
            </span>
            {f.label}
          </button>
        ))}
      </div>
      {SLIDERS.map((s) => (
        <div className="slider-row" key={s.key}>
          <span>{s.label}</span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={0.01}
            value={clip.adjust[s.key]}
            onPointerDown={() => snapshot()}
            onDoubleClick={() => updateClip(clip.id, { adjust: { ...clip.adjust, [s.key]: DEFAULT_ADJUST[s.key] } })}
            onChange={(e) => updateClip(clip.id, { adjust: { ...clip.adjust, [s.key]: Number(e.target.value) } })}
          />
          <span className="val mono">{Math.round((clip.adjust[s.key] - 1) * 100) > 0 ? '+' : ''}{Math.round((clip.adjust[s.key] - 1) * 100)}</span>
        </div>
      ))}
    </div>
  )
}
