import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { useProject } from './store/project'
import { engine } from './engine/engine'

// Handy for poking at state from devtools / automated tests.
if (import.meta.env.DEV) {
  const w = window as unknown as { __project: typeof useProject; __engine: typeof engine }
  w.__project = useProject
  w.__engine = engine
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
