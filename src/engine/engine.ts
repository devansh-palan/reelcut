import type { Clip, MediaAsset, TextOverlay } from '../types'
import { useProject } from '../store/project'
import { usePlayback } from '../store/playback'
import { clipFilterCss } from '../lib/filters'
import { aspectSize, clamp, clipAt, sourceTime, totalDuration } from '../lib/timeline'

export interface FrameRect {
  x: number
  y: number
  w: number
  h: number
}

/** Axis-aligned bbox of a text overlay, normalised to the output frame. */
export interface TextBox {
  id: string
  x: number
  y: number
  w: number
  h: number
}

type Source = HTMLVideoElement | HTMLImageElement

/**
 * The Engine owns every decoded media element, composites the current frame
 * onto a canvas, and drives playback with a requestAnimationFrame clock that
 * soft-locks to the active <video>'s currentTime so audio stays in sync.
 *
 * It is a singleton: screens attach/detach their <canvas> as they mount.
 */
class Engine {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private videos = new Map<string, HTMLVideoElement>()
  private images = new Map<string, HTMLImageElement>()
  private pendingPlay = new Set<string>()
  /** Video elements that have been played at least once inside a user gesture. */
  private unlocked = new Set<string>()
  private blur = document.createElement('canvas')
  private raf = 0
  private lastNow = 0
  private time = 0
  private playing = false

  private audioCtx: AudioContext | null = null
  private audioNodes = new Map<string, MediaElementAudioSourceNode>()
  private audioDest: MediaStreamAudioDestinationNode | null = null

  /** Whether CanvasRenderingContext2D.filter is implemented (not on older WebKit). */
  filterSupported = true
  /** Where the active clip's frame landed on the last render, in canvas px. */
  lastFrame: FrameRect = { x: 0, y: 0, w: 0, h: 0 }
  /** Text boxes measured on the last render, for hit-testing overlays. */
  textBoxes: TextBox[] = []
  /** When set, that clip is drawn uncropped (used by the crop tool). */
  uncroppedClipId: string | null = null
  /** When set, that text is always drawn (used by the text tool while editing). */
  pinnedTextId: string | null = null
  /** Invoked once when playback reaches the end of the timeline. */
  onEnded: (() => void) | null = null

  constructor() {
    this.blur.width = 40
    this.blur.height = 40
    useProject.subscribe((s, prev) => {
      if (s.aspect !== prev.aspect) this.resize()
      if (s.clips !== prev.clips) {
        // Keep the playhead inside the new duration after edits.
        const total = totalDuration(s.clips)
        if (this.time > total) this.seek(total)
      }
    })
  }

  // ---- media registry ----------------------------------------------------

  register(asset: MediaAsset) {
    if (asset.kind === 'video') {
      if (this.videos.has(asset.id)) return
      const v = document.createElement('video')
      v.src = asset.url
      v.playsInline = true
      v.preload = 'auto'
      v.muted = false
      v.crossOrigin = 'anonymous'
      v.load()
      this.videos.set(asset.id, v)
    } else {
      if (this.images.has(asset.id)) return
      const img = new Image()
      img.src = asset.url
      this.images.set(asset.id, img)
    }
  }

  private source(clip: Clip): Source | undefined {
    return this.videos.get(clip.assetId) ?? this.images.get(clip.assetId)
  }

  // ---- canvas lifecycle --------------------------------------------------

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
    this.filterSupported = !!this.ctx && 'filter' in this.ctx
    this.resize()
    if (!this.raf) {
      this.lastNow = performance.now()
      this.raf = requestAnimationFrame(this.loop)
    }
  }

  detach(canvas: HTMLCanvasElement) {
    if (this.canvas !== canvas) return
    this.pause()
    this.canvas = null
    this.ctx = null
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  getCanvas() {
    return this.canvas
  }

  private resize() {
    if (!this.canvas) return
    const { w, h } = aspectSize(useProject.getState().aspect)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  // ---- transport ---------------------------------------------------------

  getTime() {
    return this.time
  }

  isPlaying() {
    return this.playing
  }

  play() {
    const clips = useProject.getState().clips
    const total = totalDuration(clips)
    if (total <= 0) return
    if (this.time >= total - 0.02) this.time = 0
    this.playing = true
    this.lastNow = performance.now()
    this.audioCtx?.resume().catch(() => {})
    usePlayback.getState().set({ playing: true })

    // play() is normally called from a tap. Start the active video synchronously
    // inside that gesture, and unlock the others so mobile Safari lets the loop
    // start them later without another gesture.
    const active = clipAt(clips, this.time)
    if (active) {
      const v = this.videos.get(active.clip.assetId)
      if (v && v.paused) {
        const expected = sourceTime(active.clip, active.local)
        if (Math.abs(v.currentTime - expected) > 0.05) v.currentTime = expected
        v.playbackRate = active.clip.speed || 1
        this.startVideo(active.clip.assetId, v)
      }
    }
    this.unlockAll(active?.clip.assetId)
  }

  private startVideo(id: string, v: HTMLVideoElement) {
    if (this.pendingPlay.has(id)) return
    this.pendingPlay.add(id)
    this.unlocked.add(id)
    v.play()
      .catch(() => {})
      .finally(() => this.pendingPlay.delete(id))
  }

  private unlockAll(skipId?: string) {
    for (const [id, v] of this.videos) {
      if (this.unlocked.has(id) || id === skipId) continue
      this.unlocked.add(id)
      this.pendingPlay.add(id)
      v.muted = true
      v.play()
        .then(() => v.pause())
        .catch(() => {})
        .finally(() => {
          v.muted = false
          this.pendingPlay.delete(id)
        })
    }
  }

  pause() {
    this.playing = false
    for (const v of this.videos.values()) if (!v.paused) v.pause()
    this.pendingPlay.clear()
    usePlayback.getState().set({ playing: false })
  }

  toggle() {
    if (this.playing) this.pause()
    else this.play()
  }

  seek(t: number) {
    const clips = useProject.getState().clips
    const total = totalDuration(clips)
    this.time = clamp(t, 0, total)
    const active = clipAt(clips, this.time)
    if (active) {
      const v = this.videos.get(active.clip.assetId)
      if (v) {
        const target = sourceTime(active.clip, active.local)
        if (Math.abs(v.currentTime - target) > 0.03) v.currentTime = target
      }
    }
    usePlayback.getState().set({ time: this.time })
  }

  // ---- render loop -------------------------------------------------------

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.1, (now - this.lastNow) / 1000)
    this.lastNow = now

    const { clips } = useProject.getState()
    const total = totalDuration(clips)

    if (this.playing) {
      this.time += dt
      const active = clipAt(clips, this.time)
      if (active) {
        const { clip, offset, local } = active
        const v = this.videos.get(clip.assetId)
        if (v) {
          v.volume = clip.volume
          const speed = clip.speed || 1
          if (v.playbackRate !== speed) v.playbackRate = speed
          const expected = sourceTime(clip, local)
          if (v.paused && !v.ended) {
            if (!this.pendingPlay.has(clip.assetId)) {
              if (Math.abs(v.currentTime - expected) > 0.05) v.currentTime = expected
              this.startVideo(clip.assetId, v)
            }
          } else if (!v.seeking && v.readyState >= 2 && !v.ended) {
            const videoTime = offset + (v.currentTime - clip.start) / speed
            if (Math.abs(videoTime - this.time) > 0.35) v.currentTime = expected
            else this.time = videoTime
          }
        }
        // Pause any video that is not the active one.
        for (const [id, other] of this.videos) if (id !== clip.assetId && !other.paused) other.pause()
      }
      if (this.time >= total) {
        this.time = total
        this.pause()
        this.onEnded?.()
      }
      usePlayback.getState().set({ time: this.time })
    }

    this.render(this.time)
  }

  // ---- compositing -------------------------------------------------------

  render(t: number) {
    const ctx = this.ctx
    const canvas = this.canvas
    if (!ctx || !canvas) return
    const W = canvas.width
    const H = canvas.height
    const { clips, texts } = useProject.getState()

    ctx.filter = 'none'
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)

    const active = clipAt(clips, t)
    let cssFallback = ''
    if (active) {
      this.drawClip(ctx, active.clip, W, H)
      if (!this.filterSupported) cssFallback = clipFilterCss(active.clip)
    } else {
      this.lastFrame = { x: 0, y: 0, w: W, h: H }
    }
    // Older WebKit lacks ctx.filter; fall back to a CSS filter on the element for preview.
    if (canvas.style.filter !== cssFallback) canvas.style.filter = cssFallback

    this.textBoxes = []
    for (const text of texts) {
      const visible = (t >= text.from && t < text.to) || text.id === this.pinnedTextId
      if (!visible) continue
      this.drawText(ctx, text, W, H)
    }
  }

  private drawClip(ctx: CanvasRenderingContext2D, clip: Clip, W: number, H: number) {
    const src = this.source(clip)
    if (!src) return
    const isVideo = src instanceof HTMLVideoElement
    const sw = isVideo ? src.videoWidth : src.naturalWidth
    const sh = isVideo ? src.videoHeight : src.naturalHeight
    if (!sw || !sh) return
    if (isVideo && src.readyState < 2) return

    const crop = this.uncroppedClipId === clip.id ? { x: 0, y: 0, w: 1, h: 1 } : clip.crop
    const cx = crop.x * sw
    const cy = crop.y * sh
    const cw = Math.max(1, crop.w * sw)
    const ch = Math.max(1, crop.h * sh)

    // Fit the cropped region inside the output frame.
    const scale = Math.min(W / cw, H / ch)
    const dw = cw * scale
    const dh = ch * scale
    const dx = (W - dw) / 2
    const dy = (H - dh) / 2
    this.lastFrame = { x: dx, y: dy, w: dw, h: dh }

    const filter = this.filterSupported ? clipFilterCss(clip) : 'none'

    // Ambient background: a heavily downsampled copy of the frame, scaled to cover.
    if (dw < W - 1 || dh < H - 1) {
      const bctx = this.blur.getContext('2d')!
      bctx.drawImage(src, cx, cy, cw, ch, 0, 0, this.blur.width, this.blur.height)
      const cover = Math.max(W / cw, H / ch)
      const bw = cw * cover
      const bh = ch * cover
      ctx.save()
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'low'
      ctx.filter = this.filterSupported ? 'blur(18px) brightness(0.55)' : 'none'
      ctx.drawImage(this.blur, (W - bw) / 2, (H - bh) / 2, bw, bh)
      ctx.restore()
      if (!this.filterSupported) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(0, 0, W, H)
      }
    }

    ctx.save()
    ctx.filter = filter
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, cx, cy, cw, ch, dx, dy, dw, dh)
    ctx.restore()
  }

  private drawText(ctx: CanvasRenderingContext2D, text: TextOverlay, W: number, H: number) {
    const px = Math.max(8, text.size * H)
    const lines = text.text.split('\n')
    const lineHeight = px * 1.2
    ctx.save()
    ctx.filter = 'none'
    ctx.font = `${text.weight} ${px}px "${text.font}", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const widths = lines.map((l) => ctx.measureText(l || ' ').width)
    const boxW = Math.max(...widths) + px * 0.6
    const boxH = lines.length * lineHeight + px * 0.35
    const x = text.x * W
    const y = text.y * H
    this.textBoxes.push({ id: text.id, x: (x - boxW / 2) / W, y: (y - boxH / 2) / H, w: boxW / W, h: boxH / H })

    if (text.bg) {
      ctx.fillStyle = text.bg
      const r = px * 0.25
      const bx = x - boxW / 2
      const by = y - boxH / 2
      ctx.beginPath()
      ctx.moveTo(bx + r, by)
      ctx.arcTo(bx + boxW, by, bx + boxW, by + boxH, r)
      ctx.arcTo(bx + boxW, by + boxH, bx, by + boxH, r)
      ctx.arcTo(bx, by + boxH, bx, by, r)
      ctx.arcTo(bx, by, bx + boxW, by, r)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur = px * 0.25
      ctx.shadowOffsetY = px * 0.06
    }
    ctx.fillStyle = text.color
    const startY = y - ((lines.length - 1) * lineHeight) / 2
    lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight))
    ctx.restore()
  }

  // ---- export --------------------------------------------------------------

  private ensureAudioGraph(): MediaStreamAudioDestinationNode | null {
    if (typeof AudioContext === 'undefined') return null
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext()
      this.audioDest = this.audioCtx.createMediaStreamDestination()
    }
    for (const [id, v] of this.videos) {
      if (this.audioNodes.has(id)) continue
      try {
        const node = this.audioCtx.createMediaElementSource(v)
        node.connect(this.audioCtx.destination)
        node.connect(this.audioDest!)
        this.audioNodes.set(id, node)
      } catch {
        /* element may already be bound; ignore */
      }
    }
    this.audioCtx.resume().catch(() => {})
    return this.audioDest
  }

  static pickMimeType(): string {
    const candidates = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ]
    if (typeof MediaRecorder === 'undefined') return ''
    return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
  }

  /**
   * Records the timeline in real time through MediaRecorder.
   * Returns the encoded blob, or null if cancelled.
   */
  async export(signal?: AbortSignal): Promise<Blob | null> {
    const canvas = this.canvas
    if (!canvas) throw new Error('No canvas attached')
    const mimeType = Engine.pickMimeType()
    if (!mimeType) throw new Error('Recording is not supported in this browser')

    this.pause()
    this.seek(0)
    const videoStream = canvas.captureStream(30)
    const dest = this.ensureAudioGraph()
    const tracks = [...videoStream.getVideoTracks(), ...(dest ? dest.stream.getAudioTracks() : [])]
    const stream = new MediaStream(tracks)
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }

    usePlayback.getState().set({ exporting: true })
    let cancelled = false
    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })
    const stop = () => {
      if (recorder.state !== 'inactive') recorder.stop()
    }
    this.onEnded = stop
    signal?.addEventListener('abort', () => {
      cancelled = true
      this.pause()
      stop()
    })

    recorder.start(200)
    // Give the recorder a beat to attach before frames start moving.
    await new Promise((r) => setTimeout(r, 120))
    this.play()
    await done
    this.onEnded = null
    usePlayback.getState().set({ exporting: false })
    for (const t of tracks) t.stop()
    if (cancelled) return null
    return new Blob(chunks, { type: mimeType.split(';')[0] })
  }
}

export const engine = new Engine()
