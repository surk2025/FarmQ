import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { BarChart3, TrendingDown, Users, Scale, Clock, Filter } from 'lucide-react';
import api from '../../services/api';

export const Analytics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'today' | '7days' | '30days'>('7days');

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/analytics?timeframe=${timeframe}`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [timeframe]);

  if (loading || !data) {
    return <div className="py-20 text-center text-slate-400">Loading procurement analytics...</div>;
  }

  const { dailyTrends, centerUtilization, cropDistribution, summary } = data;
  const CROP_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#8b5cf6'];

  return (
    <div className="space-y-8 pb-12">
      {/* Header with Timeframe Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white font-heading">
            Procurement & Queue Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Recharts visualization of farmer arrivals, queue waiting trends, and crop distribution.
          </p>
        </div>

        {/* Filters: Today, 7 days, 30 days */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start sm:self-auto text-xs">
          {(['today', '7days', '30days'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                timeframe === t ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'today' ? 'Today' : t === '7days' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800">
          <p className="text-xs text-slate-400 font-semibold uppercase">Total Farmers Served</p>
          <p className="text-3xl font-black text-white font-heading mt-2">{summary.totalFarmersServed}</p>
          <span className="text-[10px] text-emerald-400">Verified through digital slots</span>
        </div>
        <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800">
          <p className="text-xs text-slate-400 font-semibold uppercase">Total Intake (Quintal)</p>
          <p className="text-3xl font-black text-emerald-400 font-heading mt-2">{summary.totalProcurementQuintals} Q</p>
          <span className="text-[10px] text-slate-400">Government MSP intake</span>
        </div>
        <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800">
          <p className="text-xs text-slate-400 font-semibold uppercase">Avg Waiting Time</p>
          <p className="text-3xl font-black text-amber-400 font-heading mt-2">{summary.systemAvgWaitMinutes}m</p>
          <span className="text-[10px] text-emerald-400 font-medium">32% wait reduction</span>
        </div>
        <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800">
          <p className="text-xs text-slate-400 font-semibold uppercase">Peak Congestion Day</p>
          <p className="text-xl font-bold text-white font-heading mt-3 truncate">{summary.peakWaitDay}</p>
          <span className="text-[10px] text-slate-400">Lowest: {summary.lowestWaitDay}</span>
        </div>
      </div>

      {/* Charts Grid - Section 29 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1: Daily Farmers (Line Chart) */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-white font-heading">1. Daily Farmers Served</h3>
            <p className="text-xs text-slate-400">Daily appointment intake volume</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="farmers" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981' }} name="Farmers" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Procurement Quantity (Bar Chart) */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-white font-heading">2. Procurement Quantity (Quintals)</h3>
            <p className="text-xs text-slate-400">Total daily grain and crop tonnage weighed</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="procurement" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Procured Q" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Waiting Time (Line Chart) */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-white font-heading">3. Average Queue Waiting Time (Minutes)</h3>
            <p className="text-xs text-slate-400">Duration from mandi arrival to weighbridge clearance</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="avgWait" stroke="#f59e0b" strokeWidth={3} dot={{ r: 5, fill: '#f59e0b' }} name="Avg Wait (min)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Center Utilization (Bar Chart) */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-white font-heading">4. Mandi Center Capacity Utilization (%)</h3>
            <p className="text-xs text-slate-400">Intake capacity saturation by center</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={centerUtilization}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="centerName" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="utilizationPercent" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Utilization %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Crop Distribution (Donut Chart) */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4 lg:col-span-2">
          <div>
            <h3 className="text-base font-bold text-white font-heading">5. Crop Procurement Distribution</h3>
            <p className="text-xs text-slate-400">Share of harvest intake volume across commodities</p>
          </div>
          <div className="h-72 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                <Pie
                  data={cropDistribution}
                  dataKey="quantity"
                  nameKey="cropName"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={5}
                >
                  {cropDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill || CROP_COLORS[index % CROP_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
