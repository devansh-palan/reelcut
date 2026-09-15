import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, Pause, Play, Share2, X } from 'lucide-react'
import { useProject } from '../store/project'
import { usePlayback } from '../store/playback'
import { engine } from '../engine/engine'
import { formatTime, totalDuration } from '../lib/timeline'
import { formatBytes } from '../lib/media'
import { useToast } from '../store/toast'
import Stage from '../components/Stage'

type ExportState = { phase: 'idle' } | { phase: 'recording' } | { phase: 'done'; blob: Blob; url: string } | { phase: 'error'; message: string }

export default function PreviewScreen() {
  const setScreen = useProject((s) => s.setScreen)
  const clips = useProject((s) => s.clips)
  const time = usePlayback((s) => s.time)
  const playing = usePlayback((s) => s.playing)
  const show = useToast((s) => s.show)
  const total = totalDuration(clips)
  const [exp, setExp] = useState<ExportState>({ phase: 'idle' })
  const abortRef = useRef<AbortController | null>(null)
  const [flash, setFlash] = useState(false)

  // Autoplay from the start when entering preview.
  useEffect(() => {
    engine.seek(0)
    const id = window.setTimeout(() => engine.play(), 150)
    return () => {
      window.clearTimeout(id)
      engine.pause()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (exp.phase === 'done') URL.revokeObjectURL(exp.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exp.phase])

  const toggle = () => {
    engine.toggle()
    setFlash(true)
    window.setTimeout(() => setFlash(false), 350)
  }

  const startExport = async () => {
    setExp({ phase: 'recording' })
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const blob = await engine.export(ac.signal)
      if (!blob) {
        setExp({ phase: 'idle' })
        return
      }
      setExp({ phase: 'done', blob, url: URL.createObjectURL(blob) })
    } catch (err) {
      setExp({ phase: 'error', message: err instanceof Error ? err.message : 'Export failed' })
    }
  }

  const ext = exp.phase === 'done' ? (exp.blob.type.includes('mp4') ? 'mp4' : 'webm') : 'webm'
  const filename = `reelcut-${new Date().toISOString().slice(0, 10)}.${ext}`

  const share = async () => {
    if (exp.phase !== 'done') return
    const file = new File([exp.blob], filename, { type: exp.blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Reelcut export' })
      } catch {
        /* user dismissed */
      }
    } else show('Sharing files is not supported here. Use Download instead.', 'error')
  }

  return (
    <div className="screen preview">
      <div className="topbar">
        <button className="icon-btn" onClick={() => setScreen('editor')} aria-label="Back to editor">
          <ArrowLeft size={20} />
        </button>
        <div className="spacer" />
        <span className="mono label">{formatTime(total)}</span>
      </div>

      <Stage onTap={toggle}>{flash && <div className="bigplay"><span>{playing ? <Play size={30} fill="currentColor" /> : <Pause size={30} fill="currentColor" />}</span></div>}</Stage>

      <div className="bottom">
        <div className="scrub">
          <span>{formatTime(time)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0.01, total)}
            step={0.01}
            value={Math.min(time, total)}
            onPointerDown={() => engine.pause()}
            onChange={(e) => engine.seek(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span>{formatTime(total)}</span>
        </div>
        <div className="row">
          <button className="play-btn" onClick={toggle} aria-label="Play/Pause">
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
          <button className="btn primary" style={{ flex: 1 }} onClick={startExport} disabled={exp.phase === 'recording'}>
            <Download size={18} /> Export video
          </button>
        </div>
      </div>

      {exp.phase !== 'idle' && (
        <div className="export-card">
          <div className="sheet">
            {exp.phase === 'recording' && (
              <>
                <h3>Rendering…</h3>
                <p>Recording the timeline in real time. Keep this tab in the foreground.</p>
                <div className="progress">
                  <i style={{ width: `${Math.min(100, (time / Math.max(0.01, total)) * 100)}%` }} />
                </div>
                <button className="btn block" onClick={() => abortRef.current?.abort()}>
                  <X size={16} /> Cancel
                </button>
              </>
            )}
            {exp.phase === 'done' && (
              <>
                <h3>Ready to share</h3>
                <p>
                  {formatBytes(exp.blob.size)} · {ext.toUpperCase()} · {formatTime(total, false)}
                </p>
                <video className="result-video" src={exp.url} controls playsInline />
                <div className="row">
                  <a className="btn primary" style={{ flex: 1, textDecoration: 'none' }} href={exp.url} download={filename}>
                    <Download size={18} /> Download
                  </a>
                  <button className="btn" onClick={share}>
                    <Share2 size={18} /> Share
                  </button>
                  <button className="btn" onClick={() => setExp({ phase: 'idle' })}>
                    Close
                  </button>
                </div>
              </>
            )}
            {exp.phase === 'error' && (
              <>
                <h3>Export failed</h3>
                <p>{exp.message}</p>
                <button className="btn block" onClick={() => setExp({ phase: 'idle' })}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
