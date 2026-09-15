import { create } from 'zustand'

interface ToastState {
  message: string | null
  tone: 'info' | 'error'
  show: (message: string, tone?: 'info' | 'error') => void
  clear: () => void
}

let timer: number | undefined

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'info',
  show: (message, tone = 'info') => {
    window.clearTimeout(timer)
    set({ message, tone })
    timer = window.setTimeout(() => set({ message: null }), 2600)
  },
  clear: () => set({ message: null }),
}))
