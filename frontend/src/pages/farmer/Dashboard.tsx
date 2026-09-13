import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wheat,
  DollarSign,
  MapPin,
  Bot,
  CreditCard,
  Building,
  Package,
  TrendingUp,
  Hourglass,
  Users,
  Clock,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Radio,
  CalendarCheck,
  Compass
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useQueueSocket } from '../../context/QueueSocketContext';
import api from '../../services/api';

export const FarmerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { latestEvent, isConnected } = useQueueSocket();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/farmer/dashboard');
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (latestEvent) {
      fetchDashboardData();
    }
  }, [latestEvent]);

  if (loading) {
    return <div className="py-20 text-center text-slate-400">Loading farmer dashboard...</div>;
  }

  const tokenNum = data?.currentToken;
  const bank = data?.bankDetails || {};
  const todayPrices = data?.todayCropPrices || [];
  const nearbyMarkets = data?.nearbyMarkets || [];

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Welcome Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">
              {t('goodMorning')}, {user?.name || data?.farmerName || 'Farmer'} <span className="animate-wave">👋</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Welcome to your FarmQ agricultural platform. Live queue, market prices, and DBT payments are active.
          </p>
        </div>

        {/* Live WebSocket Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shrink-0 self-start sm:self-auto">
          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'}`}></span>
          <span>{isConnected ? t('liveStatusConnected') : 'Synchronizing Mandi...'}</span>
        </div>
      </div>

      {/* 2. Active Queue Status Bar (if farmer has token) */}
      {tokenNum && (
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <Sparkles className="w-4 h-4" />
              <span>Active Token #{tokenNum} • {data?.cropName} ({data?.quantity} Qtl)</span>
            </div>
            <h3 className="text-xl font-bold font-heading">
              {data?.advice || "Arrive ~20 mins prior to your turn to minimize waiting."}
            </h3>
            <p className="text-xs text-emerald-200">
              {data?.centerName} • {data?.farmersAhead} farmers ahead • Estimated wait: <strong>{data?.formattedWaitTime}</strong>
            </p>
          </div>

          <Link
            to="/farmer/queue"
            className="px-6 py-3 rounded-2xl bg-white text-emerald-950 hover:bg-emerald-50 font-bold text-sm shadow-md transition-all whitespace-nowrap flex items-center gap-2 self-stretch sm:self-auto justify-center"
          >
            <span>{t('viewLiveQueue')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2.5 NEW FEATURE: PREDICTION CENTER CALLOUT                        */}
      {/* ================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white p-6 sm:p-7 shadow-lg border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 group">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
            <span>New Feature • Google Maps & NHAI Matrix</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black font-heading text-white">
            📍 FarmQ Prediction Center
          </h3>
          <p className="text-emerald-100/90 text-xs sm:text-sm leading-relaxed">
            Know your exact road distance, travel time, vehicle transportation cost, and estimated net return before loading your harvest.
          </p>
        </div>

        <Link
          to="/farmer/prediction-center"
          className="shrink-0 px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
        >
          <span>Open Prediction Center</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ================================================================= */}
      {/* 3. MAIN SECTION: 8 DASHBOARD CARDS (REQUIREMENT 4)                 */}
      {/* ================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
            <span>Farmer Services & Market Operations</span>
          </h2>
          <span className="text-xs text-slate-400">8 Core Farmer Modules</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: 🌾 My Crops */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Wheat className="w-4 h-4 text-emerald-600" />
                  <span>My Crops</span>
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                  🌾
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 font-heading">
                {data?.cropsCount ?? 0} <span className="text-sm font-normal text-slate-500">Crops</span>
              </div>
              <div className="text-xs text-slate-500 mt-2 space-y-1">
                {data?.recentCrops?.slice(0, 2).map((c: any) => (
                  <div key={c.id} className="truncate">
                    • {c.name} ({c.quantity} {c.unit})
                  </div>
                )) || <div>No harvests registered yet</div>}
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
              <Link to="/farmer/crops" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <span>Register / View Crops</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: 💰 Today's Crop Prices */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  <span>Today's Crop Prices</span>
                </span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
                  💰
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-heading">
                ₹{todayPrices[0]?.modalPrice ? `${todayPrices[0].modalPrice.toLocaleString()}` : '2,350'}{' '}
                <span className="text-xs font-normal text-slate-500">/ Qtl ({todayPrices[0]?.cropName || 'Wheat'})</span>
              </div>
              <div className="text-xs text-slate-500 mt-2 space-y-1">
                {todayPrices.slice(1, 3).map((p: any) => (
                  <div key={p.id} className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">{p.cropName}:</span>
                    <span className="font-bold text-emerald-700">₹{p.modalPrice}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
              <Link to="/farmer/crop-prices" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <span>View All Mandi Rates</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: 📍 Nearby Markets */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>Nearby Markets</span>
                </span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                  📍
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 font-heading truncate">
                {nearbyMarkets[0]?.name || 'Karnal Grain Mandi'}
              </div>
              <div className="text-xs text-slate-500 mt-2 flex items-center justify-between">
                <span>Distance: <strong>{nearbyMarkets[0]?.distanceKm || 4.2} km</strong></span>
                <span className="text-emerald-700 font-semibold">{nearbyMarkets[0]?.formattedTravelTime || '~15 mins'}</span>
              </div>
              {nearbyMarkets[0]?.directionsUrl && (
                <a
                  href={nearbyMarkets[0].directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                >
                  <span>Google Maps Directions</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
              <Link to="/farmer/centers" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <span>Compare Mandis</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 4: 🤖 AI Distance Prediction */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Bot className="w-4 h-4 text-purple-600" />
                  <span>AI Distance & Queue</span>
                </span>
                <span className="p-2 rounded-xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
                  🤖
                </span>
              </div>
              <div className="text-3xl font-black text-emerald-700 font-heading">
                {tokenNum ? data?.formattedWaitTime : '~18m'}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {tokenNum
                  ? `${data?.farmersAhead} farmers ahead in queue`
                  : 'AI predicts ~15-20 min arrival window based on intake bay velocity.'}
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
              <Link to="/farmer/queue" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <span>Live Token Velocity</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 5: 💳 Payments (Payment Receive Service) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>Payments Receive</span>
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                  💳
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 font-heading">
                ₹{data?.paymentsSummary?.totalReceived ? Number(data.paymentsSummary.totalReceived).toLocaleString() : '0'}
              </div>
              <div className="text-xs text-slate-500 mt-2 flex justify-between">
                <span>Ready to Claim:</span>
                <span className="font-bold text-emerald-700">
                  ₹{data?.paymentsSummary?.readyToReceive ? Number(data.paymentsSummary.readyToReceive).toLocaleString() : '0'}
                </span>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
              <Link to="/farmer/payments" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <span>Claim Payout / QR</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 6: 🏦 Bank Details */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Building className="w-4 h-4 text-teal-600" />
                  <span>Bank Details</span>
                </span>
                <span className="p-2 rounded-xl bg-teal-50 text-teal-600 group-hover:scale-110 transition-transform">
                  🏦
                </span>
              </div>
              <div className="text-lg font-black text-slate-900 font-heading truncate">
                {bank?.bankName || 'State Bank of India'}
              </div>
              <div className="text-xs font-mono font-bold text-emerald-800 mt-1">
                {bank?.accountNumberMasked || 'XXXX XXXX 9012'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                IFSC: <span className="font-semibold">{bank?.ifscCode || 'SBIN0001234'}</span>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
              <Link to="/farmer/profile" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <span>View & Edit Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 7: 📦 Sell Crop (Slot Booking) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Package className="w-4 h-4 text-orange-600" />
                  <span>Sell Crop</span>
                </span>
                <span className="p-2 rounded-xl bg-orange-50 text-orange-600 group-hover:scale-110 transition-transform">
                  📦
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 font-heading">
                Book Intake Slot
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Reserve your 1-hour appointment window to avoid waiting in long queues at the mandi.
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
              <Link to="/farmer/book" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <span>Book Slot Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 8: 📊 Market Trends */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Market Trends</span>
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                  📊
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 font-heading">
                7D / 30D Analysis
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Track historical commodity trajectories, seasonal price peaks, and AI selling signals.
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
              <Link to="/farmer/crop-prices" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <span>Open Price Trends</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Quick Actions Grid */}
      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/80">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Quick Navigation</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/farmer/crops"
            className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 text-xs font-bold text-slate-800 flex items-center gap-2.5 transition-all shadow-xs"
          >
            <span>🌾</span>
            <span>Register Harvest</span>
          </Link>
          <Link
            to="/farmer/crop-prices"
            className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 text-xs font-bold text-slate-800 flex items-center gap-2.5 transition-all shadow-xs"
          >
            <span>📈</span>
            <span>Mandi Prices & Trends</span>
          </Link>
          <Link
            to="/farmer/payments"
            className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 text-xs font-bold text-slate-800 flex items-center gap-2.5 transition-all shadow-xs"
          >
            <span>💳</span>
            <span>Payment Receive QR</span>
          </Link>
          <Link
            to="/farmer/profile"
            className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 text-xs font-bold text-slate-800 flex items-center gap-2.5 transition-all shadow-xs"
          >
            <span>🏦</span>
            <span>Bank Account Details</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
