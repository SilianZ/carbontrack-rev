import { StrictMode as Silian_StrictMode } from 'react'
import { createRoot as Silian_createRoot } from 'react-dom/client'
import './index.css'
import { initializeI18n as Silian_initializeI18n } from './lib/i18n'
import Silian_RootShell from './RootShell.jsx'
import { bootstrapDevAuthFromEnv as Silian_bootstrapDevAuthFromEnv } from './lib/auth';

(() => {
  const Silian_RESET_FLAG_KEY = 'auth_reset_once_v1';
  if (!localStorage.getItem(Silian_RESET_FLAG_KEY)) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    localStorage.setItem(Silian_RESET_FLAG_KEY, '1');
  }
})();

Silian_bootstrapDevAuthFromEnv();

const Silian_root = Silian_createRoot(document.getElementById('root'));

const Silian_renderApp = () => {
  Silian_root.render(
    <Silian_StrictMode>
      <Silian_RootShell />
    </Silian_StrictMode>,
  );
};

const Silian_bootstrapApp = async () => {
  try {
    await Silian_initializeI18n();
  } catch (Silian_error) {
    console.error('Failed to initialize i18n before app render', Silian_error);
  }

  Silian_renderApp();
};

void Silian_bootstrapApp();
