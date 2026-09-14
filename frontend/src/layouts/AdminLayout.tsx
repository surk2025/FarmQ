import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Hourglass,
  Calendar,
  ClipboardCheck,
  Building2,
  Gauge,
  BarChart3,
  Settings,
  LogOut,
  Play,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Sprout,
  ExternalLink,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSimulateQueue = async () => {
    setSimulating(true);
    try {
      const res = await api.post('/admin/queue/simulate');
      setSimulationResult(`Simulation Success: Token #${res.data.completedToken} Completed → Token #${res.data.nowProcessing} Processing!`);
      setTimeout(() => setSimulationResult(null), 5000);
    } catch (err: any) {
      alert(`Simulation failed: ${err?.response?.data?.detail || 'Error'}`);
    } finally {
      setSimulating(false);
    }
  };

  const navItems = [
    { name: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Live Queue', path: '/admin/queue', icon: Hourglass, badge: 'Live' },
    { name: 'Farmers Management', path: '/admin/farmers', icon: Users },
    { name: 'Procurement Status', path: '/admin/procurement', icon: ClipboardCheck },
    { name: 'Centers & Capacity', path: '/admin/capacity', icon: Gauge },
    { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden w-full">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-xs">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base text-white">Farm<span className="text-emerald-400">Q</span></span>
            <span className="text-[10px] text-emerald-400 ml-1 font-semibold uppercase">Admin</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulateQueue}
            disabled={simulating}
            title="Simulate Queue Update"
            className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
            <span className="text-[11px]">Simulate</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            aria-label="Toggle admin navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs flex">
          <div className="w-72 bg-slate-950 h-full flex flex-col p-4 shadow-2xl border-r border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="font-bold text-white text-sm uppercase tracking-wider">Admin Navigation</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Assigned Center Pill */}
            <div className="my-3 p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
              <p className="text-slate-400 text-[10px]">Assigned Center:</p>
              <p className="text-white font-bold truncate">Greenfield Mandi</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                🟢 Active
              </span>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 py-2 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      active
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <Link
                to="/farmer/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/60 rounded-xl border border-emerald-800/50 transition-colors"
              >
                <span>Switch to Farmer View</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)}></div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-68 bg-slate-950 border-r border-slate-800 shrink-0">
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-600/30">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-black text-white font-heading tracking-tight">Farm<span className="text-emerald-400">Q</span></span>
              <span className="block text-[10px] uppercase tracking-widest text-emerald-400 font-bold -mt-0.5">Admin Portal</span>
            </div>
          </Link>
        </div>

        {/* Center Pill */}
        <div className="mx-4 my-3 p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
          <p className="text-slate-400 text-[11px] font-medium">Assigned Center:</p>
          <p className="text-white font-bold truncate">Greenfield Procurement Center</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80">
            🟢 Active Operations
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    active ? 'bg-white text-emerald-800' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          {/* Quick Demo Switcher */}
          <Link
            to="/farmer/dashboard"
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/60 rounded-xl border border-emerald-800/50 transition-colors"
          >
            <span>Switch to Farmer View</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-x-hidden w-full">
        {/* Top Navbar */}
        <header className="hidden md:flex h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold text-white font-heading">
              Procurement Center Admin Console
            </h1>
          </div>

          {/* Prominent "Simulate Queue Update" Button for Viva Demonstration */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSimulateQueue}
              disabled={simulating}
              title="Click to simulate real-time queue advancement: completes Token #23, advances #24 to processing, and pushes WebSocket updates to farmer screens!"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
              <span>{simulating ? 'Broadcasting...' : '⚡ Simulate Queue Update'}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-400">{user?.name || 'Vikram Singh'}</span>
            </div>
          </div>
        </header>

        {/* Live Simulation Alert */}
        {simulationResult && (
          <div className="bg-emerald-950 text-emerald-200 border-b border-emerald-800 px-4 sm:px-6 py-2.5 text-xs font-semibold flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{simulationResult}</span>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
