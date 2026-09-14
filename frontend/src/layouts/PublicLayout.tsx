import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Sprout, UserCheck, ArrowRight, ShieldCheck, Menu, X, LayoutDashboard, LogOut } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export const PublicLayout: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu whenever navigation path changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: t('home'), path: '/' },
    { name: t('howItWorks'), path: '/how-it-works' },
    { name: t('features'), path: '/features' },
    { name: t('centers'), path: '/centers' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden w-full">
      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Sprout className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 font-heading">
                Farm<span className="text-emerald-600">Q</span>
              </span>
              <span className="hidden sm:block text-[10px] uppercase tracking-widest text-emerald-700 font-bold -mt-1">
                Kisan Queue & Mandi AI
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    active ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-100'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${language === 'en' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-500 hover:text-slate-800'}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-2 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${language === 'hi' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-500 hover:text-slate-800'}`}
              >
                हिन्दी
              </button>
            </div>

            {/* Auth Buttons */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  to={user?.role === 'admin' || user?.role === 'superadmin' ? '/admin/dashboard' : '/farmer/dashboard'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-700 transition-all"
                >
                  <UserCheck className="w-4 h-4" />
                  {t('dashboard')}
                </Link>
                <button
                  onClick={logout}
                  className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-red-600 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  {t('logout')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-sm font-bold text-slate-700 hover:text-emerald-600 transition-colors"
                >
                  {t('login')}
                </Link>
                <Link
                  to="/farmer/book"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-700 hover:shadow-emerald-600/40 hover:-translate-y-0.5 transition-all"
                >
                  {t('bookProcurementSlot')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Right Controls (Language Switcher & Hamburger Toggle) */}
          <div className="flex md:hidden items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded transition-colors ${language === 'en' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-500'}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-2 py-1 rounded transition-colors ${language === 'hi' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-500'}`}
              >
                हिन्दी
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 hover:text-emerald-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Toggle mobile navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/98 backdrop-blur-xl shadow-xl transition-all">
            <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
              {/* Nav links */}
              <nav className="flex flex-col space-y-1">
                {navLinks.map((link) => {
                  const active = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl text-base font-bold transition-all ${
                        active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-emerald-600'
                      }`}
                    >
                      <span>{link.name}</span>
                      {active && <span className="w-2 h-2 rounded-full bg-emerald-600"></span>}
                    </Link>
                  );
                })}
              </nav>

              {/* Action section in mobile drawer */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                {isAuthenticated ? (
                  <>
                    <Link
                      to={user?.role === 'admin' || user?.role === 'superadmin' ? '/admin/dashboard' : '/farmer/dashboard'}
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full py-3 px-4 rounded-xl text-center text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{t('dashboard')}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logout();
                      }}
                      className="w-full py-2.5 px-4 rounded-xl text-center text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t('logout')}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/farmer/book"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full py-3.5 px-4 rounded-xl text-center text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all"
                    >
                      <span>{t('bookProcurementSlot')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full py-3 px-4 rounded-xl text-center text-sm font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      {t('login')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Page Content */}
      <main className="flex-1 w-full overflow-x-hidden">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 pt-16 pb-12 border-t border-slate-800 overflow-x-hidden w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Col 1: Brand */}
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold">
                🌾
              </div>
              <span className="text-xl font-bold text-white tracking-tight">Farm<span className="text-emerald-400">Q</span></span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Smart Agricultural Procurement & Queue Management System. Empowering farmers with digital slot booking, AI wait estimation, and transparency.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-800/60">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Dedicated to Zero Unnecessary Waiting for Kisans</span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 font-heading">Features</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/farmer/book" className="hover:text-emerald-400 transition-colors">Digital Slot Booking</Link></li>
              <li><Link to="/farmer/queue" className="hover:text-emerald-400 transition-colors">Live Queue Tracker</Link></li>
              <li><Link to="/farmer/centers" className="hover:text-emerald-400 transition-colors">Smart Center Recommendation</Link></li>
              <li><Link to="/farmer/procurement" className="hover:text-emerald-400 transition-colors">7-Stage Status Timeline</Link></li>
            </ul>
          </div>

          {/* Col 3: Supported Mandis */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 font-heading">Procurement Centers</h4>
            <ul className="space-y-2.5 text-sm">
              <li>Greenfield Procurement Center (Karnal)</li>
              <li>District Mandi Center (GT Road)</li>
              <li>North Block Center (Nilokheri)</li>
              <li>Toll-Free Helpline: 1800-180-1551</li>
            </ul>
          </div>

          {/* Col 4: Evaluator Quick Access */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 font-heading">Quick Evaluator Demo</h4>
            <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700 text-xs space-y-2">
              <p className="text-slate-300">Click below to test full authenticated roles:</p>
              <div className="flex flex-col gap-1.5 pt-1">
                <Link to="/login" className="w-full text-center py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors">
                  Login as Farmer (Token #25)
                </Link>
                <Link to="/login" className="w-full text-center py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">
                  Login as Mandi Admin
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-slate-800/80 text-center text-xs text-slate-500">
          © 2026 FarmQ — Smart Agricultural Procurement & Queue Management System. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
