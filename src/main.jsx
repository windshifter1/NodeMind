import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/styles/ui-glass.css'
import '@/styles/ui-clay-soft.css'
import '@/styles/ui-clay-vivid.css'
import '@/styles/ui-sketch.css'
import '@/styles/ui-whiteboard.css'
import { applyDocumentTheme, readStoredTheme } from '@/lib/theme'
import { applyDocumentUiStyle, readStoredUiStyle } from '@/lib/uiStyle'
import { registerServiceWorker } from '@/registerServiceWorker'

applyDocumentTheme(readStoredTheme())
applyDocumentUiStyle(readStoredUiStyle())

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

registerServiceWorker()
