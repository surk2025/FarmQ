import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Search,
  Filter,
  Star,
  Bell,
  Sparkles,
  MapPin,
  Calendar,
  DollarSign,
  ChevronRight,
  Info,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  ExternalLink,
  Bot,
  User,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export const CropPrices: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Data states
  const [prices, setPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteCrops, setFavoriteCrops] = useState<string[]>(['Wheat', 'Rice']);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCropFilter, setSelectedCropFilter] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');

  // Trend Chart states
  const [activeTrendCrop, setActiveTrendCrop] = useState<string>('Wheat');
  const [trendPeriod, setTrendPeriod] = useState<'7d' | '30d' | '3m'>('7d');
  const [trendData, setTrendData] = useState<any[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Price Alert Modal
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertCrop, setAlertCrop] = useState('Wheat');
  const [alertTargetPrice, setAlertTargetPrice] = useState('2500');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  // AI Assistant Query states
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiVerifiedPrices, setAiVerifiedPrices] = useState<any[]>([]);

  // Fetch Crop Prices
  const fetchPrices = async () => {
    try {
      const res = await api.get('/crop-prices');
      setPrices(res.data);
    } catch (err) {
      console.error('Error fetching crop prices:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Price Trends
  const fetchTrends = async (cropName: string, period: string) => {
    setTrendLoading(true);
    try {
      const res = await api.get(`/crop-prices/trends?crop=${encodeURIComponent(cropName)}&period=${period}`);
      setTrendData(res.data.data || []);
    } catch (err) {
      console.error('Error fetching trends:', err);
    } finally {
      setTrendLoading(false);
    }
  };

  // Fetch Alerts
  const fetchAlerts = async () => {
    try {
      const res = await api.get('/crop-prices/alerts');
      setAlertsList(res.data);
    } catch (err) {
      console.warn('Alerts fetch error:', err);
    }
  };

  useEffect(() => {
    fetchPrices();
    fetchTrends(activeTrendCrop, trendPeriod);
    fetchAlerts();
  }, []);

  useEffect(() => {
    fetchTrends(activeTrendCrop, trendPeriod);
  }, [activeTrendCrop, trendPeriod]);

  // Handle Ask FarmQ AI
  const handleAskAI = async (queryText?: string) => {
    const q = (queryText || aiQuery).trim();
    if (!q) return;

    setAiLoading(true);
    setAiResponse(null);
    setAiVerifiedPrices([]);
    try {
      const res = await api.post('/ai/farmer-query', {
        query: q,
        state: user?.state || 'Haryana',
        district: user?.district || 'Karnal'
      });
      setAiResponse(res.data.answer);
      setAiVerifiedPrices(res.data.verifiedPrices || []);
      if (!queryText) setAiQuery('');
    } catch (err: any) {
      setAiResponse(err?.response?.data?.detail || "I couldn't retrieve current market data right now. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  // Toggle Favorite Crop
  const handleToggleFavorite = async (cropName: string) => {
    const updated = favoriteCrops.includes(cropName)
      ? favoriteCrops.filter((c) => c !== cropName)
      : [...favoriteCrops, cropName];
    setFavoriteCrops(updated);
    try {
      await api.post('/farmer/favorite-crops', { crops: updated });
    } catch (err) {
      console.error('Failed to update favorite crops:', err);
    }
  };

  // Create Price Alert
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/crop-prices/alerts', {
        cropName: alertCrop,
        targetPrice: parseFloat(alertTargetPrice),
        condition: alertCondition
      });
      setAlertSuccess(`Price alert created for ${alertCrop} (${alertCondition} ₹${alertTargetPrice})`);
      fetchAlerts();
      setTimeout(() => {
        setAlertSuccess(null);
        setAlertModalOpen(false);
      }, 2500);
    } catch (err: any) {
      console.error('Alert creation error:', err);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await api.delete(`/crop-prices/alerts/${id}`);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  // Unique lists for filters
  const uniqueStates = Array.from(new Set(prices.map((p) => p.state))).filter(Boolean);
  const uniqueDistricts = Array.from(
    new Set(
      prices
        .filter((p) => selectedState === 'all' || p.state === selectedState)
        .map((p) => p.district)
    )
  ).filter(Boolean);
  const uniqueCrops = Array.from(new Set(prices.map((p) => p.cropName))).filter(Boolean);

  // Filtered Prices
  const filteredPrices = prices.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      p.cropName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.marketName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.variety.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.district.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCrop = selectedCropFilter === 'all' || p.cropName === selectedCropFilter;
    const matchesState = selectedState === 'all' || p.state === selectedState;
    const matchesDistrict = selectedDistrict === 'all' || p.district === selectedDistrict;

    return matchesSearch && matchesCrop && matchesState && matchesDistrict;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">
              Real-Time Mandi Crop Prices 📈
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Official mandi prices from Directorate of Marketing & Inspection (Agmarknet, Govt. of India).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAlertModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Bell className="w-4 h-4 text-amber-700" />
            <span>Price Alerts ({alertsList.length})</span>
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Agmarknet Live Sync</span>
          </div>
        </div>
      </div>

      {/* 2. 🤖 Ask FarmQ AI Section */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-700/40 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-heading text-white">Ask FarmQ AI (Agri Market Advisor)</h3>
              <p className="text-xs text-emerald-200">
                Grounded with live official mandi rates. Never invents or hallucinates fake prices.
              </p>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 bg-emerald-800/80 rounded-full font-semibold border border-emerald-600/40 text-emerald-300">
            Gemini 1.5 Grounded
          </span>
        </div>

        {/* Query Input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask anything: 'What is today's wheat price near me?' or 'Should I sell wheat now?'"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
            className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-emerald-200/60 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-400"
          />
          <button
            type="button"
            disabled={aiLoading || !aiQuery.trim()}
            onClick={() => handleAskAI()}
            className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Ask AI</span>
          </button>
        </div>

        {/* Quick Sample Queries */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-[11px] text-emerald-300 font-semibold py-1">Quick prompts:</span>
          {[
            "What is today's wheat price near me?",
            "Which nearby mandi has better prices?",
            "Should I sell wheat now?",
            "What is the price trend of rice?"
          ].map((promptText) => (
            <button
              key={promptText}
              type="button"
              onClick={() => handleAskAI(promptText)}
              className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-emerald-100 border border-white/10 transition-colors cursor-pointer"
            >
              "{promptText}"
            </button>
          ))}
        </div>

        {/* AI Answer Box */}
        {aiResponse && (
          <div className="mt-4 p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/40 text-slate-100 text-sm space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>FarmQ AI Advisory Response:</span>
            </div>
            <div className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-slate-200">
              {aiResponse}
            </div>
          </div>
        )}
      </div>

      {/* 3. Favorite Crops Selector (Section 9) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>⭐ My Favorite Crops (Dashboard Prioritization)</span>
          </div>
          <span className="text-xs text-slate-400">Click star to toggle preference</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {['Wheat', 'Rice', 'Mustard', 'Maize', 'Sugarcane', 'Potato', 'Tomato', 'Cotton'].map((cropName) => {
            const isFav = favoriteCrops.includes(cropName);
            return (
              <button
                key={cropName}
                type="button"
                onClick={() => handleToggleFavorite(cropName)}
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isFav
                    ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${isFav ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                <span>{cropName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Price Trend Interactive Chart (Section 8) */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="text-xl font-black text-slate-900 font-heading">
                {activeTrendCrop} Price Trend Analysis
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Historical mandi rates anchored to latest Agmarknet modal prices (₹ / Quintal)
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Crop Selector */}
            <select
              value={activeTrendCrop}
              onChange={(e) => setActiveTrendCrop(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white"
            >
              {['Wheat', 'Rice', 'Mustard', 'Maize', 'Potato', 'Tomato', 'Sugarcane', 'Cotton'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Period Toggles */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {(['7d', '30d', '3m'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTrendPeriod(p)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    trendPeriod === p
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '3 Months'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64 sm:h-72 w-full">
          {trendLoading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              <span>Loading price trend chart...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <YAxis
                  domain={['dataMin - 100', 'dataMax + 100']}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-xl space-y-1">
                          <div className="font-bold text-emerald-400">{data.date}</div>
                          <div>
                            Modal Price:{' '}
                            <span className="font-mono font-black text-white text-sm">
                              ₹{data.modalPrice} / Qtl
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300">
                            Min: ₹{data.minPrice} | Max: ₹{data.maxPrice}
                          </div>
                          <div className="text-[10px] text-emerald-300 font-semibold pt-1 border-t border-slate-700">
                            {data.isLatest ? '🟢 Latest Available Market Data' : '⚪ Historical Trend Data'}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="modalPrice"
                  stroke="#059669"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#priceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <span>Modal Benchmark Price</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-200"></span>
              <span>Verified Mandi Interval</span>
            </span>
          </div>
          <span className="text-[11px]">Source: Agmarknet & State Agricultural Boards</span>
        </div>
      </div>

      {/* 5. Search & Filters Bar (Section 7) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search crop or mandi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Crop Filter */}
          <div>
            <select
              value={selectedCropFilter}
              onChange={(e) => setSelectedCropFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white"
            >
              <option value="all">All Crops</option>
              {uniqueCrops.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* State Filter */}
          <div>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict('all');
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white"
            >
              <option value="all">All States</option>
              {uniqueStates.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* District Filter */}
          <div>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white"
            >
              <option value="all">All Districts</option>
              {uniqueDistricts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            Showing <strong className="text-slate-800">{filteredPrices.length}</strong> matching latest available market prices
          </span>
          {(searchTerm || selectedCropFilter !== 'all' || selectedState !== 'all' || selectedDistrict !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCropFilter('all');
                setSelectedState('all');
                setSelectedDistrict('all');
              }}
              className="text-emerald-600 hover:text-emerald-800 font-bold hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 6. Real-Time Mandi Crop Prices Cards Grid (Section 5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPrices.map((item) => {
          const isFav = favoriteCrops.includes(item.cropName);
          return (
            <div
              key={item.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Card Top */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {item.state} • {item.district}
                    </span>
                    <h3 className="text-xl font-black text-slate-900 font-heading mt-0.5 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                      <span>{item.cropName}</span>
                      {item.cropHindi && <span className="text-sm font-normal text-slate-500">({item.cropHindi})</span>}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(item.cropName)}
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Toggle Favorite"
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                  </button>
                </div>

                {/* Mandi & Variety */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-4 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{item.marketName}</span>
                  </div>
                  <div className="text-slate-500 text-[11px] pl-5">
                    Variety: <span className="font-semibold text-slate-700">{item.variety}</span>
                  </div>
                </div>

                {/* Price Matrix */}
                <div className="grid grid-cols-3 gap-2 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100 mb-4 text-center">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Min Price</div>
                    <div className="text-xs font-extrabold text-slate-700 mt-0.5">₹{item.minPrice?.toLocaleString()}</div>
                  </div>
                  <div className="border-x border-emerald-200/60">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase">Modal Price</div>
                    <div className="text-base font-black text-emerald-950 mt-0.5">₹{item.modalPrice?.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Max Price</div>
                    <div className="text-xs font-extrabold text-slate-700 mt-0.5">₹{item.maxPrice?.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Unit: ₹ / Quintal</span>
                  <span className="font-semibold text-emerald-700">Updated: {item.lastUpdated}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTrendCrop(item.cropName);
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>View Trend</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAlertCrop(item.cropName);
                      setAlertTargetPrice(String(item.modalPrice + 100));
                      setAlertModalOpen(true);
                    }}
                    className="py-2 px-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                    title="Set Price Alert"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-600" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Price Alert Modal */}
      {alertModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold font-heading text-lg">
                <Bell className="w-5 h-5 text-amber-600" />
                <span>Create Mandi Price Alert</span>
              </div>
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {alertSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{alertSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateAlert} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Crop Commodity</label>
                <select
                  value={alertCrop}
                  onChange={(e) => setAlertCrop(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold"
                >
                  {['Wheat', 'Rice', 'Mustard', 'Maize', 'Sugarcane', 'Potato', 'Tomato', 'Cotton'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Notify When</label>
                  <select
                    value={alertCondition}
                    onChange={(e: any) => setAlertCondition(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value="above">Price Goes Above</option>
                    <option value="below">Price Drops Below</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Target Price (₹ / Qtl)</label>
                  <input
                    type="number"
                    required
                    value={alertTargetPrice}
                    onChange={(e) => setAlertTargetPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Create Alert
              </button>
            </form>

            {/* Active Alerts List */}
            {alertsList.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Your Active Alerts</div>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {alertsList.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs border border-slate-200/80"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{a.cropName}</span>{' '}
                        <span className="text-slate-500">
                          {a.condition === 'above' ? '≥' : '≤'} ₹{a.targetPrice} / Qtl
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAlert(a.id)}
                        className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
