import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/styles/fonts.css'
import '@/index.css'
import '@/styles/tokens.css'
import '@/styles/ui-chrome-layout.css'
import '@/styles/gen-ii.css'
import '@/styles/shell.css'
import '@/styles/motion.css'
import '@/styles/glassPress.css'
import {
  applyA11yContrast,
  applyA11yFont,
  applyDensity,
  applyDocumentTheme,
  readStoredA11yContrast,
  readStoredA11yFont,
  readStoredDensity,
  readStoredTheme,
} from '@/lib/theme'
import { registerServiceWorker } from '@/registerServiceWorker'

/** Prod SW registrations on localhost can serve a stale shell and break `vite` dev. */
if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister())
  })
}

applyDocumentTheme(readStoredTheme())
applyDensity(readStoredDensity())
applyA11yFont(readStoredA11yFont())
applyA11yContrast(readStoredA11yContrast())

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

registerServiceWorker()
