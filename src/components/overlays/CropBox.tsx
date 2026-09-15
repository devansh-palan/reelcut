import { useEffect, useRef } from 'react'
import { engine } from '../../engine/engine'
import { selectSelectedClip, useProject } from '../../store/project'
import { useStage } from '../Stage'
import { clamp } from '../../lib/timeline'
import type { CropRect } from '../../types'

const MIN_FRACTION = 0.1

export interface CropAspect {
  label: string
  ratio: number | null
}

interface Props {
  /** Locked aspect (w/h) in source pixels, or null for freeform. */
  ratio: number | null
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move'

/**
 * Interactive crop rectangle drawn over the (uncropped) source frame.
 * All maths happen in normalised source coordinates; the engine draws the
 * clip uncropped while this tool is active so the overlay lines up.
 */
export default function CropBox({ ratio }: Props) {
  const { width, height, canvasW, canvasH, scale } = useStage()
  const clip = useProject(selectSelectedClip)
  const asset = useProject((s) => (clip ? s.assets[clip.assetId] : undefined))
  const drag = useRef<{ handle: Handle; startCrop: CropRect; sx: number; sy: number } | null>(null)

  useEffect(() => {
    engine.uncroppedClipId = clip?.id ?? null
    return () => {
      engine.uncroppedClipId = null
    }
  }, [clip?.id])

  if (!clip || !asset || !width || !asset.width || !asset.height) return null

  // Where the full source frame lands on the canvas (same maths as the engine).
  const fitScale = Math.min(canvasW / asset.width, canvasH / asset.height)
  const frame = {
    w: asset.width * fitScale * scale,
    h: asset.height * fitScale * scale,
  }
  const frameX = (width - frame.w) / 2
  const frameY = (height - frame.h) / 2

  const crop = clip.crop
  const left = frameX + crop.x * frame.w
  const top = frameY + crop.y * frame.h
  const boxW = crop.w * frame.w
  const boxH = crop.h * frame.h

  const start = (handle: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    useProject.getState().snapshot()
    drag.current = { handle, startCrop: { ...clip.crop }, sx: e.clientX, sy: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    e.stopPropagation()
    // Deltas in normalised source units.
    const dx = (e.clientX - d.sx) / frame.w
    const dy = (e.clientY - d.sy) / frame.h
    const c = d.startCrop
    let next: CropRect

    if (d.handle === 'move') {
      next = { ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) }
    } else {
      // Anchor is the opposite corner; the dragged corner follows the pointer.
      const anchorX = d.handle.includes('w') ? c.x + c.w : c.x
      const anchorY = d.handle.includes('n') ? c.y + c.h : c.y
      const cornerX = clamp((d.handle.includes('w') ? c.x : c.x + c.w) + dx, 0, 1)
      const cornerY = clamp((d.handle.includes('n') ? c.y : c.y + c.h) + dy, 0, 1)
      let w = Math.abs(cornerX - anchorX)
      let h = Math.abs(cornerY - anchorY)

      if (ratio) {
        // ratio is w/h in source pixels; convert to normalised units.
        const normRatio = (ratio * asset.height) / asset.width
        // Use the larger implied size so the box tracks the pointer diagonally.
        if (w / normRatio > h) h = w / normRatio
        else w = h * normRatio
        // Keep within the frame on the side we are growing towards.
        const maxW = d.handle.includes('w') ? anchorX : 1 - anchorX
        const maxH = d.handle.includes('n') ? anchorY : 1 - anchorY
        if (w > maxW) {
          w = maxW
          h = w / normRatio
        }
        if (h > maxH) {
          h = maxH
          w = h * normRatio
        }
      }
      w = Math.max(MIN_FRACTION, w)
      h = Math.max(MIN_FRACTION, h)
      const x = d.handle.includes('w') ? anchorX - w : anchorX
      const y = d.handle.includes('n') ? anchorY - h : anchorY
      next = { x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - h), w, h }
    }
    useProject.getState().updateClip(clip.id, { crop: next })
  }

  const end = () => {
    drag.current = null
  }

  return (
    <div
      className="crop-box"
      style={{ left, top, width: boxW, height: boxH }}
      onPointerDown={start('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="grid-line" style={{ left: '33.3%', top: 0, bottom: 0, width: 1 }} />
      <span className="grid-line" style={{ left: '66.6%', top: 0, bottom: 0, width: 1 }} />
      <span className="grid-line" style={{ top: '33.3%', left: 0, right: 0, height: 1 }} />
      <span className="grid-line" style={{ top: '66.6%', left: 0, right: 0, height: 1 }} />
      {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
        <span key={h} className={`h ${h}`} onPointerDown={start(h)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
      ))}
    </div>
  )
}
