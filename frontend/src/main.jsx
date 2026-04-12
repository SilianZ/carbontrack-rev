import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initializeI18n } from './lib/i18n'
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

const root = createRoot(document.getElementById('root'));

const renderApp = () => {
  root.render(
    <StrictMode>
      <RootShell />
    </StrictMode>,
  );
};

const bootstrapApp = async () => {
  try {
    await initializeI18n();
  } catch (error) {
    console.error('Failed to initialize i18n before app render', error);
  }

  renderApp();
};

void bootstrapApp();
