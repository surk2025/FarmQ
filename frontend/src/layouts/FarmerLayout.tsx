import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Wheat,
  MapPin,
  CalendarCheck,
  Hourglass,
  Clock,
  ClipboardList,
  CreditCard,
  Bell,
  User,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Sprout,
  Radio,
  ChevronRight,
  TrendingUp,
  Compass
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useQueueSocket } from '../context/QueueSocketContext';
import api from '../services/api';

export const FarmerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { subscribeToCenter, latestEvent, isConnected } = useQueueSocket();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTokenData, setActiveTokenData] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState<number>(2);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch farmer's active token & center
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/farmer/dashboard');
        setActiveTokenData(res.data);
        if (res.data.centerId) {
          subscribeToCenter(res.data.centerId);
        }
      } catch (err) {
        console.warn('Dashboard fetch error:', err);
      }
    };
    fetchDashboard();
  }, []);

  // Listen for WebSocket live queue events
  useEffect(() => {
    if (latestEvent) {
      if (latestEvent.type === 'QUEUE_UPDATE') {
        setToastMessage(`📢 Queue Update: Token #${latestEvent.completedToken || ''} completed. Now processing: Token #${latestEvent.nowProcessing || ''}!`);
        // Refresh dashboard data
        api.get('/farmer/dashboard').then(res => setActiveTokenData(res.data)).catch(() => {});
        setTimeout(() => setToastMessage(null), 6000);
      }
    }
  }, [latestEvent]);

  const navItems = [
    { name: t('dashboard'), path: '/farmer/dashboard', icon: LayoutDashboard },
    { name: t('myCrops'), path: '/farmer/crops', icon: Wheat },
    { name: 'Crop Prices 📈', path: '/farmer/crop-prices', icon: TrendingUp },
    { name: '📍 Prediction Center', path: '/farmer/prediction-center', icon: Compass },
    { name: t('findCenter'), path: '/farmer/centers', icon: MapPin },
    { name: t('bookSlot'), path: '/farmer/book', icon: CalendarCheck },
    { name: t('myQueue'), path: '/farmer/queue', icon: Hourglass, badge: activeTokenData?.currentToken ? `#${activeTokenData.currentToken}` : undefined },
    { name: t('procurementStatus'), path: '/farmer/procurement', icon: ClipboardList },
    { name: t('payments'), path: '/farmer/payments', icon: CreditCard },
    { name: t('notifications'), path: '/farmer/notifications', icon: Bell, badgeCount: unreadCount },
    { name: t('profile'), path: '/farmer/profile', icon: User },
    { name: t('help'), path: '/farmer/help', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Toast Banner for Live WebSocket Events */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl border border-emerald-500/30 flex items-center gap-3 animate-soft-pulse">
          <Radio className="w-5 h-5 text-emerald-300 animate-ping" />
          <span className="text-sm font-semibold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-200 hover:text-white text-xs underline ml-2">Dismiss</button>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-68 bg-white border-r border-slate-200 shrink-0">
        {/* Brand */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <Link to="/" className="text-xl font-black text-slate-900 font-heading tracking-tight">Farm<span className="text-emerald-600">Q</span></Link>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isConnected ? 'Live Connected' : 'Connecting...'}</span>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-3 bg-emerald-50/80 rounded-xl border border-emerald-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
            {user?.name ? user.name[0].toUpperCase() : 'K'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{user?.name || 'Surjeet Kumar'}</p>
            <p className="text-xs text-emerald-700 font-medium truncate">{user?.village || 'Taraori'}, {user?.district || 'Karnal'}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                    active ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {item.badgeCount && item.badgeCount > 0 && !item.badge && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500 text-white">
                    {item.badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          {/* Language Switcher */}
          <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-xl text-xs font-semibold">
            <span className="text-slate-500 pl-2">{t('language')}:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-lg ${language === 'en' ? 'bg-white shadow-xs text-emerald-700 font-bold' : 'text-slate-600'}`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-2 py-1 rounded-lg ${language === 'hi' ? 'bg-white shadow-xs text-emerald-700 font-bold' : 'text-slate-600'}`}
              >
                हिन्दी
              </button>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
            <Sprout className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg text-slate-900">Farm<span className="text-emerald-600">Q</span></span>
        </Link>

        {/* Active token quick indicator */}
        {activeTokenData?.currentToken && (
          <Link to="/farmer/queue" className="flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold animate-pulse">
            <span>Token #{activeTokenData.currentToken}</span>
          </Link>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            className="px-2 py-1 text-xs font-bold bg-slate-100 rounded-lg text-slate-700 border border-slate-200"
          >
            {language === 'en' ? 'हिन्दी' : 'EN'}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 rounded-lg hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs flex">
          <div className="w-72 bg-white h-full flex flex-col p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <span className="font-bold text-slate-900">FarmQ Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-slate-400" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">{item.badge}</span>}
                </Link>
              ))}
            </nav>
            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={() => { setMobileMenuOpen(false); logout(); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-rose-600 bg-rose-50 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('logout')}</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)}></div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-6xl mx-auto w-full pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar for Farmers */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-2 flex justify-around items-center">
        <Link to="/farmer/dashboard" className={`flex flex-col items-center py-1 px-2 text-xs font-semibold ${location.pathname === '/farmer/dashboard' ? 'text-emerald-600' : 'text-slate-500'}`}>
          <LayoutDashboard className="w-5 h-5" />
          <span>Home</span>
        </Link>
        <Link to="/farmer/crops" className={`flex flex-col items-center py-1 px-2 text-xs font-semibold ${location.pathname === '/farmer/crops' ? 'text-emerald-600' : 'text-slate-500'}`}>
          <Wheat className="w-5 h-5" />
          <span>Crops</span>
        </Link>
        <Link to="/farmer/book" className={`flex flex-col items-center py-1 px-2 text-xs font-semibold ${location.pathname === '/farmer/book' ? 'text-emerald-600' : 'text-slate-500'}`}>
          <CalendarCheck className="w-5 h-5" />
          <span>Book</span>
        </Link>
        <Link to="/farmer/queue" className={`flex flex-col items-center py-1 px-2 text-xs font-semibold relative ${location.pathname === '/farmer/queue' ? 'text-emerald-600' : 'text-slate-500'}`}>
          <Hourglass className="w-5 h-5" />
          <span>Queue</span>
          {activeTokenData?.currentToken && (
            <span className="absolute top-0 right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          )}
        </Link>
        <Link to="/farmer/procurement" className={`flex flex-col items-center py-1 px-2 text-xs font-semibold ${location.pathname === '/farmer/procurement' ? 'text-emerald-600' : 'text-slate-500'}`}>
          <ClipboardList className="w-5 h-5" />
          <span>Status</span>
        </Link>
      </nav>
    </div>
  );
};
