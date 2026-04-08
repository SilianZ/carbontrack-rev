import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n.js'
import RootShell from './RootShell.jsx'
import { bootstrapDevAuthFromEnv } from './lib/auth';

(() => {
  const RESET_FLAG_KEY = 'auth_reset_once_v1';
  if (!localStorage.getItem(RESET_FLAG_KEY)) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    localStorage.setItem(RESET_FLAG_KEY, '1');
  }
})();

bootstrapDevAuthFromEnv();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootShell />
  </StrictMode>,
)
