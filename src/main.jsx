import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/styles/tokens.css'
import '@/styles/ui-chrome-layout.css'
import '@/styles/gen-ii.css'
import '@/styles/shell.css'
import '@/styles/motion.css'
import { applyDensity, applyDocumentTheme, readStoredDensity, readStoredTheme } from '@/lib/theme'
import { registerServiceWorker } from '@/registerServiceWorker'

applyDocumentTheme(readStoredTheme())
applyDensity(readStoredDensity())

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

registerServiceWorker()
