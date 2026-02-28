/**
 * src/main.jsx — Vite/React entry point
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
  console.warn(
    '⚠️  VITE_ANTHROPIC_API_KEY is not set. AI summaries will not work.\n' +
    'Create a .env file in the project root with:\n' +
    'VITE_ANTHROPIC_API_KEY=your_key_here'
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
