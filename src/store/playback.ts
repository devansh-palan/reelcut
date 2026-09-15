import { create } from 'zustand'

/**
 * High-frequency playback state lives in its own store so the 60fps time
 * updates only re-render the few components that subscribe to it.
 */
export interface PlaybackState {
  time: number
  playing: boolean
  /** True while an export is recording. */
  exporting: boolean
  set: (patch: Partial<Pick<PlaybackState, 'time' | 'playing' | 'exporting'>>) => void
}

export const usePlayback = create<PlaybackState>((set) => ({
  time: 0,
  playing: false,
  exporting: false,
  set: (patch) => set(patch),
}))
