import { useEffect, useRef, useState } from 'react'
import { Crop, Gauge, Plus, Sparkles } from 'lucide-react'
import { engine } from '../engine/engine'
import { usePlayback } from '../store/playback'
import { useProject } from '../store/project'
import { MIN_CLIP_LENGTH, clamp, clipLength, clipOffset, formatTime, totalDuration } from '../lib/timeline'
import { IMAGE_MAX_DURATION } from '../lib/media'
import type { Clip, MediaAsset } from '../types'

const PPS = 72 // pixels per second
const THUMB_W = 48

interface Props {
  onAddMedia: () => void
}

/** Filmstrip for one clip: picks thumbnails that fall inside the trimmed range. */
type HandleSide = 'l' | 'r'

interface ClipStripProps {
  clip: Clip
  asset: MediaAsset
  selected: boolean
  onSelect: () => void
  onHandleDown: (clip: Clip, side: HandleSide, e: React.PointerEvent) => void
}

function ClipStrip({ clip, asset, selected, onSelect, onHandleDown }: ClipStripProps) {
  const width = Math.max(THUMB_W, Math.round(clipLength(clip) * PPS))
  const slots = Math.ceil(width / THUMB_W)
  const thumbs = asset.thumbnails
  const isCropped = clip.crop.w < 0.999 || clip.crop.h < 0.999
  const hasLook = clip.filter !== 'none' || clip.adjust.brightness !== 1 || clip.adjust.contrast !== 1 || clip.adjust.saturation !== 1
  return (
    <div className={`tl-clip ${selected ? 'on' : ''}`} style={{ width }} onClick={onSelect}>
      <div className="tl-thumbs">
        {Array.from({ length: slots }).map((_, i) => {
          const t = clip.start + ((i + 0.5) / slots) * clipLength(clip)
          const idx = asset.kind === 'image' ? 0 : Math.min(thumbs.length - 1, Math.floor((t / asset.duration) * thumbs.length))
          return <img key={i} src={thumbs[idx]} alt="" draggable={false} />
        })}
      </div>
      <span className="meta">{formatTime(clipLength(clip), true)}</span>
      {selected && (
        <>
          <div className="tl-handle l" onPointerDown={(e) => onHandleDown(clip, 'l', e)} />
          <div className="tl-handle r" onPointerDown={(e) => onHandleDown(clip, 'r', e)} />
        </>
      )}
      {(isCropped || hasLook || clip.speed !== 1) && (
        <span className="fx">
          {clip.speed !== 1 && (
            <span className="speed">
              <Gauge size={9} /> {clip.speed}×
            </span>
          )}
          {isCropped && (
            <span>
              <Crop size={9} />
            </span>
          )}
          {hasLook && (
            <span>
              <Sparkles size={9} />
            </span>
          )}
        </span>
      )}
    </div>
  )
}

export default function Timeline({ onAddMedia }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const programmatic = useRef(false)
  /** Set while an edge handle is being dragged so the playhead follow-scroll stays out of the way. */
  const trimming = useRef(false)
  /**
   * The playhead can be dragged away from the centre. `offset` is its distance
   * from the centre in px, so timeline time = (scrollLeft + offset) / PPS.
   */
  const [offset, setOffset] = useState(0)
  const offsetRef = useRef(0)
  const lastScroll = useRef(0)
  /** Mouse drag-to-pan state (touch uses native scrolling). */
  const pan = useRef<{ x: number; left: number } | null>(null)
  const suppressClick = useRef(false)
  const clips = useProject((s) => s.clips)
  const texts = useProject((s) => s.texts)
  const assets = useProject((s) => s.assets)
  const selectedClipId = useProject((s) => s.selectedClipId)
  const selectedTextId = useProject((s) => s.selectedTextId)
  const selectClip = useProject((s) => s.selectClip)
  const selectText = useProject((s) => s.selectText)
  const setTool = useProject((s) => s.setTool)

  // Follow the playhead: engine time → scroll position.
  useEffect(() => {
    const unsub = usePlayback.subscribe((s, prev) => {
      if (s.time === prev.time || trimming.current) return
      const el = scrollRef.current
      if (!el) return
      const target = Math.round(s.time * PPS - offsetRef.current)
      const before = el.scrollLeft
      if (Math.abs(before - target) < 1) return
      el.scrollLeft = target
      const after = el.scrollLeft
      if (after !== before) programmatic.current = true
      // The scroll range ran out (start or end of the timeline): move the
      // playhead instead so it always sits over the current time.
      if (Math.abs(after - target) >= 1) {
        const limit = el.clientWidth / 2 - 10
        const next = clamp(s.time * PPS - after, -limit, limit)
        offsetRef.current = next
        setOffset(next)
      }
    })
    return unsub
  }, [])

  /**
   * User scroll / pan. The content moves and the playhead keeps its time
   * (its screen offset shifts with the content). Once the playhead would be
   * pushed past the edge of the view it sticks there and starts scrubbing.
   */
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const delta = el.scrollLeft - lastScroll.current
    lastScroll.current = el.scrollLeft
    if (programmatic.current) {
      programmatic.current = false
      return
    }
    if (engine.isPlaying()) engine.pause()
    const limit = el.clientWidth / 2 - 10
    let next = offsetRef.current - delta
    if (next < -limit || next > limit) {
      next = clamp(next, -limit, limit)
      engine.seek(Math.max(0, (el.scrollLeft + next) / PPS))
    }
    offsetRef.current = next
    setOffset(next)
  }

  const onPanDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (engine.isPlaying()) engine.pause()
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = e.currentTarget
    pan.current = { x: e.clientX, left: el.scrollLeft }
    // Window listeners rather than pointer capture: capture would redirect the
    // follow-up click away from the clip that was tapped.
    const move = (ev: PointerEvent) => {
      if (!pan.current) return
      const dx = ev.clientX - pan.current.x
      if (Math.abs(dx) > 4) suppressClick.current = true
      el.scrollLeft = pan.current.left - dx
    }
    const up = () => {
      pan.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  /** Drag the playhead line itself to pick a time. */
  const onPlayheadDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    engine.pause()
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const limit = rect.width / 2 - 10
    const move = (ev: PointerEvent) => {
      // Stay within the view and within the timeline's [0, total] range.
      const total = totalDuration(useProject.getState().clips)
      const min = Math.max(-limit, -el.scrollLeft)
      const max = Math.min(limit, total * PPS - el.scrollLeft)
      const next = clamp(ev.clientX - centerX, min, Math.max(min, max))
      offsetRef.current = next
      setOffset(next)
      engine.seek((el.scrollLeft + next) / PPS)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  /**
   * Edge-handle trimming on the timeline. Left handle: the timeline scrolls by
   * the trimmed amount so the edge stays under the finger. Right handle: the
   * clip simply grows/shrinks. The preview scrubs to the edge being dragged.
   */
  const onHandleDown = (clip: Clip, side: HandleSide, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    engine.pause()
    trimming.current = true
    let snapped = false // push one undo entry, and only if the drag changes something
    const startX = e.clientX
    const start0 = clip.start
    const end0 = clip.end
    let appliedStart = clip.start

    const move = (ev: PointerEvent) => {
      const s = useProject.getState()
      const current = s.clips.find((c) => c.id === clip.id)
      const asset = current && s.assets[current.assetId]
      if (!current || !asset) return
      const speed = current.speed || 1
      const dt = ((ev.clientX - startX) / PPS) * speed // source seconds
      const offset = clipOffset(s.clips, clip.id)
      if (side === 'l') {
        const start = clamp(start0 + dt, 0, end0 - MIN_CLIP_LENGTH * speed)
        const delta = start - appliedStart
        if (delta !== 0 && scrollRef.current) {
          programmatic.current = true
          scrollRef.current.scrollLeft -= (delta / speed) * PPS
        }
        appliedStart = start
        if (start === current.start) return
        if (!snapped) {
          s.snapshot()
          snapped = true
        }
        s.updateClip(clip.id, { start })
        engine.seek(offset)
      } else {
        const maxEnd = asset.kind === 'image' ? IMAGE_MAX_DURATION : asset.duration
        const end = clamp(end0 + dt, start0 + MIN_CLIP_LENGTH * speed, maxEnd)
        if (end === current.end) return
        if (!snapped) {
          s.snapshot()
          snapped = true
        }
        s.updateClip(clip.id, { end })
        engine.seek(offset + (end - current.start) / speed - 0.04)
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      trimming.current = false
      programmatic.current = false
      const el = scrollRef.current
      if (el) engine.seek((el.scrollLeft + offsetRef.current) / PPS)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div className="timeline">
      <div
        className="tl-scroll"
        ref={scrollRef}
        onScroll={onScroll}
        onPointerDown={onPanDown}
        onClickCapture={(e) => {
          // A drag should not count as a tap on a clip.
          if (suppressClick.current) {
            suppressClick.current = false
            e.stopPropagation()
            e.preventDefault()
          }
        }}
      >
        <div className="tl-track">
          {clips.map((clip) => {
            const asset = assets[clip.assetId]
            if (!asset) return null
            return (
              <ClipStrip
                key={clip.id}
                clip={clip}
                asset={asset}
                selected={clip.id === selectedClipId}
                onHandleDown={onHandleDown}
                onSelect={() => {
                  selectClip(clip.id)
                  const s = useProject.getState()
                  if (s.tool === 'text') s.setTool('none')
                }}
              />
            )
          })}
          <button className="tl-add" onClick={onAddMedia} aria-label="Add media">
            <Plus size={18} />
          </button>
        </div>
        {texts.length > 0 && (
          <div className="tl-texts">
            {texts.map((t) => (
              <div
                key={t.id}
                className={`tl-text ${t.id === selectedTextId ? 'on' : ''}`}
                style={{ left: `calc(50% + ${Math.round(t.from * PPS)}px)`, width: Math.max(24, Math.round((t.to - t.from) * PPS)) }}
                onClick={() => {
                  selectText(t.id)
                  setTool('text')
                  engine.seek(Math.max(t.from, Math.min(engine.getTime(), t.to - 0.05)))
                }}
              >
                {t.text.replace(/\n/g, ' ')}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="playhead" style={{ left: `calc(50% + ${Math.round(offset)}px)` }} onPointerDown={onPlayheadDown} />
    </div>
  )
}

