import { useEffect } from 'react'
import { useProject } from './store/project'
import { engine } from './engine/engine'
import UploadScreen from './screens/UploadScreen'
import EditorScreen from './screens/EditorScreen'
import PreviewScreen from './screens/PreviewScreen'
import Toast from './components/Toast'

export default function App() {
  const screen = useProject((s) => s.screen)

  // Desktop conveniences: space to play/pause, ctrl/cmd+z to undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return
      const s = useProject.getState()
      if (e.code === 'Space' && s.screen !== 'upload') {
        e.preventDefault()
        engine.toggle()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Pause when the tab goes to the background.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) engine.pause()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <div className="app">
      {screen === 'upload' && <UploadScreen key="upload" />}
      {screen === 'editor' && <EditorScreen key="editor" />}
      {screen === 'preview' && <PreviewScreen key="preview" />}
      <Toast />
    </div>
  )
}
