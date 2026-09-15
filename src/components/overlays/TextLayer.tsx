import { useEffect, useRef, useState } from 'react'
import { engine, type TextBox } from '../../engine/engine'
import { useProject } from '../../store/project'
import { useStage } from '../Stage'
import { clamp } from '../../lib/timeline'

/**
 * Hit-tests and drags text overlays directly on the preview. The canvas draws
 * the text; this layer only draws the selection outline and captures pointers.
 */
export default function TextLayer() {
  const { width, height } = useStage()
  const selectedTextId = useProject((s) => s.selectedTextId)
  const tool = useProject((s) => s.tool)
  const [box, setBox] = useState<TextBox | null>(null)
  const drag = useRef<{ id: string; dx: number; dy: number; hw: number; hh: number } | null>(null)
  // Set when a pointer-down landed on a text, so the follow-up click does not toggle playback.
  const swallowClick = useRef(false)

  // Keep the outline glued to the canvas-measured box.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const b = selectedTextId ? engine.textBoxes.find((t) => t.id === selectedTextId) ?? null : null
      setBox((prev) => {
        if (!b && !prev) return prev
        if (b && prev && b.x === prev.x && b.y === prev.y && b.w === prev.w && b.h === prev.h) return prev
        return b
      })
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [selectedTextId])

  useEffect(() => {
    engine.pinnedTextId = tool === 'text' ? selectedTextId : null
    return () => {
      engine.pinnedTextId = null
    }
  }, [tool, selectedTextId])

  const active = tool !== 'crop'
  if (!active) return null

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    // Topmost text wins.
    const hit = [...engine.textBoxes].reverse().find((b) => nx >= b.x && nx <= b.x + b.w && ny >= b.y && ny <= b.y + b.h)
    const s = useProject.getState()
    if (!hit) {
      if (s.tool === 'text' && s.selectedTextId) s.selectText(null)
      return
    }
    e.stopPropagation()
    swallowClick.current = true
    const text = s.texts.find((t) => t.id === hit.id)
    if (!text) return
    s.selectText(hit.id)
    if (s.tool !== 'text') s.setTool('text')
    s.snapshot()
    drag.current = { id: hit.id, dx: text.x - nx, dy: text.y - ny, hw: hit.w / 2, hh: hit.h / 2 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    // Keep the whole text box inside the frame (fall back to a loose clamp for oversized text).
    const { dx, dy, hw, hh } = drag.current
    useProject.getState().updateText(drag.current.id, {
      x: hw < 0.5 ? clamp(nx + dx, hw, 1 - hw) : clamp(nx + dx, 0.02, 0.98),
      y: hh < 0.5 ? clamp(ny + dy, hh, 1 - hh) : clamp(ny + dy, 0.02, 0.98),
    })
  }

  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <div
      style={{ position: 'absolute', inset: 0 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => {
        if (swallowClick.current) {
          swallowClick.current = false
          e.stopPropagation()
        }
      }}
    >
      {box && tool === 'text' && (
        <div
          className="text-box"
          style={{ left: box.x * width - 4, top: box.y * height - 4, width: box.w * width + 8, height: box.h * height + 8 }}
        />
      )}
    </div>
  )
}
