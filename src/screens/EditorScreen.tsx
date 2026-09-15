import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown, Redo2, Undo2, Upload } from 'lucide-react'
import { useProject } from '../store/project'
import { engine } from '../engine/engine'
import { ASPECTS } from '../lib/timeline'
import { useImport } from '../lib/useImport'
import Stage from '../components/Stage'
import Transport from '../components/Transport'
import Timeline from '../components/Timeline'
import ToolDock from '../components/ToolDock'
import TrimPanel from '../components/panels/TrimPanel'
import SpeedPanel from '../components/panels/SpeedPanel'
import MovePanel from '../components/panels/MovePanel'
import CropPanel from '../components/panels/CropPanel'
import FilterPanel from '../components/panels/FilterPanel'
import TextPanel from '../components/panels/TextPanel'
import CropBox from '../components/overlays/CropBox'
import TextLayer from '../components/overlays/TextLayer'
import type { AspectId, MediaAsset } from '../types'

function AspectPicker() {
  const aspect = useProject((s) => s.aspect)
  const setAspect = useProject((s) => s.setAspect)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const shape = (id: AspectId) => {
    const a = ASPECTS.find((x) => x.id === id)!
    const r = a.w / a.h
    return <span className="shape" style={{ width: r >= 1 ? 16 : 16 * r, height: r >= 1 ? 16 / r : 16 }} />
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="aspect-btn" onClick={() => setOpen((o) => !o)}>
        {shape(aspect)}
        {aspect}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="aspect-menu">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              className={a.id === aspect ? 'on' : ''}
              onClick={() => {
                setAspect(a.id)
                setOpen(false)
              }}
            >
              {shape(a.id)}
              <span className="mono">{a.id}</span>
              <span style={{ color: 'var(--muted)', marginLeft: 'auto', fontSize: 12 }}>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EditorScreen() {
  const tool = useProject((s) => s.tool)
  const clips = useProject((s) => s.clips)
  const canUndo = useProject((s) => s.past.length > 0)
  const canRedo = useProject((s) => s.future.length > 0)
  const undo = useProject((s) => s.undo)
  const redo = useProject((s) => s.redo)
  const setScreen = useProject((s) => s.setScreen)
  const setTool = useProject((s) => s.setTool)
  const [cropRatio, setCropRatio] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { importFiles } = useImport()

  useEffect(() => {
    // Leaving the crop tool should forget the preset lock.
    if (tool !== 'crop') setCropRatio(null)
  }, [tool])

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    const batch: MediaAsset[] = []
    void importFiles(files, (asset) => {
      batch.push(asset)
      useProject.getState().addAssets([asset])
    })
  }

  return (
    <div className="screen editor">
      <div className="topbar">
        <button className="icon-btn ghost" onClick={() => setScreen('upload')} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <button className="icon-btn ghost" onClick={undo} disabled={!canUndo} aria-label="Undo">
          <Undo2 size={19} />
        </button>
        <button className="icon-btn ghost" onClick={redo} disabled={!canRedo} aria-label="Redo">
          <Redo2 size={19} />
        </button>
        <div className="spacer" />
        <AspectPicker />
        <button
          className="btn primary sm"
          style={{ marginLeft: 6 }}
          disabled={!clips.length}
          onClick={() => {
            engine.pause()
            setTool('none')
            setScreen('preview')
          }}
        >
          <Upload size={15} /> Preview
        </button>
      </div>

      {clips.length ? (
        <Stage
          onTap={() => {
            if (tool === 'crop') return
            engine.toggle()
          }}
        >
          <TextLayer />
          {tool === 'crop' && <CropBox ratio={cropRatio} />}
        </Stage>
      ) : (
        <div className="stage-wrap">
          <div className="empty-stage">
            Your timeline is empty.
            <br />
            <button className="btn primary sm" style={{ marginTop: 12 }} onClick={() => setScreen('upload')}>
              Add media
            </button>
          </div>
        </div>
      )}

      <Transport />
      <Timeline onAddMedia={() => fileRef.current?.click()} />

      {tool === 'trim' && <TrimPanel />}
      {tool === 'speed' && <SpeedPanel />}
      {tool === 'move' && <MovePanel />}
      {tool === 'crop' && <CropPanel ratio={cropRatio} onRatio={setCropRatio} />}
      {tool === 'filter' && <FilterPanel />}
      {tool === 'text' && <TextPanel />}

      <ToolDock />

      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
