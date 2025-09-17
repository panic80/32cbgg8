import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import './styles/typography.css'
import './styles/animations.css'
import './styles/landing.css'
import { ThemeProvider } from './context/ThemeContext'
import { GlossaryProvider } from './context/GlossaryContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <GlossaryProvider>
        <App />
      </GlossaryProvider>
    </ThemeProvider>
  </React.StrictMode>
)
