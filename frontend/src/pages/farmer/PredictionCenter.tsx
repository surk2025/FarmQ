import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Truck,
  TrendingUp,
  Clock,
  Compass,
  DollarSign,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  Building2,
  Info,
  Layers,
  Send,
  Target
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// Agricultural staples with default benchmark modal prices
const COMMON_CROPS = [
  { name: 'Wheat', hindi: 'गेहूं', defaultPrice: 2350, icon: '🌾' },
  { name: 'Rice', hindi: 'धान / चावल', defaultPrice: 2200, icon: '🍚' },
  { name: 'Mustard', hindi: 'सरसों', defaultPrice: 5400, icon: '🌼' },
  { name: 'Maize', hindi: 'मक्का', defaultPrice: 2090, icon: '🌽' },
  { name: 'Cotton', hindi: 'कपास', defaultPrice: 7100, icon: '☁️' },
  { name: 'Potato', hindi: 'आलू', defaultPrice: 1450, icon: '🥔' },
  { name: 'Sugarcane', hindi: 'गन्ना', defaultPrice: 380, icon: '🎋' }
];

// Realistic agricultural vehicle rates
const VEHICLES = [
  { id: 'tractor_trolley', name: 'Tractor Trolley', capacity: 50, base: 400, perKm: 18, emoji: '🚜', desc: 'Standard farm trailer (up to 50 Qtl)' },
  { id: 'pickup_bolero', name: 'Bolero Pickup', capacity: 30, base: 500, perKm: 22, emoji: '🛻', desc: 'Fast rural pickup (up to 30 Qtl)' },
  { id: 'small_truck', name: 'Small Truck (Tata Ace)', capacity: 25, base: 450, perKm: 20, emoji: '🚚', desc: 'Mini commercial hauler (up to 25 Qtl)' },
  { id: 'medium_truck', name: 'Medium Truck (Eicher 6-W)', capacity: 90, base: 900, perKm: 32, emoji: '🚛', desc: 'Commercial heavy transport (up to 90 Qtl)' },
  { id: 'heavy_truck', name: 'Heavy Truck (10-Wheeler)', capacity: 200, base: 1600, perKm: 48, emoji: '🚛', desc: 'Long-haul bulk carrier (up to 200 Qtl)' },
];

const PRESET_MANDIS = [
  { name: 'Karnal Grain Mandi', district: 'Karnal', state: 'Haryana', tag: 'Major Hub' },
  { name: 'Taraori Basmati Mandi', district: 'Karnal', state: 'Haryana', tag: 'Basmati Special' },
  { name: 'Panipat Grain Market', district: 'Panipat', state: 'Haryana', tag: 'APMC' },
  { name: 'Kurukshetra Mandi', district: 'Kurukshetra', state: 'Haryana', tag: 'APMC' },
  { name: 'Ambala City Mandi', district: 'Ambala', state: 'Haryana', tag: 'Regional Yard' },
  { name: 'Azadpur APMC Mandi', district: 'North Delhi', state: 'Delhi', tag: "Asia's Largest" },
  { name: 'Khanna Grain Market', district: 'Ludhiana', state: 'Punjab', tag: 'Mega Grain Yard' },
  { name: 'Meerut Mandi', district: 'Meerut', state: 'Uttar Pradesh', tag: 'West UP Center' }
];

export const PredictionCenter: React.FC = () => {
  const { user } = useAuth();

  // Location configuration state
  const [sourceMode, setSourceMode] = useState<'saved' | 'gps' | 'manual'>('saved');
  const [sourceAddress, setSourceAddress] = useState<string>('Kisanpur, Karnal, Haryana');
  const [sourceCoords, setSourceCoords] = useState<{ lat: number; lng: number } | null>({ lat: 29.6520, lng: 77.0210 });
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);

  const [destinationMandi, setDestinationMandi] = useState<string>('Karnal Grain Mandi');
  const [customDestination, setCustomDestination] = useState<string>('');
  const [isCustomDest, setIsCustomDest] = useState<boolean>(false);

  // Commodity & Transport params
  const [cropName, setCropName] = useState<string>('Wheat');
  const [quantity, setQuantity] = useState<number>(50);
  const [vehicleType, setVehicleType] = useState<string>('tractor_trolley');

  // Execution & Results state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<any | null>(null);
  const [recommendations, setRecommendations] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // AI Decision state
  const [aiQuery, setAiQuery] = useState<string>('');
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Sync saved farmer location from user profile on mount
  useEffect(() => {
    if (user) {
      const parts = [user.village, user.district, user.state].filter(Boolean);
      if (parts.length > 0) {
        setSourceAddress(parts.join(', '));
      }
    }
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/prediction/history');
      if (Array.isArray(res.data)) {
        setHistory(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch prediction history:', err);
    }
  };

  // Browser Geolocation trigger
  const handleGetGps = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setSourceCoords(coords);
        setSourceAddress(`GPS: ${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E (Farm Location)`);
        setSourceMode('gps');
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setError('Location permission denied or unavailable. You can enter village/city manually.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Run distance & economic predictions
  const runPrediction = async () => {
    setLoading(true);
    setError(null);
    setPrediction(null);
    setRecommendations(null);

    const destName = isCustomDest && customDestination.trim() ? customDestination.trim() : destinationMandi;

    const payload = {
      source: {
        address: sourceAddress,
        lat: sourceCoords?.lat,
        lng: sourceCoords?.lng,
        village: user?.village || 'Kisanpur',
        district: user?.district || 'Karnal',
        state: user?.state || 'Haryana'
      },
      destination: {
        mandiName: destName,
        address: destName
      },
      cropName,
      quantity: Number(quantity),
      vehicleType
    };

    try {
      // 1. Primary route distance prediction
      const distRes = await api.post('/prediction/distance', payload);
      setPrediction(distRes.data);

      // 2. Fetch multi-mandi recommendation comparison
      const recRes = await api.post('/prediction/mandi-recommendation', payload);
      setRecommendations(recRes.data);

      // 3. Default AI explanation
      if (recRes.data?.allMandis?.length > 0) {
        explainWithAi(recRes.data.allMandis, "Why is the recommended mandi the most profitable choice?");
      }

      // Refresh history
      fetchHistory();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to calculate route and predictions. Please verify inputs.');
    } finally {
      setLoading(false);
    }
  };

  // AI Decision Explainer
  const explainWithAi = async (mandisData: any[], customPrompt?: string) => {
    const q = customPrompt || aiQuery || 'Explain the economic breakdown for this crop shipment.';
    setAiLoading(true);
    try {
      const res = await api.post('/prediction/ai-explain', {
        query: q,
        cropName,
        quantity: Number(quantity),
        mandisData: mandisData || recommendations?.allMandis || []
      });
      setAiExplanation(res.data.explanation);
    } catch (err) {
      console.warn('AI Explain error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const deleteHistory = async (id: string) => {
    try {
      await api.delete(`/prediction/history/${id}`);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const selectedVehicleObj = VEHICLES.find((v) => v.id === vehicleType) || VEHICLES[0];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-8 sm:p-10 shadow-xl border border-emerald-500/20">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
            <span>Google Maps Platform & NHAI Agri-Corridor Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-heading tracking-tight text-white mb-3">
            📍 FarmQ Prediction Center
          </h1>
          <p className="text-emerald-100/90 text-base sm:text-lg leading-relaxed font-normal">
            Know the distance, travel time and estimated transportation cost before sending your crop.
            Maximize your net cash in hand with real road routing and live Agmarknet prices.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* Configuration Inputs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Col 1 & 2: Location and Parameters */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900 font-heading flex items-center gap-2 border-b border-slate-100 pb-3">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <span>1. Location Configuration</span>
            </h2>

            {/* Source Location */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📍 Source Location (Your Farm / Village)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSourceMode('saved');
                      if (user) {
                        const parts = [user.village, user.district, user.state].filter(Boolean);
                        setSourceAddress(parts.join(', ') || 'Kisanpur, Karnal, Haryana');
                      }
                    }}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                      sourceMode === 'saved' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Saved Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleGetGps}
                    disabled={gpsLoading}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium flex items-center gap-1 transition-all ${
                      sourceMode === 'gps' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {gpsLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                    <span>Use GPS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceMode('manual')}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                      sourceMode === 'manual' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Enter Manually
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={sourceAddress}
                  onChange={(e) => {
                    setSourceAddress(e.target.value);
                    setSourceMode('manual');
                  }}
                  placeholder="e.g., Kisanpur, Karnal, Haryana"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition-all pl-10"
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Destination Mandi */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  🎯 Destination Mandi / Procurement Center
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomDest(!isCustomDest)}
                  className="text-xs text-emerald-700 font-semibold hover:underline"
                >
                  {isCustomDest ? '← Choose from Preset Mandis' : '+ Enter Custom Address'}
                </button>
              </div>

              {isCustomDest ? (
                <div className="relative">
                  <input
                    type="text"
                    value={customDestination}
                    onChange={(e) => setCustomDestination(e.target.value)}
                    placeholder="Enter mandi yard, city, or collection center address..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition-all pl-10"
                  />
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PRESET_MANDIS.map((m) => {
                    const isSelected = destinationMandi === m.name;
                    return (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() => setDestinationMandi(m.name)}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold'
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{m.name}</div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {m.district}, {m.state}
                        </div>
                        <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-white/80 border border-slate-200/60 text-slate-600 font-semibold">
                          {m.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Commodity & Quantity */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  🌾 Select Crop
                </label>
                <select
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none transition-all"
                >
                  {COMMON_CROPS.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.icon} {c.name} ({c.hindi}) — Modal ~₹{c.defaultPrice}/Qtl
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    ⚖️ Harvest Quantity
                  </label>
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    {quantity} Quintals
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-28 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 flex-1">
                    {[25, 50, 100, 200].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQuantity(preset)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                          quantity === preset
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {preset} Q
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Selection Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 font-heading flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                <span>2. Transport Vehicle & Rate Matrix</span>
              </span>
              <span className="text-xs font-normal text-slate-500">Configured Agri-Rates</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {VEHICLES.map((v) => {
                const isSelected = vehicleType === v.id;
                const trips = Math.ceil(quantity / v.capacity);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVehicleType(v.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{v.emoji}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                        )}
                      </div>
                      <div className="font-bold text-sm text-slate-900 mt-2">{v.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{v.desc}</div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Capacity:</span>
                        <span className="font-bold text-slate-900">{v.capacity} Qtl</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Rate / Km:</span>
                        <span className="font-bold text-slate-900">₹{v.perKm}/km</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-semibold">
                        <span>Trips Required:</span>
                        <span>{trips} {trips > 1 ? 'Trips' : 'Trip'}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Col 3: Action & Quick Info Card */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg space-y-5">
            <h3 className="text-xl font-black font-heading flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>Instant Road Prediction</span>
            </h3>
            <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed">
              Calculates genuine road distance via Google Maps and NHAI highway data, combines real Agmarknet crop pricing, and evaluates your total net return.
            </p>

            <div className="space-y-3 bg-white/10 rounded-2xl p-4 backdrop-blur-md text-xs">
              <div className="flex justify-between">
                <span className="text-emerald-200">Selected Vehicle:</span>
                <span className="font-bold text-white">{selectedVehicleObj.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-200">Base Hookup:</span>
                <span className="font-bold text-white">₹{selectedVehicleObj.base}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-200">Per Km Rate:</span>
                <span className="font-bold text-white">₹{selectedVehicleObj.perKm} / km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-200">Estimated Trips:</span>
                <span className="font-bold text-amber-300">
                  {Math.ceil(quantity / selectedVehicleObj.capacity)} Trips
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={runPrediction}
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base shadow-lg shadow-amber-400/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Computing Routing Matrix...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" />
                  <span>Calculate Distance & Predictions</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Tips */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 text-xs space-y-3 text-slate-600">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-emerald-600" />
              <span>Smart Transport Tip</span>
            </div>
            <p className="leading-relaxed">
              If another mandi is paying <strong>₹50/Qtl more</strong>, a 50 Qtl shipment earns <strong>+₹2,500 gross</strong>.
              If it is 30 km farther, a Tractor Trolley costs only <strong>~₹540 extra</strong>, giving you a net gain of <strong>+₹1,960</strong>!
            </p>
          </div>
        </div>
      </div>

      {/* Prediction Output Section */}
      {prediction && (
        <div className="space-y-8 animate-fadeIn">
          {/* Section Heading */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 font-heading">
                📊 Prediction & Transportation Economics
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Route: <span className="font-semibold text-slate-700">{prediction.sourceFormatted}</span> → <span className="font-semibold text-slate-700">{prediction.destinationFormatted}</span>
              </p>
            </div>
            {prediction.googleMapsDirectionsUrl && (
              <a
                href={prediction.googleMapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 shadow-xs transition-all"
              >
                <span>Open in Google Maps Navigation</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* 4 Large Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Distance */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between group hover:border-emerald-400 transition-all">
              <div>
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
                  <span>Road Distance</span>
                  <span className="p-2 rounded-xl bg-blue-50 text-blue-600">📍</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-slate-900 font-heading">
                  {prediction.distanceFormatted}
                </div>
                <div className="text-xs text-slate-500 mt-2 font-medium">
                  {prediction.recommendedRoute}
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] text-blue-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                <span>Verified Road Curvature</span>
              </div>
            </div>

            {/* Card 2: Travel Time */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between group hover:border-emerald-400 transition-all">
              <div>
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
                  <span>Est. Travel Time</span>
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-600">⏱️</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-slate-900 font-heading">
                  {prediction.travelTimeFormatted}
                </div>
                <div className="text-xs text-slate-500 mt-2 font-medium">
                  {prediction.routeStatus}
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Transit Duration</span>
              </div>
            </div>

            {/* Card 3: Transport Cost */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between group hover:border-emerald-400 transition-all">
              <div>
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
                  <span>Estimated Transport Cost</span>
                  <span className="p-2 rounded-xl bg-purple-50 text-purple-600">🚚</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-purple-950 font-heading">
                  ₹{prediction.estimatedTransportCost?.toLocaleString() ?? '0'}
                </div>
                <div className="text-xs text-slate-500 mt-2 font-medium">
                  ₹{(prediction.estimatedTransportCost / quantity).toFixed(1)} / Quintal
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] text-purple-700 font-semibold flex items-center justify-between">
                <span>Vehicle: {selectedVehicleObj.name}</span>
                <span>{Math.ceil(quantity / selectedVehicleObj.capacity)} Trip(s)</span>
              </div>
            </div>

            {/* Card 4: Estimated Net Return */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-100/70 rounded-3xl p-6 border border-emerald-300 shadow-xs flex flex-col justify-between group hover:border-emerald-500 transition-all">
              <div>
                <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
                  <span>Estimated Net Return</span>
                  <span className="p-2 rounded-xl bg-emerald-500 text-white">💰</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-emerald-950 font-heading">
                  ₹{prediction.estimatedNetReturn ? Number(prediction.estimatedNetReturn).toLocaleString() : '—'}
                </div>
                <div className="text-xs text-emerald-800 mt-2 font-semibold">
                  Gross ₹{prediction.grossCropValue ? Number(prediction.grossCropValue).toLocaleString() : '0'} - Transport ₹{prediction.estimatedTransportCost?.toLocaleString()}
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-emerald-200 text-[11px] text-emerald-900 font-bold flex items-center justify-between">
                <span>Modal Rate: ₹{prediction.cropPricePerQuintal}/Qtl</span>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px]">High Profit</span>
              </div>
            </div>
          </div>

          {/* Interactive Map Visualizer */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-emerald-600" />
                  <span>Interactive Route & Terrain Vector</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visual road path with highway waypoints and real GPS coordinates
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  Provider: {prediction.sourceProvider}
                </span>
                {prediction.googleMapsDirectionsUrl && (
                  <a
                    href={prediction.googleMapsDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <span>Google Maps App</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* SVG Visual Map Canvas */}
            <div className="relative w-full h-64 sm:h-80 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center p-6">
              {/* Decorative grid pattern */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, #10b981 1px, transparent 1px), radial-gradient(circle, #38bdf8 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                  backgroundPosition: '0 0, 16px 16px'
                }}
              />

              {/* Highway Route Arc */}
              <svg className="w-full h-full" viewBox="0 0 800 300" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Road outline path */}
                <path
                  d="M 120 180 Q 300 80, 500 130 T 680 120"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="12"
                  strokeLinecap="round"
                />

                {/* Animated active route polyline */}
                <path
                  d="M 120 180 Q 300 80, 500 130 T 680 120"
                  fill="none"
                  stroke="url(#routeGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="10 6"
                  filter="url(#glow)"
                  className="animate-pulse"
                />

                {/* Intermediate waypoint dots */}
                <circle cx="280" cy="115" r="4" fill="#38bdf8" />
                <circle cx="480" cy="125" r="4" fill="#38bdf8" />
                <circle cx="580" cy="118" r="4" fill="#fbbf24" />

                {/* Source marker */}
                <g transform="translate(120, 180)">
                  <circle r="18" fill="#10b981" fillOpacity="0.2" className="animate-ping" />
                  <circle r="12" fill="#10b981" />
                  <circle r="5" fill="#ffffff" />
                  <text x="0" y="32" textAnchor="middle" fill="#a7f3d0" fontSize="12" fontWeight="bold">
                    🌾 Farm ({prediction.sourceFormatted.split(',')[0]})
                  </text>
                </g>

                {/* Destination marker */}
                <g transform="translate(680, 120)">
                  <circle r="22" fill="#f59e0b" fillOpacity="0.2" className="animate-ping" />
                  <circle r="14" fill="#f59e0b" />
                  <circle r="6" fill="#ffffff" />
                  <text x="0" y="34" textAnchor="middle" fill="#fde68a" fontSize="12" fontWeight="bold">
                    🏢 {prediction.destinationFormatted.split(',')[0]}
                  </text>
                </g>

                {/* Distance Badge on route */}
                <g transform="translate(400, 75)">
                  <rect x="-70" y="-18" width="140" height="32" rx="16" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                  <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">
                    📍 {prediction.distanceFormatted} • {prediction.travelTimeFormatted}
                  </text>
                </g>
              </svg>

              {/* Highway Corridor Overlay Badge */}
              <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-200 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Corridor: {prediction.recommendedRoute}</span>
              </div>
            </div>
          </div>

          {/* Nearby Mandi Intelligence & Comparison Table */}
          {recommendations && recommendations.allMandis?.length > 0 && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <span>Nearby Mandi Intelligence (Price + Distance Matrix)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {recommendations.summary}
                  </p>
                </div>
                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                  Crop: {cropName} ({quantity} Qtl)
                </div>
              </div>

              {/* Responsive Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-y border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Market / Mandi</th>
                      <th className="py-3 px-4">Road Distance</th>
                      <th className="py-3 px-4">Travel Time</th>
                      <th className="py-3 px-4">Agmarknet Price</th>
                      <th className="py-3 px-4">Transport Cost</th>
                      <th className="py-3 px-4 text-right font-black">Est. Net Return</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recommendations.allMandis.map((m: any, idx: number) => {
                      const isTop = m.isRecommended;
                      return (
                        <tr
                          key={m.mandiId || idx}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isTop ? 'bg-emerald-50/60 font-semibold' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {isTop && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold">
                                  ⭐ Recommended
                                </span>
                              )}
                              <div>
                                <div className="font-bold text-slate-900">{m.mandiName}</div>
                                <div className="text-[10px] text-slate-500">
                                  {m.district}, {m.state}
                                </div>
                              </div>
                            </div>
                            {isTop && m.recommendationReason && (
                              <div className="text-[11px] text-emerald-800 font-medium mt-1">
                                💡 {m.recommendationReason}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            {m.distanceKm} km
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {m.travelTimeFormatted}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-emerald-800">
                            ₹{m.cropPrice.toLocaleString()} / Qtl
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            ₹{m.transportCost.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-sm">
                            <span className={isTop ? 'text-emerald-700 text-base' : 'text-slate-900'}>
                              ₹{m.estimatedNetReturn.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setDestinationMandi(m.mandiName);
                                  setIsCustomDest(false);
                                  runPrediction();
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 text-xs font-bold transition-all shadow-2xs"
                              >
                                Select
                              </button>
                              {m.directionsUrl && (
                                <a
                                  href={m.directionsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                                  title="Open Google Maps Directions"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Decision Explanation Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-slate-900 font-heading">
                  AI Agri-Logistics Decision Assistant
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                Grounded Mathematical Model
              </span>
            </div>

            {/* Prompt Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                'Why is this mandi better than closer ones?',
                'Would using a larger truck save me transport money?',
                'What is the breakeven distance for higher prices?'
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => explainWithAi(recommendations?.allMandis, chip)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200/80 transition-all text-left"
                >
                  💬 {chip}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="Ask custom question (e.g., Is it worth traveling to Delhi Azadpur for this batch?)..."
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => explainWithAi(recommendations?.allMandis)}
                disabled={aiLoading}
                className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {aiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Ask AI</span>
              </button>
            </div>

            {/* AI Response Display */}
            {aiExplanation && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/60 to-slate-50 border border-purple-100 text-xs text-slate-800 leading-relaxed space-y-2 whitespace-pre-line">
                {aiExplanation}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prediction History Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-700" />
            <h3 className="text-lg font-bold text-slate-900 font-heading">
              Your Past Prediction History
            </h3>
          </div>
          <span className="text-xs text-slate-500">{history.length} Saved Records</span>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No prediction records saved yet. Run a distance calculation above to start building your logistics history.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Crop</th>
                  <th className="py-2.5 px-4">From → To</th>
                  <th className="py-2.5 px-4">Distance</th>
                  <th className="py-2.5 px-4">Transport Cost</th>
                  <th className="py-2.5 px-4 text-right">Net Return</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500">{item.date}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{item.cropName}</td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-xs">
                      {item.sourceName.split(',')[0]} → {item.destinationName.split(',')[0]}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{item.distanceKm} km</td>
                    <td className="py-3 px-4 text-slate-600">₹{item.transportCost.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-800">
                      ₹{item.estimatedNetReturn.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSourceAddress(item.sourceName);
                            setDestinationMandi(item.destinationName);
                            setCropName(item.cropName);
                            setIsCustomDest(true);
                            setCustomDestination(item.destinationName);
                            window.scrollTo({ top: 120, behavior: 'smooth' });
                          }}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all text-xs"
                          title="Recalculate"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteHistory(item.id)}
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all text-xs"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
