import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/typography.css';
import './styles/animations.css';
import './styles/landing.css';
import { ThemeProvider } from './context/ThemeContext';
import { LocaleProvider } from './i18n/LocaleContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
