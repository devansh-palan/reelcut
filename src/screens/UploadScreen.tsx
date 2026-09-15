import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Film, Image as ImageIcon, Plus, Upload, X } from 'lucide-react'
import type { MediaAsset } from '../types'
import { useProject } from '../store/project'
import { useImport } from '../lib/useImport'
import { formatTime } from '../lib/timeline'

export default function UploadScreen() {
  const [staged, setStaged] = useState<MediaAsset[]>([])
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { importFiles, pending } = useImport()
  const hasProject = useProject((s) => s.clips.length > 0)
  const addAssets = useProject((s) => s.addAssets)
  const setScreen = useProject((s) => s.setScreen)

  const onFiles = (files: FileList | File[] | null) => {
    if (!files || !files.length) return
    void importFiles(files, (asset) => setStaged((prev) => [...prev, asset]))
  }

  const remove = (id: string) => {
    setStaged((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((a) => a.id !== id)
    })
  }

  const proceed = () => {
    if (staged.length) addAssets(staged)
    setScreen('editor')
  }

  const videos = staged.filter((a) => a.kind === 'video').length
  const photos = staged.length - videos

  return (
    <div className="screen upload">
      <div className="brand">
        {hasProject ? (
          <button className="icon-btn ghost" style={{ marginLeft: -10 }} onClick={() => setScreen('editor')} aria-label="Back to editor">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <span className="dot" />
        )}
        <span className="name">Reelcut</span>
        <span className="tag">v0.1 · mobile</span>
      </div>

      <h1>
        {hasProject ? (
          <>
            Add more <em>media</em>
          </>
        ) : (
          <>
            Cut, style, <em>ship.</em>
          </>
        )}
      </h1>
      <p className="sub">
        {hasProject
          ? 'Pick more clips or photos to append to your timeline.'
          : 'Bring in videos and photos, trim and stack them, drop in text and a look, then export.'}
      </p>

      <div
        className={`dropzone ${over ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          onFiles(e.dataTransfer.files)
        }}
      >
        <div className="orb">
          <Upload size={28} strokeWidth={2.4} />
        </div>
        <h3>Choose videos or photos</h3>
        <p>Select one file or many. MP4, MOV, WebM, JPG, PNG, HEIC.</p>
        <div className="pick-row">
          <button className="btn primary" onClick={() => inputRef.current?.click()}>
            <Plus size={18} /> Pick media
          </button>
          <label className="btn">
            <Camera size={18} /> Record
            <input type="file" accept="video/*" capture="environment" hidden onChange={(e) => onFiles(e.target.files)} />
          </label>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,image/*"
          multiple
          onChange={(e) => {
            onFiles(e.target.files)
            e.target.value = ''
          }}
          style={{ pointerEvents: 'none' }}
        />
      </div>

      {(staged.length > 0 || pending > 0) && (
        <div className="queue">
          <div className="head">
            <span className="label">
              {staged.length} selected
              {videos ? ` · ${videos} video${videos > 1 ? 's' : ''}` : ''}
              {photos ? ` · ${photos} photo${photos > 1 ? 's' : ''}` : ''}
            </span>
            {pending > 0 && <span className="label" style={{ color: 'var(--amber)' }}>Reading {pending}…</span>}
          </div>
          <div className="grid">
            {staged.map((a, i) => (
              <div className="tile" key={a.id} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <img src={a.thumbnails[0]} alt={a.name} />
                <span className="badge">
                  {a.kind === 'video' ? <Film size={11} /> : <ImageIcon size={11} />}
                  {a.kind === 'video' ? formatTime(a.duration, false) : 'photo'}
                </span>
                <button className="x" onClick={() => remove(a.id)} aria-label="Remove">
                  <X size={14} />
                </button>
              </div>
            ))}
            {Array.from({ length: pending }).map((_, i) => (
              <div className="tile skeleton" key={`s${i}`} />
            ))}
          </div>
        </div>
      )}

      {(staged.length > 0 || hasProject) && (
        <div className="cta-bar">
          <button className="btn primary block" onClick={proceed} disabled={pending > 0 || (!staged.length && !hasProject)}>
            {hasProject ? (staged.length ? `Add ${staged.length} to timeline` : 'Back to editor') : `Open editor with ${staged.length}`}
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
