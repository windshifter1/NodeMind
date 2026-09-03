import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { applyDocumentTheme, readStoredTheme } from '@/lib/theme'
import { applyDocumentUiStyle } from '@/lib/uiStyle'
import { registerServiceWorker } from '@/registerServiceWorker'

applyDocumentTheme(readStoredTheme())
applyDocumentUiStyle()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

registerServiceWorker()
