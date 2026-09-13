import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Sprout, Globe, UserCheck, ArrowRight, ShieldCheck, PhoneCall } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export const PublicLayout: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { name: t('home'), path: '/' },
    { name: t('howItWorks'), path: '/how-it-works' },
    { name: t('features'), path: '/features' },
    { name: t('centers'), path: '/centers' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Banner with Demo credentials hint */}
      <div className="bg-emerald-900 text-emerald-100 text-xs py-1.5 px-4 text-center flex items-center justify-center gap-4 flex-wrap">
        <span className="flex items-center gap-1 font-medium">
          🌾 <strong>FarmQ Live Demo:</strong> Farmer Phone: <code className="bg-emerald-800 px-1.5 py-0.5 rounded text-white">demo-farmer</code> (pass: demo123) | Admin: <code className="bg-emerald-800 px-1.5 py-0.5 rounded text-white">admin@farmq.demo</code> (pass: admin123)
        </span>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-slate-900 font-heading">Farm<span className="text-emerald-600">Q</span></span>
              <span className="block text-[10px] uppercase tracking-widest text-emerald-700 font-bold -mt-1">Kisan Queue & Mandi AI</span>
            </div>
          </Link>

          {/* Navigation Links */}
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

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 text-xs font-bold rounded ${language === 'en' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-500 hover:text-slate-800'}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-2 py-1 text-xs font-bold rounded ${language === 'hi' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-500 hover:text-slate-800'}`}
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
                  className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-red-600 rounded-lg hover:bg-slate-100"
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
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 pt-16 pb-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Col 1: Brand */}
          <div className="space-y-4">
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
                <Link to="/login" className="w-full text-center py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium transition-colors">
                  Login as Farmer (Token #25)
                </Link>
                <Link to="/login" className="w-full text-center py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors">
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
