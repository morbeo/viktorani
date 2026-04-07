import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Apply theme before first paint to avoid flash
const stored = localStorage.getItem('app-theme')
document.documentElement.setAttribute('data-theme', stored ?? 'system')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
