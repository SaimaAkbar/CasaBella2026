import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { RoleRoute } from '../components/RoleRoute';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../layout/AppLayout';
import { ApprovalsPage } from '../pages/ApprovalsPage';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { BackupsPage } from '../pages/BackupsPage';
import { DailyGuestsPage } from '../pages/DailyGuestsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { EmployeesPage } from '../pages/EmployeesPage';
import { ExpensesPage } from '../pages/ExpensesPage';
import { InventoryPage } from '../pages/InventoryPage';
import { LoginPage } from '../pages/LoginPage';
import { MonthlyTenantsPage } from '../pages/MonthlyTenantsPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { OwnersPage } from '../pages/OwnersPage';
import { PaymentsPage } from '../pages/PaymentsPage';
import { ProfitLossPage } from '../pages/ProfitLossPage';
import { PropertiesPage } from '../pages/PropertiesPage';
import { ReportsPage } from '../pages/ReportsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { UnitsPage } from '../pages/UnitsPage';

function GuestRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="app-boot">
        <div className="app-boot__spinner" aria-hidden="true" />
        <p>Checking your session…</p>
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/rooms" element={<UnitsPage />} />
          <Route path="/monthly-tenants" element={<MonthlyTenantsPage />} />
          <Route path="/daily-guests" element={<DailyGuestsPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/profit-loss" element={<ProfitLossPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route element={<RoleRoute roles={['SUPER_ADMIN']} />}>
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/backups" element={<BackupsPage />} />
            <Route path="/owners" element={<OwnersPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
