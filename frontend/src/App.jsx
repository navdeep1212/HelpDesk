import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';
import AuthLayout from './layouts/AuthLayout';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CreateTicketPage from './pages/customer/CreateTicketPage';
import MyTicketsPage from './pages/customer/MyTicketsPage';
import TicketDetailPage from './pages/customer/TicketDetailPage';
import AgentDashboard from './pages/agent/AgentDashboard';
import AgentTicketsPage from './pages/agent/AgentTicketsPage';
import AgentTicketDetailPage from './pages/agent/AgentTicketDetailPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';

// Resolves default home route based on active user role
const HomeRoute = () => {
  const { isAgent } = useAuth();
  return isAgent ? <Navigate to="/agent" replace /> : <CustomerDashboard />;
};

export const App = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Authentication Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Authenticated Application Shell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {/* Dynamic Role-Based Landing */}
            <Route path="/" element={<HomeRoute />} />
            <Route path="/dashboard" element={<HomeRoute />} />

            {/* Customer Portal Routes (USER role) */}
            <Route element={<RoleRoute allowedRoles={['USER']} />}>
              <Route path="/tickets" element={<MyTicketsPage />} />
              <Route path="/tickets/create" element={<CreateTicketPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
            </Route>

            {/* Support Agent Console Routes (AGENT role) */}
            <Route element={<RoleRoute allowedRoles={['AGENT']} />}>
              <Route path="/agent" element={<AgentDashboard />} />
              <Route path="/agent/dashboard" element={<AgentDashboard />} />
              <Route path="/agent/tickets" element={<AgentTicketsPage />} />
              <Route path="/agent/tickets/:id" element={<AgentTicketDetailPage />} />
            </Route>

            {/* 403 Forbidden Page */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
          </Route>
        </Route>

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
