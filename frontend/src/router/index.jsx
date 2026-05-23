import Silian_React from 'react';
import { createBrowserRouter as Silian_createBrowserRouter, Navigate as Silian_Navigate } from 'react-router-dom';
import { Layout as Silian_Layout, AuthLayout as Silian_AuthLayout } from '../components/layout/Layout';
import { ProtectedRoute as Silian_ProtectedRoute, PublicRoute as Silian_PublicRoute, AdminRoute as Silian_AdminRoute, SupportRoute as Silian_SupportRoute } from '../components/auth/ProtectedRoute';

// Lazy loaded pages
const Silian_HomePage = Silian_React.lazy(() => import('../pages/HomePage'));
const Silian_LoginPage = Silian_React.lazy(() => import('../pages/LoginPage'));
const Silian_RegisterPage = Silian_React.lazy(() => import('../pages/RegisterPage'));
const Silian_ForgotPasswordPage = Silian_React.lazy(() => import('../pages/ForgotPasswordPage'));
const Silian_DashboardPage = Silian_React.lazy(() => import('../pages/DashboardPage'));
const Silian_VerifyEmailPage = Silian_React.lazy(() => import('../pages/VerifyEmailPage'));
const Silian_ResetPasswordPage = Silian_React.lazy(() => import('../pages/ResetPasswordPage'));
const Silian_CalculatePage = Silian_React.lazy(() => import('../pages/CalculatePage'));
const Silian_ActivitiesPage = Silian_React.lazy(() => import('../pages/ActivitiesPage'));
const Silian_StorePage = Silian_React.lazy(() => import('../pages/StorePage'));
const Silian_ExchangeHistoryPage = Silian_React.lazy(() => import('../pages/ExchangeHistoryPage'));
const Silian_MessagesPage = Silian_React.lazy(() => import('../pages/MessagesPage'));
const Silian_ProfilePage = Silian_React.lazy(() => import('../pages/ProfilePage'));
const Silian_OnboardingPage = Silian_React.lazy(() => import('../pages/OnboardingPage'));
const Silian_AchievementsPage = Silian_React.lazy(() => import('../pages/AchievementsPage'));
const Silian_NotificationSettingsPage = Silian_React.lazy(() => import('../pages/NotificationSettingsPage'));
const Silian_AboutUsPage = Silian_React.lazy(() => import('../pages/AboutUsPage'));
const Silian_ContactPage = Silian_React.lazy(() => import('../pages/ContactPage'));
const Silian_HelpPage = Silian_React.lazy(() => import('../pages/HelpPage'));
const Silian_PrivacyPolicyPage = Silian_React.lazy(() => import('../pages/PrivacyPolicyPage'));
const Silian_TermsOfServicePage = Silian_React.lazy(() => import('../pages/TermsOfServicePage'));
const Silian_CookiePolicyPage = Silian_React.lazy(() => import('../pages/CookiePolicyPage'));
const Silian_SecurityPage = Silian_React.lazy(() => import('../pages/SecurityPage'));
const Silian_TicketsPage = Silian_React.lazy(() => import('../pages/TicketsPage'));
const Silian_TicketDetailPage = Silian_React.lazy(() => import('../pages/TicketDetailPage'));
const Silian_AdminLayout = Silian_React.lazy(() => import('../components/layout/AdminLayout'));
const Silian_SupportLayout = Silian_React.lazy(() => import('../components/layout/SupportLayout'));
// Admin pages
const Silian_AdminDashboardPage = Silian_React.lazy(() => import('../pages/admin/Dashboard'));
const Silian_AdminPasskeysPage = Silian_React.lazy(() => import('../pages/admin/Passkeys'));
const Silian_AdminUsersPage = Silian_React.lazy(() => import('../pages/admin/Users'));
const Silian_AdminUserGroupsPage = Silian_React.lazy(() => import('../pages/admin/UserGroups'));
const Silian_AdminActivitiesPage = Silian_React.lazy(() => import('../pages/admin/Activities'));
const Silian_AdminBadgesPage = Silian_React.lazy(() => import('../pages/admin/Badges'));
const Silian_AdminAvatarsPage = Silian_React.lazy(() => import('../pages/admin/Avatars'));
const Silian_AdminProductsPage = Silian_React.lazy(() => import('../pages/admin/Products'));
const Silian_AdminExchangesPage = Silian_React.lazy(() => import('../pages/admin/Exchanges'));
const Silian_AdminBroadcastPage = Silian_React.lazy(() => import('../pages/admin/Broadcast'));
const Silian_AdminSupportOpsPage = Silian_React.lazy(() => import('../pages/admin/SupportOps'));
const Silian_AdminCronPage = Silian_React.lazy(() => import('../pages/admin/Cron'));
const Silian_AdminAiWorkspacePage = Silian_React.lazy(() => import('../pages/admin/AiWorkspace'));
const Silian_AdminSystemLogsPage = Silian_React.lazy(() => import('../pages/admin/SystemLogs'));
const Silian_AdminDiagnosticsPage = Silian_React.lazy(() => import('../pages/admin/Diagnostics'));
const Silian_AdminLlmUsagePage = Silian_React.lazy(() => import('../pages/admin/LlmUsage'));
const Silian_SupportWorkbenchPage = Silian_React.lazy(() => import('../pages/support/WorkbenchPage'));
const Silian_SupportTicketsPage = Silian_React.lazy(() => import('../pages/support/TicketsPage'));
const Silian_SupportTicketDetailPage = Silian_React.lazy(() => import('../pages/support/TicketDetailPage'));
const Silian_NotFoundPage = Silian_React.lazy(() => import('../pages/NotFoundPage'));

const Silian_loadingSpinner = (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-green-500" />
  </div>
);

export const router = Silian_createBrowserRouter([
  {
    path: '/',
    element: <Silian_Layout />,
    children: [
      { index: true, element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_HomePage /></Silian_React.Suspense> },
      { path: 'about-us', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AboutUsPage /></Silian_React.Suspense> },
      { path: 'contact', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_ContactPage /></Silian_React.Suspense> },
      { path: 'help', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_HelpPage /></Silian_React.Suspense> },
      { path: 'privacy', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_PrivacyPolicyPage /></Silian_React.Suspense> },
      { path: 'terms', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_TermsOfServicePage /></Silian_React.Suspense> },
      { path: 'cookies', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_CookiePolicyPage /></Silian_React.Suspense> },
      { path: 'security', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_SecurityPage /></Silian_React.Suspense> },
      { path: 'tickets', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_TicketsPage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      { path: 'tickets/:ticketId', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_TicketDetailPage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      { path: 'dashboard', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_DashboardPage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      { path: 'calculate', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_CalculatePage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      { path: 'activities', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_ActivitiesPage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      { path: 'store', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_StorePage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      { path: 'store/exchanges', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_ExchangeHistoryPage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      { path: 'messages', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_MessagesPage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      { path: 'profile', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_ProfilePage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      { path: 'achievements', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AchievementsPage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      { path: 'onboarding', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_OnboardingPage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      { path: 'settings/notifications', element: <Silian_ProtectedRoute requireAuth><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_NotificationSettingsPage /></Silian_React.Suspense></Silian_ProtectedRoute> },
      {
        path: '*',
        element: (
          <Silian_React.Suspense fallback={Silian_loadingSpinner}>
            <Silian_NotFoundPage />
          </Silian_React.Suspense>
        )
      }
    ]
  },
  {
    path: '/auth',
    element: <Silian_AuthLayout />,
    children: [
      { path: 'login', element: <Silian_PublicRoute><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_LoginPage /></Silian_React.Suspense></Silian_PublicRoute> },
      { path: 'register', element: <Silian_PublicRoute><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_RegisterPage /></Silian_React.Suspense></Silian_PublicRoute> },
      { path: 'forgot-password', element: <Silian_PublicRoute><Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_ForgotPasswordPage /></Silian_React.Suspense></Silian_PublicRoute> },
      { path: 'verify-email', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_VerifyEmailPage /></Silian_React.Suspense> },
    ]
  },
  { path: '/login', element: <Silian_Navigate to="/auth/login" replace /> },
  { path: '/register', element: <Silian_Navigate to="/auth/register" replace /> },
  { path: '/forgot-password', element: <Silian_Navigate to="/auth/forgot-password" replace /> },
  { path: '/reset-password', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_ResetPasswordPage /></Silian_React.Suspense> },
  {
    path: '/admin',
    element: (
      <Silian_AdminRoute>
        <Silian_React.Suspense fallback={Silian_loadingSpinner}>
          <Silian_AdminLayout />
        </Silian_React.Suspense>
      </Silian_AdminRoute>
    ),
    children: [
      { index: true, element: <Silian_Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminDashboardPage /></Silian_React.Suspense> },
      { path: 'ai', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminAiWorkspacePage /></Silian_React.Suspense> },
      { path: 'passkeys', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminPasskeysPage /></Silian_React.Suspense> },
      { path: 'users', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminUsersPage /></Silian_React.Suspense> },
      { path: 'users/groups', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminUserGroupsPage /></Silian_React.Suspense> },
      { path: 'activities', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminActivitiesPage /></Silian_React.Suspense> },
      { path: 'badges', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminBadgesPage /></Silian_React.Suspense> },
      { path: 'avatars', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminAvatarsPage /></Silian_React.Suspense> },
      { path: 'products', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminProductsPage /></Silian_React.Suspense> },
      { path: 'exchanges', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminExchangesPage /></Silian_React.Suspense> },
      { path: 'broadcast', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminBroadcastPage /></Silian_React.Suspense> },
      { path: 'support', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminSupportOpsPage /></Silian_React.Suspense> },
      { path: 'cron', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminCronPage /></Silian_React.Suspense> },
      { path: 'llm-usage', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminLlmUsagePage /></Silian_React.Suspense> },
      { path: 'system-logs', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminSystemLogsPage /></Silian_React.Suspense> },
      { path: 'diagnostics', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_AdminDiagnosticsPage /></Silian_React.Suspense> }
    ]
  },
  {
    path: '/support',
    element: (
      <Silian_SupportRoute>
        <Silian_React.Suspense fallback={Silian_loadingSpinner}>
          <Silian_SupportLayout />
        </Silian_React.Suspense>
      </Silian_SupportRoute>
    ),
    children: [
      { index: true, element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_SupportWorkbenchPage /></Silian_React.Suspense> },
      { path: 'workbench', element: <Silian_Navigate to="/support" replace /> },
      { path: 'tickets', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_SupportTicketsPage /></Silian_React.Suspense> },
      { path: 'tickets/:ticketId', element: <Silian_React.Suspense fallback={Silian_loadingSpinner}><Silian_SupportTicketDetailPage /></Silian_React.Suspense> }
    ]
  }
]);

export default router;
