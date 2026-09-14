import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { QueueSocketProvider } from './context/QueueSocketContext';

// Layouts
import { PublicLayout } from './layouts/PublicLayout';
import { FarmerLayout } from './layouts/FarmerLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { CentersPage } from './pages/public/CentersPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';

// Farmer Pages
import { FarmerDashboard } from './pages/farmer/Dashboard';
import { MyCrops } from './pages/farmer/MyCrops';
import { CropPrices } from './pages/farmer/CropPrices';
import { PredictionCenter } from './pages/farmer/PredictionCenter';
import { FindCenter } from './pages/farmer/FindCenter';
import { BookSlot } from './pages/farmer/BookSlot';
import { LiveQueue } from './pages/farmer/LiveQueue';
import { ProcurementStatus } from './pages/farmer/ProcurementStatus';
import { Payments } from './pages/farmer/Payments';
import { Notifications } from './pages/farmer/Notifications';
import { Profile } from './pages/farmer/Profile';
import { Help } from './pages/farmer/Help';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { LiveQueueManagement } from './pages/admin/LiveQueueManagement';
import { FarmerManagement } from './pages/admin/FarmerManagement';
import { CenterCapacity } from './pages/admin/CenterCapacity';
import { Analytics } from './pages/admin/Analytics';

// Protected Route wrappers
const ProtectedFarmerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const hasLocalToken = Boolean(localStorage.getItem('farmq_token'));
  if (loading) return <div className="p-12 text-center text-slate-500">Loading FarmQ...</div>;
  if (!isAuthenticated && !hasLocalToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const hasLocalToken = Boolean(localStorage.getItem('farmq_token'));
  if (loading) return <div className="p-12 text-center text-slate-500">Loading FarmQ...</div>;
  if (!isAuthenticated && !hasLocalToken) return <Navigate to="/login" replace />;
  const savedUser = user || (localStorage.getItem('farmq_user') ? JSON.parse(localStorage.getItem('farmq_user')!) : null);
  if (savedUser?.role !== 'admin' && savedUser?.role !== 'superadmin') {
    return <Navigate to="/farmer/dashboard" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <QueueSocketProvider>
            <Routes>
              {/* Public Routes */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/features" element={<LandingPage />} />
                <Route path="/centers" element={<CentersPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>

              {/* Farmer Portal Routes */}
              <Route
                path="/farmer"
                element={
                  <ProtectedFarmerRoute>
                    <FarmerLayout />
                  </ProtectedFarmerRoute>
                }
              >
                <Route index element={<Navigate to="/farmer/dashboard" replace />} />
                <Route path="dashboard" element={<FarmerDashboard />} />
                <Route path="crops" element={<MyCrops />} />
                <Route path="crop-prices" element={<CropPrices />} />
                <Route path="prediction-center" element={<PredictionCenter />} />
                <Route path="centers" element={<FindCenter />} />
                <Route path="book" element={<BookSlot />} />
                <Route path="queue" element={<LiveQueue />} />
                <Route path="procurement" element={<ProcurementStatus />} />
                <Route path="payments" element={<Payments />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route path="help" element={<Help />} />
              </Route>

              {/* Admin Portal Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedAdminRoute>
                    <AdminLayout />
                  </ProtectedAdminRoute>
                }
              >
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="queue" element={<LiveQueueManagement />} />
                <Route path="farmers" element={<FarmerManagement />} />
                <Route path="capacity" element={<CenterCapacity />} />
                <Route path="procurement" element={<LiveQueueManagement />} />
                <Route path="analytics" element={<Analytics />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </QueueSocketProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
