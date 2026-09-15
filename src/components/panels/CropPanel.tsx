import { Crop, RotateCcw } from 'lucide-react'
import { selectSelectedClip, useProject } from '../../store/project'
import PanelHead from './PanelHead'
import type { CropRect } from '../../types'

export const CROP_PRESETS: { label: string; ratio: number | null }[] = [
  { label: 'Free', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '16:9', ratio: 16 / 9 },
]

interface Props {
  ratio: number | null
  onRatio: (r: number | null) => void
}

/** Builds the largest centred crop with the given pixel ratio. */
function centredCrop(ratio: number, w: number, h: number): CropRect {
  const srcRatio = w / h
  if (ratio > srcRatio) {
    const ch = srcRatio / ratio
    return { x: 0, y: (1 - ch) / 2, w: 1, h: ch }
  }
  const cw = ratio / srcRatio
  return { x: (1 - cw) / 2, y: 0, w: cw, h: 1 }
}

export default function CropPanel({ ratio, onRatio }: Props) {
  const clip = useProject(selectSelectedClip)
  const asset = useProject((s) => (clip ? s.assets[clip.assetId] : undefined))
  const updateClip = useProject((s) => s.updateClip)
  const snapshot = useProject((s) => s.snapshot)
  if (!clip || !asset || !asset.width || !asset.height) return null

  const apply = (r: number | null) => {
    onRatio(r)
    if (r) {
      snapshot()
      updateClip(clip.id, { crop: centredCrop(r, asset.width, asset.height) })
    }
  }

  const reset = () => {
    snapshot()
    onRatio(null)
    updateClip(clip.id, { crop: { x: 0, y: 0, w: 1, h: 1 } })
  }

  const px = {
    w: Math.round(clip.crop.w * asset.width),
    h: Math.round(clip.crop.h * asset.height),
  }

  return (
    <div className="panel">
      <PanelHead
        icon={<Crop size={16} />}
        title="Crop"
        right={
          <span className="mono label">
            {px.w}×{px.h}
          </span>
        }
      />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="hscroll" style={{ margin: 0, padding: 0 }}>
          {CROP_PRESETS.map((p) => (
            <button key={p.label} className={`chip ${ratio === p.ratio ? 'on' : ''}`} onClick={() => apply(p.ratio)}>
              {p.label}
            </button>
          ))}
        </div>
        <button className="btn sm" onClick={reset}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>
      <p style={{ margin: '10px 0 4px', fontSize: 12, color: 'var(--muted)' }}>Drag the corners or move the box on the preview.</p>
    </div>
  )
}
