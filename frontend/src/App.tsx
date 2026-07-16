import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout, AuthLayout } from '@/layouts';
import {
  DashboardPage,
  CamerasPage,
  ViolationsPage,
  ReportsPage,
  SettingsPage,
  HelpPage,
  LoginPage,
  RegisterPage
} from '@/pages';
import useTheme from '@/hooks/useTheme';
import './App.css';

function App() {
  // Trigger theme sync on application mount
  useTheme();

  return (
    <BrowserRouter>
      <Routes>
        {/* Authentication layout wrapper */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Dashboard layout wrapper */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/cameras" element={<CamerasPage />} />
          <Route path="/violations" element={<ViolationsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
