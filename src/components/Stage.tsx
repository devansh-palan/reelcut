import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { engine } from '../engine/engine'
import { useProject } from '../store/project'
import { aspectSize } from '../lib/timeline'

export interface StageMetrics {
  /** Display size of the stage in CSS px. */
  width: number
  height: number
  /** Output canvas size in px. */
  canvasW: number
  canvasH: number
  /** CSS px per canvas px. */
  scale: number
}

const StageContext = createContext<StageMetrics>({ width: 0, height: 0, canvasW: 1, canvasH: 1, scale: 1 })

export function useStage() {
  return useContext(StageContext)
}

interface Props {
  children?: ReactNode
  onTap?: () => void
  className?: string
}

/**
 * Hosts the engine's canvas, sized to fit its container while keeping the
 * project aspect ratio, and exposes display metrics to overlay children.
 */
export default function Stage({ children, onTap, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const aspect = useProject((s) => s.aspect)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const fit = () => {
      const { w, h } = aspectSize(aspect)
      // Content box only: clientWidth/Height would include the wrapper's padding.
      const cs = getComputedStyle(el)
      const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const ch = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      const s = Math.min(cw / w, ch / h)
      setBox({ w: Math.max(0, Math.floor(w * s)), h: Math.max(0, Math.floor(h * s)) })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [aspect])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    engine.attach(canvas)
    return () => engine.detach(canvas)
  }, [])

  const { w: canvasW, h: canvasH } = aspectSize(aspect)
  const metrics: StageMetrics = { width: box.w, height: box.h, canvasW, canvasH, scale: box.w / canvasW || 1 }

  return (
    <div className={`stage-wrap ${className ?? ''}`} ref={wrapRef}>
      <StageContext.Provider value={metrics}>
        <div className="stage" style={{ width: box.w, height: box.h }} onClick={onTap}>
          <canvas ref={canvasRef} />
          <div className="overlay">{children}</div>
        </div>
      </StageContext.Provider>
    </div>
  )
}
