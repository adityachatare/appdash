import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppShell } from './components/Layout';
import { Spinner } from './components/ui';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { AppLayout } from './pages/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { DevicesPage } from './pages/DevicesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { NotificationDetailPage } from './pages/NotificationDetailPage';
import { ComposePage } from './pages/ComposePage';
import { SettingsPage } from './pages/SettingsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner className="h-screen" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={loading ? <Spinner className="h-screen" /> : user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={loading ? <Spinner className="h-screen" /> : user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="apps/:appId" element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="notifications/new" element={<ComposePage />} />
          <Route path="notifications/:notificationId" element={<NotificationDetailPage />} />
          <Route path="notifications/:notificationId/edit" element={<ComposePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
