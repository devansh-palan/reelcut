import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { engine } from '../engine/engine'
import { usePlayback } from '../store/playback'
import { useProject } from '../store/project'
import { clipAt, clipLength, formatTime, totalDuration } from '../lib/timeline'

export default function Transport() {
  const time = usePlayback((s) => s.time)
  const playing = usePlayback((s) => s.playing)
  const clips = useProject((s) => s.clips)
  const total = totalDuration(clips)

  const jump = (dir: -1 | 1) => {
    const active = clipAt(clips, time)
    if (!active) return
    if (dir === -1) {
      // Go to the start of the current clip, or the previous one if already there.
      const target = active.local > 0.3 ? active.offset : Math.max(0, active.offset - clipLength(clips[active.index - 1] ?? active.clip))
      engine.seek(target)
    } else {
      const next = active.offset + clipLength(active.clip)
      engine.seek(Math.min(next, total))
    }
  }

  return (
    <div className="transport">
      <span className="time">
        <b>{formatTime(time)}</b>
      </span>
      <button className="icon-btn" onClick={() => jump(-1)} aria-label="Previous clip">
        <SkipBack size={20} />
      </button>
      <button className="play-btn" onClick={() => engine.toggle()} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      <button className="icon-btn" onClick={() => jump(1)} aria-label="Next clip">
        <SkipForward size={20} />
      </button>
      <span className="time right">{formatTime(total)}</span>
    </div>
  )
}
