import type { MediaAsset } from '../types'
import { uid } from './id'

const THUMB_WIDTH = 160
export const IMAGE_DEFAULT_DURATION = 3
/** Longest a photo can be stretched to on the timeline, in seconds. */
export const IMAGE_MAX_DURATION = 30

export function isSupportedFile(file: File): boolean {
  return file.type.startsWith('video/') || file.type.startsWith('image/')
}

function once(el: EventTarget, ev: string, errEv = 'error'): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      cleanup()
      resolve()
    }
    const bad = () => {
      cleanup()
      reject(new Error('Failed while waiting for ' + ev))
    }
    const cleanup = () => {
      el.removeEventListener(ev, ok)
      el.removeEventListener(errEv, bad)
    }
    el.addEventListener(ev, ok)
    el.addEventListener(errEv, bad)
  })
}

function thumbCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  const scale = THUMB_WIDTH / Math.max(1, w)
  c.width = THUMB_WIDTH
  c.height = Math.max(1, Math.round(h * scale))
  return c
}

async function ingestImage(file: File, url: string): Promise<MediaAsset> {
  const img = new Image()
  img.src = url
  await img.decode()
  const c = thumbCanvas(img.naturalWidth, img.naturalHeight)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return {
    id: uid('asset'),
    kind: 'image',
    name: file.name,
    url,
    file,
    duration: IMAGE_DEFAULT_DURATION,
    width: img.naturalWidth,
    height: img.naturalHeight,
    thumbnails: [c.toDataURL('image/jpeg', 0.7)],
  }
}

async function ingestVideo(file: File, url: string): Promise<MediaAsset> {
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  await once(video, 'loadedmetadata')

  // Some recorders (e.g. MediaRecorder webm) report Infinity until the tail is parsed.
  if (!Number.isFinite(video.duration)) {
    video.currentTime = 1e6
    await once(video, 'durationchange')
    video.currentTime = 0
  }
  const duration = Number.isFinite(video.duration) ? video.duration : 1

  // Dimensions can still be 0 right after loadedmetadata (e.g. WebM without
  // a track header); they are reliable once the first frame is decoded.
  if (!video.videoWidth || !video.videoHeight) {
    video.currentTime = 0.01
    try {
      await once(video, 'seeked')
    } catch {
      /* fall through: use whatever we have */
    }
  }
  let width = video.videoWidth
  let height = video.videoHeight

  const count = Math.round(Math.min(8, Math.max(4, duration / 1.5)))
  let c: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  const thumbnails: string[] = []
  for (let i = 0; i < count; i++) {
    const t = duration * ((i + 0.5) / count)
    video.currentTime = Math.min(t, Math.max(0, duration - 0.05))
    try {
      await once(video, 'seeked')
    } catch {
      break
    }
    if (!width || !height) {
      width = video.videoWidth
      height = video.videoHeight
    }
    if (!width || !height) continue
    if (!c) {
      c = thumbCanvas(width, height)
      ctx = c.getContext('2d')
    }
    ctx!.drawImage(video, 0, 0, c.width, c.height)
    thumbnails.push(c.toDataURL('image/jpeg', 0.65))
  }
  video.removeAttribute('src')
  video.load()

  if (!width || !height) throw new Error('Could not decode video dimensions')

  return {
    id: uid('asset'),
    kind: 'video',
    name: file.name,
    url,
    file,
    duration,
    width,
    height,
    thumbnails: thumbnails.length ? thumbnails : [''],
  }
}

export async function ingestFile(file: File): Promise<MediaAsset> {
  const url = URL.createObjectURL(file)
  try {
    return file.type.startsWith('image/') ? await ingestImage(file, url) : await ingestVideo(file, url)
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
