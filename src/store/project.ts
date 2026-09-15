import { create } from 'zustand'
import type { AspectId, Clip, MediaAsset, Screen, TextOverlay, Tool } from '../types'
import { uid } from '../lib/id'
import { DEFAULT_ADJUST } from '../lib/filters'
import { MIN_CLIP_LENGTH, clipLength, clipOffset, sourceTime, totalDuration } from '../lib/timeline'

interface Snapshot {
  clips: Clip[]
  texts: TextOverlay[]
}

const HISTORY_LIMIT = 60

export interface ProjectState {
  screen: Screen
  assets: Record<string, MediaAsset>
  clips: Clip[]
  texts: TextOverlay[]
  aspect: AspectId
  selectedClipId: string | null
  selectedTextId: string | null
  tool: Tool
  past: Snapshot[]
  future: Snapshot[]

  setScreen: (screen: Screen) => void
  setAspect: (aspect: AspectId) => void
  /** Registers assets and appends one clip per asset to the timeline. */
  addAssets: (assets: MediaAsset[]) => void
  removeClip: (id: string) => void
  moveClip: (id: string, direction: -1 | 1) => void
  duplicateClip: (id: string) => void
  splitClip: (id: string, timelineTime: number) => void
  updateClip: (id: string, patch: Partial<Clip>) => void
  selectClip: (id: string | null) => void
  setTool: (tool: Tool) => void

  addText: (at: number) => string
  updateText: (id: string, patch: Partial<TextOverlay>) => void
  removeText: (id: string) => void
  selectText: (id: string | null) => void

  /** Push the current clips/texts onto the undo stack. Call before a drag gesture. */
  snapshot: () => void
  undo: () => void
  redo: () => void
}

function makeClip(asset: MediaAsset): Clip {
  return {
    id: uid('clip'),
    assetId: asset.id,
    start: 0,
    end: asset.duration,
    crop: { x: 0, y: 0, w: 1, h: 1 },
    filter: 'none',
    adjust: { ...DEFAULT_ADJUST },
    volume: 1,
    speed: 1,
  }
}

export const useProject = create<ProjectState>((set, get) => {
  const pushHistory = (state: ProjectState): Pick<ProjectState, 'past' | 'future'> => ({
    past: [...state.past.slice(-HISTORY_LIMIT + 1), { clips: state.clips, texts: state.texts }],
    future: [],
  })

  return {
    screen: 'upload',
    assets: {},
    clips: [],
    texts: [],
    aspect: '9:16',
    selectedClipId: null,
    selectedTextId: null,
    tool: 'none',
    past: [],
    future: [],

    setScreen: (screen) => set({ screen }),
    setAspect: (aspect) => set({ aspect }),

    addAssets: (assets) =>
      set((s) => {
        const next = { ...s.assets }
        const clips = [...s.clips]
        for (const a of assets) {
          next[a.id] = a
          clips.push(makeClip(a))
        }
        // Auto-pick the aspect from the first imported media if the project is empty.
        let aspect = s.aspect
        if (!s.clips.length && assets.length) {
          const first = assets[0]
          const r = first.width / first.height
          aspect = r > 1.3 ? '16:9' : r > 0.9 ? '1:1' : '9:16'
        }
        return {
          ...pushHistory(s),
          assets: next,
          clips,
          aspect,
          selectedClipId: s.selectedClipId ?? clips[0]?.id ?? null,
        }
      }),

    removeClip: (id) =>
      set((s) => {
        const idx = s.clips.findIndex((c) => c.id === id)
        if (idx < 0) return s
        const clips = s.clips.filter((c) => c.id !== id)
        const nextSelected = clips[Math.min(idx, clips.length - 1)]?.id ?? null
        return { ...pushHistory(s), clips, selectedClipId: nextSelected, tool: clips.length ? s.tool : 'none' }
      }),

    moveClip: (id, direction) =>
      set((s) => {
        const idx = s.clips.findIndex((c) => c.id === id)
        const target = idx + direction
        if (idx < 0 || target < 0 || target >= s.clips.length) return s
        const clips = [...s.clips]
        ;[clips[idx], clips[target]] = [clips[target], clips[idx]]
        return { ...pushHistory(s), clips }
      }),

    duplicateClip: (id) =>
      set((s) => {
        const idx = s.clips.findIndex((c) => c.id === id)
        if (idx < 0) return s
        const copy: Clip = { ...s.clips[idx], id: uid('clip'), crop: { ...s.clips[idx].crop }, adjust: { ...s.clips[idx].adjust } }
        const clips = [...s.clips]
        clips.splice(idx + 1, 0, copy)
        return { ...pushHistory(s), clips, selectedClipId: copy.id }
      }),

    splitClip: (id, timelineTime) =>
      set((s) => {
        const idx = s.clips.findIndex((c) => c.id === id)
        if (idx < 0) return s
        const clip = s.clips[idx]
        const local = timelineTime - clipOffset(s.clips, id)
        if (local < MIN_CLIP_LENGTH || clipLength(clip) - local < MIN_CLIP_LENGTH) return s
        const cut = sourceTime(clip, local)
        const left: Clip = { ...clip, end: cut }
        const right: Clip = { ...clip, id: uid('clip'), start: cut, crop: { ...clip.crop }, adjust: { ...clip.adjust } }
        const clips = [...s.clips]
        clips.splice(idx, 1, left, right)
        return { ...pushHistory(s), clips, selectedClipId: right.id }
      }),

    updateClip: (id, patch) =>
      set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

    selectClip: (id) => set({ selectedClipId: id, selectedTextId: id ? null : get().selectedTextId }),

    setTool: (tool) => set({ tool }),

    addText: (at) => {
      const id = uid('text')
      set((s) => {
        const total = totalDuration(s.clips)
        const from = Math.max(0, Math.min(at, Math.max(0, total - 1)))
        const text: TextOverlay = {
          id,
          text: 'Your text',
          x: 0.5,
          y: 0.5,
          size: 0.055,
          color: '#ffffff',
          bg: null,
          font: 'Sora',
          weight: 800,
          from,
          to: Math.min(total || 3, from + 3),
        }
        return { ...pushHistory(s), texts: [...s.texts, text], selectedTextId: id, tool: 'text' }
      })
      return id
    },

    updateText: (id, patch) =>
      set((s) => ({ texts: s.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

    removeText: (id) =>
      set((s) => ({
        ...pushHistory(s),
        texts: s.texts.filter((t) => t.id !== id),
        selectedTextId: s.selectedTextId === id ? null : s.selectedTextId,
      })),

    selectText: (id) => set({ selectedTextId: id }),

    snapshot: () => set((s) => pushHistory(s)),

    undo: () =>
      set((s) => {
        const prev = s.past[s.past.length - 1]
        if (!prev) return s
        return {
          past: s.past.slice(0, -1),
          future: [{ clips: s.clips, texts: s.texts }, ...s.future],
          clips: prev.clips,
          texts: prev.texts,
          selectedClipId: prev.clips.some((c) => c.id === s.selectedClipId) ? s.selectedClipId : prev.clips[0]?.id ?? null,
          selectedTextId: prev.texts.some((t) => t.id === s.selectedTextId) ? s.selectedTextId : null,
        }
      }),

    redo: () =>
      set((s) => {
        const next = s.future[0]
        if (!next) return s
        return {
          future: s.future.slice(1),
          past: [...s.past, { clips: s.clips, texts: s.texts }],
          clips: next.clips,
          texts: next.texts,
          selectedClipId: next.clips.some((c) => c.id === s.selectedClipId) ? s.selectedClipId : next.clips[0]?.id ?? null,
          selectedTextId: next.texts.some((t) => t.id === s.selectedTextId) ? s.selectedTextId : null,
        }
      }),
  }
})

export const selectSelectedClip = (s: ProjectState): Clip | null =>
  s.clips.find((c) => c.id === s.selectedClipId) ?? null

export const selectSelectedText = (s: ProjectState): TextOverlay | null =>
  s.texts.find((t) => t.id === s.selectedTextId) ?? null
