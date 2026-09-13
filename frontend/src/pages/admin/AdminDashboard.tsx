import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Hourglass,
  Clock,
  CheckCircle2,
  TrendingUp,
  Scale,
  Building2,
  Play,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Gauge
} from 'lucide-react';
import api from '../../services/api';
import { AdminOverview } from '../../types';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await api.post('/admin/queue/simulate');
      setSimMessage(`Queue advanced! Token #${res.data.completedToken} Completed → Token #${res.data.nowProcessing} Processing.`);
      fetchStats();
      setTimeout(() => setSimMessage(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-400">Loading admin console...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Mandi Operations</span>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-heading mt-1">
            Greenfield Procurement Center Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Live queue monitoring, counter throughput metrics, and daily capacity balancing.
          </p>
        </div>

        {/* Big Viva Simulation Button */}
        <button
          onClick={handleSimulate}
          disabled={simulating}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
          <span>{simulating ? 'Broadcasting Event...' : '⚡ Simulate Queue Update'}</span>
        </button>
      </div>

      {simMessage && (
        <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{simMessage}</span>
        </div>
      )}

      {/* Section 25 Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Today's Farmers */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Today's Farmers</p>
          <div className="text-4xl font-black text-white font-heading mt-2">{stats?.todayFarmers || 128}</div>
          <p className="text-[11px] text-emerald-400 mt-1">Total registered tokens</p>
        </div>

        {/* Waiting */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Waiting</p>
          <div className="text-4xl font-black text-amber-400 font-heading mt-2">{stats?.waiting || 38}</div>
          <p className="text-[11px] text-slate-400 mt-1">In active queue line</p>
        </div>

        {/* Processing */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Processing</p>
          <div className="text-4xl font-black text-blue-400 font-heading mt-2">{stats?.processing || 12}</div>
          <p className="text-[11px] text-slate-400 mt-1">At weighbridge counters</p>
        </div>

        {/* Completed */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Completed</p>
          <div className="text-4xl font-black text-emerald-400 font-heading mt-2">{stats?.completed || 90}</div>
          <p className="text-[11px] text-slate-400 mt-1">Receipts generated</p>
        </div>
      </div>

      {/* Section 25: Secondary Mandi Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold">
            <Hourglass className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">Average Waiting Time</p>
            <p className="text-2xl font-black text-white font-heading">1h 12m</p>
            <p className="text-[11px] text-emerald-400 font-medium">32% lower than season avg</p>
          </div>
        </div>

        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-blue-400 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">Average Processing Time</p>
            <p className="text-2xl font-black text-white font-heading">8 min</p>
            <p className="text-[11px] text-slate-400 font-medium">Per tractor/trolley unloading</p>
          </div>
        </div>

        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">Today's Procurement</p>
            <p className="text-2xl font-black text-white font-heading">1,240 Quintal</p>
            <p className="text-[11px] text-amber-400 font-medium">Wheat MSP intake</p>
          </div>
        </div>
      </div>

      {/* Quick Navigation Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/admin/queue"
          className="p-5 rounded-3xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition-all flex items-center justify-between"
        >
          <div>
            <h3 className="font-bold text-white text-sm">Manage Live Queue</h3>
            <p className="text-xs text-slate-400 mt-1">Start, complete, or reject tokens.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-emerald-400" />
        </Link>

        <Link
          to="/admin/farmers"
          className="p-5 rounded-3xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition-all flex items-center justify-between"
        >
          <div>
            <h3 className="font-bold text-white text-sm">Farmer Directory</h3>
            <p className="text-xs text-slate-400 mt-1">Search and filter crop submissions.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-emerald-400" />
        </Link>

        <Link
          to="/admin/analytics"
          className="p-5 rounded-3xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition-all flex items-center justify-between"
        >
          <div>
            <h3 className="font-bold text-white text-sm">Procurement Analytics</h3>
            <p className="text-xs text-slate-400 mt-1">Interactive Recharts visualizer.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-emerald-400" />
        </Link>
      </div>
    </div>
  );
};
