import type { AspectId, Clip } from '../types'

export const MIN_CLIP_LENGTH = 0.2

export const SPEED_MIN = 0.25
export const SPEED_MAX = 4

/** Length of the clip on the timeline, in seconds (source range divided by speed). */
export function clipLength(clip: Clip): number {
  return Math.max(0, (clip.end - clip.start) / (clip.speed || 1))
}

/** Converts a timeline-local time inside a clip to a source (media) time. */
export function sourceTime(clip: Clip, local: number): number {
  return clip.start + local * (clip.speed || 1)
}

export function totalDuration(clips: Clip[]): number {
  return clips.reduce((sum, c) => sum + clipLength(c), 0)
}

export function clipOffset(clips: Clip[], clipId: string): number {
  let offset = 0
  for (const c of clips) {
    if (c.id === clipId) return offset
    offset += clipLength(c)
  }
  return offset
}

export interface ActiveClip {
  clip: Clip
  index: number
  /** Timeline offset where this clip begins. */
  offset: number
  /** Seconds elapsed inside the clip (0..length). */
  local: number
}

/** Finds the clip that is on screen at timeline time `t`. */
export function clipAt(clips: Clip[], t: number): ActiveClip | null {
  if (!clips.length) return null
  let offset = 0
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    const len = clipLength(clip)
    if (t < offset + len || i === clips.length - 1) {
      const local = Math.min(Math.max(0, t - offset), Math.max(0, len - 0.0001))
      return { clip, index: i, offset, local }
    }
    offset += len
  }
  return null
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function formatTime(seconds: number, showTenths = true): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const tenths = Math.floor((s - Math.floor(s)) * 10)
  const base = `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return showTenths ? `${base}.${tenths}` : base
}

export const ASPECTS: { id: AspectId; label: string; w: number; h: number }[] = [
  { id: '9:16', label: 'Portrait', w: 720, h: 1280 },
  { id: '4:5', label: 'Feed', w: 864, h: 1080 },
  { id: '1:1', label: 'Square', w: 960, h: 960 },
  { id: '16:9', label: 'Wide', w: 1280, h: 720 },
]

export function aspectSize(id: AspectId): { w: number; h: number } {
  const a = ASPECTS.find((x) => x.id === id) ?? ASPECTS[0]
  return { w: a.w, h: a.h }
}
