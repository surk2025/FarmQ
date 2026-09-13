import React, { useEffect, useState } from 'react';
import { Gauge, Building2, Users, Clock, CheckCircle2, Settings, Save } from 'lucide-react';
import api from '../../services/api';
import { ProcurementCenter } from '../../types';

export const CenterCapacity: React.FC = () => {
  const [centers, setCenters] = useState<ProcurementCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCenter, setEditingCenter] = useState<ProcurementCenter | null>(null);
  const [editCap, setEditCap] = useState<number>(150);
  const [editCounters, setEditCounters] = useState<number>(3);
  const [editHours, setEditHours] = useState<string>('08:00 AM - 05:00 PM');
  const [editStatus, setEditStatus] = useState<string>('open');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchCenters = async () => {
    try {
      const res = await api.get('/centers');
      setCenters(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCenters();
  }, []);

  const handleOpenEdit = (c: ProcurementCenter) => {
    setEditingCenter(c);
    setEditCap(c.capacityPerDay);
    setEditCounters(c.activeCounters);
    setEditHours(c.operatingHours);
    setEditStatus(c.status);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCenter) return;
    setSaving(true);
    try {
      await api.put(`/admin/centers/${editingCenter.id}/capacity`, {
        capacityPerDay: editCap,
        activeCounters: editCounters,
        operatingHours: editHours,
        status: editStatus
      });
      setSuccess(`Updated capacity settings for ${editingCenter.name}`);
      setEditingCenter(null);
      fetchCenters();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-black text-white font-heading">
          Procurement Center Capacity Management
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Monitor real-time capacity headroom, adjust parallel weighing counters, and rebalance daily intakes.
        </p>
      </div>

      {success && (
        <div className="p-4 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Centers Grid - Section 28 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {centers.map((c) => {
          const util = Math.min(100, Math.round((c.bookedQuantity / c.capacityPerDay) * 100));
          const remaining = Math.max(0, c.capacityPerDay - c.bookedQuantity);

          return (
            <div
              key={c.id}
              className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-white text-base font-heading">{c.name}</h3>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                    c.status === 'open' || c.status === 'low_queue'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {c.status}
                  </span>
                </div>

                {/* Metrics Box */}
                <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Daily Capacity:</span>
                    <span className="font-bold text-white">{c.capacityPerDay} Q</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Booked:</span>
                    <span className="font-semibold text-slate-300">{c.bookedQuantity} Q</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Remaining:</span>
                    <span className="font-bold text-emerald-400">{remaining} Q</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between">
                    <span className="text-slate-400">Utilization:</span>
                    <span className="font-black text-amber-400">{util}%</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full transition-all ${util > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${util}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Active Counters: <strong>{c.activeCounters} parallel bays</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Hours: {c.operatingHours}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenEdit(c)}
                className="mt-6 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configure Center</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingCenter && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-800 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold font-heading">Configure: {editingCenter.name}</h3>
              <button onClick={() => setEditingCenter(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1.5">Daily Intake Capacity (Quintal)</label>
                <input
                  type="number"
                  min="50"
                  step="10"
                  value={editCap}
                  onChange={(e) => setEditCap(parseFloat(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1.5">Number of Active Weighing Counters</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={editCounters}
                  onChange={(e) => setEditCounters(parseInt(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1.5">Operating Hours</label>
                <input
                  type="text"
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1.5">Center Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed / Maintenance</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCenter(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {saving ? 'Updating...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
