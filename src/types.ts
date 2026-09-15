export type MediaKind = 'video' | 'image'

export interface MediaAsset {
  id: string
  kind: MediaKind
  name: string
  url: string
  file: File
  /** Natural duration in seconds. Images get a default duration. */
  duration: number
  width: number
  height: number
  /** Small data-URL thumbnails sampled across the media. */
  thumbnails: string[]
}

/** Normalised (0..1) rectangle relative to the source frame. */
export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

export type FilterId =
  | 'none'
  | 'vivid'
  | 'warm'
  | 'cool'
  | 'fade'
  | 'mono'
  | 'noir'
  | 'sepia'
  | 'punch'
  | 'dream'

export interface Adjust {
  brightness: number // 0.5 .. 1.5
  contrast: number // 0.5 .. 1.5
  saturation: number // 0 .. 2
}

export interface Clip {
  id: string
  assetId: string
  /** Trim in-point, in source seconds. */
  start: number
  /** Trim out-point, in source seconds. */
  end: number
  crop: CropRect
  filter: FilterId
  adjust: Adjust
  volume: number
  /** Playback rate. 1 = normal; 2 = twice as fast (clip takes half the time). */
  speed: number
}

export type TextFont = 'Sora' | 'JetBrains Mono' | 'Georgia'

export interface TextOverlay {
  id: string
  text: string
  /** Centre position, normalised to the output frame. */
  x: number
  y: number
  /** Font size as a fraction of output height. */
  size: number
  color: string
  bg: string | null
  font: TextFont
  weight: 400 | 800
  /** Timeline range in seconds. */
  from: number
  to: number
}

export type AspectId = '9:16' | '1:1' | '4:5' | '16:9'

export type Tool = 'none' | 'trim' | 'speed' | 'crop' | 'text' | 'filter' | 'move'

export type Screen = 'upload' | 'editor' | 'preview'
