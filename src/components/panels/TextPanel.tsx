import { Plus, Trash2, Type } from 'lucide-react'
import { selectSelectedText, useProject } from '../../store/project'
import { engine } from '../../engine/engine'
import { usePlayback } from '../../store/playback'
import { formatTime, totalDuration } from '../../lib/timeline'
import PanelHead from './PanelHead'
import type { TextFont } from '../../types'

const COLORS = ['#ffffff', '#0a0a0d', '#ffb020', '#4ff0c3', '#ff4d5e', '#3ec3ff', '#ff9ad5', '#c8ff5e']
const BGS: { label: string; value: string | null }[] = [
  { label: 'None', value: null },
  { label: 'Black', value: 'rgba(0,0,0,0.75)' },
  { label: 'White', value: 'rgba(255,255,255,0.92)' },
  { label: 'Amber', value: '#ffb020' },
]
const FONTS: { id: TextFont; label: string }[] = [
  { id: 'Sora', label: 'Sora' },
  { id: 'JetBrains Mono', label: 'Mono' },
  { id: 'Georgia', label: 'Serif' },
]

export default function TextPanel() {
  const texts = useProject((s) => s.texts)
  const text = useProject(selectSelectedText)
  const clips = useProject((s) => s.clips)
  const addText = useProject((s) => s.addText)
  const updateText = useProject((s) => s.updateText)
  const removeText = useProject((s) => s.removeText)
  const selectText = useProject((s) => s.selectText)
  const snapshot = useProject((s) => s.snapshot)
  const time = usePlayback((s) => s.time)
  const total = totalDuration(clips)

  const add = () => {
    addText(engine.getTime())
  }

  return (
    <div className="panel">
      <PanelHead
        icon={<Type size={16} />}
        title="Text"
        right={
          <button className="btn sm" onClick={add}>
            <Plus size={14} /> New
          </button>
        }
      />
      {texts.length > 1 && (
        <div className="text-list">
          {texts.map((t, i) => (
            <button key={t.id} className={`chip ${t.id === text?.id ? 'on' : ''}`} onClick={() => selectText(t.id)}>
              {i + 1}. {t.text.split('\n')[0].slice(0, 14) || 'Text'}
            </button>
          ))}
        </div>
      )}
      {!text ? (
        <p style={{ margin: '4px 0 10px', color: 'var(--muted)', fontSize: 13 }}>
          {texts.length ? 'Tap a text on the preview to edit it.' : 'Add a title, caption or label on top of your video.'}
        </p>
      ) : (
        <>
          <textarea
            className="text-input"
            rows={1}
            value={text.text}
            onFocus={() => snapshot()}
            onChange={(e) => updateText(text.id, { text: e.target.value })}
            placeholder="Type something"
          />
          <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 6 }}>
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  className={`chip ${text.font === f.id ? 'on' : ''}`}
                  style={{ fontFamily: f.id === 'Georgia' ? 'Georgia, serif' : f.id }}
                  onClick={() => updateText(text.id, { font: f.id })}
                >
                  {f.label}
                </button>
              ))}
              <button className={`chip ${text.weight === 800 ? 'on' : ''}`} onClick={() => updateText(text.id, { weight: text.weight === 800 ? 400 : 800 })}>
                <b>B</b>
              </button>
            </div>
            <button className="icon-btn ghost" style={{ width: 32, height: 32, color: 'var(--danger)' }} onClick={() => removeText(text.id)} aria-label="Delete text">
              <Trash2 size={17} />
            </button>
          </div>
          <div className="row" style={{ marginTop: 10, gap: 14 }}>
            <div className="swatches">
              {COLORS.map((c) => (
                <button key={c} className={`swatch ${text.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => updateText(text.id, { color: c })} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="row" style={{ marginTop: 10, gap: 6 }}>
            <span className="label" style={{ marginRight: 4 }}>Box</span>
            {BGS.map((b) => (
              <button key={b.label} className={`chip ${text.bg === b.value ? 'on' : ''}`} onClick={() => updateText(text.id, { bg: b.value })}>
                {b.label}
              </button>
            ))}
          </div>
          <div className="slider-row" style={{ marginTop: 4 }}>
            <span>Size</span>
            <input type="range" min={0.02} max={0.16} step={0.002} value={text.size} onChange={(e) => updateText(text.id, { size: Number(e.target.value) })} />
            <span className="val mono">{Math.round(text.size * 1000) / 10}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
            <button className="btn sm" onClick={() => updateText(text.id, { from: Math.min(time, text.to - 0.2) })}>
              Start here <span className="mono" style={{ color: 'var(--muted)' }}>{formatTime(text.from)}</span>
            </button>
            <span className="mono label">{formatTime(time)}</span>
            <button className="btn sm" onClick={() => updateText(text.id, { to: Math.max(time, text.from + 0.2) })}>
              End here <span className="mono" style={{ color: 'var(--muted)' }}>{formatTime(Math.min(text.to, total))}</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
