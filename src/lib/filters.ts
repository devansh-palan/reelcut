import type { Adjust, Clip, FilterId } from '../types'

export interface FilterPreset {
  id: FilterId
  label: string
  css: string
  /** Swatch used in the filter picker. */
  swatch: string
}

export const FILTERS: FilterPreset[] = [
  { id: 'none', label: 'Original', css: '', swatch: 'linear-gradient(135deg,#6b7280,#1f2937)' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.6) contrast(1.08)', swatch: 'linear-gradient(135deg,#ff3d81,#ffb020,#2ee6a6)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.28) saturate(1.3) hue-rotate(-6deg) brightness(1.03)', swatch: 'linear-gradient(135deg,#ff9a3c,#ffcf6b)' },
  { id: 'cool', label: 'Cool', css: 'hue-rotate(-14deg) saturate(1.15) brightness(1.02) contrast(1.04)', swatch: 'linear-gradient(135deg,#3ec3ff,#7b6bff)' },
  { id: 'fade', label: 'Fade', css: 'contrast(0.82) brightness(1.12) saturate(0.78)', swatch: 'linear-gradient(135deg,#cfc8bf,#8f8a86)' },
  { id: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.05)', swatch: 'linear-gradient(135deg,#e5e5e5,#4b4b4b)' },
  { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.45) brightness(0.88)', swatch: 'linear-gradient(135deg,#ffffff,#000000)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.85) contrast(0.95) brightness(1.05)', swatch: 'linear-gradient(135deg,#c9a068,#5a3d1e)' },
  { id: 'punch', label: 'Punch', css: 'contrast(1.32) saturate(1.25) brightness(0.98)', swatch: 'linear-gradient(135deg,#ff2d55,#5b0f2b)' },
  { id: 'dream', label: 'Dream', css: 'brightness(1.1) saturate(1.25) contrast(0.88) blur(0.5px)', swatch: 'linear-gradient(135deg,#ffd1f7,#a3c4ff)' },
]

export const DEFAULT_ADJUST: Adjust = { brightness: 1, contrast: 1, saturation: 1 }

export function filterById(id: FilterId): FilterPreset {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0]
}

/** Builds the complete CSS filter string for a clip (preset + manual adjustments). */
export function clipFilterCss(clip: Pick<Clip, 'filter' | 'adjust'>): string {
  const parts: string[] = []
  const preset = filterById(clip.filter).css
  if (preset) parts.push(preset)
  const { brightness, contrast, saturation } = clip.adjust
  if (Math.abs(brightness - 1) > 0.005) parts.push(`brightness(${brightness.toFixed(3)})`)
  if (Math.abs(contrast - 1) > 0.005) parts.push(`contrast(${contrast.toFixed(3)})`)
  if (Math.abs(saturation - 1) > 0.005) parts.push(`saturate(${saturation.toFixed(3)})`)
  return parts.length ? parts.join(' ') : 'none'
}
