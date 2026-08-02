import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { applyDocumentTheme, readStoredTheme } from '@/lib/theme'
import { registerServiceWorker } from '@/registerServiceWorker'

applyDocumentTheme(readStoredTheme())

// Seed PWA/visual viewport height before first paint to avoid a bottom dead band.
(() => {
  const vv = window.visualViewport
  const height = Math.max(1, Math.round(vv?.height ?? window.innerHeight))
  const width = Math.max(1, Math.round(vv?.width ?? window.innerWidth))
  document.documentElement.style.setProperty('--app-height', `${height}px`)
  document.documentElement.style.setProperty('--app-width', `${width}px`)
  document.documentElement.style.setProperty('--app-offset-top', `${Math.max(0, Math.round(vv?.offsetTop ?? 0))}px`)
  document.documentElement.style.setProperty('--app-offset-left', `${Math.max(0, Math.round(vv?.offsetLeft ?? 0))}px`)
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

registerServiceWorker()
