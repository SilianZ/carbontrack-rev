import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout, AuthLayout } from '../components/layout/Layout';
import AdminLayout from '../components/layout/AdminLayout';
import { ProtectedRoute, PublicRoute, AdminRoute } from '../components/auth/ProtectedRoute';

// Lazy loaded pages
const HomePage = React.lazy(() => import('../pages/HomePage'));
const LoginPage = React.lazy(() => import('../pages/LoginPage'));
const RegisterPage = React.lazy(() => import('../pages/RegisterPage'));
const ForgotPasswordPage = React.lazy(() => import('../pages/ForgotPasswordPage'));
const DashboardPage = React.lazy(() => import('../pages/DashboardPage'));
const VerifyEmailPage = React.lazy(() => import('../pages/VerifyEmailPage'));
const ResetPasswordPage = React.lazy(() => import('../pages/ResetPasswordPage'));
const CalculatePage = React.lazy(() => import('../pages/CalculatePage'));
const ActivitiesPage = React.lazy(() => import('../pages/ActivitiesPage'));
const StorePage = React.lazy(() => import('../pages/StorePage'));
const ExchangeHistoryPage = React.lazy(() => import('../pages/ExchangeHistoryPage'));
const MessagesPage = React.lazy(() => import('../pages/MessagesPage'));
const ProfilePage = React.lazy(() => import('../pages/ProfilePage'));
const OnboardingPage = React.lazy(() => import('../pages/OnboardingPage'));
const AchievementsPage = React.lazy(() => import('../pages/AchievementsPage'));
const NotificationSettingsPage = React.lazy(() => import('../pages/NotificationSettingsPage'));
const AboutUsPage = React.lazy(() => import('../pages/AboutUsPage'));
const PrivacyPolicyPage = React.lazy(() => import('../pages/PrivacyPolicyPage'));
const TermsOfServicePage = React.lazy(() => import('../pages/TermsOfServicePage'));
const CookiePolicyPage = React.lazy(() => import('../pages/CookiePolicyPage'));
const SecurityPage = React.lazy(() => import('../pages/SecurityPage'));
// Admin pages
const AdminDashboardPage = React.lazy(() => import('../pages/admin/Dashboard'));
const AdminPasskeysPage = React.lazy(() => import('../pages/admin/Passkeys'));
const AdminUsersPage = React.lazy(() => import('../pages/admin/Users'));
const AdminUserGroupsPage = React.lazy(() => import('../pages/admin/UserGroups'));
const AdminActivitiesPage = React.lazy(() => import('../pages/admin/Activities'));
const AdminBadgesPage = React.lazy(() => import('../pages/admin/Badges'));
const AdminAvatarsPage = React.lazy(() => import('../pages/admin/Avatars'));
const AdminProductsPage = React.lazy(() => import('../pages/admin/Products'));
const AdminExchangesPage = React.lazy(() => import('../pages/admin/Exchanges'));
const AdminBroadcastPage = React.lazy(() => import('../pages/admin/Broadcast'));
const AdminSystemLogsPage = React.lazy(() => import('../pages/admin/SystemLogs'));
const AdminDiagnosticsPage = React.lazy(() => import('../pages/admin/Diagnostics'));
const AdminLlmUsagePage = React.lazy(() => import('../pages/admin/LlmUsage'));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage'));

const loadingSpinner = (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-green-500" />
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <React.Suspense fallback={loadingSpinner}><HomePage /></React.Suspense> },
      { path: 'about-us', element: <React.Suspense fallback={loadingSpinner}><AboutUsPage /></React.Suspense> },
      { path: 'privacy', element: <React.Suspense fallback={loadingSpinner}><PrivacyPolicyPage /></React.Suspense> },
      { path: 'terms', element: <React.Suspense fallback={loadingSpinner}><TermsOfServicePage /></React.Suspense> },
      { path: 'cookies', element: <React.Suspense fallback={loadingSpinner}><CookiePolicyPage /></React.Suspense> },
      { path: 'security', element: <React.Suspense fallback={loadingSpinner}><SecurityPage /></React.Suspense> },
      { path: 'dashboard', element: <ProtectedRoute requireAuth><React.Suspense fallback={loadingSpinner}><DashboardPage /></React.Suspense></ProtectedRoute> },
      { path: 'calculate', element: <ProtectedRoute requireAuth><React.Suspense fallback={loadingSpinner}><CalculatePage /></React.Suspense></ProtectedRoute> },
      { path: 'activities', element: <ProtectedRoute requireAuth><React.Suspense fallback={loadingSpinner}><ActivitiesPage /></React.Suspense></ProtectedRoute> },
      { path: 'store', element: <ProtectedRoute requireAuth><React.Suspense fallback={loadingSpinner}><StorePage /></React.Suspense></ProtectedRoute> },
      { path: 'store/exchanges', element: <ProtectedRoute requireAuth><React.Suspense fallback={loadingSpinner}><ExchangeHistoryPage /></React.Suspense></ProtectedRoute> },
      { path: 'messages', element: <ProtectedRoute requireAuth><React.Suspense fallback={loadingSpinner}><MessagesPage /></React.Suspense></ProtectedRoute> },
      { path: 'profile', element: <ProtectedRoute requireAuth><React.Suspense fallback={loadingSpinner}><ProfilePage /></React.Suspense></ProtectedRoute> },
      { path: 'achievements', element: <ProtectedRoute requireAuth><React.Suspense fallback={loadingSpinner}><AchievementsPage /></React.Suspense></ProtectedRoute> },
      { path: 'onboarding', element: <ProtectedRoute requireAuth><React.Suspense fallback={loadingSpinner}><OnboardingPage /></React.Suspense></ProtectedRoute> },
      { path: 'settings/notifications', element: <ProtectedRoute requireAuth><React.Suspense fallback={loadingSpinner}><NotificationSettingsPage /></React.Suspense></ProtectedRoute> },
      {
        path: '*',
        element: (
          <React.Suspense fallback={loadingSpinner}>
            <NotFoundPage />
          </React.Suspense>
        )
      }
    ]
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <PublicRoute><React.Suspense fallback={loadingSpinner}><LoginPage /></React.Suspense></PublicRoute> },
      { path: 'register', element: <PublicRoute><React.Suspense fallback={loadingSpinner}><RegisterPage /></React.Suspense></PublicRoute> },
      { path: 'forgot-password', element: <PublicRoute><React.Suspense fallback={loadingSpinner}><ForgotPasswordPage /></React.Suspense></PublicRoute> },
      { path: 'verify-email', element: <React.Suspense fallback={loadingSpinner}><VerifyEmailPage /></React.Suspense> },
    ]
  },
  { path: '/login', element: <Navigate to="/auth/login" replace /> },
  { path: '/register', element: <Navigate to="/auth/register" replace /> },
  { path: '/forgot-password', element: <Navigate to="/auth/forgot-password" replace /> },
  { path: '/reset-password', element: <React.Suspense fallback={loadingSpinner}><ResetPasswordPage /></React.Suspense> },
  {
    path: '/admin',
    element: <AdminRoute><AdminLayout /></AdminRoute>,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <React.Suspense fallback={loadingSpinner}><AdminDashboardPage /></React.Suspense> },
      { path: 'passkeys', element: <React.Suspense fallback={loadingSpinner}><AdminPasskeysPage /></React.Suspense> },
      { path: 'users', element: <React.Suspense fallback={loadingSpinner}><AdminUsersPage /></React.Suspense> },
      { path: 'users/groups', element: <React.Suspense fallback={loadingSpinner}><AdminUserGroupsPage /></React.Suspense> },
      { path: 'activities', element: <React.Suspense fallback={loadingSpinner}><AdminActivitiesPage /></React.Suspense> },
      { path: 'badges', element: <React.Suspense fallback={loadingSpinner}><AdminBadgesPage /></React.Suspense> },
      { path: 'avatars', element: <React.Suspense fallback={loadingSpinner}><AdminAvatarsPage /></React.Suspense> },
      { path: 'products', element: <React.Suspense fallback={loadingSpinner}><AdminProductsPage /></React.Suspense> },
      { path: 'exchanges', element: <React.Suspense fallback={loadingSpinner}><AdminExchangesPage /></React.Suspense> },
      { path: 'broadcast', element: <React.Suspense fallback={loadingSpinner}><AdminBroadcastPage /></React.Suspense> },
      { path: 'llm-usage', element: <React.Suspense fallback={loadingSpinner}><AdminLlmUsagePage /></React.Suspense> },
      { path: 'system-logs', element: <React.Suspense fallback={loadingSpinner}><AdminSystemLogsPage /></React.Suspense> },
      { path: 'diagnostics', element: <React.Suspense fallback={loadingSpinner}><AdminDiagnosticsPage /></React.Suspense> }
    ]
  }
]);

export default router;
