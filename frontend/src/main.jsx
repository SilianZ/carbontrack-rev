import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n.js' // 初始化i18n
import App from './App.jsx'
import { QueryClientProvider } from 'react-query';
import { queryClient } from './lib/react-query';
import { ThemeProvider } from './components/theme/ThemeProvider.jsx'
import { Toaster } from './components/ui/sonner.jsx'

// 首次加载强制重置本地登录态（清一次历史token），确保“默认未登录”
(() => {
  const RESET_FLAG_KEY = 'auth_reset_once_v1';
  if (!localStorage.getItem(RESET_FLAG_KEY)) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    localStorage.setItem(RESET_FLAG_KEY, '1');
  }
})();

// 加载中组件
const loadingFallback = (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Suspense fallback={loadingFallback}>
          <App />
        </Suspense>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
