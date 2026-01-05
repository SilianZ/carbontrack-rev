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
const AdminUsersPage = React.lazy(() => import('../pages/admin/Users'));
const AdminActivitiesPage = React.lazy(() => import('../pages/admin/Activities'));
const AdminBadgesPage = React.lazy(() => import('../pages/admin/Badges'));
const AdminAvatarsPage = React.lazy(() => import('../pages/admin/Avatars'));
const AdminProductsPage = React.lazy(() => import('../pages/admin/Products'));
const AdminExchangesPage = React.lazy(() => import('../pages/admin/Exchanges'));
const AdminBroadcastPage = React.lazy(() => import('../pages/admin/Broadcast'));
const AdminSystemLogsPage = React.lazy(() => import('../pages/admin/SystemLogs'));
const AdminDiagnosticsPage = React.lazy(() => import('../pages/admin/Diagnostics'));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage'));

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500" />
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <React.Suspense fallback={<LoadingSpinner />}><HomePage /></React.Suspense> },
      { path: 'about-us', element: <React.Suspense fallback={<LoadingSpinner />}><AboutUsPage /></React.Suspense> },
      { path: 'privacy', element: <React.Suspense fallback={<LoadingSpinner />}><PrivacyPolicyPage /></React.Suspense> },
      { path: 'terms', element: <React.Suspense fallback={<LoadingSpinner />}><TermsOfServicePage /></React.Suspense> },
      { path: 'cookies', element: <React.Suspense fallback={<LoadingSpinner />}><CookiePolicyPage /></React.Suspense> },
      { path: 'security', element: <React.Suspense fallback={<LoadingSpinner />}><SecurityPage /></React.Suspense> },
      { path: 'dashboard', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><DashboardPage /></React.Suspense></ProtectedRoute> },
      { path: 'calculate', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><CalculatePage /></React.Suspense></ProtectedRoute> },
      { path: 'activities', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><ActivitiesPage /></React.Suspense></ProtectedRoute> },
      { path: 'store', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><StorePage /></React.Suspense></ProtectedRoute> },
      { path: 'messages', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><MessagesPage /></React.Suspense></ProtectedRoute> },
      { path: 'profile', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><ProfilePage /></React.Suspense></ProtectedRoute> },
      { path: 'achievements', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><AchievementsPage /></React.Suspense></ProtectedRoute> },
      { path: 'onboarding', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><OnboardingPage /></React.Suspense></ProtectedRoute> },
      { path: 'settings/notifications', element: <ProtectedRoute requireAuth><React.Suspense fallback={<LoadingSpinner />}><NotificationSettingsPage /></React.Suspense></ProtectedRoute> },
      {
        path: '*',
        element: (
          <React.Suspense fallback={<LoadingSpinner />}>
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
      { path: 'login', element: <PublicRoute><React.Suspense fallback={<LoadingSpinner />}><LoginPage /></React.Suspense></PublicRoute> },
      { path: 'register', element: <PublicRoute><React.Suspense fallback={<LoadingSpinner />}><RegisterPage /></React.Suspense></PublicRoute> },
      { path: 'forgot-password', element: <PublicRoute><React.Suspense fallback={<LoadingSpinner />}><ForgotPasswordPage /></React.Suspense></PublicRoute> },
      { path: 'verify-email', element: <React.Suspense fallback={<LoadingSpinner />}><VerifyEmailPage /></React.Suspense> },
    ]
  },
  { path: '/login', element: <Navigate to="/auth/login" replace /> },
  { path: '/register', element: <Navigate to="/auth/register" replace /> },
  { path: '/forgot-password', element: <Navigate to="/auth/forgot-password" replace /> },
  { path: '/reset-password', element: <React.Suspense fallback={<LoadingSpinner />}><ResetPasswordPage /></React.Suspense> },
  {
    path: '/admin',
    element: <AdminRoute><AdminLayout /></AdminRoute>,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <React.Suspense fallback={<LoadingSpinner />}><AdminDashboardPage /></React.Suspense> },
      { path: 'users', element: <React.Suspense fallback={<LoadingSpinner />}><AdminUsersPage /></React.Suspense> },
      { path: 'activities', element: <React.Suspense fallback={<LoadingSpinner />}><AdminActivitiesPage /></React.Suspense> },
      { path: 'badges', element: <React.Suspense fallback={<LoadingSpinner />}><AdminBadgesPage /></React.Suspense> },
      { path: 'avatars', element: <React.Suspense fallback={<LoadingSpinner />}><AdminAvatarsPage /></React.Suspense> },
      { path: 'products', element: <React.Suspense fallback={<LoadingSpinner />}><AdminProductsPage /></React.Suspense> },
      { path: 'exchanges', element: <React.Suspense fallback={<LoadingSpinner />}><AdminExchangesPage /></React.Suspense> },
      { path: 'broadcast', element: <React.Suspense fallback={<LoadingSpinner />}><AdminBroadcastPage /></React.Suspense> },
      { path: 'system-logs', element: <React.Suspense fallback={<LoadingSpinner />}><AdminSystemLogsPage /></React.Suspense> },
      { path: 'diagnostics', element: <React.Suspense fallback={<LoadingSpinner />}><AdminDiagnosticsPage /></React.Suspense> }
    ]
  }
]);

export default router;
